import express from "express"
import cors from "cors"
import morgan from "morgan"
import sessionMiddleware from "./middleware/sessionMiddleware.js"
import authRouter from "./controllers/authRouter.js"
import loginCheckRouter from "./controllers/loginCheckRouter.js"
import config from "./utils/config.js"
import uploadMiddleware from "./middleware/uploadMiddleware.js"

const app = express()

app.use(cors({ origin: config.FRONTEND_URL, credentials:true}))
app.use(express.json())
app.use(morgan("dev"))
app.use(sessionMiddleware)
app.use(uploadMiddleware)
app.use('/auth', authRouter)
app.use('/api/me', loginCheckRouter)

export default app