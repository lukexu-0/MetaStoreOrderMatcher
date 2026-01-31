import { Outlet, useNavigation } from 'react-router-dom'
import Loading from './Loading'

const RootLayout = () => {
  const navigation = useNavigation()
  const isLoading = navigation.state === 'loading'

  if (isLoading) {
    return <Loading message="Checking session..." />
  }

  return <Outlet />
}

export default RootLayout
