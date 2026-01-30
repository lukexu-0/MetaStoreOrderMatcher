import supabase from './supabaseClient.js'
import { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } from '../utils/config.js'

const GMAIL_BASE_URL = 'https://gmail.googleapis.com/gmail/v1/users/me'
const GMAIL_TOKEN_URL = 'https://oauth2.googleapis.com/token'

const DEFAULT_FROM_FILTER = 'from:store@email.meta.com'
const DEFAULT_SUBJECT_QUERY = 'subject:"Your order #" "is on the way"'
const DEFAULT_START_MS = Date.UTC(2024, 0, 1)

const pad2 = (value) => String(value).padStart(2, '0')

const formatDateForQuery = (ms) => {
  const date = new Date(ms)
  return `${date.getUTCFullYear()}/${pad2(date.getUTCMonth() + 1)}/${pad2(date.getUTCDate())}`
}

const buildQuery = ({ fromFilter, startMs, endMs, incrementalAfterMs }) => {
  const baseAfter = `after:${formatDateForQuery(startMs - 86400000)}`
  const baseBefore = `before:${formatDateForQuery(endMs)}`
  let query = `${DEFAULT_SUBJECT_QUERY} ${fromFilter} `
  if (incrementalAfterMs && incrementalAfterMs > startMs) {
    query += `after:${formatDateForQuery(incrementalAfterMs)} `
  } else {
    query += `${baseAfter} `
  }
  query += baseBefore
  return query.trim()
}

const isTokenExpired = (expiresAt) => {
  if (!expiresAt) return true
  const now = Math.floor(Date.now() / 1000)
  return now >= Number(expiresAt) - 60
}

const refreshAccessToken = async (refreshToken) => {
  if (!refreshToken) {
    throw new Error('Missing refresh token for Gmail API refresh')
  }
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error('Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET')
  }

  const body = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: 'refresh_token'
  })

  const response = await fetch(GMAIL_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Failed to refresh Gmail token: ${response.status} ${text}`)
  }

  const data = await response.json()
  const expiresAt = Math.floor(Date.now() / 1000) + Number(data.expires_in || 0)
  return {
    accessToken: data.access_token,
    expiresAt
  }
}

const ensureAccessToken = async ({ accessToken, refreshToken, expiresAt }) => {
  if (!accessToken || isTokenExpired(expiresAt)) {
    const refreshed = await refreshAccessToken(refreshToken)
    return { ...refreshed, refreshed: true }
  }
  return { accessToken, expiresAt, refreshed: false }
}

const gmailFetch = async (accessToken, url, { method = 'GET', body } = {}) => {
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Gmail API error ${response.status}: ${text}`)
  }

  return response.json()
}

const listAllMessageIds = async (accessToken, query) => {
  const messageIds = []
  let pageToken
  do {
    const params = new URLSearchParams({
      q: query,
      maxResults: '500'
    })
    if (pageToken) params.set('pageToken', pageToken)
    const data = await gmailFetch(
      accessToken,
      `${GMAIL_BASE_URL}/messages?${params.toString()}`
    )
    if (data.messages && data.messages.length) {
      for (const message of data.messages) {
        if (message?.id) messageIds.push(message.id)
      }
    }
    pageToken = data.nextPageToken
  } while (pageToken)
  return messageIds
}

const getMessageMetadata = async (accessToken, messageId) => {
  const params = new URLSearchParams({
    format: 'metadata',
    metadataHeaders: 'Subject',
  })
  params.append('metadataHeaders', 'Date')
  return gmailFetch(accessToken, `${GMAIL_BASE_URL}/messages/${messageId}?${params.toString()}`)
}

const getMessageFull = async (accessToken, messageId) => (
  gmailFetch(accessToken, `${GMAIL_BASE_URL}/messages/${messageId}?format=full`)
)

