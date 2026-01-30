import express from 'express'
import { syncGmailOrderEmails, getLatestGmailOrderEmailDate } from '../db/gmailOrders.js'
import { GMAIL_FROM_ADDRESS } from '../utils/config.js'

const syncRouter = express.Router()

syncRouter.post('/gmail', async (request, response) => {
  if (!request.session.user) {
    return response.status(401).json({ error: 'not logged in' })
  }

  const google = request.session.google
  if (!google?.accessToken) {
    return response.status(400).json({ error: 'missing google session' })
  }

  try {
    const loggedInEmail = request.session.user?.email?.toLowerCase()
    const targetEmail = GMAIL_FROM_ADDRESS?.toLowerCase()
    const fromFilterOverride = targetEmail && loggedInEmail === targetEmail
      ? `from:${GMAIL_FROM_ADDRESS}`
      : ''

    const result = await syncGmailOrderEmails({
      userId: request.session.user.id,
      accessToken: google.accessToken,
      refreshToken: google.refreshToken,
      expiresAt: google.expiresAt,
      fromFilter: fromFilterOverride
    })

    if (result.refreshed) {
      request.session.google.accessToken = result.accessToken
      request.session.google.expiresAt = result.expiresAt
    }

    return response.status(200).json({ ok: true, ...result })
  } catch (error) {
    return response.status(500).json({ error: error.message })
  }
})

syncRouter.get('/gmail/status', async (request, response) => {
  if (!request.session.user) {
    return response.status(401).json({ error: 'not logged in' })
  }

  try {
    const lastUpdated = await getLatestGmailOrderEmailDate(request.session.user.id)
    return response.status(200).json({ ok: true, lastUpdated })
  } catch (error) {
    return response.status(500).json({ error: error.message })
  }
})

export default syncRouter
