import config from "../utils/config"

const startGoogleLogin = () => {
  window.location.href = `${config.BACKEND_URL}/auth/google`
}

const apiMe = async (signal) => {
  const response = await fetch(`${config.BACKEND_URL}/api/me`, {credentials: "include", signal})

  if (response.status === 401) {
    return null
  }
  return await response.json()
}

const logout = async () => {
  const response = await fetch(`${config.BACKEND_URL}/auth/logout`,{
    method: 'POST',
    credentials: 'include',
  })
  if (!response.ok){
    throw new Error(`Request failed: ${response.status}`)
  }
  window.location.href = `/login`
}

export default {startGoogleLogin, apiMe, logout}
