import XLSX from 'xlsx'
import supabase from './supabaseClient.js'

const EMAIL_SHEET_NAME = 'Emails'
const ORDER_SHEET_NAME = 'Orders'

const pad2 = (value) => String(value).padStart(2, '0')

const parseDateInput = (value, label) => {
  if (typeof value !== 'string') throw new Error(`${label} is required`)
  const trimmed = value.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new Error(`${label} must be YYYY-MM-DD`)
  }
  const [year, month, day] = trimmed.split('-').map((part) => Number.parseInt(part, 10))
  const date = new Date(Date.UTC(year, month - 1, day))
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${label} is invalid`)
  }
  return { year, month, day }
}

const parseMonthInput = (value, label) => {
  if (typeof value !== 'string') throw new Error(`${label} is required`)
  const trimmed = value.trim()
  if (!/^\d{4}-\d{2}$/.test(trimmed)) {
    throw new Error(`${label} must be YYYY-MM`)
  }
  const [year, month] = trimmed.split('-').map((part) => Number.parseInt(part, 10))
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    throw new Error(`${label} is invalid`)
  }
  return { year, month }
}

const toUtcIso = (year, month, day) => (
  new Date(Date.UTC(year, month - 1, day)).toISOString()
)

const addDaysUtc = (year, month, day, days) => {
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() + days)
  return date
}

const normalizeEmailDate = (value) => {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toISOString().slice(0, 10)
}

const normalizeSheetDate = (value) => {
  if (!value) return ''
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }
  const trimmed = String(value).trim()
  if (!trimmed) return ''
  return trimmed
}

const statusStyles = {
  MATCH: {
    fill: { patternType: 'solid', fgColor: { rgb: 'C6EFCE' } },
    font: { color: { rgb: '006100' } }
  },
  OVERCOUNT: {
    fill: { patternType: 'solid', fgColor: { rgb: 'F4B084' } },
    font: { color: { rgb: '7F2100' } }
  },
  MISSING: {
    fill: { patternType: 'solid', fgColor: { rgb: 'FFC7CE' } },
    font: { color: { rgb: '9C0006' } }
  },
  MISMATCH: {
    fill: { patternType: 'solid', fgColor: { rgb: 'FFEB9C' } },
    font: { color: { rgb: '9C6500' } }
  }
}

const fetchEmailRows = async ({ userId, emailStart, emailEnd }) => {
  const startDate = parseDateInput(emailStart, 'emailStart')
  const endDate = parseDateInput(emailEnd, 'emailEnd')
  const startMs = Date.UTC(startDate.year, startDate.month - 1, startDate.day)
  const endMs = Date.UTC(endDate.year, endDate.month - 1, endDate.day)
  if (startMs > endMs) {
    throw new Error('emailStart must be on or before emailEnd')
  }
  const startIso = toUtcIso(startDate.year, startDate.month, startDate.day)
  const endExclusive = addDaysUtc(endDate.year, endDate.month, endDate.day, 1).toISOString()

  const { data, error } = await supabase
    .from('gmail_order_emails')
    .select('email_date, tracking_number, quantity')
    .eq('user_id', userId)
    .gte('email_date', startIso)
    .lt('email_date', endExclusive)
    .order('email_date', { ascending: true })

  if (error) {
    throw new Error(`Failed to load email orders: ${error.message}`)
  }

  return (data ?? []).map((row) => ({
    email_date: normalizeEmailDate(row.email_date),
    tracking_number: row.tracking_number ?? '',
    quantity: Number.parseInt(row.quantity, 10) || 0
  }))
}

const fetchSpreadsheetRows = async ({ startMonth, endMonth }) => {
  const start = parseMonthInput(startMonth, 'receiptStart')
  const end = parseMonthInput(endMonth, 'receiptEnd')
  const startValue = start.year * 100 + start.month
  const endValue = end.year * 100 + end.month
  if (startValue > endValue) {
    throw new Error('receiptStart must be on or before receiptEnd')
  }

  const startMonthValue = `${start.year}-${pad2(start.month)}-01`
  const endMonthValue = `${end.year}-${pad2(end.month)}-01`

  const { data, error } = await supabase
    .from('spreadsheets')
    .select('id, month, spreadsheet_rows(date, tracking_number, quantity)')
    .gte('month', startMonthValue)
    .lte('month', endMonthValue)
    .order('month', { ascending: true })

  if (error) {
    throw new Error(`Failed to load spreadsheet orders: ${error.message}`)
  }

  const rows = []
  for (const sheet of data ?? []) {
    for (const row of sheet.spreadsheet_rows ?? []) {
      rows.push({
        date: normalizeSheetDate(row.date),
        tracking_number: row.tracking_number ?? '',
        quantity: Number.parseInt(row.quantity, 10) || 0
      })
    }
  }

  return rows
}

const buildTotalsByTracking = (rows) => {
  const totals = new Map()
  for (const row of rows) {
    const tracking = row.tracking_number
    if (!tracking) continue
    totals.set(tracking, (totals.get(tracking) || 0) + (row.quantity || 0))
  }
  return totals
}

const buildStatusFormula = (rowNumber) => {
  const trackingCell = `B${rowNumber}`
  const qtyCell = `C${rowNumber}`
  const sumif = `SUMIF(${ORDER_SHEET_NAME}!B:B,${trackingCell},${ORDER_SHEET_NAME}!C:C)`
  return `IF(${sumif}=0,"MISSING",IF(${qtyCell}=${sumif},"MATCH",IF(${qtyCell}>${sumif},"OVERCOUNT","MISMATCH")))`
}

const computeStatus = (emailQty, orderTotal) => {
  if (!orderTotal) return 'MISSING'
  if (emailQty === orderTotal) return 'MATCH'
  if (emailQty > orderTotal) return 'OVERCOUNT'
  return 'MISMATCH'
}

export const generateOrderComparisonWorkbook = async ({
  userId,
  emailStart,
  emailEnd,
  receiptStart,
  receiptEnd
}) => {
  const emailRows = await fetchEmailRows({ userId, emailStart, emailEnd })
  const orderRows = await fetchSpreadsheetRows({
    startMonth: receiptStart,
    endMonth: receiptEnd
  })

  const totalsByTracking = buildTotalsByTracking(orderRows)

  const emailData = [
    ['Email Date', 'Tracking Number', 'Quantity', 'Status']
  ]
  for (const row of emailRows) {
    emailData.push([row.email_date, row.tracking_number, row.quantity, ''])
  }

  const orderData = [
    ['Date', 'Tracking Number', 'Quantity']
  ]
  for (const row of orderRows) {
    orderData.push([row.date, row.tracking_number, row.quantity])
  }

  const emailSheet = XLSX.utils.aoa_to_sheet(emailData)
  const orderSheet = XLSX.utils.aoa_to_sheet(orderData)

  for (let i = 0; i < emailRows.length; i++) {
    const rowNumber = i + 2
    const status = computeStatus(
      emailRows[i].quantity,
      totalsByTracking.get(emailRows[i].tracking_number) || 0
    )
    const cellAddress = XLSX.utils.encode_cell({ r: rowNumber - 1, c: 3 })
    emailSheet[cellAddress] = {
      t: 's',
      f: buildStatusFormula(rowNumber),
      v: status,
      s: statusStyles[status]
    }
  }

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, emailSheet, EMAIL_SHEET_NAME)
  XLSX.utils.book_append_sheet(workbook, orderSheet, ORDER_SHEET_NAME)

  return { workbook, emailCount: emailRows.length, orderCount: orderRows.length }
}
