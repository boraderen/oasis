import { useNavigate } from 'react-router-dom'
import { useState, useRef, useEffect } from 'react'
import './Page.css'

interface LogItem {
  filename: string
  uploaded_at: string
  num_events: number
  num_cases: number
  num_activities: number
}

interface ModelItem {
  filename: string
  uploaded_at: string
  model_type: string
}

interface OcelItem {
  filename: string
  uploaded_at: string
  num_events: number
  num_objects: number
  object_types: string[]
}

function Data() {
  const navigate = useNavigate()
  const [uploadingLog, setUploadingLog] = useState(false)
  const [uploadingModel, setUploadingModel] = useState(false)
  const [uploadingOcel, setUploadingOcel] = useState(false)
  const [logs, setLogs] = useState<LogItem[]>([])
  const [models, setModels] = useState<ModelItem[]>([])
  const [ocels, setOcels] = useState<OcelItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const logFileInputRef = useRef<HTMLInputElement>(null)
  const modelFileInputRef = useRef<HTMLInputElement>(null)
  const ocelFileInputRef = useRef<HTMLInputElement>(null)

  // Fetch logs, models, and ocels on component mount
  useEffect(() => {
    fetchLogs()
    fetchModels()
    fetchOcels()
  }, [])

  const fetchLogs = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/logs')
      const result = await response.json()
      if (result.status === 'success') {
        setLogs(result.logs)
      }
    } catch (err) {
      console.error('Error fetching logs:', err)
    }
  }

  const fetchModels = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/models')
      const result = await response.json()
      if (result.status === 'success') {
        setModels(result.models)
      }
    } catch (err) {
      console.error('Error fetching models:', err)
    }
  }

  const fetchOcels = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/ocels')
      const result = await response.json()
      if (result.status === 'success') {
        setOcels(result.ocels)
      }
    } catch (err) {
      console.error('Error fetching OCELs:', err)
    }
  }

  const handleLogUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploadingLog(true)
    setError(null)
    setSuccessMessage(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch('http://localhost:8000/api/upload_log', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()
      
      if (result.status === 'success') {
        setSuccessMessage(`Successfully uploaded event log: ${result.filename}`)
        fetchLogs() // Refresh the logs list
      } else {
        setError(result.message || 'Upload failed')
      }
    } catch (err) {
      setError('Failed to connect to server')
    } finally {
      setUploadingLog(false)
      // Reset file input
      if (logFileInputRef.current) {
        logFileInputRef.current.value = ''
      }
    }
  }

  const handleModelUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploadingModel(true)
    setError(null)
    setSuccessMessage(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch('http://localhost:8000/api/upload_model', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()
      
      if (result.status === 'success') {
        setSuccessMessage(`Successfully uploaded process model: ${result.filename}`)
        fetchModels() // Refresh the models list
      } else {
        setError(result.message || 'Upload failed')
      }
    } catch (err) {
      setError('Failed to connect to server')
    } finally {
      setUploadingModel(false)
      // Reset file input
      if (modelFileInputRef.current) {
        modelFileInputRef.current.value = ''
      }
    }
  }

  const triggerLogFileInput = () => {
    logFileInputRef.current?.click()
  }

  const triggerModelFileInput = () => {
    modelFileInputRef.current?.click()
  }

  const formatDate = (isoString: string) => {
    const date = new Date(isoString)
    return date.toLocaleString()
  }

  const handleDeleteLog = async (index: number, filename: string) => {
    if (!confirm(`Are you sure you want to delete "${filename}"?`)) {
      return
    }

    try {
      const response = await fetch(`http://localhost:8000/api/delete_log/${index}`, {
        method: 'DELETE',
      })

      const result = await response.json()
      
      if (result.status === 'success') {
        setSuccessMessage(result.message)
        fetchLogs() // Refresh the logs list
      } else {
        setError(result.message || 'Delete failed')
      }
    } catch (err) {
      setError('Failed to connect to server')
    }
  }

  const handleDeleteModel = async (index: number, filename: string) => {
    if (!confirm(`Are you sure you want to delete "${filename}"?`)) {
      return
    }

    try {
      const response = await fetch(`http://localhost:8000/api/delete_model/${index}`, {
        method: 'DELETE',
      })

      const result = await response.json()
      
      if (result.status === 'success') {
        setSuccessMessage(result.message)
        fetchModels() // Refresh the models list
      } else {
        setError(result.message || 'Delete failed')
      }
    } catch (err) {
      setError('Failed to connect to server')
    }
  }

  const handleOcelUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploadingOcel(true)
    setError(null)
    setSuccessMessage(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch('http://localhost:8000/api/upload_ocel', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()
      
      if (result.status === 'success') {
        setSuccessMessage(`Successfully uploaded OCEL: ${result.filename}`)
        fetchOcels() // Refresh the OCELs list
      } else {
        setError(result.message || 'Upload failed')
      }
    } catch (err) {
      setError('Failed to connect to server')
    } finally {
      setUploadingOcel(false)
      // Reset file input
      if (ocelFileInputRef.current) {
        ocelFileInputRef.current.value = ''
      }
    }
  }

  const handleDeleteOcel = async (index: number, filename: string) => {
    if (!confirm(`Are you sure you want to delete "${filename}"?`)) {
      return
    }

    try {
      const response = await fetch(`http://localhost:8000/api/delete_ocel/${index}`, {
        method: 'DELETE',
      })

      const result = await response.json()
      
      if (result.status === 'success') {
        setSuccessMessage(result.message)
        fetchOcels() // Refresh the OCELs list
      } else {
        setError(result.message || 'Delete failed')
      }
    } catch (err) {
      setError('Failed to connect to server')
    }
  }

  const triggerOcelFileInput = () => {
    ocelFileInputRef.current?.click()
  }

  return (
    <div className="page">
      <h1 className="page-title">Data</h1>
      <div className="page-description">
        <p className="page-content">
          <strong>Data Management:</strong> Upload, manage, and explore your process mining data. View event logs, analyze data quality, and prepare datasets for process discovery and analysis.
        </p>
      </div>
      
      <div className="upload-section">
        <input
          type="file"
          ref={logFileInputRef}
          onChange={handleLogUpload}
          accept=".xes,.csv"
          style={{ display: 'none' }}
        />
        <input
          type="file"
          ref={modelFileInputRef}
          onChange={handleModelUpload}
          accept=".pnml,.bpmn"
          style={{ display: 'none' }}
        />
        <input
          type="file"
          ref={ocelFileInputRef}
          onChange={handleOcelUpload}
          accept=".jsonocel,.xmlocel,.json,.xml,.csv"
          style={{ display: 'none' }}
        />
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <button 
            className="upload-button"
            onClick={triggerLogFileInput}
            disabled={uploadingLog}
          >
            {uploadingLog ? 'Uploading...' : 'Upload Event Log'}
          </button>
          <button 
            className="upload-button"
            onClick={triggerModelFileInput}
            disabled={uploadingModel}
          >
            {uploadingModel ? 'Uploading...' : 'Upload Process Model'}
          </button>
          <button 
            className="upload-button"
            onClick={triggerOcelFileInput}
            disabled={uploadingOcel}
          >
            {uploadingOcel ? 'Uploading...' : 'Upload OCEL'}
          </button>
        </div>
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

      {/* Event Logs List */}
      <div className="data-lists">
        <div className="data-list-section">
          <h2 className="list-title">Uploaded Event Logs ({logs.length})</h2>
          {logs.length === 0 ? (
            <div className="empty-list">
              <p>No event logs uploaded yet. Upload an event log to get started!</p>
            </div>
          ) : (
            <div className="data-items">
              {logs.map((log, index) => (
                <div key={index} className="data-item">
                  <div className="data-item-content">
                    <div className="data-item-header">
                      <span className="data-item-name">{log.filename}</span>
                      <span className="data-item-date">{formatDate(log.uploaded_at)}</span>
                    </div>
                    <div className="data-item-stats">
                      <span className="stat-badge">Events: {log.num_events}</span>
                      <span className="stat-badge">Cases: {log.num_cases}</span>
                      <span className="stat-badge">Activities: {log.num_activities}</span>
                    </div>
                  </div>
                  <button 
                    className="delete-button"
                    onClick={() => handleDeleteLog(index, log.filename)}
                    title="Delete this log"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Process Models List */}
        <div className="data-list-section">
          <h2 className="list-title">Uploaded Process Models ({models.length})</h2>
          {models.length === 0 ? (
            <div className="empty-list">
              <p>No process models uploaded yet. Upload a model to get started!</p>
            </div>
          ) : (
            <div className="data-items">
              {models.map((model, index) => (
                <div key={index} className="data-item">
                  <div className="data-item-content">
                    <div className="data-item-header">
                      <span className="data-item-name">{model.filename}</span>
                      <span className="data-item-date">{formatDate(model.uploaded_at)}</span>
                    </div>
                    <div className="data-item-stats">
                      <span className="stat-badge">Type: {model.model_type}</span>
                    </div>
                  </div>
                  <button 
                    className="delete-button"
                    onClick={() => handleDeleteModel(index, model.filename)}
                    title="Delete this model"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* OCELs List */}
        <div className="data-list-section">
          <h2 className="list-title">Uploaded OCELs ({ocels.length})</h2>
          {ocels.length === 0 ? (
            <div className="empty-list">
              <p>No OCELs uploaded yet. Upload an OCEL to get started!</p>
            </div>
          ) : (
            <div className="data-items">
              {ocels.map((ocel, index) => (
                <div key={index} className="data-item">
                  <div className="data-item-content">
                    <div className="data-item-header">
                      <span className="data-item-name">{ocel.filename}</span>
                      <span className="data-item-date">{formatDate(ocel.uploaded_at)}</span>
                    </div>
                    <div className="data-item-stats">
                      <span className="stat-badge">Events: {ocel.num_events}</span>
                      <span className="stat-badge">Objects: {ocel.num_objects}</span>
                      <span className="stat-badge">Types: {ocel.object_types.join(', ')}</span>
                    </div>
                  </div>
                  <button 
                    className="delete-button"
                    onClick={() => handleDeleteOcel(index, ocel.filename)}
                    title="Delete this OCEL"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Data