const getAttachment = async (accessToken, messageId, attachmentId) => (
  gmailFetch(accessToken, `${GMAIL_BASE_URL}/messages/${messageId}/attachments/${attachmentId}`)
)

const getHeaderValue = (headers, name) => {
  if (!headers || !headers.length) return ''
  const target = name.toLowerCase()
  for (const header of headers) {
    if ((header.name || '').toLowerCase() === target) {
      return header.value || ''
    }
  }
  return ''
}

const isTargetSubject = (subject) => {
  if (!subject) return false
  const normalized = subject.trim()
  return /^Your order #\d+ is on the way$/.test(normalized)
}

const isWithinDateRange = (internalDate, startMs, endMs) => {
  if (!internalDate) return false
  const ms = Number(internalDate)
  return ms >= startMs && ms < endMs
}

const decodeGmailBodyData = (data) => {
  if (data == null) return ''
  if (typeof data !== 'string') return ''
  const b64 = data.replace(/-/g, '+').replace(/_/g, '/')
  const padded = b64 + '==='.slice((b64.length + 3) % 4)
  return Buffer.from(padded, 'base64').toString('utf8')
}

const findFirstPartByMimeType = (part, targetMimeType) => {
  if (!part) return null
  if ((part.mimeType || '').toLowerCase() === targetMimeType.toLowerCase()) {
    return part
  }
  if (Array.isArray(part.parts)) {
    for (const child of part.parts) {
      const found = findFirstPartByMimeType(child, targetMimeType)
      if (found) return found
    }
  }
  return null
}

const getBodyFromPart = async (accessToken, messageId, part) => {
  if (!part || !part.body) return ''

  if (part.body.data != null) {
    const decoded = decodeGmailBodyData(part.body.data)
    if (decoded) return decoded
  }

  if (typeof part.body.attachmentId === 'string' && part.body.attachmentId) {
    const attachment = await getAttachment(accessToken, messageId, part.body.attachmentId)
    if (attachment?.data != null) {
      const decoded = decodeGmailBodyData(attachment.data)
      if (decoded) return decoded
    }
  }

  return ''
}

const getHtmlOrTextBody = async (accessToken, messageId, payload) => {
  const htmlPart = findFirstPartByMimeType(payload, 'text/html')
  const htmlBody = await getBodyFromPart(accessToken, messageId, htmlPart)
  if (htmlBody) return htmlBody

  const textPart = findFirstPartByMimeType(payload, 'text/plain')
  const textBody = await getBodyFromPart(accessToken, messageId, textPart)
  if (textBody) return textBody

  return getBodyFromPart(accessToken, messageId, payload)
}

const extractTrackingNumber = (html) => {
  if (!html) return ''
  const match = html.match(/trackNums=([A-Za-z0-9]+)/)
  return match ? match[1] : ''
}

const sum = (values) => values.reduce((total, value) => total + value, 0)

const dedupeIfRepeated = (values) => {
  if (values.length % 2 !== 0) return values
  const half = values.length / 2
  const first = values.slice(0, half).join(',')
  const second = values.slice(half).join(',')
  return first === second ? values.slice(half) : values
}

const extractTotalQuantity = (html) => {
  if (!html) return 0

  const divRegex = /<div[^>]*>\s*Quantity:\s*(\d+)\s*<\/div>/gi
  const quantities = []
  let match
  while ((match = divRegex.exec(html)) !== null) {
    quantities.push(Number.parseInt(match[1], 10))
  }
  if (quantities.length) return sum(quantities)

  const fallbackRegex = /Quantity:\s*(\d+)/gi
  const fallback = []
  while ((match = fallbackRegex.exec(html)) !== null) {
    fallback.push(Number.parseInt(match[1], 10))
  }
  if (!fallback.length) return 0

  return sum(dedupeIfRepeated(fallback))
}

const chunk = (items, size) => {
  const out = []
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size))
  }
  return out
}

