import { useNavigate } from 'react-router-dom'
import { useState, useRef } from 'react'
import './Page.css'
import ViewAlpha from '../components/ViewAlpha'
import ViewILP from '../components/ViewILP'
import ViewHeuristics from '../components/ViewHeuristics'
import ViewInductive from '../components/ViewInductive'

interface DiscoveryData {
  message: string
  filename: string
  status: string
}

function Discovery() {
  const navigate = useNavigate()
  const [uploading, setUploading] = useState(false)
  const [discoveryData, setDiscoveryData] = useState<DiscoveryData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError(null)
    setSuccessMessage(null)
    setDiscoveryData(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch('http://localhost:8000/api/upload_log', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()
      
      if (result.status === 'success') {
        console.log('Received data:', result) // Debug log
        setDiscoveryData(result)
        setSuccessMessage(`Successfully uploaded and processed ${result.filename}`)
      } else {
        setError(result.message || 'Upload failed')
      }
    } catch (err) {
      setError('Failed to connect to server')
    } finally {
      setUploading(false)
    }
  }

  const triggerFileInput = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className="page">
      <img 
        src="/icon.png" 
        alt="Oasis" 
        className="logo-icon" 
        onClick={() => navigate('/')}
      />
      <h1 className="page-title">Discovery</h1>
      <div className="page-description">
        <p className="page-content">
          <strong>Process Discovery Tool:</strong> Upload an event log (.xes or .csv) to automatically discover process models using four different algorithms. Each algorithm reveals different aspects of your process structure.
        </p>
        <div className="info-section">
          <h3>Available Algorithms:</h3>
          <ul>
            <li><strong>Alpha Miner:</strong> Discovers basic process structure from event sequences</li>
            <li><strong>ILP Miner:</strong> Uses Integer Linear Programming for optimal model discovery</li>
            <li><strong>Heuristics Miner:</strong> Handles noise and infrequent behavior patterns</li>
            <li><strong>Inductive Miner:</strong> Creates sound models with configurable noise thresholds</li>
          </ul>
        </div>
        <div className="info-section">
          <h3>Metrics Explained:</h3>
          <ul>
            <li><strong>Fitness:</strong> How well the model fits the observed behavior (higher = better)</li>
            <li><strong>Precision:</strong> How specific the model is to the observed behavior (higher = less overfitting)</li>
            <li><strong>F1-Measure:</strong> Harmonic mean of fitness and precision (balanced quality metric)</li>
            <li><strong>Simplicity:</strong> Number of cases in the log (process instance count)</li>
          </ul>
        </div>
        <div className="info-section">
          <h3>How to Use:</h3>
          <ol>
            <li>Upload your event log file</li>
            <li>Adjust algorithm parameters using the sliders (if available)</li>
            <li>Click "Discover" to generate the process model</li>
            <li>Compare metrics across algorithms to find the best model for your data</li>
          </ol>
        </div>
      </div>
      
      <div className="upload-section">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleUpload}
          accept=".xes,.csv"
          style={{ display: 'none' }}
        />
        <button 
          className="upload-button"
          onClick={triggerFileInput}
          disabled={uploading}
        >
          {uploading ? 'Processing...' : 'Upload Event Log'}
        </button>
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
              <ViewAlpha />
              <ViewILP />
              <ViewHeuristics />
              <ViewInductive />
            </div>
          )}
    </div>
  )
}

export default Discovery
