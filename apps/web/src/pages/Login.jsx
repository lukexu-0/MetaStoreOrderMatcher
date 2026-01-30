import { useEffect, useRef, useState } from 'react'
import './Login.css'
import loginService from '../services/loginService'

const WAKE_SLOW_MS = 8000
const WAKE_TIMEOUT_MS = 25000

const Login = () => {
  const [wakeState, setWakeState] = useState('idle')
  const wakeInFlight = useRef(false)
  const wakeController = useRef(null)
  const isMounted = useRef(true)

  const setWakeStateSafe = (state) => {
    if (isMounted.current) {
      setWakeState(state)
    }
  }

  const wakeBackend = async () => {
    if (wakeInFlight.current) return
    wakeInFlight.current = true
    setWakeStateSafe('waking')

    const controller = new AbortController()
    wakeController.current = controller
    const slowTimer = setTimeout(() => setWakeStateSafe('slow'), WAKE_SLOW_MS)
    const timeoutId = setTimeout(() => controller.abort(), WAKE_TIMEOUT_MS)

    try {
      await loginService.wakeBackend(controller.signal)
      setWakeStateSafe('ready')
    } catch (error) {
      if (error?.name === 'AbortError') {
        setWakeStateSafe('timeout')
      } else {
        setWakeStateSafe('error')
      }
    } finally {
      clearTimeout(slowTimer)
      clearTimeout(timeoutId)
      wakeInFlight.current = false
      wakeController.current = null
    }
  }

  useEffect(() => {
    isMounted.current = true
    void wakeBackend()
    return () => {
      isMounted.current = false
      if (wakeController.current) {
        wakeController.current.abort()
      }
    }
  }, [])

  const handleLogin = () => {
    if (!wakeInFlight.current && wakeState !== 'ready') {
      void wakeBackend()
    }
    loginService.startGoogleLogin()
  }

  const wakeMessages = {
    idle: '',
    waking: 'Waking server... first request can take 30-60 seconds.',
    slow: 'Still waking... if sign-in hangs, wait a bit and try again.',
    ready: 'Server is awake.',
    timeout: 'Server is taking longer than usual. You can try again or sign in anyway.',
    error: 'Could not reach the server. Check your connection and try again.'
  }
  const wakeMessage = wakeMessages[wakeState]
  const showRetry = wakeState === 'timeout' || wakeState === 'error'

  return(
    <div className="login-container">
      <h1>Login</h1>
      <button onClick={handleLogin}>Sign in with Google</button>
      {wakeMessage && (
        <p className={`wake-status ${wakeState}`}>{wakeMessage}</p>
      )}
      {showRetry && (
        <button className="wake-retry" onClick={wakeBackend}>Retry wake</button>
      )}
    </div>
  )
}

export default Login
