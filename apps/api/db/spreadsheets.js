import XLSX from 'xlsx'
import supabase from './supabaseClient.js'

const pad2 = (value) => String(value).padStart(2, '0')

const normalizeHeader = (value) => (
  typeof value === 'string' ? value.trim().toLowerCase() : ''
)

const getCaseInsensitive = (row, key) => {
  const target = normalizeHeader(key)
  for (const [k, v] of Object.entries(row)) {
    if (normalizeHeader(k) === target) return v
  }
  return null
}

const normalizeDateString = (value) => {
  if (!value || typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null

  const isoDateTime = trimmed.match(/^(\d{4}-\d{2}-\d{2})[ T].+$/)
  if (isoDateTime) return isoDateTime[1]

  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) return trimmed

  const mdy = trimmed.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/)
  if (mdy) {
    let [, month, day, year] = mdy
    if (year.length === 2) year = `20${year}`
    return `${year}-${pad2(month)}-${pad2(day)}`
  }

  const parsed = new Date(trimmed)
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10)

  return null
}

const normalizeDate = (value) => {
  if (!value) return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value)
    if (parsed) return `${parsed.y}-${pad2(parsed.m)}-${pad2(parsed.d)}`
  }
  if (typeof value === 'string') return normalizeDateString(value)
  return null
}

const normalizeRow = (row, index) => {
  const dateValue = getCaseInsensitive(row, 'date')
  const trackingValue = getCaseInsensitive(row, 'tracking')
  const upcValue = getCaseInsensitive(row, 'upc')
  const qtyValue = getCaseInsensitive(row, 'qty')

  const date = normalizeDate(dateValue)
  if (!date) throw new Error(`Row ${index + 2}: invalid date`)

  const tracking_number = String(trackingValue ?? '').trim()
  if (!tracking_number) throw new Error(`Row ${index + 2}: missing tracking number`)

  const upc = String(upcValue ?? '').trim()
  if (!upc) throw new Error(`Row ${index + 2}: missing upc`)

  const quantity = Number.parseInt(qtyValue, 10)
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error(`Row ${index + 2}: invalid quantity`)
  }

  return {
    date,
    tracking_number,
    upc,
    quantity
  }
}

const chunk = (items, size) => {
  const out = []
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size))
  }
  return out
}

export const insertSpreadsheetImport = async ({
  month,
  sourceName,
  sheetRows
}) => {
  if (!month) throw new Error('month is required')
  if (!Array.isArray(sheetRows)) throw new Error('sheetRows must be an array')

  const normalizedRows = sheetRows.map((row, index) => normalizeRow(row, index))

  const { data: spreadsheet, error: spreadsheetError } = await supabase
    .from('spreadsheets')
    .insert({
      month,
      source_name: sourceName ?? null
    })
    .select('id')
    .single()

  if (spreadsheetError) {
    throw new Error(`Failed to insert spreadsheet: ${spreadsheetError.message}`)
  }

  const rowsWithId = normalizedRows.map((row) => ({
    spreadsheet_id: spreadsheet.id,
    ...row
  }))

  const chunks = chunk(rowsWithId, 500)
  for (const rows of chunks) {
    const { error } = await supabase
      .from('spreadsheet_rows')
      .insert(rows)

    if (error) {
      throw new Error(`Failed to insert spreadsheet rows: ${error.message}`)
    }
  }

  return {
    spreadsheetId: spreadsheet.id,
    rowCount: rowsWithId.length
  }
}
