import { useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
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

type ConformanceVariant = 'log-log' | 'log-model' | 'model-model'

interface ConformanceData {
  message: string
  status: string
  // Log-Log specific
  log1_metadata?: LogItem
  log2_metadata?: LogItem
  log1_svg?: string
  log2_svg?: string
  num_events_1?: number
  num_cases_1?: number
  num_events_2?: number
  num_cases_2?: number
  footprint_conformance?: number
  // Log-Model specific
  log_metadata?: LogItem
  model_metadata?: ModelItem
  model_svg?: string
  log_svg?: string
  num_events?: number
  num_cases?: number
  num_places?: number
  num_transitions?: number
  num_arcs?: number
  log_footprint_matrix?: {
    activities: string[]
    matrix: string[][]
  }
  model_footprint_matrix?: {
    activities: string[]
    matrix: string[][]
  }
  alignment_data?: Array<{
    variant: string[]
    frequency: number
    alignment: Array<[string | null, string | null]>
    fitness: number
  }>
  tbr_data?: Array<{
    variant: string[]
    frequency: number
    missing_tokens: number
    consumed_tokens: number
    remaining_tokens: number
    produced_tokens: number
    trace_is_fit: boolean
    trace_fitness: number
  }>
  tbr_fitness?: number
  align_fitness?: number | string
  tbr_precision?: number
  align_precision?: number | string
  tbr_f1?: number
  align_f1?: number | string
  mean_fitness?: number
  mean_precision?: number
  mean_fitness_combined?: number
  mean_precision_combined?: number
  mean_f1_combined?: number
  simplicity?: number
  // Model-Model specific
  model1_metadata?: ModelItem
  model2_metadata?: ModelItem
  model1_svg?: string
  model2_svg?: string
  num_places_1?: number
  num_transitions_1?: number
  num_arcs_1?: number
  num_places_2?: number
  num_transitions_2?: number
  num_arcs_2?: number
  // Common (shared across variants)
  footprint1_matrix?: {
    activities: string[]
    matrix: string[][]
  }
  footprint2_matrix?: {
    activities: string[]
    matrix: string[][]
  }
  num_different_cells?: number
  footprint_fitness?: number | string
}

function Conformance() {
  const navigate = useNavigate()
  const [logs, setLogs] = useState<LogItem[]>([])
  const [models, setModels] = useState<ModelItem[]>([])
  const [variant, setVariant] = useState<ConformanceVariant>('log-log')
  
  // Selection states
  const [selectedLog1, setSelectedLog1] = useState(-1)
  const [selectedLog2, setSelectedLog2] = useState(-1)
  const [selectedLog, setSelectedLog] = useState(-1)
  const [selectedModel, setSelectedModel] = useState(-1)
  const [selectedModel1, setSelectedModel1] = useState(-1)
  const [selectedModel2, setSelectedModel2] = useState(-1)
  
  const [conformanceData, setConformanceData] = useState<ConformanceData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  
  // Custom trace alignment state
  const [customTrace, setCustomTrace] = useState<string>('')
  const [customAlignment, setCustomAlignment] = useState<{
    alignment: Array<[string | null, string | null]>
    fitness: number
    tbr: {
      missing_tokens: number
      consumed_tokens: number
      remaining_tokens: number
      produced_tokens: number
      trace_is_fit: boolean
      trace_fitness: number
    }
  } | null>(null)
  const [computingCustom, setComputingCustom] = useState(false)
  
  // View mode for trace diagnostics (separate for variants and custom)
  const [variantDiagnosticsView, setVariantDiagnosticsView] = useState<'alignments' | 'tbr'>('alignments')
  const [customDiagnosticsView, setCustomDiagnosticsView] = useState<'alignments' | 'tbr'>('alignments')
  
  // Helper function to generate consistent colors for activities
  const getActivityColor = (activity: string | null): string => {
    if (!activity || activity === '>>' || activity === 'τ') {
      return ''
    }
    
    // Generate a hash from the activity name
    let hash = 0
    for (let i = 0; i < activity.length; i++) {
      hash = activity.charCodeAt(i) + ((hash << 5) - hash)
    }
    
    // Generate vibrant colors using HSL
    const hue = Math.abs(hash % 360)
    const saturation = 65 + (Math.abs(hash) % 20) // 65-85%
    const lightness = 50 + (Math.abs(hash >> 8) % 15) // 50-65%
    
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`
  }
  
  // Zoom and drag state for SVGs
  const svg1Ref = useRef<HTMLDivElement>(null)
  const svg2Ref = useRef<HTMLDivElement>(null)
  const [zoom1, setZoom1] = useState(0.8)
  const [position1, setPosition1] = useState({ x: 0, y: 0 })
  const [isDragging1, setIsDragging1] = useState(false)
  const [dragStart1, setDragStart1] = useState({ x: 0, y: 0 })
  const [zoom2, setZoom2] = useState(0.8)
  const [position2, setPosition2] = useState({ x: 0, y: 0 })
  const [isDragging2, setIsDragging2] = useState(false)
  const [dragStart2, setDragStart2] = useState({ x: 0, y: 0 })

  // Fetch logs and models on component mount
  useEffect(() => {
    fetchLogs()
    fetchModels()
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

  const fetchModels = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/models')
      const result = await response.json()
      if (result.status === 'success') {
        setModels(result.models)
      }
    } catch (err) {
      console.error('Failed to fetch models:', err)
    }
  }

  // Zoom and drag handlers for SVG 1
  const zoomIn1 = () => setZoom1(prev => Math.min(5, prev * 1.2))
  const zoomOut1 = () => setZoom1(prev => Math.max(0.1, prev / 1.2))
  const resetView1 = () => {
    setZoom1(0.8)
    setPosition1({ x: 0, y: 0 })
  }

  const handleMouseDown1 = (e: React.MouseEvent) => {
    setIsDragging1(true)
    setDragStart1({ x: e.clientX - position1.x, y: e.clientY - position1.y })
  }

  const handleMouseMove1 = (e: React.MouseEvent) => {
    if (!isDragging1) return
    setPosition1({ x: e.clientX - dragStart1.x, y: e.clientY - dragStart1.y })
  }

  const handleMouseUp1 = () => setIsDragging1(false)

  // Zoom and drag handlers for SVG 2
  const zoomIn2 = () => setZoom2(prev => Math.min(5, prev * 1.2))
  const zoomOut2 = () => setZoom2(prev => Math.max(0.1, prev / 1.2))
  const resetView2 = () => {
    setZoom2(0.8)
    setPosition2({ x: 0, y: 0 })
  }

  const handleMouseDown2 = (e: React.MouseEvent) => {
    setIsDragging2(true)
    setDragStart2({ x: e.clientX - position2.x, y: e.clientY - position2.y })
  }

  const handleMouseMove2 = (e: React.MouseEvent) => {
    if (!isDragging2) return
    setPosition2({ x: e.clientX - dragStart2.x, y: e.clientY - dragStart2.y })
  }

  const handleMouseUp2 = () => setIsDragging2(false)

  const handleComputeCustomAlignment = async () => {
    if (selectedLog === -1 || selectedModel === -1) {
      setError('Please select both log and model first')
      return
    }

    if (!customTrace.trim()) {
      setError('Please enter a trace (comma-separated activities)')
      return
    }

    setComputingCustom(true)
    setError(null)
    setCustomAlignment(null)

    try {
      // Parse the trace (comma-separated activities)
      const activities = customTrace.split(',').map(a => a.trim()).filter(a => a.length > 0)

      const formData = new FormData()
      formData.append('log_index', selectedLog.toString())
      formData.append('model_index', selectedModel.toString())
      formData.append('trace_activities', JSON.stringify(activities))

      const response = await fetch('http://localhost:8000/api/compute_custom_alignment', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()
      
      if (result.status === 'success') {
        setCustomAlignment({
          alignment: result.alignment,
          fitness: result.fitness,
          tbr: result.tbr
        })
      } else {
        setError(result.message || 'Failed to compute custom alignment')
      }
    } catch (err) {
      setError('Failed to connect to server')
    } finally {
      setComputingCustom(false)
    }
  }

  const handleCheck = async () => {
    setLoading(true)
    setError(null)
    setSuccessMessage(null)
    setConformanceData(null)

    try {
      let endpoint = ''
      const formData = new FormData()

      if (variant === 'log-log') {
        if (selectedLog1 === -1 || selectedLog2 === -1) {
          setError('Please select both logs')
          setLoading(false)
          return
        }
        endpoint = 'http://localhost:8000/api/conformance_log_log'
        formData.append('log_index_1', selectedLog1.toString())
        formData.append('log_index_2', selectedLog2.toString())
      } else if (variant === 'log-model') {
        if (selectedLog === -1 || selectedModel === -1) {
          setError('Please select both log and model')
          setLoading(false)
          return
        }
        endpoint = 'http://localhost:8000/api/conformance_log_model'
        formData.append('log_index', selectedLog.toString())
        formData.append('model_index', selectedModel.toString())
      } else if (variant === 'model-model') {
        if (selectedModel1 === -1 || selectedModel2 === -1) {
          setError('Please select both models')
          setLoading(false)
          return
        }
        endpoint = 'http://localhost:8000/api/conformance_model_model'
        formData.append('model_index_1', selectedModel1.toString())
        formData.append('model_index_2', selectedModel2.toString())
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()
      
      if (result.status === 'success') {
        setConformanceData(result)
        setSuccessMessage(result.message)
      } else {
        setError(result.message || 'Conformance checking failed')
      }
    } catch (err) {
      setError('Failed to connect to server')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page">
      <img 
        src="/icon.png" 
        alt="Oasis" 
        className="logo-icon" 
        onClick={() => navigate('/')}
      />
      <h1 className="page-title">Conformance</h1>
      <div className="page-description">
        <p className="page-content">
          <strong>Conformance Checking Tool:</strong> Compare event logs and process models to measure how well they align. Choose from three variants: Log-Log (compare two event logs), Log-Model (check log against model), or Model-Model (compare two models).
        </p>
      </div>

      {/* Variant Selection */}
      <div className="upload-section">
        <h3>Select Conformance Variant</h3>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1rem' }}>
          <button 
            className={`upload-button ${variant === 'log-log' ? 'active' : ''}`}
            onClick={() => setVariant('log-log')}
          >
            Log-Log
          </button>
          <button 
            className={`upload-button ${variant === 'log-model' ? 'active' : ''}`}
            onClick={() => setVariant('log-model')}
          >
            Log-Model
          </button>
          <button 
            className={`upload-button ${variant === 'model-model' ? 'active' : ''}`}
            onClick={() => setVariant('model-model')}
          >
            Model-Model
          </button>
            </div>
        </div>

      {/* Selection UI based on variant */}
      <div className="upload-section">
        {variant === 'log-log' && (
          <div>
            <h3>Select Two Event Logs</h3>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', justifyContent: 'center', marginTop: '1rem' }}>
              <div>
                <label>First Log:</label>
                <select 
                  className="log-selector"
                  value={selectedLog1}
                  onChange={(e) => setSelectedLog1(parseInt(e.target.value))}
                  disabled={logs.length === 0}
                >
                  <option value={-1}>-- Select log 1 --</option>
                  {logs.map((log, index) => (
                    <option key={index} value={index}>
                      {log.filename} ({log.num_events} events)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label>Second Log:</label>
                <select 
                  className="log-selector"
                  value={selectedLog2}
                  onChange={(e) => setSelectedLog2(parseInt(e.target.value))}
                  disabled={logs.length === 0}
                >
                  <option value={-1}>-- Select log 2 --</option>
                  {logs.map((log, index) => (
                    <option key={index} value={index}>
                      {log.filename} ({log.num_events} events)
                    </option>
                  ))}
                </select>
              </div>
            </div>
            </div>
          )}

        {variant === 'log-model' && (
          <div>
            <h3>Select Event Log and Model</h3>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', justifyContent: 'center', marginTop: '1rem' }}>
              <div>
                <label>Event Log:</label>
                <select 
                  className="log-selector"
                  value={selectedLog}
                  onChange={(e) => setSelectedLog(parseInt(e.target.value))}
                  disabled={logs.length === 0}
                >
                  <option value={-1}>-- Select log --</option>
                  {logs.map((log, index) => (
                    <option key={index} value={index}>
                      {log.filename} ({log.num_events} events)
                    </option>
                  ))}
                </select>
        </div>
              <div>
                <label>Process Model:</label>
                <select 
                  className="log-selector"
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(parseInt(e.target.value))}
                  disabled={models.length === 0}
                >
                  <option value={-1}>-- Select model --</option>
                  {models.map((model, index) => (
                    <option key={index} value={index}>
                      {model.filename} ({model.model_type})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {variant === 'model-model' && (
          <div>
            <h3>Select Two Process Models</h3>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', justifyContent: 'center', marginTop: '1rem' }}>
              <div>
                <label>First Model:</label>
                <select 
                  className="log-selector"
                  value={selectedModel1}
                  onChange={(e) => setSelectedModel1(parseInt(e.target.value))}
                  disabled={models.length === 0}
                >
                  <option value={-1}>-- Select model 1 --</option>
                  {models.map((model, index) => (
                    <option key={index} value={index}>
                      {model.filename} ({model.model_type})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label>Second Model:</label>
                <select 
                  className="log-selector"
                  value={selectedModel2}
                  onChange={(e) => setSelectedModel2(parseInt(e.target.value))}
                  disabled={models.length === 0}
                >
                  <option value={-1}>-- Select model 2 --</option>
                  {models.map((model, index) => (
                    <option key={index} value={index}>
                      {model.filename} ({model.model_type})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Check Button */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.5rem' }}>
          <button 
            className="upload-button"
            onClick={handleCheck}
            disabled={loading}
          >
            {loading ? 'Checking...' : 'Check Conformance'}
          </button>
        </div>

        {/* No data message */}
        {logs.length === 0 && models.length === 0 && (
          <p style={{ textAlign: 'center', color: '#7f8c8d', marginTop: '1rem' }}>
            No logs or models uploaded yet. Go to the <span 
              style={{ color: '#3498db', cursor: 'pointer', textDecoration: 'underline' }}
              onClick={() => navigate('/data')}
            >Data page</span> to upload first.
          </p>
        )}
      </div>

      {/* Error and Success Messages */}
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

      {/* Results */}
      {conformanceData && (
        <div className="insights-container">
          {/* Log Statistics for Log-Log */}
          {conformanceData.num_events_1 !== undefined && (
            <>
              <div style={{ marginBottom: '2rem' }}>
                <h3 className="chart-title">Log Statistics</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginTop: '1rem' }}>
                  <div className="stats-grid">
                    <div className="stat-card">
                      <div className="stat-value">{conformanceData.num_events_1}</div>
                      <div className="stat-label">Events (Log 1)</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-value">{conformanceData.num_cases_1}</div>
                      <div className="stat-label">Cases (Log 1)</div>
                    </div>
                  </div>
                  <div className="stats-grid">
                    <div className="stat-card">
                      <div className="stat-value">{conformanceData.num_events_2}</div>
                      <div className="stat-label">Events (Log 2)</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-value">{conformanceData.num_cases_2}</div>
                      <div className="stat-label">Cases (Log 2)</div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div style={{ marginBottom: '2rem' }}>
                <h3 className="chart-title">Conformance Metrics</h3>
                <div className="metrics-list">
                  {/* Footprint Metrics */}
                  {conformanceData.footprint_conformance !== undefined && (
                    <>
                      <div className="metric-row">
                        <span className="metric-label">Footprint Conformance</span>
                        <span className="metric-value">{conformanceData.footprint_conformance.toFixed(3)}</span>
                      </div>
                      <div className="metric-row">
                        <span className="metric-label">Different Cells</span>
                        <span className="metric-value">{conformanceData.num_different_cells}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Log and Model Statistics for Log-Model */}
          {conformanceData.num_events !== undefined && conformanceData.num_places !== undefined && (
            <div style={{ marginBottom: '2rem' }}>
              <h3 className="chart-title">Log & Model Statistics</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginTop: '1rem' }}>
                <div className="stats-grid">
                  <div className="stat-card">
                    <div className="stat-value">{conformanceData.num_events}</div>
                    <div className="stat-label">Events (Log)</div>
                </div>
                  <div className="stat-card">
                    <div className="stat-value">{conformanceData.num_cases}</div>
                    <div className="stat-label">Cases (Log)</div>
              </div>
            </div>
                <div className="stats-grid">
                  <div className="stat-card">
                    <div className="stat-value">{conformanceData.num_places}</div>
                    <div className="stat-label">Places (Model)</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">{conformanceData.num_transitions}</div>
                    <div className="stat-label">Transitions (Model)</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">{conformanceData.num_arcs}</div>
                    <div className="stat-label">Arcs (Model)</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Petri Net Statistics for Model-Model */}
          {conformanceData.num_places_1 !== undefined && (
            <>
              <div style={{ marginBottom: '2rem' }}>
                <h3 className="chart-title">Petri Net Statistics</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginTop: '1rem' }}>
                  <div className="stats-grid">
                    <div className="stat-card">
                      <div className="stat-value">{conformanceData.num_places_1}</div>
                      <div className="stat-label">Places (Model 1)</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-value">{conformanceData.num_transitions_1}</div>
                      <div className="stat-label">Transitions (Model 1)</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-value">{conformanceData.num_arcs_1}</div>
                      <div className="stat-label">Arcs (Model 1)</div>
                    </div>
                  </div>
                  <div className="stats-grid">
                    <div className="stat-card">
                      <div className="stat-value">{conformanceData.num_places_2}</div>
                      <div className="stat-label">Places (Model 2)</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-value">{conformanceData.num_transitions_2}</div>
                      <div className="stat-label">Transitions (Model 2)</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-value">{conformanceData.num_arcs_2}</div>
                      <div className="stat-label">Arcs (Model 2)</div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div style={{ marginBottom: '2rem' }}>
                <h3 className="chart-title">Conformance Metrics</h3>
                <div className="metrics-list">
                  {/* Footprint Metrics */}
                  {conformanceData.footprint_conformance !== undefined && (
                    <>
                      <div className="metric-row">
                        <span className="metric-label">Footprint Conformance</span>
                        <span className="metric-value">{conformanceData.footprint_conformance.toFixed(3)}</span>
                      </div>
                      <div className="metric-row">
                        <span className="metric-label">Different Cells</span>
                        <span className="metric-value">{conformanceData.num_different_cells}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Metrics */}
          <div className="stats-grid" style={{ marginBottom: '2rem' }}>
            {conformanceData.footprint_fitness !== undefined && (
              <div className="stat-card">
                <div className="stat-value">
                  {typeof conformanceData.footprint_fitness === 'number' 
                    ? conformanceData.footprint_fitness.toFixed(3) 
                    : conformanceData.footprint_fitness}
                </div>
                <div className="stat-label">Footprint Fitness</div>
              </div>
            )}
          </div>

          {/* Conformance Metrics for Log-Model */}
          {conformanceData.tbr_fitness !== undefined && (
            <div style={{ marginBottom: '2rem' }}>
              <h3 className="chart-title">Conformance Metrics</h3>
              <div className="metrics-list">
                {/* Footprint Metrics */}
                {conformanceData.footprint_conformance !== undefined && (
                  <>
                    <div className="metric-row">
                      <span className="metric-label">Footprint Conformance</span>
                      <span className="metric-value">{conformanceData.footprint_conformance.toFixed(3)}</span>
                    </div>
                    <div className="metric-row">
                      <span className="metric-label">Different Cells</span>
                      <span className="metric-value">{conformanceData.num_different_cells}</span>
                    </div>
                  </>
                )}
                
                {/* Fitness Section */}
                <div className="metric-section">
                  <div className="section-header">Fitness</div>
                  <div className="metric-row">
                    <span className="metric-label">Mean</span>
                    <span className="metric-value primary">{conformanceData.mean_fitness_combined?.toFixed(3)}</span>
                  </div>
                  <div className="metric-row sub">
                    <span className="metric-label">TBR</span>
                    <span className="metric-value">{conformanceData.tbr_fitness.toFixed(3)}</span>
                  </div>
                  <div className="metric-row sub">
                    <span className="metric-label">Alignment</span>
                    <span className="metric-value">
                      {typeof conformanceData.align_fitness === 'number' 
                        ? conformanceData.align_fitness.toFixed(3) 
                        : conformanceData.align_fitness}
                    </span>
                  </div>
                  </div>
                
                {/* Precision Section */}
                <div className="metric-section">
                  <div className="section-header">Precision</div>
                  <div className="metric-row">
                    <span className="metric-label">Mean</span>
                    <span className="metric-value primary">{conformanceData.mean_precision_combined?.toFixed(3)}</span>
                </div>
                  <div className="metric-row sub">
                    <span className="metric-label">TBR</span>
                    <span className="metric-value">{conformanceData.tbr_precision?.toFixed(3)}</span>
                  </div>
                  <div className="metric-row sub">
                    <span className="metric-label">Alignment</span>
                    <span className="metric-value">
                      {typeof conformanceData.align_precision === 'number' 
                        ? conformanceData.align_precision.toFixed(3) 
                        : conformanceData.align_precision}
                    </span>
                  </div>
                  </div>
                
                {/* F1 Section */}
                <div className="metric-section">
                  <div className="section-header">F1-Score</div>
                  <div className="metric-row">
                    <span className="metric-label">Mean</span>
                    <span className="metric-value primary">{conformanceData.mean_f1_combined?.toFixed(3)}</span>
                </div>
                  <div className="metric-row sub">
                    <span className="metric-label">TBR</span>
                    <span className="metric-value">{conformanceData.tbr_f1?.toFixed(3)}</span>
                  </div>
                  <div className="metric-row sub">
                    <span className="metric-label">Alignment</span>
                    <span className="metric-value">
                      {typeof conformanceData.align_f1 === 'number' 
                        ? conformanceData.align_f1.toFixed(3) 
                        : conformanceData.align_f1}
                    </span>
                  </div>
                  </div>
                
                {/* Simplicity */}
                <div className="metric-row">
                  <span className="metric-label">Simplicity</span>
                  <span className="metric-value">{conformanceData.simplicity?.toFixed(3)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Footprint Matrices for Log-Log */}
          {conformanceData.footprint1_matrix && conformanceData.footprint2_matrix && conformanceData.log1_metadata && (
            <div style={{ marginTop: '2rem' }}>
              <h3 className="chart-title">Footprint Matrices Comparison</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginTop: '1rem' }}>
                {/* Log 1 Footprint Matrix */}
                <div className="footprint-matrix">
                  <h4 style={{ fontSize: '1rem', marginBottom: '1rem', color: '#2c3e50' }}>
                    Log 1: {conformanceData.log1_metadata?.filename}
                  </h4>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="footprint-table">
                      <thead>
                        <tr>
                          <th></th>
                          {conformanceData.footprint1_matrix.activities.map((act, idx) => (
                            <th key={idx} title={act}>{act.substring(0, 5)}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {conformanceData.footprint1_matrix.activities.map((rowAct, rowIdx) => (
                          <tr key={rowIdx}>
                            <th title={rowAct}>{rowAct.substring(0, 6)}</th>
                            {conformanceData.footprint1_matrix!.matrix[rowIdx].map((cell, colIdx) => (
                              <td key={colIdx} className={cell ? (cell === '||' ? 'has-relation parallel-relation' : 'has-relation') : ''}>
                                {cell || '#'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  </div>

                {/* Log 2 Footprint Matrix */}
                <div className="footprint-matrix">
                  <h4 style={{ fontSize: '1rem', marginBottom: '1rem', color: '#2c3e50' }}>
                    Log 2: {conformanceData.log2_metadata?.filename}
                  </h4>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="footprint-table">
                      <thead>
                        <tr>
                          <th></th>
                          {conformanceData.footprint2_matrix.activities.map((act, idx) => (
                            <th key={idx} title={act}>{act.substring(0, 5)}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {conformanceData.footprint2_matrix.activities.map((rowAct, rowIdx) => (
                          <tr key={rowIdx}>
                            <th title={rowAct}>{rowAct.substring(0, 6)}</th>
                            {conformanceData.footprint2_matrix!.matrix[rowIdx].map((cell, colIdx) => (
                              <td key={colIdx} className={cell ? (cell === '||' ? 'has-relation parallel-relation' : 'has-relation') : ''}>
                                {cell || '#'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                </div>
                  </div>
                  </div>
                </div>
          )}

          {/* Footprint Matrices for Log-Model */}
          {conformanceData.log_footprint_matrix && conformanceData.model_footprint_matrix && (
            <div style={{ marginTop: '2rem' }}>
              <h3 className="chart-title">Footprint Matrices Comparison</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginTop: '1rem' }}>
                {/* Log Footprint Matrix */}
                <div className="footprint-matrix">
                  <h4 style={{ fontSize: '1rem', marginBottom: '1rem', color: '#2c3e50' }}>
                    Log: {conformanceData.log_metadata?.filename}
                  </h4>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="footprint-table">
                      <thead>
                        <tr>
                          <th></th>
                          {conformanceData.log_footprint_matrix.activities.map((act, idx) => (
                            <th key={idx} title={act}>{act.substring(0, 5)}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {conformanceData.log_footprint_matrix.activities.map((rowAct, rowIdx) => (
                          <tr key={rowIdx}>
                            <th title={rowAct}>{rowAct.substring(0, 6)}</th>
                            {conformanceData.log_footprint_matrix!.matrix[rowIdx].map((cell, colIdx) => (
                              <td key={colIdx} className={cell ? (cell === '||' ? 'has-relation parallel-relation' : 'has-relation') : ''}>
                                {cell || '#'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  </div>

                {/* Model Footprint Matrix */}
                <div className="footprint-matrix">
                  <h4 style={{ fontSize: '1rem', marginBottom: '1rem', color: '#2c3e50' }}>
                    Model: {conformanceData.model_metadata?.filename}
                  </h4>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="footprint-table">
                      <thead>
                        <tr>
                          <th></th>
                          {conformanceData.model_footprint_matrix.activities.map((act, idx) => (
                            <th key={idx} title={act}>{act.substring(0, 5)}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {conformanceData.model_footprint_matrix.activities.map((rowAct, rowIdx) => (
                          <tr key={rowIdx}>
                            <th title={rowAct}>{rowAct.substring(0, 6)}</th>
                            {conformanceData.model_footprint_matrix!.matrix[rowIdx].map((cell, colIdx) => (
                              <td key={colIdx} className={cell ? (cell === '||' ? 'has-relation parallel-relation' : 'has-relation') : ''}>
                                {cell || '#'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                </div>
              </div>
            </div>
          </div>
          )}

          {/* Alignment Information for Log-Model */}
          {conformanceData.log_metadata && conformanceData.model_metadata && (
            <div style={{ marginTop: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 className="chart-title" style={{ margin: 0 }}>Trace Variant Diagnostics</h3>
                <div className="dfg-type-controls">
                  <button 
                    className={`dfg-type-button ${variantDiagnosticsView === 'alignments' ? 'active' : ''}`}
                    onClick={() => setVariantDiagnosticsView('alignments')}
                  >
                    Alignments
                  </button>
                  <button 
                    className={`dfg-type-button ${variantDiagnosticsView === 'tbr' ? 'active' : ''}`}
                    onClick={() => setVariantDiagnosticsView('tbr')}
                  >
                    TBR
                  </button>
                  </div>
              </div>
              
              {variantDiagnosticsView === 'alignments' && conformanceData.alignment_data && conformanceData.alignment_data.length > 0 ? (
                <div style={{ maxHeight: '600px', overflowY: 'auto', marginTop: '1rem' }}>
                  {conformanceData.alignment_data.map((variantAlign, idx) => (
                    <div key={idx} className="alignment-variant-row">
                      <div className="alignment-header">
                        <span className="alignment-variant-index">#{idx + 1}</span>
                        <span className="alignment-frequency">{variantAlign.frequency} cases</span>
                        <span className="alignment-fitness">Fitness: {variantAlign.fitness.toFixed(3)}</span>
                      </div>
                      <div className="alignment-container">
                        {/* Log moves (top row) */}
                        <div className="alignment-row">
                          <span className="alignment-row-label">Log:</span>
                          <div className="alignment-sequence">
                            {variantAlign.alignment.map((pair, moveIdx) => {
                              const logMove = pair[0]
                              let displayText = logMove === '>>' ? '>>' : (logMove || 'τ')
                              let specialClass = ''
                              let customColor = ''
                              
                              if (logMove === '>>') {
                                specialClass = 'skip'
                              } else if (logMove === null) {
                                displayText = 'τ'
                                specialClass = 'tau'
                              } else {
                                // Regular activity - use unique color
                                customColor = getActivityColor(logMove)
                              }
                              
                              return (
                                <span 
                                  key={moveIdx}
                                  className={`alignment-move ${specialClass}`}
                                  style={customColor ? { background: customColor, color: 'white' } : {}}
                                  title={logMove === '>>' ? 'Skip in log' : logMove === null ? 'Empty transition (τ)' : logMove}
                                >
                                  {displayText}
                                </span>
                              )
                            })}
                          </div>
                        </div>
                        {/* Model moves (bottom row) */}
                        <div className="alignment-row">
                          <span className="alignment-row-label">Model:</span>
                          <div className="alignment-sequence">
                            {variantAlign.alignment.map((pair, moveIdx) => {
                              const modelMove = pair[1]
                              let displayText = modelMove === '>>' ? '>>' : (modelMove || 'τ')
                              let specialClass = ''
                              let customColor = ''
                              
                              if (modelMove === '>>') {
                                displayText = '>>'
                                specialClass = 'skip'
                              } else if (modelMove === null) {
                                displayText = 'τ'
                                specialClass = 'tau'
                              } else {
                                // Regular activity - use unique color
                                customColor = getActivityColor(modelMove)
                              }
                              
                              return (
                                <span 
                                  key={moveIdx}
                                  className={`alignment-move ${specialClass}`}
                                  style={customColor ? { background: customColor, color: 'white' } : {}}
                                  title={modelMove === '>>' ? 'Skip in model' : modelMove === null ? 'Empty transition (τ)' : modelMove}
                                >
                                  {displayText}
                                </span>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : variantDiagnosticsView === 'tbr' && conformanceData.tbr_data && conformanceData.tbr_data.length > 0 ? (
                <div style={{ maxHeight: '600px', overflowY: 'auto', marginTop: '1rem' }}>
                  {conformanceData.tbr_data.map((variantTbr, idx) => (
                    <div key={idx} className="alignment-variant-row">
                      <div className="alignment-header">
                        <span className="alignment-variant-index">#{idx + 1}</span>
                        <span className="alignment-frequency">{variantTbr.frequency} cases</span>
                        <span className={`alignment-fitness ${variantTbr.trace_is_fit ? '' : 'unfit'}`}>
                          {variantTbr.trace_is_fit ? '✓ Fit' : '✗ Unfit'}
                        </span>
                        <span className="alignment-fitness">Fitness: {variantTbr.trace_fitness.toFixed(3)}</span>
                      </div>
                      <div className="tbr-stats-simple">
                        <div>Missing Tokens: <strong>{variantTbr.missing_tokens}</strong></div>
                        <div>Consumed Tokens: <strong>{variantTbr.consumed_tokens}</strong></div>
                        <div>Remaining Tokens: <strong>{variantTbr.remaining_tokens}</strong></div>
                        <div>Produced Tokens: <strong>{variantTbr.produced_tokens}</strong></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', color: '#7f8c8d', marginTop: '1rem', padding: '2rem', background: '#f8f9fa', borderRadius: '8px' }}>
                  <p>Computing diagnostics... This may take a moment for large logs.</p>
                  <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>
                    {variantDiagnosticsView === 'alignments' ? 
                      (conformanceData.alignment_data ? 
                        `No alignment data available (${conformanceData.alignment_data.length} variants processed)` : 
                        'Alignment data not yet loaded') :
                      (conformanceData.tbr_data ?
                        `No TBR data available (${conformanceData.tbr_data.length} variants processed)` :
                        'TBR data not yet loaded')
                    }
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Custom Trace Alignment for Log-Model */}
          {conformanceData && conformanceData.log_metadata && conformanceData.model_metadata && (
            <div style={{ marginTop: '2rem' }}>
              <h3 className="chart-title">Custom Trace Diagnostics</h3>
              <div style={{ marginTop: '1rem', padding: '1.5rem', background: 'white', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)' }}>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: '#2c3e50' }}>
                    Enter custom trace (comma-separated activities):
                  </label>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <input
                      type="text"
                      value={customTrace}
                      onChange={(e) => setCustomTrace(e.target.value)}
                      placeholder="e.g., submitted, pre-accepted, accepted, finalized"
                      className="log-selector"
                      style={{ flex: 1 }}
                    />
                  <button 
                      className="upload-button"
                      onClick={handleComputeCustomAlignment}
                      disabled={computingCustom}
                    >
                      {computingCustom ? 'Computing...' : 'Compute Diagnostics'}
                  </button>
                </div>
                </div>

                {customAlignment && (
                  <>
                    <div className="dfg-type-controls" style={{ marginBottom: '1rem' }}>
                <button 
                        className={`dfg-type-button ${customDiagnosticsView === 'alignments' ? 'active' : ''}`}
                        onClick={() => setCustomDiagnosticsView('alignments')}
                      >
                        Alignments
                      </button>
                      <button 
                        className={`dfg-type-button ${customDiagnosticsView === 'tbr' ? 'active' : ''}`}
                        onClick={() => setCustomDiagnosticsView('tbr')}
                      >
                        TBR
                      </button>
                    </div>

                    {customDiagnosticsView === 'alignments' ? (
                  <div className="alignment-variant-row" style={{ marginTop: '1rem' }}>
                    <div className="alignment-header">
                      <span className="alignment-variant-index">Custom Trace</span>
                      <span className="alignment-fitness">Fitness: {customAlignment.fitness.toFixed(3)}</span>
                    </div>
                    <div className="alignment-container">
                      {/* Log moves (top row) */}
                      <div className="alignment-row">
                        <span className="alignment-row-label">Log:</span>
                        <div className="alignment-sequence">
                          {customAlignment.alignment.map((pair, moveIdx) => {
                            const logMove = pair[0]
                            let displayText = logMove === '>>' ? '>>' : (logMove || 'τ')
                            let specialClass = ''
                            let customColor = ''
                            
                            if (logMove === '>>') {
                              specialClass = 'skip'
                            } else if (logMove === null) {
                              displayText = 'τ'
                              specialClass = 'tau'
                            } else {
                              // Regular activity - use unique color
                              customColor = getActivityColor(logMove)
                            }
                            
                            return (
                              <span 
                                key={moveIdx}
                                className={`alignment-move ${specialClass}`}
                                style={customColor ? { background: customColor, color: 'white' } : {}}
                                title={logMove === '>>' ? 'Skip in log' : logMove === null ? 'Empty transition (τ)' : logMove}
                              >
                                {displayText}
                              </span>
                            )
                          })}
                        </div>
                      </div>
                      {/* Model moves (bottom row) */}
                      <div className="alignment-row">
                        <span className="alignment-row-label">Model:</span>
                        <div className="alignment-sequence">
                          {customAlignment.alignment.map((pair, moveIdx) => {
                            const modelMove = pair[1]
                            let displayText = modelMove === '>>' ? '>>' : (modelMove || 'τ')
                            let specialClass = ''
                            let customColor = ''
                            
                            if (modelMove === '>>') {
                              displayText = '>>'
                              specialClass = 'skip'
                            } else if (modelMove === null) {
                              displayText = 'τ'
                              specialClass = 'tau'
                            } else {
                              // Regular activity - use unique color
                              customColor = getActivityColor(modelMove)
                            }
                            
                            return (
                              <span 
                                key={moveIdx}
                                className={`alignment-move ${specialClass}`}
                                style={customColor ? { background: customColor, color: 'white' } : {}}
                                title={modelMove === '>>' ? 'Skip in model' : modelMove === null ? 'Empty transition (τ)' : modelMove}
                              >
                                {displayText}
                              </span>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                    ) : (
                      <div className="alignment-variant-row" style={{ marginTop: '1rem' }}>
                        <div className="alignment-header">
                          <span className="alignment-variant-index">Custom Trace</span>
                          <span className={`alignment-fitness ${customAlignment.tbr.trace_is_fit ? '' : 'unfit'}`}>
                            {customAlignment.tbr.trace_is_fit ? '✓ Fit' : '✗ Unfit'}
                          </span>
                          <span className="alignment-fitness">Fitness: {customAlignment.tbr.trace_fitness.toFixed(3)}</span>
                        </div>
                        <div className="tbr-stats-simple">
                          <div>Missing Tokens: <strong>{customAlignment.tbr.missing_tokens}</strong></div>
                          <div>Consumed Tokens: <strong>{customAlignment.tbr.consumed_tokens}</strong></div>
                          <div>Remaining Tokens: <strong>{customAlignment.tbr.remaining_tokens}</strong></div>
                          <div>Produced Tokens: <strong>{customAlignment.tbr.produced_tokens}</strong></div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Footprint Matrices for Model-Model */}
          {conformanceData.footprint1_matrix && conformanceData.footprint2_matrix && conformanceData.model1_metadata && (
            <div style={{ marginTop: '2rem' }}>
              <h3 className="chart-title">Footprint Matrices Comparison</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginTop: '1rem' }}>
                {/* Model 1 Footprint Matrix */}
                <div className="footprint-matrix">
                  <h4 style={{ fontSize: '1rem', marginBottom: '1rem', color: '#2c3e50' }}>
                    Model 1: {conformanceData.model1_metadata?.filename}
                  </h4>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="footprint-table">
                      <thead>
                        <tr>
                          <th></th>
                          {conformanceData.footprint1_matrix.activities.map((act, idx) => (
                            <th key={idx} title={act}>{act.substring(0, 5)}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {conformanceData.footprint1_matrix.activities.map((rowAct, rowIdx) => (
                          <tr key={rowIdx}>
                            <th title={rowAct}>{rowAct.substring(0, 6)}</th>
                            {conformanceData.footprint1_matrix!.matrix[rowIdx].map((cell, colIdx) => (
                              <td key={colIdx} className={cell ? (cell === '||' ? 'has-relation parallel-relation' : 'has-relation') : ''}>
                                {cell || '#'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Model 2 Footprint Matrix */}
                <div className="footprint-matrix">
                  <h4 style={{ fontSize: '1rem', marginBottom: '1rem', color: '#2c3e50' }}>
                    Model 2: {conformanceData.model2_metadata?.filename}
                  </h4>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="footprint-table">
                      <thead>
                        <tr>
                          <th></th>
                          {conformanceData.footprint2_matrix.activities.map((act, idx) => (
                            <th key={idx} title={act}>{act.substring(0, 5)}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {conformanceData.footprint2_matrix.activities.map((rowAct, rowIdx) => (
                          <tr key={rowIdx}>
                            <th title={rowAct}>{rowAct.substring(0, 6)}</th>
                            {conformanceData.footprint2_matrix!.matrix[rowIdx].map((cell, colIdx) => (
                              <td key={colIdx} className={cell ? (cell === '||' ? 'has-relation parallel-relation' : 'has-relation') : ''}>
                                {cell || '#'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Visualizations */}
          <div className="charts-section-stacked" style={{ marginTop: '2rem' }}>
            {/* Log-Log visualizations */}
            {conformanceData.log1_svg && conformanceData.log2_svg && (
              <>
                <div className="svg-viewer-container">
                  <h3 className="chart-title">Log 1 DFG: {conformanceData.log1_metadata?.filename}</h3>
                  <div className="svg-controls">
                    <div className="zoom-controls">
                      <button className="zoom-button" onClick={zoomOut1}>−</button>
                      <span className="zoom-info">Zoom: {Math.round(zoom1 * 100)}%</span>
                      <button className="zoom-button" onClick={zoomIn1}>+</button>
                    </div>
                    <button className="reset-button" onClick={resetView1}>
                  Reset View
                </button>
              </div>
                  <div 
                    className="svg-viewer"
                    ref={svg1Ref}
                    onMouseDown={handleMouseDown1}
                    onMouseMove={handleMouseMove1}
                    onMouseUp={handleMouseUp1}
                    onMouseLeave={handleMouseUp1}
                    style={{ cursor: isDragging1 ? 'grabbing' : 'grab' }}
                  >
                    <div
                      className="svg-content"
                      style={{
                        transform: `translate(${position1.x}px, ${position1.y}px) scale(${zoom1})`,
                        transformOrigin: '0 0'
                      }}
                      dangerouslySetInnerHTML={{ __html: conformanceData.log1_svg }}
                    />
                  </div>
                </div>
                <div className="svg-viewer-container">
                  <h3 className="chart-title">Log 2 DFG: {conformanceData.log2_metadata?.filename}</h3>
                  <div className="svg-controls">
                    <div className="zoom-controls">
                      <button className="zoom-button" onClick={zoomOut2}>−</button>
                      <span className="zoom-info">Zoom: {Math.round(zoom2 * 100)}%</span>
                      <button className="zoom-button" onClick={zoomIn2}>+</button>
                    </div>
                    <button className="reset-button" onClick={resetView2}>
                      Reset View
                    </button>
            </div>
            <div 
                    className="svg-viewer"
                    ref={svg2Ref}
                    onMouseDown={handleMouseDown2}
                    onMouseMove={handleMouseMove2}
                    onMouseUp={handleMouseUp2}
                    onMouseLeave={handleMouseUp2}
                    style={{ cursor: isDragging2 ? 'grabbing' : 'grab' }}
            >
              <div 
                className="svg-content"
                style={{
                        transform: `translate(${position2.x}px, ${position2.y}px) scale(${zoom2})`,
                        transformOrigin: '0 0'
                }}
                      dangerouslySetInnerHTML={{ __html: conformanceData.log2_svg }}
              />
            </div>
          </div>
              </>
            )}

            {/* Log-Model visualizations */}
            {conformanceData.log_svg && conformanceData.model_svg && (
              <>
                <div className="svg-viewer-container">
                  <h3 className="chart-title">Log DFG: {conformanceData.log_metadata?.filename}</h3>
                  <div className="svg-controls">
                    <div className="zoom-controls">
                      <button className="zoom-button" onClick={zoomOut1}>−</button>
                      <span className="zoom-info">Zoom: {Math.round(zoom1 * 100)}%</span>
                      <button className="zoom-button" onClick={zoomIn1}>+</button>
        </div>
                    <button className="reset-button" onClick={resetView1}>
                      Reset View
                    </button>
                  </div>
                  <div 
                    className="svg-viewer"
                    ref={svg1Ref}
                    onMouseDown={handleMouseDown1}
                    onMouseMove={handleMouseMove1}
                    onMouseUp={handleMouseUp1}
                    onMouseLeave={handleMouseUp1}
                    style={{ cursor: isDragging1 ? 'grabbing' : 'grab' }}
                  >
                    <div
                      className="svg-content"
                      style={{
                        transform: `translate(${position1.x}px, ${position1.y}px) scale(${zoom1})`,
                        transformOrigin: '0 0'
                      }}
                      dangerouslySetInnerHTML={{ __html: conformanceData.log_svg }}
                    />
                  </div>
                </div>
                <div className="svg-viewer-container">
                  <h3 className="chart-title">Petri Net: {conformanceData.model_metadata?.filename}</h3>
                  <div className="svg-controls">
                    <div className="zoom-controls">
                      <button className="zoom-button" onClick={zoomOut2}>−</button>
                      <span className="zoom-info">Zoom: {Math.round(zoom2 * 100)}%</span>
                      <button className="zoom-button" onClick={zoomIn2}>+</button>
                    </div>
                    <button className="reset-button" onClick={resetView2}>
                      Reset View
                    </button>
                  </div>
                  <div 
                    className="svg-viewer"
                    ref={svg2Ref}
                    onMouseDown={handleMouseDown2}
                    onMouseMove={handleMouseMove2}
                    onMouseUp={handleMouseUp2}
                    onMouseLeave={handleMouseUp2}
                    style={{ cursor: isDragging2 ? 'grabbing' : 'grab' }}
                  >
                    <div
                      className="svg-content"
                      style={{
                        transform: `translate(${position2.x}px, ${position2.y}px) scale(${zoom2})`,
                        transformOrigin: '0 0'
                      }}
                      dangerouslySetInnerHTML={{ __html: conformanceData.model_svg }}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Model-Model visualizations */}
            {conformanceData.model1_svg && conformanceData.model2_svg && (
              <>
                <div className="svg-viewer-container">
                  <h3 className="chart-title">Model 1: {conformanceData.model1_metadata?.filename}</h3>
                  <div className="svg-controls">
                    <div className="zoom-controls">
                      <button className="zoom-button" onClick={zoomOut1}>−</button>
                      <span className="zoom-info">Zoom: {Math.round(zoom1 * 100)}%</span>
                      <button className="zoom-button" onClick={zoomIn1}>+</button>
                    </div>
                    <button className="reset-button" onClick={resetView1}>
                      Reset View
                    </button>
                  </div>
                  <div 
                    className="svg-viewer"
                    ref={svg1Ref}
                    onMouseDown={handleMouseDown1}
                    onMouseMove={handleMouseMove1}
                    onMouseUp={handleMouseUp1}
                    onMouseLeave={handleMouseUp1}
                    style={{ cursor: isDragging1 ? 'grabbing' : 'grab' }}
                  >
                    <div
                      className="svg-content"
                      style={{
                        transform: `translate(${position1.x}px, ${position1.y}px) scale(${zoom1})`,
                        transformOrigin: '0 0'
                      }}
                      dangerouslySetInnerHTML={{ __html: conformanceData.model1_svg }}
                    />
                  </div>
                </div>
                <div className="svg-viewer-container">
                  <h3 className="chart-title">Model 2: {conformanceData.model2_metadata?.filename}</h3>
                  <div className="svg-controls">
                    <div className="zoom-controls">
                      <button className="zoom-button" onClick={zoomOut2}>−</button>
                      <span className="zoom-info">Zoom: {Math.round(zoom2 * 100)}%</span>
                      <button className="zoom-button" onClick={zoomIn2}>+</button>
                    </div>
                    <button className="reset-button" onClick={resetView2}>
                      Reset View
                    </button>
                  </div>
                  <div 
                    className="svg-viewer"
                    ref={svg2Ref}
                    onMouseDown={handleMouseDown2}
                    onMouseMove={handleMouseMove2}
                    onMouseUp={handleMouseUp2}
                    onMouseLeave={handleMouseUp2}
                    style={{ cursor: isDragging2 ? 'grabbing' : 'grab' }}
                  >
                    <div
                      className="svg-content"
                      style={{
                        transform: `translate(${position2.x}px, ${position2.y}px) scale(${zoom2})`,
                        transformOrigin: '0 0'
                      }}
                      dangerouslySetInnerHTML={{ __html: conformanceData.model2_svg }}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default Conformance
