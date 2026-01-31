import { RouterProvider } from "react-router-dom"
import router from './router'
import Loading from './components/Loading'

function App() {
  return (
    <RouterProvider
      router={router}
      fallbackElement={<Loading />}
      hydrateFallbackElement={<Loading message="Loading app..." />}
    />
  )
}

export default App
