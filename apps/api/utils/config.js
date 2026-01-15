import dotenv from 'dotenv'

dotenv.config()

const PORT = process.env.PORT

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET

const SESSION_SECRET = process.env.SESSION_SECRET

const FRONTEND_URL = process.env.NODE_ENV === 'development'
  ? process.env.FRONTEND_URL_DEV
  : null
const BACKEND_URL = process.env.NODE_ENV === 'development'
  ? process.env.BACKEND_URL_DEV
  : null

export {
  PORT,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  SESSION_SECRET,
  FRONTEND_URL,
  BACKEND_URL
}

export default {
  PORT,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  SESSION_SECRET,
  FRONTEND_URL,
  BACKEND_URL
}
