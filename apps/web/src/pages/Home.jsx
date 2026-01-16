import { useRouteLoaderData } from 'react-router-dom'
import loginService from '../services/loginService'
import './Home.css'

const EmailDateForm = () => {
  return(
    <form className='dateForm'>
      <div>
        <label>
           Email Date Range
           <br/>
          <input type = 'date' className='input'>
          </input>
        </label>
        <label>
          -
          <input type = 'date' className='input'></input>
        </label>
      </div>
    </form>
  )
}

const RecieptDateForm = () => {
  return(
    <form className='dateForm'>
      <div>
        <label>
          <span>
           Receipt Date Range
           <br/>
           </span>
          <input type = 'month' className='input'>
          </input>
        </label>
        <label>
          -
          <input type = 'month' className='input'></input>
        </label>
      </div>
    </form>
  )
}

const BaseButton = ({text, className, onClick}) => {
  return(
    <button className={className} onClick = {onClick}>{text}</button>
  )
}

const logout = async () => {
  console.log('attempted logout')
  await loginService.logout()
}

const HomeHeader = () => {
  const {user} = useRouteLoaderData('app')
  const username = user.name
  return(<div className='header'>
    <div>
      <BaseButton text = {"Generate Sheet"} className='generateSheet' />
      <p className='updatedTime'>Last Updated:</p>
    </div>
    <div>
      <BaseButton text = {'Log out'} className='logout' onClick={logout} /><br/>Signed in as {username}
    </div>
    </div>)
}



const ControlPanel = () => {
  return(
    <div className='controlPanel'>
      <EmailDateForm />
      <RecieptDateForm />
      <BaseButton text='Update Emails Now' className='generalButton' />
      <BaseButton text='Delete Receipts' className='generalButton' />
      <BaseButton text='Upload Receipts' className='generalButton' />
    </div>
  )
}


const Home = () => {
  return(
    <div className='layout'>
      <HomeHeader />
      <ControlPanel />
    </div>
  )
}

export default Home