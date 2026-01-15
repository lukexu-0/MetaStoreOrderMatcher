import express from "express"
import sessionMiddleware from "./middleware/sessionMiddleware.js"
import authRouter from "./controllers/authRouter.js"
import loginCheckRouter from "./controllers/loginCheckRouter.js"

const app = express()

app.use(express.json())
app.use(sessionMiddleware)
app.use('/auth', authRouter)
app.use('/loginCheck', loginCheckRouter)

export default app