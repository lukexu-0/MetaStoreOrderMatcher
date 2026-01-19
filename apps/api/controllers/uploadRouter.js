import express from 'express'
import uploadMiddleware from '../middleware/uploadMiddleware'

uploadRouter = express.Router()

uploadRouter.post('/', uploadMiddleware.single('file'), async (request, response) => {
  if (!request.file){
    return response.status(400).send({error: 'missing file'})
  }
})

export default uploadRouter