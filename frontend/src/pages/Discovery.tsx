import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import './Page.css'
import ViewAlpha from '../components/ViewAlpha'
import ViewILP from '../components/ViewILP'
import ViewHeuristics from '../components/ViewHeuristics'
import ViewInductive from '../components/ViewInductive'

interface LogItem {
  filename: string
  upload_date: string
  num_events: number
  num_cases: number
  num_activities: number
  num_trace_variants: number
}

interface DiscoveryData {
  message: string
  log_metadata: any
  train_stats: any
  test_stats: any
  status: string
}

function Discovery() {
  const navigate = useNavigate()
  const [logs, setLogs] = useState<LogItem[]>([])
  const [selectedLogIndex, setSelectedLogIndex] = useState(-1)
  const [discoveryData, setDiscoveryData] = useState<DiscoveryData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Fetch logs on component mount
  useEffect(() => {
    fetchLogs()
  }, [])

  const fetchLogs = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/logs')
      const result = await response.json()
      if (result.status === 'success') {
        setLogs(result.logs)
      }
    } catch (err) {
      console.error('Failed to fetch logs:', err)
    }
  }

  const handleDiscover = async () => {
    if (selectedLogIndex === -1) {
      setError('Please select a log to discover from')
      return
    }
    
    setError(null)
    setSuccessMessage(null)
    setDiscoveryData(null)

    try {
      const response = await fetch(`http://localhost:8000/api/discover_alpha`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          log_index: selectedLogIndex.toString()
        })
      })

      const result = await response.json()
      
      if (result.status === 'success') {
        setDiscoveryData(result)
        setSuccessMessage(`Discovery completed for ${result.log_metadata.filename}`)
      } else {
        setError(result.message || 'Discovery failed')
      }
    } catch (err) {
      setError('Failed to connect to server')
    }
  }


  return (
    <div className="page">
      <h1 className="page-title">Discovery</h1>
      <p className="page-description">
        Automatically discover process models from event logs using four different mining algorithms. 
        The log is split into training (80%) and test (20%) data for proper evaluation. 
        Compare fitness, precision, and F1-score across algorithms to find the best model for your process.
      </p>
      
      <div className="upload-section">
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', justifyContent: 'center' }}>
          <select 
            className="log-selector"
            value={selectedLogIndex}
            onChange={(e) => setSelectedLogIndex(parseInt(e.target.value))}
            disabled={logs.length === 0}
          >
            <option value={-1}>-- Select a log --</option>
            {logs.map((log, index) => (
              <option key={index} value={index}>
                {log.filename} ({log.num_events} events, {log.num_cases} cases)
              </option>
            ))}
          </select>
          <button 
            className="upload-button"
            onClick={handleDiscover}
            disabled={selectedLogIndex === -1 || logs.length === 0}
          >
            Discover Models
          </button>
        </div>
        {logs.length === 0 && (
          <p style={{ textAlign: 'center', color: '#7f8c8d', marginTop: '1rem' }}>
            No logs uploaded yet. Go to the <span 
              style={{ color: '#3498db', cursor: 'pointer', textDecoration: 'underline' }}
              onClick={() => navigate('/data')}
            >Data page</span> to upload a log first.
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
              <ViewAlpha logIndex={selectedLogIndex} />
              <ViewILP logIndex={selectedLogIndex} />
              <ViewHeuristics logIndex={selectedLogIndex} />
              <ViewInductive logIndex={selectedLogIndex} />
            </div>
          )}
    </div>
  )
}

export default Discovery
