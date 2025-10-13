import { useNavigate } from 'react-router-dom'
import { useState, useRef, useEffect } from 'react'
import './Page.css'
import ActivityPieChart from '../components/ActivityPieChart'
import TraceVariantPieChart from '../components/TraceVariantPieChart'

interface LogItem {
  filename: string
  uploaded_at: string
  num_events: number
  num_cases: number
  num_activities: number
}

interface VariantItem {
  activities: string[]
  frequency: number
}

interface ExploreData {
  message: string
  regular_svg_content: string
  performance_svg_content: string
  insights: LogInsights
  log_metadata: LogItem
  available_activities: string[]
  available_variants: VariantItem[]
  dotted_chart_svg: string
  case_duration_svg: string
  events_per_time_svg: string
  event_distribution_svg: string
  first_20_events: any[]
  footprint_matrix: {
    activities: string[]
    matrix: string[][]
  }
  status: string
}

interface LogInsights {
  num_events: number
  num_cases: number
  num_activities: number
  num_trace_variants: number
  activity_frequencies: Record<string, number>
  activity_case_counts: Record<string, number>
  activity_durations: Record<string, ActivityDuration>
  trace_variants: TraceVariant[]
  start_activities: Record<string, number>
  end_activities: Record<string, number>
  log_avg_tpt: number
  log_min_tpt: number
  log_max_tpt: number
  log_median_tpt: number
  error?: string
}

interface ActivityDuration {
  avg: number
  min: number
  max: number
  median: number
}

interface TraceVariant {
  activities: string[]
  frequency: number
  percentage: number
  avg_tpt: number
  min_tpt: number
  max_tpt: number
  median_tpt: number
}

// Helper function to format duration in human-readable format
const formatDuration = (seconds: number): string => {
  if (seconds === 0) return '0s';
  
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
  
  return parts.join(' ');
};

