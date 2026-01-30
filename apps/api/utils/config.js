import dotenv from 'dotenv'

dotenv.config()

const PORT = process.env.PORT

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET

const SESSION_SECRET = process.env.SESSION_SECRET

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const FRONTEND_URL = process.env.NODE_ENV === 'development'
  ? process.env.FRONTEND_URL_DEV
  : process.env.FRONTEND_URL_PROD
const BACKEND_URL = process.env.NODE_ENV === 'development'
  ? process.env.BACKEND_URL_DEV
  : process.env.BACKEND_URL_PROD

export {
  PORT,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  SESSION_SECRET,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  FRONTEND_URL,
  BACKEND_URL
}

export default {
  PORT,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  SESSION_SECRET,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  FRONTEND_URL,
  BACKEND_URL
}
