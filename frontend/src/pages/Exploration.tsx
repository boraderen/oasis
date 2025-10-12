import { useNavigate } from 'react-router-dom'
import { useState, useRef, useEffect } from 'react'
import './Page.css'
import ActivityPieChart from '../components/ActivityPieChart'
import TraceVariantPieChart from '../components/TraceVariantPieChart'

interface UploadData {
  message: string
  filename: string
  status: string
}

interface DFGData {
  message: string
  svg_content: string
  activity_threshold: number
  path_threshold: number
  status: string
}

interface StatsData {
  message: string
  insights: LogInsights
  status: string
}

interface LogInsights {
  num_events: number
  num_cases: number
  num_activities: number
  num_trace_variants: number
  activity_frequencies: Record<string, number>
  activity_case_counts: Record<string, number>
  trace_variants: TraceVariant[]
  start_activities: Record<string, number>
  end_activities: Record<string, number>
  error?: string
}

interface TraceVariant {
  activities: string[]
  frequency: number
  percentage: number
}

function Exploration() {
  const navigate = useNavigate()
  const [uploading, setUploading] = useState(false)
  const [uploadData, setUploadData] = useState<UploadData | null>(null)
  const [dfgData, setDfgData] = useState<DFGData | null>(null)
  const [statsData, setStatsData] = useState<StatsData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [dfgLoading, setDfgLoading] = useState(false)
  const [statsLoading, setStatsLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const svgContainerRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [isInitialized, setIsInitialized] = useState(false)
  const [activitySliderValue, setActivitySliderValue] = useState(0.5)
  const [pathSliderValue, setPathSliderValue] = useState(0.2)
  const [isActivitySliderDragging, setIsActivitySliderDragging] = useState(false)
  const [isPathSliderDragging, setIsPathSliderDragging] = useState(false)
  const activitySliderRef = useRef<HTMLDivElement>(null)
  const pathSliderRef = useRef<HTMLDivElement>(null)

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError(null)
    setSuccessMessage(null)
    setUploadData(null)
    setDfgData(null)
    setStatsData(null)

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
        setUploadData(result)
        setSuccessMessage(`Successfully uploaded and processed ${result.filename}`)
        setIsInitialized(false) // Reset initialization flag for new upload
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

  const handleUpdateDFG = async () => {
    setDfgLoading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('activity_threshold', activitySliderValue.toString())
      formData.append('path_threshold', pathSliderValue.toString())

      const response = await fetch('http://localhost:8000/api/update_dfg', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()
      
      if (result.status === 'success') {
        setDfgData(result)
        setIsInitialized(false) // Reset initialization for new DFG
      } else {
        setError(result.message || 'DFG update failed')
      }
    } catch (err) {
      setError('Failed to connect to server')
    } finally {
      setDfgLoading(false)
    }
  }

  const handleUpdateStats = async () => {
    setStatsLoading(true)
    setError(null)

    try {
      const response = await fetch('http://localhost:8000/api/update_stats', {
        method: 'POST',
      })

      const result = await response.json()
      
      if (result.status === 'success') {
        setStatsData(result)
      } else {
        setError(result.message || 'Statistics update failed')
      }
    } catch (err) {
      setError('Failed to connect to server')
    } finally {
      setStatsLoading(false)
    }
  }

  // Zoom functionality
  const zoomIn = () => {
    setZoom(prev => Math.min(5, prev * 1.2))
  }

  const zoomOut = () => {
    setZoom(prev => Math.max(0.1, prev * 0.8))
  }

  // Drag functionality
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  // Reset view
  const resetView = () => {
    setZoom(0.8)
    setPosition({ x: 0, y: 0 })
    setIsInitialized(false)
  }

  // Activity Slider functionality
  const handleActivitySliderMouseDown = (e: React.MouseEvent) => {
    setIsActivitySliderDragging(true)
    e.preventDefault()
  }


  const handleActivitySliderClick = (e: React.MouseEvent) => {
    if (activitySliderRef.current) {
      const rect = activitySliderRef.current.getBoundingClientRect()
      const y = e.clientY - rect.top
      const percentage = Math.max(0, Math.min(1, y / rect.height))
      const newValue = 1 - percentage
      setActivitySliderValue(newValue)
    }
  }

  // Path Slider functionality
  const handlePathSliderMouseDown = (e: React.MouseEvent) => {
    setIsPathSliderDragging(true)
    e.preventDefault()
  }


  const handlePathSliderClick = (e: React.MouseEvent) => {
    if (pathSliderRef.current) {
      const rect = pathSliderRef.current.getBoundingClientRect()
      const y = e.clientY - rect.top
      const percentage = Math.max(0, Math.min(1, y / rect.height))
      const newValue = 1 - percentage
      setPathSliderValue(newValue)
    }
  }


  // Global mouse events for activity slider
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isActivitySliderDragging && activitySliderRef.current) {
        const rect = activitySliderRef.current.getBoundingClientRect()
        const y = e.clientY - rect.top
        const percentage = Math.max(0, Math.min(1, y / rect.height))
        const newValue = 1 - percentage
        setActivitySliderValue(newValue)
      }
    }

    const handleGlobalMouseUp = () => {
      setIsActivitySliderDragging(false)
    }

    if (isActivitySliderDragging) {
      document.addEventListener('mousemove', handleGlobalMouseMove)
      document.addEventListener('mouseup', handleGlobalMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove)
      document.removeEventListener('mouseup', handleGlobalMouseUp)
    }
  }, [isActivitySliderDragging, pathSliderValue])

  // Global mouse events for path slider
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isPathSliderDragging && pathSliderRef.current) {
        const rect = pathSliderRef.current.getBoundingClientRect()
        const y = e.clientY - rect.top
        const percentage = Math.max(0, Math.min(1, y / rect.height))
        const newValue = 1 - percentage
        setPathSliderValue(newValue)
      }
    }

    const handleGlobalMouseUp = () => {
      setIsPathSliderDragging(false)
    }

    if (isPathSliderDragging) {
      document.addEventListener('mousemove', handleGlobalMouseMove)
      document.addEventListener('mouseup', handleGlobalMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove)
      document.removeEventListener('mouseup', handleGlobalMouseUp)
    }
  }, [isPathSliderDragging, activitySliderValue])

  // Center SVG when first loaded
  useEffect(() => {
    if (dfgData && !isInitialized && svgContainerRef.current) {
      const container = svgContainerRef.current
      const containerRect = container.getBoundingClientRect()
      
      // Center the SVG within the container
      const centerX = (containerRect.width - containerRect.width * 0.8) / 2
      const centerY = (containerRect.height - containerRect.height * 0.8) / 2
      
      setPosition({ x: centerX, y: centerY })
      setZoom(0.8) // Start with 80% zoom for better overview
      setIsInitialized(true)
    }
  }, [dfgData, isInitialized])


  return (
    <div className="page">
      <img 
        src="/icon.png" 
        alt="Oasis" 
        className="logo-icon" 
        onClick={() => navigate('/')}
      />
      <h1 className="page-title">Exploration</h1>
      <div className="page-description">
        <p className="page-content">
          <strong>Process Exploration Tool:</strong> Upload an event log (.xes or .csv) to explore and analyze your process data through Directly-Follows Graphs (DFG) and comprehensive statistics. Understand your process behavior before applying discovery algorithms.
        </p>
        <div className="info-section">
          <h3>What You'll Get:</h3>
          <ul>
            <li><strong>Directly-Follows Graph (DFG):</strong> Visual representation of activity sequences and frequencies</li>
            <li><strong>Process Statistics:</strong> Detailed analysis of events, cases, activities, and trace variants</li>
            <li><strong>Activity Analysis:</strong> Frequency distribution and case coverage for each activity</li>
            <li><strong>Trace Variants:</strong> Different execution paths and their occurrence patterns</li>
          </ul>
        </div>
        <div className="info-section">
          <h3>DFG Controls:</h3>
          <ul>
            <li><strong>Activity Threshold:</strong> Filter out activities below this frequency percentage</li>
            <li><strong>Path Threshold:</strong> Filter out paths below this frequency percentage</li>
            <li><strong>Zoom & Pan:</strong> Navigate large graphs with mouse controls</li>
          </ul>
        </div>
        <div className="info-section">
          <h3>How to Use:</h3>
          <ol>
            <li>Upload your event log file</li>
            <li>Click "Generate DFG" to create the Directly-Follows Graph</li>
            <li>Click "Generate Statistics" to analyze process data</li>
            <li>Adjust sliders and regenerate DFG to explore different views</li>
            <li>Use insights to inform your process discovery strategy</li>
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

      {uploadData && (
        <div className="svg-viewer-container">
          <h2 className="insights-title">DFG</h2>
          <div className="svg-controls">
            <div className="zoom-controls">
              <button className="zoom-button" onClick={zoomOut}>−</button>
              <span className="zoom-info">Zoom: {Math.round(zoom * 100)}%</span>
              <button className="zoom-button" onClick={zoomIn}>+</button>
            </div>
            <button className="reset-button" onClick={resetView}>
              Reset View
            </button>
            <button 
              className="discover-button"
              onClick={handleUpdateDFG}
              disabled={dfgLoading}
            >
              {dfgLoading ? 'Generating...' : 'Generate DFG'}
            </button>
          </div>
          <div className="svg-main-content">
            <div 
              className="svg-viewer"
              ref={svgContainerRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
            >
              {dfgData ? (
                <div
                  className="svg-content"
                  style={{
                    transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
                    transformOrigin: '0 0'
                  }}
                  dangerouslySetInnerHTML={{ __html: dfgData.svg_content }}
                />
              ) : (
                <div className="empty-svg-placeholder">
                  <p>Click "Generate DFG" to create the Directly-Follows Graph</p>
                </div>
              )}
            </div>
            <div className="sliders-container-vertical">
              <div className="vertical-slider-container">
                <div className="slider-label">Activities</div>
                <div className="slider-value-display">
                  {Math.round(activitySliderValue * 100)}%
                </div>
                <div 
                  className="slider-track"
                  ref={activitySliderRef}
                  onClick={handleActivitySliderClick}
                >
                  <div 
                    className="slider-thumb"
                    style={{
                      bottom: `${activitySliderValue * 100}%`
                    }}
                    onMouseDown={handleActivitySliderMouseDown}
                  />
                </div>
              </div>
              <div className="vertical-slider-container">
                <div className="slider-label">Paths</div>
                <div className="slider-value-display">
                  {Math.round(pathSliderValue * 100)}%
                </div>
                <div 
                  className="slider-track"
                  ref={pathSliderRef}
                  onClick={handlePathSliderClick}
                >
                  <div 
                    className="slider-thumb"
                    style={{
                      bottom: `${pathSliderValue * 100}%`
                    }}
                    onMouseDown={handlePathSliderMouseDown}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {uploadData && (
        <div className="insights-container">
          <h2 className="insights-title">Log Analysis</h2>
          
          <div className="stats-button-container">
            <button 
              className="discover-button"
              onClick={handleUpdateStats}
              disabled={statsLoading}
            >
              {statsLoading ? 'Generating...' : 'Generate Statistics'}
            </button>
          </div>
          
          {statsData ? (
            <>
          
          {/* Statistics Cards */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{statsData.insights.num_events}</div>
              <div className="stat-label">Events</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{statsData.insights.num_cases}</div>
              <div className="stat-label">Cases</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{statsData.insights.num_activities}</div>
              <div className="stat-label">Activities</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{statsData.insights.num_trace_variants}</div>
              <div className="stat-label">Trace Variants</div>
            </div>
          </div>

          {/* Charts Section - Stacked Layout */}
          <div className="charts-section-stacked">
            {/* Activity Analysis */}
            <div className="chart-container">
              <h3 className="chart-title">Activity Analysis</h3>
              <div className="bar-chart">
                  {Object.entries(statsData.insights?.activity_frequencies || {})
                    .sort(([,a], [,b]) => b - a)
                    .map(([activity, frequency], index) => {
                      // Get case count and percentage for this activity
                      const casesWithActivity = statsData.insights?.activity_case_counts?.[activity] || 0
                      const casePercentage = ((casesWithActivity / (statsData.insights?.num_cases || 1)) * 100).toFixed(1)
                      
                      return (
                        <div key={activity} className="bar-item">
                          <div className="bar-label">
                            <div className="activity-name">{activity}</div>
                          </div>
                          <div className="bar-wrapper">
                            <div 
                              className="bar-fill"
                              style={{ 
                                 width: `${(frequency / Math.max(...Object.values(statsData.insights?.activity_frequencies || {}))) * 100}%`,
                                backgroundColor: `hsl(${(index * 60) % 360}, 70%, 60%)`
                              }}
                            />
                          </div>
                          <div className="bar-value">
                            <div className="frequency-count">{frequency} cases</div>
                            <div className="case-info">
                              present in {casePercentage}% of the cases
                            </div>
                          </div>
                        </div>
                      )
                    })}
              </div>
              
              {/* Activity Distribution Pie Chart */}
              <ActivityPieChart 
                activityFrequencies={statsData.insights.activity_frequencies}
                totalEvents={statsData.insights.num_events}
              />
            </div>

            {/* Trace Variants Analysis */}
            <div className="chart-container">
              <h3 className="chart-title">Trace Variants Analysis</h3>
              
              {/* Trace Variants Sequence */}
              <div className="trace-variants-sequence">
                {statsData.insights?.trace_variants?.map((variant, variantIndex) => (
                  <div key={variantIndex} className="trace-variant-row">
                    <div className="variant-number">{variantIndex + 1}</div>
                    <div className="variant-sequence">
                      {variant.activities.map((activity, activityIndex) => {
                        // Get consistent color for this activity across all variants
                         const activityColorIndex = Object.keys(statsData.insights?.activity_frequencies || {}).indexOf(activity)
                        const activityColor = `hsl(${(activityColorIndex * 60) % 360}, 70%, 60%)`
                        
                        return (
                          <div
                            key={activityIndex}
                            className="activity-block"
                            style={{ backgroundColor: activityColor }}
                          >
                            {activity}
                          </div>
                        )
                      })}
                    </div>
                    <div className="variant-stats">
                      {variant.frequency} times, {variant.percentage}%
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Trace Variant Distribution Pie Chart */}
              <TraceVariantPieChart 
                traceVariants={statsData.insights.trace_variants}
                totalCases={statsData.insights.num_cases}
              />

            </div>
          </div>
            </>
          ) : (
            <div className="empty-stats-placeholder">
              <p>Click "Generate Statistics" to analyze the event log</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default Exploration
