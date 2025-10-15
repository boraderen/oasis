import { useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import './Page.css'
import ActivityPieChart from '../components/ActivityPieChart'
import TraceVariantPieChart from '../components/TraceVariantPieChart'

interface OcelItem {
  filename: string
  uploaded_at: string
  num_events: number
  num_objects: number
  object_types: string[]
}

interface ObjectTypeData {
  regular_dfg_svg: string
  performance_dfg_svg: string
  insights: any
  dotted_chart_svg: string
  case_duration_svg: string
  events_per_time_svg: string
  event_distribution_svg: string
  first_20_events: any[]
  flattened_columns: string[]
  footprint_matrix: {
    activities: string[]
    matrix: string[][]
  }
}

interface OcelExploreData {
  message: string
  ocdfg_svg_content: string
  object_graph_svg_content: string | null
  ocel_metadata: OcelItem
  num_events: number
  num_objects: number
  num_activities: number
  object_types: string[]
  object_type_counts: Record<string, number>
  activities: string[]
  activity_counts: Record<string, number>
  activity_durations: Record<string, { avg: number, min: number, max: number, median: number }>
  extended_table_rows: any[]
  table_columns: string[]
  object_type_data: Record<string, ObjectTypeData | null>
  status: string
}

// Helper function to format duration
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

// Helper to format timestamps more readably
const formatTimestamp = (timestamp: string): string => {
  if (!timestamp || timestamp === 'nan' || timestamp === 'NaT' || timestamp === 'N/A') return 'N/A';
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return timestamp;
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch {
    return timestamp;
  }
};

// Helper to check if a value looks like a datetime and format it
const formatIfDatetime = (value: string): string => {
  if (!value || typeof value !== 'string') return value;
  
  // Check if it looks like an ISO datetime (contains 'T' and ':')
  if (value.includes('T') && value.includes(':')) {
    try {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return date.toLocaleString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
      }
    } catch {
      // Not a valid date, return as is
    }
  }
  return value;
};

