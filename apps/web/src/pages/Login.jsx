import './Login.css'
import loginService from '../services/loginService'

const startGoogleLogin = () => {
  loginService.startGoogleLogin()
}

const Login = () => {
  return(
    <div className="login-container">
      <h1>Login</h1>
      <button onClick={startGoogleLogin}>Sign in with Google</button>
    </div>
  )
}

export default Login