import express from 'express'
import uploadMiddleware from '../middleware/uploadMiddleware'
import parseOrders from '../utils/parseOrders'

uploadRouter = express.Router()

uploadRouter.post('/', uploadMiddleware.single('file'), async (request, response) => {
  if (!request.file){
    return response.status(400).send({error: 'missing file'})
  }

  const sheetObjs = parseOrders(request.file.buffer)
  
})

export default uploadRouter