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

const BaseButton = ({text, className}) => {
  return(
    <button className={className}>{text}</button>
  )
}

const HomeHeader = () => {
  return(<div className='header'>
    <div>
      <BaseButton text = {"Generate Sheet"} className='generateSheet' />
      <p className='updatedTime'>Last Updated:</p>
    </div> 
    <BaseButton text = {'Log out'} className='logout' />
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