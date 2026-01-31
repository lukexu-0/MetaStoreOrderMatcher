import express from 'express'
import uploadMiddleware from '../middleware/uploadMiddleware.js'
import parseOrders from '../utils/parseOrders.js'
import { insertSpreadsheetImport } from '../db/spreadsheets.js'

const uploadRouter = express.Router()

const parseYearMonth = (year, month) => {
  const yearNum = Number.parseInt(year, 10)
  if (!Number.isFinite(yearNum) || yearNum < 2000 || yearNum > 2100) {
    return { error: 'invalid year' }
  }

  const monthNum = Number.parseInt(month, 10)
  if (!Number.isFinite(monthNum) || monthNum < 1 || monthNum > 12) {
    return { error: 'invalid month' }
  }

  return {
    yearNum,
    monthNum,
    monthStart: `${yearNum}-${String(monthNum).padStart(2, '0')}-01`
  }
}

uploadRouter.post('/:year/:month', uploadMiddleware.single('file'), async (request, response) => {
  const { year, month } = request.params

  if (!request.session.user) {
    return response.status(401).send({ error: 'not logged in' })
  }

  if (!request.file) {
    return response.status(400).send({ error: 'missing file' })
  }

  const { monthStart, error } = parseYearMonth(year, month)
  if (error) {
    return response.status(400).send({ error })
  }

  try {
    const sheetObjs = parseOrders(request.file.buffer)
    const result = await insertSpreadsheetImport({
      userId: request.session.user.id,
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
