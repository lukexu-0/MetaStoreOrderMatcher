import { createBrowserRouter, Navigate } from 'react-router-dom'
import {loginLoader, requireAuthLoader} from './loaders/authLoader.js'
import Login from './pages/Login'
import Home from './pages/Home'
import NotFound from './pages/NotFound'
import Upload from './pages/Upload.jsx'
import AppLayout from './components/Outlet.jsx'

const router = createBrowserRouter([
  { path:'/login', loader: loginLoader, element:<Login />},
  { path:'/',
    id: 'app', 
    loader: requireAuthLoader,
    element:<AppLayout />,
    children:[
      {index: true, element: <Navigate to = 'home'/>},
      {path: 'home', element: <Home />},
      {path: 'Upload', element: <Upload />}
    ]
  },
  { path:'*', element:<NotFound />}
])

export default router