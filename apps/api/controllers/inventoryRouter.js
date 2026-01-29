import express from 'express'
import supabase from '../db/supabaseClient.js'
import { deleteSpreadsheetImportByMonth } from '../db/spreadsheets.js'

const inventoryRouter = express.Router()

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

inventoryRouter.get('/spreadsheets', async (request, response) => {
  try {
    const { data, error } = await supabase
      .from('spreadsheets')
      .select('*')

    if (error) {
      return response.status(500).json({ error: error.message })
    }

    return response.json(data ?? [])
  } catch (error) {
    return response.status(500).json({ error: error.message })
  }
})

inventoryRouter.get('/spreadsheet_rows', async (request, response) => {
  try {
    const { data, error } = await supabase
      .from('spreadsheet_rows')
      .select('*')

    if (error) {
      return response.status(500).json({ error: error.message })
    }

    return response.json(data ?? [])
  } catch (error) {
    return response.status(500).json({ error: error.message })
  }
})

inventoryRouter.delete('/:year/:month', async (request, response) => {
  const { year, month } = request.params
  const { monthStart, error } = parseYearMonth(year, month)
  if (error) {
    return response.status(400).send({ error })
  }

  try {
    const result = await deleteSpreadsheetImportByMonth({ month: monthStart })
    return response.status(200).send(result)
  } catch (error) {
    return response.status(400).send({ error: error.message })
  }
})

export default inventoryRouter
