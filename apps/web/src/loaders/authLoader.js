import { redirect } from "react-router-dom"
import loginService from "../services/loginService"

const requireAuthLoader = async ({request}) => {
  const user = await loginService.apiMe(request.signal)
  if (!user) {
    throw redirect('/login')
  }
  return {user} 
}

const loginLoader = async ({request}) => {
  const user = await loginService.apiMe(request.signal)
  if (user){
    throw redirect('/home')
  }
  return null
}

export {loginLoader, requireAuthLoader}