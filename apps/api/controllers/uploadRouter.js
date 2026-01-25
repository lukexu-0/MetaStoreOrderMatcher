import express from 'express'
import uploadMiddleware from '../middleware/uploadMiddleware.js'
import parseOrders from '../utils/parseOrders.js'
import { insertSpreadsheetImport } from '../db/spreadsheets.js'

const uploadRouter = express.Router()

uploadRouter.post('/:year/:month', uploadMiddleware.single('file'), async (request, response) => {
  const { year, month } = request.params

  if (!request.file) {
    return response.status(400).send({ error: 'missing file' })
  }

  const yearNum = Number.parseInt(year, 10)
  const monthNum = Number.parseInt(month, 10)
  if (!Number.isFinite(yearNum) || yearNum < 2000 || yearNum > 2100) {
    return response.status(400).send({ error: 'invalid year' })
  }
  if (!Number.isFinite(monthNum) || monthNum < 1 || monthNum > 12) {
    return response.status(400).send({ error: 'invalid month' })
  }

  const monthStart = `${yearNum}-${String(monthNum).padStart(2, '0')}-01`

  try {
    const sheetObjs = parseOrders(request.file.buffer)
    const result = await insertSpreadsheetImport({
      month: monthStart,
      sourceName: request.file.originalname,
      sheetRows: sheetObjs
    })

    return response.status(201).send(result)
  } catch (error) {
    return response.status(400).send({ error: error.message })
  }
})

export default uploadRouter
