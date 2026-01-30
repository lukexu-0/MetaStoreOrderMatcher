import './Loading.css'

const Loading = ({ message = 'Loading…' }) => {
  return (
    <div className="loading-screen" role="status" aria-live="polite">
      <div className="loading-spinner" aria-hidden="true" />
      <p className="loading-text">{message}</p>
    </div>
  )
}

export default Loading
