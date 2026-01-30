import session from 'express-session'
import config from '../utils/config.js'

const SESSION_SECRET = config.SESSION_SECRET

const sessionMiddleware = session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: {
    httpOnly: true,
    sameSite: config.NODE_ENV === 'production' ? 'none' : 'lax',
    secure: config.NODE_ENV === 'production'
  },
})

export default sessionMiddleware
