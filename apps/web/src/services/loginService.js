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

const syncEmails = async () => {
  const response = await fetch(`${config.BACKEND_URL}/sync/gmail`, {
    method: 'POST',
    credentials: 'include',
  })
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`)
  }
  try {
    return await response.json()
  } catch {
    return { ok: true }
  }
}

const getSyncStatus = async () => {
  const response = await fetch(`${config.BACKEND_URL}/sync/gmail/status`, {
    method: 'GET',
    credentials: 'include',
  })
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`)
  }
  return await response.json()
}

const generateSheet = async ({ emailStart, emailEnd, receiptStart, receiptEnd }) => {
  const response = await fetch(`${config.BACKEND_URL}/generate`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      emailStart,
      emailEnd,
      receiptStart,
      receiptEnd
    })
  })
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`)
  }
  return await response.blob()
}

export default {
  startGoogleLogin,
  apiMe,
  logout,
  syncEmails,
  getSyncStatus,
  generateSheet
}
