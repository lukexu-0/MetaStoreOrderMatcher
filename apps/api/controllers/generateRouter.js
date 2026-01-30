import express from 'express'
import XLSX from 'xlsx'
import { generateOrderComparisonWorkbook } from '../db/generateSpreadsheet.js'

const generateRouter = express.Router()

generateRouter.post('/', async (request, response) => {
  if (!request.session.user) {
    return response.status(401).json({ error: 'not logged in' })
  }

  const {
    emailStart,
    emailEnd,
    receiptStart,
    receiptEnd
  } = request.body ?? {}

  try {
    const { workbook } = await generateOrderComparisonWorkbook({
      userId: request.session.user.id,
      emailStart,
      emailEnd,
      receiptStart,
      receiptEnd
    })

    const buffer = XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
      cellStyles: true
    })
    const filename = `order_match_${emailStart}_to_${emailEnd}.xlsx`

    response.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    response.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    return response.status(200).send(buffer)
  } catch (error) {
    return response.status(400).json({ error: error.message })
  }
})

export default generateRouter