function OCPMExploration() {
  const navigate = useNavigate()
  const [ocels, setOcels] = useState<OcelItem[]>([])
  const [selectedOcelIndex, setSelectedOcelIndex] = useState<number>(-1)
  const [exploreData, setExploreData] = useState<OcelExploreData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  
  // Main graph viewer state
  const svgContainerRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [isInitialized, setIsInitialized] = useState(false)
  const [selectedGraph, setSelectedGraph] = useState<string>('ocdfg')
  const [dfgType, setDfgType] = useState<'regular' | 'performance'>('regular')
  
  // Visualizations viewer state
  const vizContainerRef = useRef<HTMLDivElement>(null)
  const [vizZoom, setVizZoom] = useState(1)
  const [vizPosition, setVizPosition] = useState({ x: 0, y: 0 })
  const [isVizDragging, setIsVizDragging] = useState(false)
  const [vizDragStart, setVizDragStart] = useState({ x: 0, y: 0 })
  const [isVizInitialized, setIsVizInitialized] = useState(false)
  const [activeVisualization, setActiveVisualization] = useState<'dotted' | 'duration' | 'time' | 'distribution'>('dotted')
  const [selectedVizObjectType, setSelectedVizObjectType] = useState<string | null>(null)
  const [distributionType, setDistributionType] = useState<string>('days_week')
  
  // Data view state
  const [dataView, setDataView] = useState<'ocel' | 'events' | 'footprint'>('ocel')
  const [selectedDataObjectType, setSelectedDataObjectType] = useState<string | null>(null)
  
  // Analysis state
  const [selectedAnalysisObjectType, setSelectedAnalysisObjectType] = useState<string | null>(null)
  
  // Activity analysis state
  const [selectedActivityView, setSelectedActivityView] = useState<string>('ocel')
  
  // Trace variants state
  const [selectedVariantObjectType, setSelectedVariantObjectType] = useState<string | null>(null)
  const [sortColumn, setSortColumn] = useState<'index' | 'freq' | 'percentage' | 'avg_tpt' | 'min_tpt' | 'max_tpt' | 'median_tpt'>('freq')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

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
        if (result.ocels.length > 0 && selectedOcelIndex === -1) {
          setSelectedOcelIndex(result.ocels.length - 1)
        }
      }
    } catch (err) {
      console.error('Error fetching OCELs:', err)
    }
  }

  const handleExplore = async () => {
    if (selectedOcelIndex === -1) {
      setError('Please select an OCEL to explore')
      return
    }
    
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`http://localhost:8000/api/explore_ocel/${selectedOcelIndex}`, {
        method: 'POST',
      })

      const result = await response.json()
      
      if (result.status === 'success') {
        setExploreData(result)
        setSuccessMessage(`Exploring: ${result.ocel_metadata.filename}`)
        setIsInitialized(false)
        setIsVizInitialized(false)
        
        // Auto-select first object type
        if (result.object_types && result.object_types.length > 0) {
          const firstObjType = result.object_types[0]
          setSelectedVizObjectType(firstObjType)
          setSelectedDataObjectType(firstObjType)
          setSelectedAnalysisObjectType(firstObjType)
          setSelectedVariantObjectType(firstObjType)
        }
        // Set activity view to OCEL by default
        setSelectedActivityView('ocel')
      } else {
        setError(result.message || 'Exploration failed')
      }
    } catch (err) {
      setError('Failed to connect to server')
    } finally {
      setLoading(false)
    }
  }

  // Main graph zoom/pan functionality
  const zoomIn = () => setZoom(prev => Math.min(5, prev * 1.2))
  const zoomOut = () => setZoom(prev => Math.max(0.1, prev * 0.8))
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y })
  }
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y })
  }
  const handleMouseUp = () => setIsDragging(false)
  const resetView = () => {
    setZoom(0.8)
    setPosition({ x: 0, y: 0 })
    setIsInitialized(false)
  }

  // Visualization zoom/pan functionality
  const vizZoomIn = () => setVizZoom(prev => Math.min(5, prev * 1.2))
  const vizZoomOut = () => setVizZoom(prev => Math.max(0.1, prev / 1.2))
  const handleVizMouseDown = (e: React.MouseEvent) => {
    setIsVizDragging(true)
    setVizDragStart({ x: e.clientX - vizPosition.x, y: e.clientY - vizPosition.y })
  }
  const handleVizMouseMove = (e: React.MouseEvent) => {
    if (!isVizDragging) return
    setVizPosition({ x: e.clientX - vizDragStart.x, y: e.clientY - vizDragStart.y })
  }
  const handleVizMouseUp = () => setIsVizDragging(false)
  const resetVizView = () => {
    setVizZoom(0.8)
    setVizPosition({ x: 0, y: 0 })
    setIsVizInitialized(false)
  }

  // Center main graph when loaded or switched
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
  }, [exploreData, isInitialized, selectedGraph])

  // Center visualization when loaded or switched
  useEffect(() => {
    if (exploreData && selectedVizObjectType && !isVizInitialized && vizContainerRef.current) {
      const container = vizContainerRef.current
      const containerRect = container.getBoundingClientRect()
      const centerX = (containerRect.width - containerRect.width * 0.8) / 2
      const centerY = (containerRect.height - containerRect.height * 0.8) / 2
      setVizPosition({ x: centerX, y: centerY })
      setVizZoom(0.8)
      setIsVizInitialized(true)
    }
  }, [exploreData, isVizInitialized, activeVisualization, selectedVizObjectType])

  // Get current main graph SVG content
  const getCurrentSvgContent = () => {
    if (!exploreData) return ''
    if (selectedGraph === 'ocdfg') return exploreData.ocdfg_svg_content
    if (selectedGraph === 'object_graph') return exploreData.object_graph_svg_content || exploreData.ocdfg_svg_content
    
    // It's an object type - check if it exists and get the appropriate DFG
    const objData = exploreData.object_type_data[selectedGraph]
    if (objData) {
      return dfgType === 'regular' ? objData.regular_dfg_svg : objData.performance_dfg_svg
    }
    return ''
  }

  // Update event distribution graph
  const updateEventDistribution = async (newDistrType: string) => {
    if (selectedOcelIndex === -1 || !selectedVizObjectType) return

    try {
      const response = await fetch('http://localhost:8000/api/update_ocel_event_distribution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ocel_index: selectedOcelIndex,
          object_type: selectedVizObjectType,
          distr_type: newDistrType
        })
      })

      const result = await response.json()
      
      if (result.status === 'success' && exploreData) {
        // Update the event distribution SVG in the object type data
        const updatedObjectTypeData = { ...exploreData.object_type_data }
        if (updatedObjectTypeData[selectedVizObjectType]) {
          updatedObjectTypeData[selectedVizObjectType] = {
            ...updatedObjectTypeData[selectedVizObjectType],
            event_distribution_svg: result.event_distribution_svg
          }
          setExploreData({
            ...exploreData,
            object_type_data: updatedObjectTypeData
          })
        }
      }
    } catch (err) {
      console.error('Error updating event distribution:', err)
    }
  }

  // Get current visualization SVG content
  const getCurrentVizContent = () => {
    if (!exploreData || !selectedVizObjectType) return ''
    const objData = exploreData.object_type_data[selectedVizObjectType]
    if (!objData) return ''
    
    switch (activeVisualization) {
      case 'dotted': return objData.dotted_chart_svg
      case 'duration': return objData.case_duration_svg
      case 'time': return objData.events_per_time_svg
      case 'distribution': return objData.event_distribution_svg
      default: return ''
    }
  }

  // Sort variants
  const handleSort = (column: typeof sortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('desc')
    }
  }

  const getSortedVariants = (variants: any[]) => {
    const sorted = [...variants]
    sorted.sort((a, b) => {
      let aVal: number, bVal: number
      switch (sortColumn) {
        case 'index': aVal = variants.indexOf(a); bVal = variants.indexOf(b); break
        case 'freq': aVal = a.frequency; bVal = b.frequency; break
        case 'percentage': aVal = a.percentage; bVal = b.percentage; break
        case 'avg_tpt': aVal = a.avg_tpt; bVal = b.avg_tpt; break
        case 'min_tpt': aVal = a.min_tpt; bVal = b.min_tpt; break
        case 'max_tpt': aVal = a.max_tpt; bVal = b.max_tpt; break
        case 'median_tpt': aVal = a.median_tpt; bVal = b.median_tpt; break
        default: return 0
      }
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
    })
    return sorted
  }

  // Check if selected graph is an object type (for showing regular/performance toggle)
  const isObjectTypeDFG = () => {
    return exploreData && 
           selectedGraph !== 'ocdfg' && 
           selectedGraph !== 'object_graph' &&
           exploreData.object_types.includes(selectedGraph)
  }

  return (
    <div className="page">
      <h1 className="page-title">OCPM Exploration</h1>
      <div className="page-description">
        <p className="page-content">
          <strong>Object-Centric Process Mining:</strong> Select an uploaded Object-Centric Event Log (OCEL) to explore and analyze object-centric process data through Object-Centric Directly-Follows Graphs (OCDFG).
        </p>
      </div>
      
      <div className="upload-section">
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', justifyContent: 'center' }}>
          <select 
            className="log-selector"
            value={selectedOcelIndex}
            onChange={(e) => setSelectedOcelIndex(Number(e.target.value))}
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
            onClick={handleExplore}
            disabled={selectedOcelIndex === -1 || ocels.length === 0 || loading}
          >
            {loading ? 'Loading...' : 'Explore'}
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

      {error && <div className="error-message">{error}</div>}
      {successMessage && <div className="success-message">{successMessage}</div>}

      {/* DFG Section */}
      {exploreData && (
        <div className="svg-viewer-container">
          <h2 className="insights-title">DFG</h2>
          <div className="svg-controls">
            <div className="dfg-type-controls">
              <button 
                className={`dfg-type-button ${selectedGraph === 'ocdfg' ? 'active' : ''}`}
                onClick={() => { setSelectedGraph('ocdfg'); setIsInitialized(false); }}
              >
                OCDFG
              </button>
              {exploreData.object_graph_svg_content && (
                <button 
                  className={`dfg-type-button ${selectedGraph === 'object_graph' ? 'active' : ''}`}
                  onClick={() => { setSelectedGraph('object_graph'); setIsInitialized(false); }}
                >
                  Object Graph
                </button>
              )}
              {exploreData.object_types.map((objType) => (
                exploreData.object_type_data[objType] && (
                  <button 
                    key={objType}
                    className={`dfg-type-button ${selectedGraph === objType ? 'active' : ''}`}
                    onClick={() => { setSelectedGraph(objType); setIsInitialized(false); }}
                  >
                    {objType}
                  </button>
                )
              ))}
            </div>
            <div className="zoom-controls">
              <button className="zoom-button" onClick={zoomOut}>−</button>
              <span className="zoom-info">Zoom: {Math.round(zoom * 100)}%</span>
              <button className="zoom-button" onClick={zoomIn}>+</button>
            </div>
            <button className="reset-button" onClick={resetView}>Reset View</button>
          </div>
          
          {/* Regular/Performance DFG Toggle (only for object types) */}
          {isObjectTypeDFG() && (
            <div className="svg-controls" style={{ marginTop: '0.5rem' }}>
              <div className="dfg-type-controls">
                <button 
                  className={`dfg-type-button ${dfgType === 'regular' ? 'active' : ''}`}
                  onClick={() => { setDfgType('regular'); setIsInitialized(false); }}
                >
                  Regular DFG
                </button>
                <button 
                  className={`dfg-type-button ${dfgType === 'performance' ? 'active' : ''}`}
                  onClick={() => { setDfgType('performance'); setIsInitialized(false); }}
                >
                  Performance DFG
            </button>
          </div>
            </div>
          )}
          
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
              dangerouslySetInnerHTML={{ __html: getCurrentSvgContent() }}
            />
          </div>
        </div>
      )}

      {/* Visualizations Section (for flattened logs) */}
      {exploreData && exploreData.object_types.length > 0 && selectedVizObjectType && (
        <div className="svg-viewer-container">
          <h2 className="insights-title">Visualizations</h2>
          <div className="svg-controls">
            <div className="dfg-type-controls">
              {exploreData.object_types.map((objType) => (
                exploreData.object_type_data[objType] && (
                  <button 
                    key={objType}
                    className={`dfg-type-button ${selectedVizObjectType === objType ? 'active' : ''}`}
                    onClick={() => { setSelectedVizObjectType(objType); setIsVizInitialized(false); }}
                  >
                    {objType}
                  </button>
                )
              ))}
            </div>
          </div>
          
          <div className="svg-controls">
            <div className="viz-type-controls">
              <button 
                className={`viz-type-button ${activeVisualization === 'dotted' ? 'active' : ''}`}
                onClick={() => { setActiveVisualization('dotted'); setIsVizInitialized(false); }}
              >
                Dotted Chart
              </button>
              <button 
                className={`viz-type-button ${activeVisualization === 'duration' ? 'active' : ''}`}
                onClick={() => { setActiveVisualization('duration'); setIsVizInitialized(false); }}
              >
                Case Duration
              </button>
              <button 
                className={`viz-type-button ${activeVisualization === 'time' ? 'active' : ''}`}
                onClick={() => { setActiveVisualization('time'); setIsVizInitialized(false); }}
              >
                Events Per Time
              </button>
              <button 
                className={`viz-type-button ${activeVisualization === 'distribution' ? 'active' : ''}`}
                onClick={() => { setActiveVisualization('distribution'); setIsVizInitialized(false); }}
              >
                Event Distribution
              </button>
            </div>
            <div className="zoom-controls">
              <button className="zoom-button" onClick={vizZoomOut}>−</button>
              <span className="zoom-info">Zoom: {Math.round(vizZoom * 100)}%</span>
              <button className="zoom-button" onClick={vizZoomIn}>+</button>
            </div>
            <button className="reset-button" onClick={resetVizView}>Reset View</button>
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
              dangerouslySetInnerHTML={{ __html: getCurrentVizContent() }}
            />
          </div>
        </div>
      )}

      {/* Event Log Data Section */}
      {exploreData && (
        <div className="insights-container">
          <h2 className="insights-title">Event Log Data</h2>
          <div className="svg-controls" style={{ marginBottom: '1rem' }}>
            <div className="dfg-type-controls">
              <button 
                className={`dfg-type-button ${dataView === 'ocel' ? 'active' : ''}`}
                onClick={() => setDataView('ocel')}
              >
                OCEL Table
              </button>
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
          
          {/* Object type selector for events and footprint */}
          {dataView !== 'ocel' && exploreData.object_types.length > 0 && (
            <div className="svg-controls" style={{ marginBottom: '1rem' }}>
              <div className="dfg-type-controls">
                {exploreData.object_types.map((objType) => (
                  exploreData.object_type_data[objType] && (
                    <button 
                      key={objType}
                      className={`dfg-type-button ${selectedDataObjectType === objType ? 'active' : ''}`}
                      onClick={() => setSelectedDataObjectType(objType)}
                    >
                      {objType}
                    </button>
                  )
                ))}
              </div>
            </div>
          )}
          
          {/* OCEL Table */}
          {dataView === 'ocel' && exploreData.extended_table_rows && (
          <div style={{ overflowX: 'auto', maxHeight: '500px', overflowY: 'auto' }}>
            <table className="activities-table">
              <thead>
                <tr>
                  {exploreData.table_columns.map((col, idx) => (
                    <th key={idx}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {exploreData.extended_table_rows.map((row, idx) => (
                  <tr key={idx}>
                      {exploreData.table_columns.map((col, colIdx) => {
                        const value = row[col]
                        // Try to format any value that looks like a datetime
                        const displayValue = formatIfDatetime(value)
                        return <td key={colIdx}>{displayValue}</td>
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          {/* Events Table */}
          {dataView === 'events' && selectedDataObjectType && exploreData.object_type_data[selectedDataObjectType] && (
            <div style={{ overflowX: 'auto', maxHeight: '500px', overflowY: 'auto' }}>
              <table className="activities-table">
                <thead>
                  <tr>
                    {exploreData.object_type_data[selectedDataObjectType].flattened_columns.map((col, idx) => (
                      <th key={idx}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {exploreData.object_type_data[selectedDataObjectType].first_20_events.map((event, idx) => (
                    <tr key={idx}>
                      {exploreData.object_type_data[selectedDataObjectType].flattened_columns.map((col, colIdx) => {
                        const value = event[col]
                        // Try to format any value that looks like a datetime
                        const displayValue = formatIfDatetime(value)
                        return <td key={colIdx}>{displayValue}</td>
                      })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
          
          {/* Footprint Matrix */}
          {dataView === 'footprint' && selectedDataObjectType && exploreData.object_type_data[selectedDataObjectType] && (
            <div style={{ overflowX: 'auto', maxHeight: '500px', overflowY: 'auto' }}>
              <table className="footprint-table">
                <thead>
                  <tr>
                    <th></th>
                    {exploreData.object_type_data[selectedDataObjectType].footprint_matrix.activities.map((act, idx) => (
                      <th key={idx} title={act}>{act.substring(0, 5)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {exploreData.object_type_data[selectedDataObjectType].footprint_matrix.activities.map((rowAct, rowIdx) => (
                    <tr key={rowIdx}>
                      <th title={rowAct}>{rowAct.substring(0, 6)}</th>
                      {exploreData.object_type_data[selectedDataObjectType].footprint_matrix.matrix[rowIdx].map((cell, colIdx) => (
                        <td key={colIdx} className={cell ? (cell === '||' ? 'has-relation parallel-relation' : 'has-relation') : ''}>
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

      {/* Log Analysis Cards (per object type) */}
      {exploreData && selectedAnalysisObjectType && exploreData.object_type_data[selectedAnalysisObjectType] && (
        <div className="insights-container">
          <h2 className="insights-title">Log Analysis</h2>
          
          {/* Object type selector */}
          <div className="svg-controls" style={{ marginBottom: '1rem' }}>
            <div className="dfg-type-controls">
              {exploreData.object_types.map((objType) => (
                exploreData.object_type_data[objType] && (
                  <button 
                    key={objType}
                    className={`dfg-type-button ${selectedAnalysisObjectType === objType ? 'active' : ''}`}
                    onClick={() => setSelectedAnalysisObjectType(objType)}
                  >
                    {objType}
                  </button>
                )
              ))}
            </div>
          </div>
          
          {/* Statistics Cards */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{exploreData.object_type_data[selectedAnalysisObjectType].insights.num_events}</div>
              <div className="stat-label">Events</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{exploreData.object_type_data[selectedAnalysisObjectType].insights.num_cases}</div>
              <div className="stat-label">Cases</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{exploreData.object_type_data[selectedAnalysisObjectType].insights.num_activities}</div>
              <div className="stat-label">Activities</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{exploreData.object_type_data[selectedAnalysisObjectType].insights.num_trace_variants}</div>
              <div className="stat-label">Trace Variants</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{formatDuration(exploreData.object_type_data[selectedAnalysisObjectType].insights.log_avg_tpt)}</div>
              <div className="stat-label">Avg TPT</div>
          </div>
            <div className="stat-card">
              <div className="stat-value">{formatDuration(exploreData.object_type_data[selectedAnalysisObjectType].insights.log_median_tpt)}</div>
              <div className="stat-label">Median TPT</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{formatDuration(exploreData.object_type_data[selectedAnalysisObjectType].insights.log_min_tpt)}</div>
              <div className="stat-label">Min TPT</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{formatDuration(exploreData.object_type_data[selectedAnalysisObjectType].insights.log_max_tpt)}</div>
              <div className="stat-label">Max TPT</div>
            </div>
          </div>
        </div>
      )}

      {/* Object Types Distribution (OCEL-level) */}
      {exploreData && exploreData.object_type_counts && Object.keys(exploreData.object_type_counts).length > 0 && (
        <div className="insights-container">
          <h2 className="insights-title">Object Types Distribution</h2>
          
          <div className="chart-container">
                <div className="activity-bar-chart">
                  <svg width="100%" height="300" viewBox="0 0 1000 300" preserveAspectRatio="xMidYMid meet" style={{ background: '#f8f9fa', borderRadius: '8px' }}>
                    {Object.entries(exploreData.object_type_counts)
                      .sort(([,a], [,b]) => b - a)
                      .map(([type, count], index, array) => {
                        const maxCount = Math.max(...Object.values(exploreData.object_type_counts))
                        const barHeight = (count / maxCount) * 220
                        const barWidth = Math.min(Math.max(900 / array.length - 10, 30), 150)
                        const x = index * (barWidth + 10) + 50
                        const y = 240 - barHeight
                        const color = `hsl(${(index * 60) % 360}, 70%, 60%)`
                        
                        return (
                          <g key={type}>
                        <rect x={x} y={y} width={barWidth} height={barHeight} fill={color} opacity={0.85} rx={2} />
                        <text x={x + barWidth / 2} y={y - 5} textAnchor="middle" fontSize="11" fill="#2c3e50" fontWeight="700">
                              {count}
                            </text>
                        <text x={x + barWidth / 2} y={260} textAnchor="end" fontSize="10" fill="#2c3e50" fontWeight="500"
                          transform={`rotate(-45, ${x + barWidth / 2}, 260)`}>
                              {type}
                            </text>
                          </g>
                        )
                      })}
                    <line x1="40" y1="240" x2="950" y2="240" stroke="#2c3e50" strokeWidth="2" />
                    <line x1="40" y1="20" x2="40" y2="240" stroke="#2c3e50" strokeWidth="2" />
                <text x="15" y="130" fontSize="12" fill="#2c3e50" fontWeight="600" transform="rotate(-90, 15, 130)">Count</text>
                  </svg>
                </div>

                <div className="activities-table-container">
                  <table className="activities-table">
                    <thead>
                      <tr>
                        <th>Object Type</th>
                        <th>Count</th>
                        <th>Percentage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(exploreData.object_type_counts)
                        .sort(([,a], [,b]) => b - a)
                        .map(([type, count]) => {
                          const percentage = ((count / exploreData.num_objects) * 100).toFixed(1)
                          const color = `hsl(${(Object.keys(exploreData.object_type_counts).indexOf(type) * 60) % 360}, 70%, 60%)`
                          
                          return (
                            <tr key={type}>
                              <td className="activity-name-cell">
                                <div className="activity-color-dot" style={{ backgroundColor: color }}></div>
                                {type}
                              </td>
                              <td className="activity-stat-cell">{count}</td>
                              <td className="activity-stat-cell">{percentage}%</td>
                            </tr>
                          )
                        })}
                    </tbody>
                  </table>
            </div>
                </div>
              </div>
            )}

      {/* Activity Analysis - Combined */}
      {exploreData && (
        <div className="insights-container">
          <h2 className="insights-title">Activity Analysis</h2>
          
          {/* View selector: OCEL or Object Types */}
          <div className="svg-controls" style={{ marginBottom: '1rem' }}>
            <div className="dfg-type-controls">
              <button 
                className={`dfg-type-button ${selectedActivityView === 'ocel' ? 'active' : ''}`}
                onClick={() => setSelectedActivityView('ocel')}
              >
                OCEL
              </button>
              {exploreData.object_types.map((objType) => (
                exploreData.object_type_data[objType] && (
                  <button 
                    key={objType}
                    className={`dfg-type-button ${selectedActivityView === objType ? 'active' : ''}`}
                    onClick={() => setSelectedActivityView(objType)}
                  >
                    {objType}
                  </button>
                )
              ))}
            </div>
          </div>
          
          <div className="charts-section-stacked">
              <div className="chart-container">
              <h3 className="chart-title">
                Activity Frequencies {selectedActivityView !== 'ocel' ? `- ${selectedActivityView}` : ''}
              </h3>
                
              {/* OCEL View */}
              {selectedActivityView === 'ocel' && exploreData.activity_counts && (
                <>
                <div className="activity-bar-chart">
                  <svg width="100%" height="300" viewBox="0 0 1000 300" preserveAspectRatio="xMidYMid meet" style={{ background: '#f8f9fa', borderRadius: '8px' }}>
                    {Object.entries(exploreData.activity_counts)
                      .sort(([,a], [,b]) => b - a)
                      .slice(0, 15)
                      .map(([activity, count], index, array) => {
                        const maxCount = Math.max(...Object.values(exploreData.activity_counts))
                        const barHeight = (count / maxCount) * 220
                        const barWidth = Math.min(Math.max(900 / array.length - 10, 30), 80)
                        const x = index * (barWidth + 10) + 50
                        const y = 240 - barHeight
                        const color = `hsl(${(index * 60) % 360}, 70%, 60%)`
                        
                        return (
                          <g key={activity}>
                              <rect x={x} y={y} width={barWidth} height={barHeight} fill={color} opacity={0.85} rx={2} />
                              <text x={x + barWidth / 2} y={y - 5} textAnchor="middle" fontSize="11" fill="#2c3e50" fontWeight="700">{count}</text>
                              <text x={x + barWidth / 2} y={260} textAnchor="end" fontSize="10" fill="#2c3e50" fontWeight="500"
                                transform={`rotate(-45, ${x + barWidth / 2}, 260)`}>{activity}</text>
                          </g>
                        )
                      })}
                    <line x1="40" y1="240" x2="950" y2="240" stroke="#2c3e50" strokeWidth="2" />
                    <line x1="40" y1="20" x2="40" y2="240" stroke="#2c3e50" strokeWidth="2" />
                      <text x="15" y="130" fontSize="12" fill="#2c3e50" fontWeight="600" transform="rotate(-90, 15, 130)">Frequency</text>
                  </svg>
                </div>

                <div className="activities-table-container">
                  <table className="activities-table">
                    <thead>
                      <tr>
                        <th>Activity</th>
                        <th>Frequency</th>
                        <th>Percentage</th>
                          <th>Avg Duration</th>
                          <th>Median Duration</th>
                          <th>Min Duration</th>
                          <th>Max Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(exploreData.activity_counts)
                        .sort(([,a], [,b]) => b - a)
                        .map(([activity, count]) => {
                          const percentage = ((count / exploreData.num_events) * 100).toFixed(1)
                            const durations = exploreData.activity_durations?.[activity] || { avg: 0, min: 0, max: 0, median: 0 }
                          const color = `hsl(${(Object.keys(exploreData.activity_counts).indexOf(activity) * 60) % 360}, 70%, 60%)`
                          
                          return (
                            <tr key={activity}>
                              <td className="activity-name-cell">
                                <div className="activity-color-dot" style={{ backgroundColor: color }}></div>
                                {activity}
                              </td>
                              <td className="activity-stat-cell">{count}</td>
                              <td className="activity-stat-cell">{percentage}%</td>
                                <td className="activity-stat-cell">{formatDuration(durations.avg)}</td>
                                <td className="activity-stat-cell">{formatDuration(durations.median)}</td>
                                <td className="activity-stat-cell">{formatDuration(durations.min)}</td>
                                <td className="activity-stat-cell">{formatDuration(durations.max)}</td>
                            </tr>
                          )
                        })}
                    </tbody>
                  </table>
                </div>

                <ActivityPieChart 
                  activityFrequencies={exploreData.activity_counts}
                  totalEvents={exploreData.num_events}
                />
                </>
              )}
              
              {/* Object Type View */}
              {selectedActivityView !== 'ocel' && exploreData.object_type_data[selectedActivityView] && (
                <>
                  <div className="activity-bar-chart">
                    <svg width="100%" height="300" viewBox="0 0 1000 300" preserveAspectRatio="xMidYMid meet" style={{ background: '#f8f9fa', borderRadius: '8px' }}>
                      {Object.entries(exploreData.object_type_data[selectedActivityView].insights.activity_frequencies || {})
                        .sort(([,a], [,b]) => b - a)
                        .map(([activity, frequency], index, array) => {
                          const maxFreq = Math.max(...Object.values(exploreData.object_type_data[selectedActivityView].insights.activity_frequencies || {}))
                          const barHeight = (frequency / maxFreq) * 220
                          const barWidth = Math.min(Math.max(900 / array.length - 10, 30), 80)
                          const x = index * (barWidth + 10) + 50
                          const y = 240 - barHeight
                          const color = `hsl(${(index * 60) % 360}, 70%, 60%)`
                          
                          return (
                            <g key={activity}>
                              <rect x={x} y={y} width={barWidth} height={barHeight} fill={color} opacity={0.85} rx={2} />
                              <text x={x + barWidth / 2} y={y - 5} textAnchor="middle" fontSize="11" fill="#2c3e50" fontWeight="700">{frequency}</text>
                              <text x={x + barWidth / 2} y={260} textAnchor="end" fontSize="10" fill="#2c3e50" fontWeight="500"
                                transform={`rotate(-45, ${x + barWidth / 2}, 260)`}>{activity}</text>
                            </g>
                          )
                        })}
                      <line x1="40" y1="240" x2="950" y2="240" stroke="#2c3e50" strokeWidth="2" />
                      <line x1="40" y1="20" x2="40" y2="240" stroke="#2c3e50" strokeWidth="2" />
                      <text x="15" y="130" fontSize="12" fill="#2c3e50" fontWeight="600" transform="rotate(-90, 15, 130)">Frequency</text>
                    </svg>
              </div>

                  <div className="activities-table-container">
                    <table className="activities-table">
                      <thead>
                        <tr>
                          <th>Activity</th>
                          <th>Abs Freq</th>
                          <th>Cases</th>
                          <th>Avg Duration</th>
                          <th>Median Duration</th>
                          <th>Min Duration</th>
                          <th>Max Duration</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(exploreData.object_type_data[selectedActivityView].insights.activity_frequencies || {})
                          .sort(([,a], [,b]) => b - a)
                          .map(([activity, frequency]) => {
                            const caseCount = exploreData.object_type_data[selectedActivityView].insights.activity_case_counts?.[activity] || 0
                            const casePercentage = ((caseCount / (exploreData.object_type_data[selectedActivityView].insights?.num_cases || 1)) * 100).toFixed(1)
                            const durations = exploreData.object_type_data[selectedActivityView].insights.activity_durations?.[activity] || { avg: 0, min: 0, max: 0, median: 0 }
                            const color = `hsl(${(Object.keys(exploreData.object_type_data[selectedActivityView].insights.activity_frequencies).indexOf(activity) * 60) % 360}, 70%, 60%)`
                            
                            return (
                              <tr key={activity}>
                                <td className="activity-name-cell">
                                  <div className="activity-color-dot" style={{ backgroundColor: color }}></div>
                                  {activity}
                                </td>
                                <td className="activity-stat-cell">{frequency}</td>
                                <td className="activity-stat-cell">{caseCount} ({casePercentage}%)</td>
                                <td className="activity-stat-cell">{formatDuration(durations.avg)}</td>
                                <td className="activity-stat-cell">{formatDuration(durations.median)}</td>
                                <td className="activity-stat-cell">{formatDuration(durations.min)}</td>
                                <td className="activity-stat-cell">{formatDuration(durations.max)}</td>
                              </tr>
                            )
                          })}
                      </tbody>
                    </table>
                  </div>
                  
                  <ActivityPieChart 
                    activityFrequencies={exploreData.object_type_data[selectedActivityView].insights.activity_frequencies}
                    totalEvents={exploreData.object_type_data[selectedActivityView].insights.num_events}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Trace Variants Analysis - Per Object Type */}
      {exploreData && selectedVariantObjectType && exploreData.object_type_data[selectedVariantObjectType] && (
        <div className="insights-container">
          <h2 className="insights-title">Trace Variants Analysis</h2>
          
          {/* Object type selector */}
          <div className="svg-controls" style={{ marginBottom: '1rem' }}>
            <div className="dfg-type-controls">
              {exploreData.object_types.map((objType) => (
                exploreData.object_type_data[objType] && (
                  <button 
                    key={objType}
                    className={`dfg-type-button ${selectedVariantObjectType === objType ? 'active' : ''}`}
                    onClick={() => setSelectedVariantObjectType(objType)}
                  >
                    {objType}
                  </button>
                )
              ))}
            </div>
          </div>
          
          <div className="charts-section-stacked">
            <div className="chart-container">
              <h3 className="chart-title">Trace Variants - {selectedVariantObjectType}</h3>
              
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
                    {getSortedVariants(exploreData.object_type_data[selectedVariantObjectType].insights.trace_variants || []).map((variant, displayIndex) => {
                      const originalIndex = exploreData.object_type_data[selectedVariantObjectType].insights.trace_variants.indexOf(variant) + 1
                      return (
                        <tr key={displayIndex}>
                          <td className="variant-index-cell">{originalIndex}</td>
                          <td className="variant-trace-cell">
                            <div className="variant-sequence-scrollable">
                              {variant.activities.map((activity: string, activityIndex: number) => {
                                const activityColorIndex = Object.keys(exploreData.object_type_data[selectedVariantObjectType].insights?.activity_frequencies || {}).indexOf(activity)
                                const activityColor = `hsl(${(activityColorIndex * 60) % 360}, 70%, 60%)`
                                
                                return (
                                  <div key={activityIndex} className="activity-block-compact" style={{ backgroundColor: activityColor }}>
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
                traceVariants={exploreData.object_type_data[selectedVariantObjectType].insights.trace_variants}
                totalCases={exploreData.object_type_data[selectedVariantObjectType].insights.num_cases}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default OCPMExploration
