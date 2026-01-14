import { createBrowserRouter } from 'react-router-dom'
import Login from './pages/Login'
import Home from './pages/Home'
import NotFound from './pages/NotFound'
 
const router = createBrowserRouter([
  { path:'/login', element:<Login />},
  { path:'/home', element:<Home />},
  { path:'*', element:<NotFound />}
])

export default router