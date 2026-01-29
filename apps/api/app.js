import express from "express"
import cors from "cors"
import morgan from "morgan"
import sessionMiddleware from "./middleware/sessionMiddleware.js"
import authRouter from "./controllers/authRouter.js"
import loginCheckRouter from "./controllers/loginCheckRouter.js"
import uploadRouter from './controllers/uploadRouter.js'
import inventoryRouter from './controllers/inventoryRouter.js'
import config from "./utils/config.js"

const app = express()

app.use(cors({ origin: config.FRONTEND_URL, credentials:true}))
app.use(express.json())
app.use(morgan("dev"))
app.use(sessionMiddleware)
app.use('/auth', authRouter)
app.use('/api/me', loginCheckRouter)
app.use('/upload', uploadRouter)
app.use('/inventory', inventoryRouter)

export default app
