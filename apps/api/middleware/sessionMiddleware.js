import session from 'express-session'
import config from '../utils/config.js'

const SESSION_SECRET = config.SESSION_SECRET

const sessionMiddleware = session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: {
    httpOnly: true,
    sameSite: "lax"
  },
})

export default sessionMiddleware