const getLatestProcessedMs = async (userId) => {
  const { data, error } = await supabase
    .from('gmail_order_emails')
    .select('email_date')
    .eq('user_id', userId)
    .order('email_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load latest gmail email date: ${error.message}`)
  }

  if (!data?.email_date) return 0
  const ms = Date.parse(data.email_date)
  return Number.isNaN(ms) ? 0 : ms
}

export const getLatestGmailOrderEmailDate = async (userId) => {
  const { data, error } = await supabase
    .from('gmail_order_emails')
    .select('email_date')
    .eq('user_id', userId)
    .order('email_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load latest gmail email date: ${error.message}`)
  }

  return data?.email_date ?? null
}

const fetchExistingMessageIds = async (userId, messageIds) => {
  if (!messageIds.length) return new Set()
  const existing = new Set()
  const chunks = chunk(messageIds, 500)
  for (const ids of chunks) {
    const { data, error } = await supabase
      .from('gmail_order_emails')
      .select('email_id')
      .eq('user_id', userId)
      .in('email_id', ids)

    if (error) {
      throw new Error(`Failed to check existing gmail emails: ${error.message}`)
    }
    for (const row of data || []) {
      if (row?.email_id) existing.add(row.email_id)
    }
  }
  return existing
}

const insertGmailOrderEmails = async (rows) => {
  if (!rows.length) return 0
  const chunks = chunk(rows, 500)
  let inserted = 0
  for (const chunkRows of chunks) {
    const { error, count } = await supabase
      .from('gmail_order_emails')
      .upsert(chunkRows, {
        onConflict: 'user_id,email_id',
        ignoreDuplicates: true
      })
    if (error) {
      throw new Error(`Failed to insert gmail order emails: ${error.message}`)
    }
    if (typeof count === 'number') {
      inserted += count
    } else {
      inserted += chunkRows.length
    }
  }
  return inserted
}

export const syncGmailOrderEmails = async ({
  userId,
  accessToken,
  refreshToken,
  expiresAt,
  startMs = DEFAULT_START_MS,
  endMs = Date.now() + 86400000,
  fromFilter = DEFAULT_FROM_FILTER,
  incrementalAfterMs
}) => {
  if (!userId) throw new Error('syncGmailOrderEmails: userId is required')

  const tokenState = await ensureAccessToken({ accessToken, refreshToken, expiresAt })
  const effectiveIncrementalAfterMs = (
    typeof incrementalAfterMs === 'number' ? incrementalAfterMs : await getLatestProcessedMs(userId)
  )
  const query = buildQuery({
    fromFilter,
    startMs,
    endMs,
    incrementalAfterMs: effectiveIncrementalAfterMs
  })

  const messageIds = await listAllMessageIds(tokenState.accessToken, query)
  const existingIds = await fetchExistingMessageIds(userId, messageIds)

  const rows = []
  let processed = 0

  for (const messageId of messageIds) {
    if (existingIds.has(messageId)) continue

    const metadata = await getMessageMetadata(tokenState.accessToken, messageId)
    const internalMs = Number(metadata.internalDate)
    const subject = getHeaderValue(metadata?.payload?.headers, 'Subject')

    if (!isTargetSubject(subject)) continue
    if (!isWithinDateRange(internalMs, startMs, endMs)) continue

    const full = await getMessageFull(tokenState.accessToken, messageId)
    const body = await getHtmlOrTextBody(tokenState.accessToken, messageId, full.payload)

    rows.push({
      user_id: userId,
      email_id: messageId,
      email_date: new Date(internalMs).toISOString(),
      tracking_number: extractTrackingNumber(body),
      quantity: extractTotalQuantity(body)
    })
    processed += 1
  }

  const inserted = await insertGmailOrderEmails(rows)

  return {
    query,
    messageCount: messageIds.length,
    processedCount: processed,
    insertedCount: inserted,
    refreshed: tokenState.refreshed,
    accessToken: tokenState.accessToken,
    expiresAt: tokenState.expiresAt
  }
}
