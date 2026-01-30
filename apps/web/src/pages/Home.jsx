import { useRouteLoaderData, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import loginService from '../services/loginService'
import './Home.css'

const EmailDateForm = ({ startDate, endDate, onStartChange, onEndChange }) => {
  return(
    <form className='dateForm'>
      <div>
        <label>
           Email Date Range
           <br/>
          <input
            type='date'
            className='input'
            value={startDate}
            onChange={(event) => onStartChange(event.target.value)}
          >
          </input>
        </label>
        <label>
          -
          <input
            type='date'
            className='input'
            value={endDate}
            onChange={(event) => onEndChange(event.target.value)}
          ></input>
        </label>
      </div>
    </form>
  )
}

const RecieptDateForm = ({ startMonth, endMonth, onStartChange, onEndChange }) => {
  return(
    <form className='dateForm'>
      <div>
        <label>
          <span>
           Receipt Date Range
           <br/>
           </span>
          <input
            type='month'
            className='input'
            value={startMonth}
            onChange={(event) => onStartChange(event.target.value)}
          >
          </input>
        </label>
        <label>
          -
          <input
            type='month'
            className='input'
            value={endMonth}
            onChange={(event) => onEndChange(event.target.value)}
          ></input>
        </label>
      </div>
    </form>
  )
}

const BaseButton = ({text, className, onClick, disabled}) => {
  return(
    <button className={className} onClick={onClick} disabled={disabled}>{text}</button>
  )
}

const logout = async () => {
  console.log('attempted logout')
  await loginService.logout()
}

const HomeHeader = ({ lastUpdated, onGenerate, isGenerateDisabled, isGenerating }) => {
  const {user} = useRouteLoaderData('app')
  const username = user.name
  return(<div className='header'>
    <div>
      <BaseButton
        text={isGenerating ? 'Generating...' : 'Generate Sheet'}
        className='generateSheet'
        onClick={onGenerate}
        disabled={isGenerateDisabled}
      />
      <p className='updatedTime'>Last Updated: {lastUpdated}</p>
    </div>
    <div>
      <BaseButton text = {'Log out'} className='logout' onClick={logout} /><br/>Signed in as {username}
    </div>
    </div>)
}



const ControlPanel = ({ onSync, isSyncing, emailStart, emailEnd, receiptStart, receiptEnd, onEmailStart, onEmailEnd, onReceiptStart, onReceiptEnd }) => {
  const navigate = useNavigate()

  return(
    <div className='controlPanel'>
      <EmailDateForm
        startDate={emailStart}
        endDate={emailEnd}
        onStartChange={onEmailStart}
        onEndChange={onEmailEnd}
      />
      <RecieptDateForm
        startMonth={receiptStart}
        endMonth={receiptEnd}
        onStartChange={onReceiptStart}
        onEndChange={onReceiptEnd}
      />
      <BaseButton
        text={isSyncing ? 'Updating Emails...' : 'Update Emails Now'}
        className='generalButton'
        onClick={onSync}
      />
      <BaseButton text='Upload Receipts' className='generalButton' onClick={() => navigate('/upload')} />
    </div>
  )
}


const Home = () => {
  const [lastUpdated, setLastUpdated] = useState('Never')
  const [isSyncing, setIsSyncing] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [emailStart, setEmailStart] = useState('')
  const [emailEnd, setEmailEnd] = useState('')
  const [receiptStart, setReceiptStart] = useState('')
  const [receiptEnd, setReceiptEnd] = useState('')

  useEffect(() => {
    let isMounted = true
    const loadStatus = async () => {
      try {
        const status = await loginService.getSyncStatus()
        if (!isMounted) return
        if (status?.lastUpdated) {
          setLastUpdated(new Date(status.lastUpdated).toLocaleString())
        } else {
          setLastUpdated('Never')
        }
      } catch (error) {
        if (isMounted) setLastUpdated('ERROR')
      }
    }
    loadStatus()
    return () => {
      isMounted = false
    }
  }, [])

  const handleSyncEmails = async () => {
    if (isSyncing) return
    setIsSyncing(true)
    try {
      await loginService.syncEmails()
      const status = await loginService.getSyncStatus()
      if (status?.lastUpdated) {
        setLastUpdated(new Date(status.lastUpdated).toLocaleString())
      } else {
        setLastUpdated('Never')
      }
    } catch (error) {
      setLastUpdated('ERROR')
    } finally {
      setIsSyncing(false)
    }
  }

  const handleGenerateSheet = async () => {
    if (isGenerating) return
    setIsGenerating(true)
    try {
      const blob = await loginService.generateSheet({
        emailStart,
        emailEnd,
        receiptStart,
        receiptEnd
      })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `order_match_${emailStart}_to_${emailEnd}.xlsx`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to generate sheet', error)
    } finally {
      setIsGenerating(false)
    }
  }

  const isGenerateDisabled = (
    !emailStart || !emailEnd || !receiptStart || !receiptEnd || isGenerating
  )

  return(
    <div className='layout'>
      <HomeHeader
        lastUpdated={lastUpdated}
        onGenerate={handleGenerateSheet}
        isGenerateDisabled={isGenerateDisabled}
        isGenerating={isGenerating}
      />
      <ControlPanel
        onSync={handleSyncEmails}
        isSyncing={isSyncing}
        emailStart={emailStart}
        emailEnd={emailEnd}
        receiptStart={receiptStart}
        receiptEnd={receiptEnd}
        onEmailStart={setEmailStart}
        onEmailEnd={setEmailEnd}
        onReceiptStart={setReceiptStart}
        onReceiptEnd={setReceiptEnd}
      />
    </div>
  )
}

export default Home
