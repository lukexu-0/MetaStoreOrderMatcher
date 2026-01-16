import { RouterProvider  } from "react-router-dom"
import router from './router'

function App() {
  return (
    <div><RouterProvider router = {router} FallbackElement ={<div>Loading...</div>} /></div>
  )
}

export default App
