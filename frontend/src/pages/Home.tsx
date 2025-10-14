import { useNavigate } from 'react-router-dom'
import './Home.css'

function Home() {
  const navigate = useNavigate()

  return (
    <div className="home">
      <img 
        src="/icon.png" 
        alt="Oasis" 
        className="logo-icon" 
        onClick={() => navigate('/')}
      />
      <h1 className="logo">Oasis</h1>
      <div className="navigation-buttons">
        <button className="nav-button" onClick={() => navigate('/data')}>
          Data
        </button>
        <button className="nav-button" onClick={() => navigate('/exploration')}>
          Exploration
        </button>
        <button className="nav-button" onClick={() => navigate('/discovery')}>
          Discovery
        </button>
        <button className="nav-button" onClick={() => navigate('/conformance')}>
          Conformance
        </button>
        <button className="nav-button" onClick={() => navigate('/autopm')}>
          AutoPM
        </button>
        <button className="nav-button" onClick={() => navigate('/ocpm-exploration')}>
          OCPM Exploration
        </button>
      </div>
    </div>
  )
}

export default Home
