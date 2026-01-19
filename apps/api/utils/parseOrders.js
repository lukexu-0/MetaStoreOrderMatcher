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

const getIndex = (array, value) => {
  const idx = array.findIndex(
  h => typeof h === "string" && h.toLowerCase() === value
  )
  return idx

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
  const sheet = workbook.Sheets[sheetName]

  const headerRow = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    range: 0,
    raw: true
  })[0]

  const dateIdx = getIndex(headerRow, 'date')
  const trackingIdx = getIndex(headerRow, 'tracking')
  const upcIdx = getIndex(headerRow, 'upc')
  const qtyIdx = getIndex(headerRow, 'qty')

  const colIndices = [dateIdx, trackingIdx, upcIdx, qtyIdx]

  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    blankrows:false,
    raw: true
  })

  const cutRows = rows.map(row => row.filter((_, index) => colIndices.includes(index)))

  const out = []
  
  for (let i = 1; i < cutRows.length; i++){
    const row = cutRows[i]
    const obj = {}
    for (let j = 0; j < row.length; j++){
      const key = cutRows[0][j]
      obj[key] = cutRows[i][j]
    }
    out.push(obj)
  }
  return out
}