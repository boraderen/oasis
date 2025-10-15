import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import './Page.css'
import ViewOCPMIM from '../components/ViewOCPMIM'
import ViewOCPMIMD from '../components/ViewOCPMIMD'

interface OcelItem {
  filename: string
  upload_date: string
  num_events: number
  num_objects: number
  num_activities: number
  object_types: string[]
}

interface OCPMDiscoveryData {
  message: string
  status: string
}

function OCPMDiscovery() {
  const navigate = useNavigate()
  const [ocels, setOcels] = useState<OcelItem[]>([])
  const [selectedOcelIndex, setSelectedOcelIndex] = useState(-1)
  const [discoveryData, setDiscoveryData] = useState<OCPMDiscoveryData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Fetch OCELs on component mount
  useEffect(() => {
    fetchOcels()
  }, [])

  const fetchOcels = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/ocels')
      const result = await response.json()
      if (result.status === 'success') {
        setOcels(result.ocels)
      }
    } catch (err) {
      console.error('Failed to fetch OCELs:', err)
    }
  }

  const handleDiscover = async () => {
    if (selectedOcelIndex === -1) {
      setError('Please select an OCEL to discover from')
      return
    }
    
    setError(null)
    setSuccessMessage(null)
    setDiscoveryData(null)

    // Just initialize the discovery process without making API calls
    setDiscoveryData({ 
      message: "Discovery initiated", 
      status: "success" 
    })
    setSuccessMessage(`OCPM Discovery initiated for ${ocels[selectedOcelIndex].filename}`)
  }

  return (
    <div className="page">
      <h1 className="page-title">OCPM Discovery</h1>
      <p className="page-description">
        <strong>Object-Centric Process Discovery:</strong> Discover Object-Centric Petri nets from Object-Centric Event Logs (OCEL) using two inductive miner variants: IM (Inductive Miner) and IMD (Inductive Miner Directly-Follows). Compare the discovered models to find the best representation of your object-centric process.
      </p>
      
      <div className="upload-section">
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', justifyContent: 'center' }}>
          <select 
            className="log-selector"
            value={selectedOcelIndex}
            onChange={(e) => setSelectedOcelIndex(parseInt(e.target.value))}
            disabled={ocels.length === 0}
          >
            <option value={-1}>-- Select an OCEL --</option>
            {ocels.map((ocel, index) => (
              <option key={index} value={index}>
                {ocel.filename} ({ocel.num_events} events, {ocel.num_objects} objects)
              </option>
            ))}
          </select>
          <button 
            className="upload-button"
            onClick={handleDiscover}
            disabled={selectedOcelIndex === -1 || ocels.length === 0}
          >
            Discover OCPM Models
          </button>
        </div>
        {ocels.length === 0 && (
          <p style={{ textAlign: 'center', color: '#7f8c8d', marginTop: '1rem' }}>
            No OCELs uploaded yet. Go to the <span 
              style={{ color: '#3498db', cursor: 'pointer', textDecoration: 'underline' }}
              onClick={() => navigate('/data')}
            >Data page</span> to upload an OCEL first.
          </p>
        )}
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="success-message">
          {successMessage}
        </div>
      )}

      {discoveryData && (
        <div className="discovery-algorithms">
          <ViewOCPMIM ocelIndex={selectedOcelIndex} />
          <ViewOCPMIMD ocelIndex={selectedOcelIndex} />
        </div>
      )}
    </div>
  )
}

export default OCPMDiscovery