function Exploration() {
  const navigate = useNavigate()
  const [logs, setLogs] = useState<LogItem[]>([])
  const [selectedLogIndex, setSelectedLogIndex] = useState<number>(-1)
  const [exploreData, setExploreData] = useState<ExploreData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const svgContainerRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [isInitialized, setIsInitialized] = useState(false)
  
  // Filter controls
  const [selectedActivities, setSelectedActivities] = useState<string[]>([])
  const [selectedVariants, setSelectedVariants] = useState<string[][]>([])
  const [filtersInitialized, setFiltersInitialized] = useState(false)
  
  // Sorting state for variants table
  const [sortColumn, setSortColumn] = useState<'index' | 'freq' | 'percentage' | 'avg_tpt' | 'min_tpt' | 'max_tpt' | 'median_tpt'>('freq')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  
  // Sorting state for activities table
  const [activitySortColumn, setActivitySortColumn] = useState<'activity' | 'freq' | 'cases' | 'avg_dur' | 'min_dur' | 'max_dur' | 'median_dur'>('freq')
  const [activitySortDirection, setActivitySortDirection] = useState<'asc' | 'desc'>('desc')
  
  // DFG type state
  const [dfgType, setDfgType] = useState<'regular' | 'performance'>('regular')
  
  // Event distribution type state
  const [distributionType, setDistributionType] = useState<string>('days_week')
  
  // Visualization state
  const [activeVisualization, setActiveVisualization] = useState<'dotted' | 'duration' | 'time' | 'distribution'>('dotted')
  const vizContainerRef = useRef<HTMLDivElement>(null)
  const [vizZoom, setVizZoom] = useState(1)
  const [vizPosition, setVizPosition] = useState({ x: 0, y: 0 })
  const [isVizDragging, setIsVizDragging] = useState(false)
  const [vizDragStart, setVizDragStart] = useState({ x: 0, y: 0 })
  const [isVizInitialized, setIsVizInitialized] = useState(false)
  
  // Event log data view state
  const [dataView, setDataView] = useState<'events' | 'footprint'>('events')
  
  // Filter controls state
  const [filtersExpanded, setFiltersExpanded] = useState(false)

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
        // Auto-select the most recent log if available
        if (result.logs.length > 0 && selectedLogIndex === -1) {
          setSelectedLogIndex(result.logs.length - 1)
        }
      }
    } catch (err) {
      console.error('Error fetching logs:', err)
    }
  }

  const handleExplore = async () => {
    if (selectedLogIndex === -1) {
      setError('Please select a log to explore')
      return
    }
    
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`http://localhost:8000/api/explore/${selectedLogIndex}`, {
        method: 'POST',
      })

      const result = await response.json()
      
      if (result.status === 'success') {
        setExploreData(result)
        setSuccessMessage(`Exploring: ${result.log_metadata.filename}`)
        setIsInitialized(false)
        // Initialize filters with all items selected
        setSelectedActivities(result.available_activities || [])
        setSelectedVariants(result.available_variants?.map((v: any) => v.activities) || [])
        setFiltersInitialized(true)
      } else {
        setError(result.message || 'Exploration failed')
      }
    } catch (err) {
      setError('Failed to connect to server')
    } finally {
      setLoading(false)
    }
  }

  const updateDFG = async () => {
    if (selectedLogIndex === -1 || !exploreData) return

    setLoading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('log_index', selectedLogIndex.toString())
      formData.append('selected_activities', JSON.stringify(selectedActivities))
      formData.append('selected_variants', JSON.stringify(selectedVariants))

      const response = await fetch('http://localhost:8000/api/update_dfg', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()
      
      if (result.status === 'success') {
        setExploreData({
          ...exploreData,
          regular_svg_content: result.regular_svg_content,
          performance_svg_content: result.performance_svg_content
        })
        setIsInitialized(false)
      } else {
        setError(result.message || 'DFG update failed')
      }
    } catch (err) {
      setError('Failed to connect to server')
    } finally {
      setLoading(false)
    }
  }

  const updateEventDistribution = async (newDistrType: string) => {
    if (selectedLogIndex === -1 || !exploreData) return

    try {
      const formData = new FormData()
      formData.append('log_index', selectedLogIndex.toString())
      formData.append('distr_type', newDistrType)

      const response = await fetch('http://localhost:8000/api/update_event_distribution_graph', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()
      
      if (result.status === 'success') {
        setExploreData({
          ...exploreData,
          event_distribution_svg: result.event_distribution_svg
        })
      } else {
        setError(result.message || 'Failed to update event distribution graph')
      }
    } catch (err) {
      setError('Failed to connect to server')
    }
  }

  // Trigger DFG update when filters change
  useEffect(() => {
    if (exploreData) {
      const timeoutId = setTimeout(() => {
        updateDFG()
      }, 500) // Debounce
      return () => clearTimeout(timeoutId)
    }
  }, [selectedActivities, selectedVariants])

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

  // Center SVG when first loaded
  useEffect(() => {
    if (exploreData && !isInitialized && svgContainerRef.current) {
      const container = svgContainerRef.current
      const containerRect = container.getBoundingClientRect()
      
      const centerX = (containerRect.width - containerRect.width * 0.8) / 2
      const centerY = (containerRect.height - containerRect.height * 0.8) / 2
      
      setPosition({ x: centerX, y: centerY })
      setZoom(0.8)
      setIsInitialized(true)
    }
  }, [exploreData, isInitialized])

  // Visualization zoom/drag functionality
  const vizZoomIn = () => {
    setVizZoom(prev => Math.min(5, prev * 1.2))
  }

  const vizZoomOut = () => {
    setVizZoom(prev => Math.max(0.1, prev / 1.2))
  }

  const handleVizMouseDown = (e: React.MouseEvent) => {
    setIsVizDragging(true)
    setVizDragStart({
      x: e.clientX - vizPosition.x,
      y: e.clientY - vizPosition.y
    })
  }

  const handleVizMouseMove = (e: React.MouseEvent) => {
    if (!isVizDragging) return
    setVizPosition({
      x: e.clientX - vizDragStart.x,
      y: e.clientY - vizDragStart.y
    })
  }

  const handleVizMouseUp = () => {
    setIsVizDragging(false)
  }

  const resetVizView = () => {
    setVizZoom(0.8)
    setVizPosition({ x: 0, y: 0 })
    setIsVizInitialized(false)
  }

  // Center visualization SVG when first loaded or when switching
  useEffect(() => {
    if (exploreData && !isVizInitialized && vizContainerRef.current) {
      const container = vizContainerRef.current
      const containerRect = container.getBoundingClientRect()
      
      const centerX = (containerRect.width - containerRect.width * 0.8) / 2
      const centerY = (containerRect.height - containerRect.height * 0.8) / 2
      
      setVizPosition({ x: centerX, y: centerY })
      setVizZoom(0.8)
      setIsVizInitialized(true)
    }
  }, [exploreData, isVizInitialized, activeVisualization])

  // Activity filter toggle

  // Sort variants
  const handleSort = (column: typeof sortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('desc')
    }
  }

  const getSortedVariants = () => {
    if (!exploreData) return []
    
    const variants = [...exploreData.insights.trace_variants]
    
    variants.sort((a, b) => {
      let aVal: number, bVal: number
      
      switch (sortColumn) {
        case 'index':
          aVal = exploreData.insights.trace_variants.indexOf(a)
          bVal = exploreData.insights.trace_variants.indexOf(b)
          break
        case 'freq':
          aVal = a.frequency
          bVal = b.frequency
          break
        case 'percentage':
          aVal = a.percentage
          bVal = b.percentage
          break
        case 'avg_tpt':
          aVal = a.avg_tpt
          bVal = b.avg_tpt
          break
        case 'min_tpt':
          aVal = a.min_tpt
          bVal = b.min_tpt
          break
        case 'max_tpt':
          aVal = a.max_tpt
          bVal = b.max_tpt
          break
        case 'median_tpt':
          aVal = a.median_tpt
          bVal = b.median_tpt
          break
        default:
          return 0
      }
      
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
    })
    
    return variants
  }

  // Sort activities
  const handleActivitySort = (column: typeof activitySortColumn) => {
    if (activitySortColumn === column) {
      setActivitySortDirection(activitySortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setActivitySortColumn(column)
      setActivitySortDirection('desc')
    }
  }

  const getSortedActivities = () => {
    if (!exploreData) return []
    
    const activities = Object.entries(exploreData.insights.activity_frequencies || {}).map(([activity, frequency]) => ({
      activity,
      frequency,
      cases: exploreData.insights.activity_case_counts?.[activity] || 0,
      durations: exploreData.insights.activity_durations?.[activity] || { avg: 0, min: 0, max: 0, median: 0 }
    }))
    
    activities.sort((a, b) => {
      let aVal: number | string, bVal: number | string
      
      switch (activitySortColumn) {
        case 'activity':
          aVal = a.activity
          bVal = b.activity
          if (activitySortDirection === 'asc') {
            return aVal < bVal ? -1 : aVal > bVal ? 1 : 0
          } else {
            return aVal > bVal ? -1 : aVal < bVal ? 1 : 0
          }
        case 'freq':
          aVal = a.frequency
          bVal = b.frequency
          break
        case 'cases':
          aVal = a.cases
          bVal = b.cases
          break
        case 'avg_dur':
          aVal = a.durations.avg
          bVal = b.durations.avg
          break
        case 'min_dur':
          aVal = a.durations.min
          bVal = b.durations.min
          break
        case 'max_dur':
          aVal = a.durations.max
          bVal = b.durations.max
          break
        case 'median_dur':
          aVal = a.durations.median
          bVal = b.durations.median
          break
        default:
          return 0
      }
      
      return activitySortDirection === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number)
    })
    
    return activities
  }

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
          <strong>Process Exploration Tool:</strong> Select an uploaded event log to explore and analyze your process data through Directly-Follows Graphs (DFG) and comprehensive statistics.
        </p>
      </div>
      
      <div className="upload-section">
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', justifyContent: 'center' }}>
          <select 
            className="log-selector"
            value={selectedLogIndex}
            onChange={(e) => setSelectedLogIndex(Number(e.target.value))}
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
            onClick={handleExplore}
            disabled={selectedLogIndex === -1 || logs.length === 0 || loading}
        >
            {loading ? 'Loading...' : 'Explore'}
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

      {exploreData && (
        <div className="svg-viewer-container">
          <h2 className="insights-title">DFG</h2>
          <div className="svg-controls">
            <div className="dfg-type-controls">
              <button 
                className={`dfg-type-button ${dfgType === 'regular' ? 'active' : ''}`}
                onClick={() => setDfgType('regular')}
              >
                Regular DFG
              </button>
              <button 
                className={`dfg-type-button ${dfgType === 'performance' ? 'active' : ''}`}
                onClick={() => setDfgType('performance')}
              >
                Performance DFG
              </button>
            </div>
            <div className="zoom-controls">
              <button className="zoom-button" onClick={zoomOut}>−</button>
              <span className="zoom-info">Zoom: {Math.round(zoom * 100)}%</span>
              <button className="zoom-button" onClick={zoomIn}>+</button>
            </div>
            <button className="reset-button" onClick={resetView}>
              Reset View
            </button>
          </div>
          
          {/* DFG Visualization with Overlay Filters */}
          <div className="dfg-container">
            <div 
              className="svg-viewer"
              ref={svgContainerRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
            >
                <div
                  className="svg-content"
                  style={{
                    transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
                    transformOrigin: '0 0'
                  }}
                dangerouslySetInnerHTML={{ __html: dfgType === 'regular' ? exploreData.regular_svg_content : exploreData.performance_svg_content }}
              />
              
              {/* Filter Controls Overlay */}
              <div className="filter-overlay">
                <button 
                  className="filter-toggle"
                  onClick={() => setFiltersExpanded(!filtersExpanded)}
                >
                  {filtersExpanded ? '−' : '+'}
                </button>
                
                {filtersExpanded && (
                  <div className="filter-dropdown">
                     <div className="filter-section">
                       <div className="filter-header">
                         <span>Activities</span>
                         <div className="filter-header-buttons">
                           <button 
                             className="select-all-btn"
                             onClick={() => setSelectedActivities(exploreData.available_activities || [])}
                           >
                             All
                           </button>
                           <button 
                             className="select-all-btn"
                             onClick={() => setSelectedActivities([])}
                           >
                             None
                           </button>
                </div>
            </div>
                       <div className="filter-list">
                         {Object.entries(exploreData.insights.activity_frequencies || {})
                           .sort(([,a], [,b]) => b - a)
                           .map(([activity, frequency]) => {
                             const color = `hsl(${(Object.keys(exploreData.insights.activity_frequencies).indexOf(activity) * 60) % 360}, 70%, 60%)`
                             const totalEvents = exploreData.insights.num_events || 1
                             const relativeFreq = ((frequency / totalEvents) * 100).toFixed(1)
                             return (
                               <label key={activity} className="filter-item">
                                <input
                                  type="checkbox"
                                  checked={!filtersInitialized || selectedActivities.includes(activity)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedActivities([...selectedActivities, activity])
                                    } else {
                                      setSelectedActivities(selectedActivities.filter(a => a !== activity))
                                    }
                                  }}
                                />
                                 <span 
                                   className="color-dot" 
                                   style={{ backgroundColor: color }}
                                 ></span>
                                 <span className="item-name">{activity}</span>
                                 <span className="item-count">{frequency} ({relativeFreq}%)</span>
                               </label>
                             )
                           })}
                </div>
              </div>
                    
                     <div className="filter-section">
                       <div className="filter-header">
                         <span>Variants</span>
                         <div className="filter-header-buttons">
                           <button 
                             className="select-all-btn"
                             onClick={() => setSelectedVariants(exploreData.available_variants?.map((v: any) => v.activities) || [])}
                           >
                             All
                           </button>
                           <button 
                             className="select-all-btn"
                             onClick={() => setSelectedVariants([])}
                           >
                             None
                           </button>
                         </div>
                </div>
                       <div className="filter-list variants-list">
                         {exploreData.insights.trace_variants
                           .sort((a, b) => b.frequency - a.frequency)
                           .map((variant, displayIndex) => {
                             const originalIndex = exploreData.insights.trace_variants.indexOf(variant) + 1
                             return (
                               <label key={displayIndex} className="filter-item variant-item">
                                <input
                                  type="checkbox"
                                  checked={!filtersInitialized || selectedVariants.some(v => 
                                    v.length === variant.activities.length && 
                                    v.every((activity: string, i: number) => activity === variant.activities[i])
                                  )}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedVariants([...selectedVariants, variant.activities])
                                    } else {
                                      setSelectedVariants(selectedVariants.filter(v => 
                                        !(v.length === variant.activities.length && 
                                          v.every((activity: string, i: number) => activity === variant.activities[i]))
                                      ))
                                    }
                                  }}
                                />
                                 <span className="variant-id">#{originalIndex}</span>
                                 <span className="variant-frequency">{variant.frequency} ({variant.percentage.toFixed(1)}%)</span>
                                 <div className="variant-sequence">
                                   {variant.activities.map((activity: string, actIndex: number) => (
                                     <span key={actIndex} className="activity-chip">
                                       {activity}
                                     </span>
                                   ))}
                </div>
                               </label>
                             )
                           })}
              </div>
                </div>
                </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {exploreData && (
        <div className="svg-viewer-container">
          <h2 className="insights-title">Visualizations</h2>
          <div className="svg-controls">
            <div className="viz-type-controls">
              <button 
                className={`viz-type-button ${activeVisualization === 'dotted' ? 'active' : ''}`}
                onClick={() => {
                  setActiveVisualization('dotted')
                  setIsVizInitialized(false)
                }}
              >
                Dotted Chart
              </button>
              <button 
                className={`viz-type-button ${activeVisualization === 'duration' ? 'active' : ''}`}
                onClick={() => {
                  setActiveVisualization('duration')
                  setIsVizInitialized(false)
                }}
              >
                Case Duration
              </button>
              <button 
                className={`viz-type-button ${activeVisualization === 'time' ? 'active' : ''}`}
                onClick={() => {
                  setActiveVisualization('time')
                  setIsVizInitialized(false)
                }}
              >
                Events Per Time
              </button>
            <button 
                className={`viz-type-button ${activeVisualization === 'distribution' ? 'active' : ''}`}
                onClick={() => {
                  setActiveVisualization('distribution')
                  setIsVizInitialized(false)
                }}
              >
                Event Distribution
              </button>
            </div>
            <div className="zoom-controls">
              <button className="zoom-button" onClick={vizZoomOut}>−</button>
              <span className="zoom-info">Zoom: {Math.round(vizZoom * 100)}%</span>
              <button className="zoom-button" onClick={vizZoomIn}>+</button>
            </div>
            <button className="reset-button" onClick={resetVizView}>
              Reset View
            </button>
          </div>
          
          {/* Event Distribution Controls */}
          {activeVisualization === 'distribution' && (
            <div className="distribution-controls-bar">
              <label htmlFor="distribution-type">Distribution Type:</label>
              <select 
                id="distribution-type"
                value={distributionType}
                onChange={(e) => {
                  setDistributionType(e.target.value)
                  updateEventDistribution(e.target.value)
                }}
                className="distribution-selector"
              >
                <option value="days_week">Days of Week</option>
                <option value="days_month">Days of Month</option>
                <option value="months">Months</option>
                <option value="years">Years</option>
                <option value="hours">Hours of Day</option>
                <option value="weeks">Weeks of Year</option>
              </select>
            </div>
          )}
          
          <div 
            className="svg-viewer"
            ref={vizContainerRef}
            onMouseDown={handleVizMouseDown}
            onMouseMove={handleVizMouseMove}
            onMouseUp={handleVizMouseUp}
            onMouseLeave={handleVizMouseUp}
            style={{ cursor: isVizDragging ? 'grabbing' : 'grab' }}
                >
                  <div 
              className="svg-content"
                    style={{
                transform: `translate(${vizPosition.x}px, ${vizPosition.y}px) scale(${vizZoom})`,
                transformOrigin: '0 0'
              }}
              dangerouslySetInnerHTML={{ 
                __html: activeVisualization === 'dotted' ? exploreData.dotted_chart_svg :
                        activeVisualization === 'duration' ? exploreData.case_duration_svg :
                        activeVisualization === 'time' ? exploreData.events_per_time_svg :
                        exploreData.event_distribution_svg
              }}
            />
          </div>
        </div>
      )}

      {exploreData && (
        <div className="insights-container">
          <h2 className="insights-title">Event Log Data</h2>
          <div className="svg-controls" style={{ marginBottom: '1rem' }}>
            <div className="dfg-type-controls">
            <button 
                className={`dfg-type-button ${dataView === 'events' ? 'active' : ''}`}
                onClick={() => setDataView('events')}
              >
                Events Table
              </button>
              <button 
                className={`dfg-type-button ${dataView === 'footprint' ? 'active' : ''}`}
                onClick={() => setDataView('footprint')}
              >
                Footprint Matrix
            </button>
            </div>
          </div>
          
          {/* Events Table */}
          {dataView === 'events' && exploreData.first_20_events && (
            <div style={{ overflowX: 'auto', maxHeight: '500px', overflowY: 'auto' }}>
              <table className="activities-table">
                <thead>
                  <tr>
                    <th>Case ID</th>
                    <th>Activity</th>
                    <th>Timestamp</th>
                    <th>Resource</th>
                  </tr>
                </thead>
                <tbody>
                  {exploreData.first_20_events.map((event, idx) => (
                    <tr key={idx}>
                      <td>{event.case_id}</td>
                      <td>{event.activity}</td>
                      <td>{event.timestamp}</td>
                      <td>{event.resource}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Footprint Matrix */}
          {dataView === 'footprint' && exploreData.footprint_matrix && (
            <div style={{ overflowX: 'auto', maxHeight: '500px', overflowY: 'auto' }}>
              <table className="footprint-table">
                <thead>
                  <tr>
                    <th></th>
                    {exploreData.footprint_matrix.activities.map((act, idx) => (
                      <th key={idx} title={act}>{act.substring(0, 5)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {exploreData.footprint_matrix.activities.map((rowAct, rowIdx) => (
                    <tr key={rowIdx}>
                      <th title={rowAct}>{rowAct.substring(0, 6)}</th>
                      {exploreData.footprint_matrix.matrix[rowIdx].map((cell, colIdx) => (
                        <td key={colIdx} className={cell ? 'has-relation' : ''}>
                          {cell || '#'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {exploreData && (
        <div className="insights-container">
          <h2 className="insights-title">Log Analysis</h2>
          
          {/* Statistics Cards */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{exploreData.insights.num_events}</div>
              <div className="stat-label">Events</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{exploreData.insights.num_cases}</div>
              <div className="stat-label">Cases</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{exploreData.insights.num_activities}</div>
              <div className="stat-label">Activities</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{exploreData.insights.num_trace_variants}</div>
              <div className="stat-label">Trace Variants</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{formatDuration(exploreData.insights.log_avg_tpt)}</div>
              <div className="stat-label">Avg TPT</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{formatDuration(exploreData.insights.log_median_tpt)}</div>
              <div className="stat-label">Median TPT</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{formatDuration(exploreData.insights.log_min_tpt)}</div>
              <div className="stat-label">Min TPT</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{formatDuration(exploreData.insights.log_max_tpt)}</div>
              <div className="stat-label">Max TPT</div>
            </div>
          </div>

          {/* Charts Section */}
          <div className="charts-section-stacked">
            {/* Activity Analysis */}
            <div className="chart-container">
              <h3 className="chart-title">Activity Analysis</h3>
              
              {/* Activity Frequency Bar Chart */}
              <div className="activity-bar-chart">
                <svg width="100%" height="300" viewBox="0 0 1000 300" preserveAspectRatio="xMidYMid meet" style={{ background: '#f8f9fa', borderRadius: '8px' }}>
                  {Object.entries(exploreData.insights.activity_frequencies || {})
                    .sort(([,a], [,b]) => b - a)
                    .map(([activity, frequency], index, array) => {
                      const maxFreq = Math.max(...Object.values(exploreData.insights.activity_frequencies || {}))
                      const barHeight = (frequency / maxFreq) * 220
                      const barWidth = Math.min(Math.max(900 / array.length - 10, 30), 80)
                      const x = index * (barWidth + 10) + 50
                      const y = 240 - barHeight
                      const color = `hsl(${(index * 60) % 360}, 70%, 60%)`
                      
                      return (
                        <g key={activity}>
                          <rect
                            x={x}
                            y={y}
                            width={barWidth}
                            height={barHeight}
                            fill={color}
                            opacity={0.85}
                            rx={2}
                          />
                          <text
                            x={x + barWidth / 2}
                            y={y - 5}
                            textAnchor="middle"
                            fontSize="11"
                            fill="#2c3e50"
                            fontWeight="700"
                          >
                            {frequency}
                          </text>
                          <text
                            x={x + barWidth / 2}
                            y={260}
                            textAnchor="end"
                            fontSize="10"
                            fill="#2c3e50"
                            fontWeight="500"
                            transform={`rotate(-45, ${x + barWidth / 2}, 260)`}
                          >
                            {activity}
                          </text>
                        </g>
                      )
                    })}
                  <line x1="40" y1="240" x2="950" y2="240" stroke="#2c3e50" strokeWidth="2" />
                  <line x1="40" y1="20" x2="40" y2="240" stroke="#2c3e50" strokeWidth="2" />
                  <text x="15" y="130" fontSize="12" fill="#2c3e50" fontWeight="600" transform="rotate(-90, 15, 130)">
                    Frequency
                  </text>
                </svg>
                          </div>

              {/* Activity Table */}
              <div className="activities-table-container">
                <table className="activities-table">
                  <thead>
                    <tr>
                      <th onClick={() => handleActivitySort('activity')} className="sortable-header">
                        Activity {activitySortColumn === 'activity' && (activitySortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th onClick={() => handleActivitySort('freq')} className="sortable-header">
                        Abs Freq {activitySortColumn === 'freq' && (activitySortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th onClick={() => handleActivitySort('cases')} className="sortable-header">
                        Cases {activitySortColumn === 'cases' && (activitySortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th onClick={() => handleActivitySort('avg_dur')} className="sortable-header">
                        Avg Duration {activitySortColumn === 'avg_dur' && (activitySortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th onClick={() => handleActivitySort('median_dur')} className="sortable-header">
                        Median Duration {activitySortColumn === 'median_dur' && (activitySortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th onClick={() => handleActivitySort('min_dur')} className="sortable-header">
                        Min Duration {activitySortColumn === 'min_dur' && (activitySortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th onClick={() => handleActivitySort('max_dur')} className="sortable-header">
                        Max Duration {activitySortColumn === 'max_dur' && (activitySortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {getSortedActivities().map((activityData) => {
                      const casePercentage = ((activityData.cases / (exploreData.insights?.num_cases || 1)) * 100).toFixed(1)
                      const color = `hsl(${(Object.keys(exploreData.insights.activity_frequencies).indexOf(activityData.activity) * 60) % 360}, 70%, 60%)`
                      
                      return (
                        <tr key={activityData.activity}>
                          <td className="activity-name-cell">
                            <div className="activity-color-dot" style={{ backgroundColor: color }}></div>
                            {activityData.activity}
                          </td>
                          <td className="activity-stat-cell">{activityData.frequency}</td>
                          <td className="activity-stat-cell">{activityData.cases} ({casePercentage}%)</td>
                          <td className="activity-stat-cell">{formatDuration(activityData.durations.avg)}</td>
                          <td className="activity-stat-cell">{formatDuration(activityData.durations.median)}</td>
                          <td className="activity-stat-cell">{formatDuration(activityData.durations.min)}</td>
                          <td className="activity-stat-cell">{formatDuration(activityData.durations.max)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              
              <ActivityPieChart 
                activityFrequencies={exploreData.insights.activity_frequencies}
                totalEvents={exploreData.insights.num_events}
              />
            </div>

            {/* Trace Variants Analysis */}
            <div className="chart-container">
              <h3 className="chart-title">Trace Variants Analysis</h3>
              
              <div className="variants-table-container">
                <table className="variants-table">
                  <thead>
                    <tr>
                      <th onClick={() => handleSort('index')} className="sortable-header">
                        # {sortColumn === 'index' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th className="trace-header">Trace</th>
                      <th onClick={() => handleSort('freq')} className="sortable-header">
                        Abs Freq {sortColumn === 'freq' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th onClick={() => handleSort('percentage')} className="sortable-header">
                        Rel Freq {sortColumn === 'percentage' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th onClick={() => handleSort('avg_tpt')} className="sortable-header">
                        Avg TPT {sortColumn === 'avg_tpt' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th onClick={() => handleSort('median_tpt')} className="sortable-header">
                        Median TPT {sortColumn === 'median_tpt' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th onClick={() => handleSort('min_tpt')} className="sortable-header">
                        Min TPT {sortColumn === 'min_tpt' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th onClick={() => handleSort('max_tpt')} className="sortable-header">
                        Max TPT {sortColumn === 'max_tpt' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {getSortedVariants().map((variant, displayIndex) => {
                      const originalIndex = exploreData.insights.trace_variants.indexOf(variant) + 1
                      return (
                        <tr key={displayIndex}>
                          <td className="variant-index-cell">{originalIndex}</td>
                          <td className="variant-trace-cell">
                            <div className="variant-sequence-scrollable">
                      {variant.activities.map((activity, activityIndex) => {
                                const activityColorIndex = Object.keys(exploreData.insights?.activity_frequencies || {}).indexOf(activity)
                        const activityColor = `hsl(${(activityColorIndex * 60) % 360}, 70%, 60%)`
                        
                        return (
                          <div
                            key={activityIndex}
                                    className="activity-block-compact"
                            style={{ backgroundColor: activityColor }}
                          >
                            {activity}
                          </div>
                        )
                      })}
                    </div>
                          </td>
                          <td className="variant-stat-cell">{variant.frequency}</td>
                          <td className="variant-stat-cell">{variant.percentage}%</td>
                          <td className="variant-stat-cell">{formatDuration(variant.avg_tpt)}</td>
                          <td className="variant-stat-cell">{formatDuration(variant.median_tpt)}</td>
                          <td className="variant-stat-cell">{formatDuration(variant.min_tpt)}</td>
                          <td className="variant-stat-cell">{formatDuration(variant.max_tpt)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              
              <TraceVariantPieChart 
                traceVariants={exploreData.insights.trace_variants}
                totalCases={exploreData.insights.num_cases}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Exploration



