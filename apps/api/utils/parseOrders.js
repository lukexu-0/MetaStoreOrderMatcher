import XLSX from 'xlsx'

function sniffSpreadsheet(buffer) {
  if (buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b) return "xlsx";

  if (
    buffer.length >= 8 &&
    buffer[0] === 0xd0 && buffer[1] === 0xcf && buffer[2] === 0x11 && buffer[3] === 0xe0 &&
    buffer[4] === 0xa1 && buffer[5] === 0xb1 && buffer[6] === 0x1a && buffer[7] === 0xe1
  ) return "xls";

  const head = buffer.slice(0, 4096).toString("utf8").trimStart().toLowerCase();
  if (head.startsWith("<!doctype html") || head.startsWith("<html") || head.includes("<table")) return "html";

  return "unknown";
}

const normalizeHeader = (value) => (
  typeof value === "string" ? value.trim().toLowerCase() : ""
)

const getIndex = (array, value) => {
  const target = normalizeHeader(value)
  return array.findIndex((header) => normalizeHeader(header) === target)
}

const parseOrders = (fileBuffer, opts = {}) => {
  if (!fileBuffer || !Buffer.isBuffer(fileBuffer)){
    throw new Error('parseOrders: filebuffer must be a buffer')
  }

  const kind = sniffSpreadsheet(fileBuffer)

  let workbook;

  if (kind === "xlsx" || kind === "xls") {
    // ArrayBuffer-style parsing is safest for buffers
    workbook = XLSX.read(fileBuffer, { type: "buffer" });
  }
  else if (kind === "html") {
    const html = fileBuffer.toString("utf8");
    workbook = XLSX.read(html, { type: "string" }); // parses HTML tables
  }
  else {
    throw new Error("Unrecognized spreadsheet content")  
  }

  const sheetName = workbook.SheetNames[0]
  if (!sheetName) {
    throw new Error("No sheets found in spreadsheet")
  }
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) {
    throw new Error("Unable to read first sheet")
  }

  const headerRow = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    range: 0,
    raw: true
  })[0]
  if (!headerRow || headerRow.length === 0) {
    throw new Error("Missing header row")
  }

  const dateIdx = getIndex(headerRow, 'date')
  const trackingIdx = getIndex(headerRow, 'tracking')
  const upcIdx = getIndex(headerRow, 'upc')
  const qtyIdx = getIndex(headerRow, 'qty')

  const colIndices = [dateIdx, trackingIdx, upcIdx, qtyIdx]
  const missing = [
    dateIdx === -1 ? "date" : null,
    trackingIdx === -1 ? "tracking" : null,
    upcIdx === -1 ? "upc" : null,
    qtyIdx === -1 ? "qty" : null,
  ].filter(Boolean)
  if (missing.length > 0) {
    throw new Error(`Missing required columns: ${missing.join(", ")}`)
  }

  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    blankrows:false,
    raw: true
  })

  const out = []
  
  for (let i = 1; i < rows.length; i++){
    const row = rows[i]
    const obj = {}
    for (let j = 0; j < colIndices.length; j++){
      const colIndex = colIndices[j]
      const key = headerRow[colIndex]
      obj[key] = row[colIndex]
    }
    out.push(obj)
  }
  return out
}

export default parseOrders