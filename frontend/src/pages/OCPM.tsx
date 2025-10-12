import { useNavigate } from 'react-router-dom'
import './Page.css'

function OCPM() {
  const navigate = useNavigate()

  return (
    <div className="page">
      <img 
        src="/icon.png" 
        alt="Oasis" 
        className="logo-icon" 
        onClick={() => navigate('/')}
      />
      <h1 className="page-title">OCPM</h1>
      <p className="page-content">Process mining and optimization</p>
      <button className="back-button" onClick={() => navigate('/')}>
        Back to Home
      </button>
    </div>
  )
}

export default OCPM
