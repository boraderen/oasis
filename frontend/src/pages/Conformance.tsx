import { useNavigate } from 'react-router-dom'
import { useState, useRef, useEffect } from 'react'
import './Page.css'

interface UploadData {
  message: string
  filename: string
  status: string
  svg_content?: string
}

interface ConformanceData {
  message: string
  svg_content: string
  tbr_fitness: number
  align_fitness: number | string
  tbr_precision: number
  align_precision: number | string
  tbr_f1: number
  align_f1: number | string
  mean_fitness: number
  mean_precision: number
  simplicity: number
  status: string
}

function Conformance() {
  const navigate = useNavigate()
  const [uploadingLog, setUploadingLog] = useState(false)
  const [uploadingModel, setUploadingModel] = useState(false)
  const [runningConformance, setRunningConformance] = useState(false)
  const [logData, setLogData] = useState<UploadData | null>(null)
  const [modelData, setModelData] = useState<UploadData | null>(null)
  const [conformanceData, setConformanceData] = useState<ConformanceData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const logFileInputRef = useRef<HTMLInputElement>(null)
  const modelFileInputRef = useRef<HTMLInputElement>(null)
  
  // SVG zoom and drag state
  const [svgScale, setSvgScale] = useState(1)
  const [svgPosition, setSvgPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const svgContainerRef = useRef<HTMLDivElement>(null)

  const handleLogUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploadingLog(true)
    setError(null)
    setSuccessMessage(null)
    setLogData(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch('http://localhost:8000/api/upload_log', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()
      
      if (result.status === 'success') {
        setLogData(result)
        setSuccessMessage(`Successfully uploaded event log: ${result.filename}`)
      } else {
        setError(result.message || 'Log upload failed')
      }
    } catch (err) {
      setError('Failed to connect to server')
    } finally {
      setUploadingLog(false)
    }
  }

  const handleModelUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploadingModel(true)
    setError(null)
    setSuccessMessage(null)
    setModelData(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch('http://localhost:8000/api/upload_model', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()
      
      if (result.status === 'success') {
        setModelData(result)
        setSuccessMessage(`Successfully uploaded model: ${result.filename}`)
      } else {
        setError(result.message || 'Model upload failed')
      }
    } catch (err) {
      setError('Failed to connect to server')
    } finally {
      setUploadingModel(false)
    }
  }

  const handleConformanceCheck = async () => {
    if (!logData || !modelData) {
      setError('Please upload both an event log and a model first')
      return
    }

    setRunningConformance(true)
    setError(null)
    setConformanceData(null)

    try {
      const response = await fetch('http://localhost:8000/api/conformance', {
        method: 'POST',
      })

      const result = await response.json()
      
      if (result.status === 'success') {
        setConformanceData(result)
        setSuccessMessage('Conformance checking completed successfully')
      } else {
        setError(result.message || 'Conformance checking failed')
      }
    } catch (err) {
      setError('Failed to connect to server')
    } finally {
      setRunningConformance(false)
    }
  }

  const triggerLogFileInput = () => {
    logFileInputRef.current?.click()
  }

  const triggerModelFileInput = () => {
    modelFileInputRef.current?.click()
  }

  // SVG zoom and drag handlers
  const handleZoomIn = () => {
    const zoomStep = 0.1 // 10% zoom step
    const newScale = Math.max(0.1, Math.min(3, svgScale + zoomStep))
    setSvgScale(newScale)
  }

  const handleZoomOut = () => {
    const zoomStep = 0.1 // 10% zoom step
    const newScale = Math.max(0.1, Math.min(3, svgScale - zoomStep))
    setSvgScale(newScale)
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    setDragStart({ x: e.clientX - svgPosition.x, y: e.clientY - svgPosition.y })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    setSvgPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleMouseEnter = () => {
    document.body.style.overflow = 'hidden'
  }

  const handleMouseLeave = () => {
    document.body.style.overflow = 'auto'
    setIsDragging(false)
  }

  const resetSvgView = () => {
    setSvgScale(1)
    setSvgPosition({ x: 0, y: 0 })
  }

  // Reset SVG view when new conformance data arrives
  useEffect(() => {
    if (conformanceData) {
      resetSvgView()
    }
  }, [conformanceData])

  // Cleanup effect to restore scroll when component unmounts
  useEffect(() => {
    return () => {
      document.body.style.overflow = 'auto'
    }
  }, [])

  return (
    <div className="page">
      <img 
        src="/icon.png" 
        alt="Oasis" 
        className="logo-icon" 
        onClick={() => navigate('/')}
      />
      <h1 className="page-title">Conformance Checking</h1>
      
      <div className="page-description">
        <p className="page-content">
          <strong>Conformance Checking Tool:</strong> Upload an event log and a process model (.pnml or .bpmn) to analyze how well the model fits the observed behavior in the log. This helps validate process models and identify deviations.
        </p>
        <div className="info-section">
          <h3>What is Conformance Checking?</h3>
          <p>Conformance checking compares a process model against an event log to measure:</p>
          <ul>
            <li><strong>Fitness:</strong> How well the model can reproduce the behavior in the log</li>
            <li><strong>Precision:</strong> How specific the model is to the observed behavior</li>
            <li><strong>F1-Measure:</strong> Balanced quality metric combining fitness and precision</li>
            <li><strong>Simplicity:</strong> Model complexity relative to log characteristics</li>
          </ul>
        </div>
        <div className="info-section">
          <h3>How to Use:</h3>
          <ol>
            <li>Upload your event log file (.xes or .csv)</li>
            <li>Upload your process model (.pnml or .bpmn)</li>
            <li>Click "Run Conformance Check" to analyze the model</li>
            <li>Review the metrics and visual model to understand conformance quality</li>
          </ol>
        </div>
      </div>

      <div className="upload-section">
        <div className="upload-group">
          <input
            type="file"
            ref={logFileInputRef}
            onChange={handleLogUpload}
            accept=".xes,.csv"
            style={{ display: 'none' }}
          />
          <button 
            className="upload-button"
            onClick={triggerLogFileInput}
            disabled={uploadingLog}
          >
            {uploadingLog ? 'Processing...' : 'Upload Event Log'}
          </button>
          {logData && (
            <div className="upload-status success">
              ✓ Log uploaded: {logData.filename}
            </div>
          )}
        </div>

        <div className="upload-group">
          <input
            type="file"
            ref={modelFileInputRef}
            onChange={handleModelUpload}
            accept=".pnml,.bpmn"
            style={{ display: 'none' }}
          />
          <button 
            className="upload-button"
            onClick={triggerModelFileInput}
            disabled={uploadingModel}
          >
            {uploadingModel ? 'Processing...' : 'Upload Model'}
          </button>
          {modelData && (
            <div className="upload-status success">
              ✓ Model uploaded: {modelData.filename}
            </div>
          )}
        </div>

        <div className="conformance-button-container">
          <button 
            className="conformance-button"
            onClick={handleConformanceCheck}
            disabled={runningConformance || !logData || !modelData}
          >
            {runningConformance ? 'Running Conformance Check...' : 'Run Conformance Check'}
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

      {conformanceData && (
        <div className="conformance-results">
          <h2>Conformance Results</h2>
          
          <div className="metrics-container">
            {/* Token-Based Replay Group */}
            <div className="metric-group">
              <h3 className="group-title">Token-Based Replay</h3>
              <div className="group-metrics">
                <div className="metric-item">
                  <div className="metric-info">
                    <span className="metric-label">Fitness</span>
                    <span className="metric-value">{conformanceData.tbr_fitness.toFixed(3)}</span>
                  </div>
                  <div className="metric-bar">
                    <div 
                      className="bar-fill" 
                      style={{ width: `${conformanceData.tbr_fitness * 100}%` }}
                    ></div>
                  </div>
                </div>
                <div className="metric-item">
                  <div className="metric-info">
                    <span className="metric-label">Precision</span>
                    <span className="metric-value">{conformanceData.tbr_precision.toFixed(3)}</span>
                  </div>
                  <div className="metric-bar">
                    <div 
                      className="bar-fill" 
                      style={{ width: `${conformanceData.tbr_precision * 100}%` }}
                    ></div>
                  </div>
                </div>
                <div className="metric-item">
                  <div className="metric-info">
                    <span className="metric-label">F1-Measure</span>
                    <span className="metric-value">{conformanceData.tbr_f1.toFixed(3)}</span>
                  </div>
                  <div className="metric-bar">
                    <div 
                      className="bar-fill" 
                      style={{ width: `${conformanceData.tbr_f1 * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Alignment-Based Group */}
            <div className="metric-group">
              <h3 className="group-title">Alignment-Based</h3>
              <div className="group-metrics">
                <div className="metric-item">
                  <div className="metric-info">
                    <span className="metric-label">Fitness</span>
                    <span className="metric-value">
                      {typeof conformanceData.align_fitness === 'number' 
                        ? conformanceData.align_fitness.toFixed(3) 
                        : conformanceData.align_fitness}
                    </span>
                  </div>
                  <div className="metric-bar">
                    <div 
                      className="bar-fill" 
                      style={{ 
                        width: typeof conformanceData.align_fitness === 'number' 
                          ? `${conformanceData.align_fitness * 100}%` 
                          : '0%' 
                      }}
                    ></div>
                  </div>
                </div>
                <div className="metric-item">
                  <div className="metric-info">
                    <span className="metric-label">Precision</span>
                    <span className="metric-value">
                      {typeof conformanceData.align_precision === 'number' 
                        ? conformanceData.align_precision.toFixed(3) 
                        : conformanceData.align_precision}
                    </span>
                  </div>
                  <div className="metric-bar">
                    <div 
                      className="bar-fill" 
                      style={{ 
                        width: typeof conformanceData.align_precision === 'number' 
                          ? `${conformanceData.align_precision * 100}%` 
                          : '0%' 
                      }}
                    ></div>
                  </div>
                </div>
                <div className="metric-item">
                  <div className="metric-info">
                    <span className="metric-label">F1-Measure</span>
                    <span className="metric-value">
                      {typeof conformanceData.align_f1 === 'number' 
                        ? conformanceData.align_f1.toFixed(3) 
                        : conformanceData.align_f1}
                    </span>
                  </div>
                  <div className="metric-bar">
                    <div 
                      className="bar-fill" 
                      style={{ 
                        width: typeof conformanceData.align_f1 === 'number' 
                          ? `${conformanceData.align_f1 * 100}%` 
                          : '0%' 
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Overall Group */}
            <div className="metric-group">
              <h3 className="group-title">Overall Quality</h3>
              <div className="group-metrics">
                <div className="metric-item">
                  <div className="metric-info">
                    <span className="metric-label">Mean Fitness</span>
                    <span className="metric-value">{conformanceData.mean_fitness.toFixed(3)}</span>
                  </div>
                  <div className="metric-bar">
                    <div 
                      className="bar-fill" 
                      style={{ width: `${conformanceData.mean_fitness * 100}%` }}
                    ></div>
                  </div>
                </div>
                <div className="metric-item">
                  <div className="metric-info">
                    <span className="metric-label">Mean Precision</span>
                    <span className="metric-value">{conformanceData.mean_precision.toFixed(3)}</span>
                  </div>
                  <div className="metric-bar">
                    <div 
                      className="bar-fill" 
                      style={{ width: `${conformanceData.mean_precision * 100}%` }}
                    ></div>
                  </div>
                </div>
                <div className="metric-item">
                  <div className="metric-info">
                    <span className="metric-label">Simplicity</span>
                    <span className="metric-value">{conformanceData.simplicity.toFixed(3)}</span>
                  </div>
                  <div className="metric-bar">
                    <div 
                      className="bar-fill" 
                      style={{ width: `${Math.min(conformanceData.simplicity * 100, 100)}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Process Model Visualization */}
          <div className="model-visualization">
            <div className="svg-controls">
              <h3>Process Model</h3>
              <div className="svg-control-buttons">
                <div className="zoom-controls">
                  <button 
                    className="zoom-button"
                    onClick={handleZoomOut}
                    disabled={svgScale <= 0.1}
                  >
                    −
                  </button>
                  <div className="zoom-info">
                    {Math.round(svgScale * 100)}%
                  </div>
                  <button 
                    className="zoom-button"
                    onClick={handleZoomIn}
                    disabled={svgScale >= 3}
                  >
                    +
                  </button>
                </div>
                <button 
                  className="reset-button"
                  onClick={resetSvgView}
                >
                  Reset View
                </button>
              </div>
            </div>
            <div 
              ref={svgContainerRef}
              className="svg-container"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
              style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
            >
              <div 
                className="svg-content"
                style={{
                  transform: `translate(${svgPosition.x}px, ${svgPosition.y}px) scale(${svgScale})`,
                  transformOrigin: 'center center'
                }}
                dangerouslySetInnerHTML={{ __html: conformanceData.svg_content }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Conformance
