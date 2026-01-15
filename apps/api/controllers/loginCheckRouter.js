import express from 'express'

const loginCheckRouter = express.Router()

loginCheckRouter.get('/', (request, response) => {
  if (!request.session.user){
    return response.status(401).json({error: 'not logged in'})
  }
  response.json(request.session.user)
})

export default loginCheckRouter