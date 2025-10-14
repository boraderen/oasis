import { useState, useRef, useEffect } from 'react'

interface InductiveData {
  message: string
  svg_content: string
  log_metadata: any
  train_stats: any
  test_stats: any
  tbr_fitness: number
  align_fitness: number | string
  tbr_precision: number
  align_precision: number | string
  tbr_f1: number
  align_f1: number | string
  mean_fitness: number
  mean_precision: number
  num_places: number
  num_transitions: number
  num_arcs: number
  status: string
}

interface ViewInductiveProps {
  logIndex: number
}

function ViewInductive({ logIndex }: ViewInductiveProps) {
  const [inductiveData, setInductiveData] = useState<InductiveData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const svgContainerRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [isInitialized, setIsInitialized] = useState(false)
  const [noiseSliderValue, setNoiseSliderValue] = useState(0.2)
  const [isNoiseSliderDragging, setIsNoiseSliderDragging] = useState(false)
  const noiseSliderRef = useRef<HTMLDivElement>(null)

  const handleDiscover = async () => {
    setLoading(true)
    setError(null)

    const formData = new FormData()
    formData.append('log_index', logIndex.toString())
    formData.append('noise_threshold', noiseSliderValue.toString())

    try {
      const response = await fetch('http://localhost:8000/api/discover_inductive', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()
      
      if (result.status === 'success') {
        setInductiveData(result)
        setIsInitialized(false) // Reset initialization flag for new discovery
      } else {
        setError(result.message || 'Discovery failed')
      }
    } catch (err) {
      setError('Failed to connect to server')
    } finally {
      setLoading(false)
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

  // Noise Slider functionality
  const handleNoiseSliderMouseDown = (e: React.MouseEvent) => {
    setIsNoiseSliderDragging(true)
    e.preventDefault()
  }

  const handleNoiseSliderClick = (e: React.MouseEvent) => {
    if (noiseSliderRef.current) {
      const rect = noiseSliderRef.current.getBoundingClientRect()
      const y = e.clientY - rect.top
      const percentage = Math.max(0, Math.min(1, y / rect.height))
      const newValue = 1 - percentage
      setNoiseSliderValue(newValue)
    }
  }

  // Global mouse events for noise slider
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isNoiseSliderDragging && noiseSliderRef.current) {
        const rect = noiseSliderRef.current.getBoundingClientRect()
        const y = e.clientY - rect.top
        const percentage = Math.max(0, Math.min(1, y / rect.height))
        const newValue = 1 - percentage
        setNoiseSliderValue(newValue)
      }
    }

    const handleGlobalMouseUp = () => {
      setIsNoiseSliderDragging(false)
    }

    if (isNoiseSliderDragging) {
      document.addEventListener('mousemove', handleGlobalMouseMove)
      document.addEventListener('mouseup', handleGlobalMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove)
      document.removeEventListener('mouseup', handleGlobalMouseUp)
    }
  }, [isNoiseSliderDragging])

  // Center SVG when first loaded
  useEffect(() => {
    if (inductiveData && !isInitialized && svgContainerRef.current) {
      const container = svgContainerRef.current
      const containerRect = container.getBoundingClientRect()
      
      // Center the SVG within the container
      const centerX = (containerRect.width - containerRect.width * 0.8) / 2
      const centerY = (containerRect.height - containerRect.height * 0.8) / 2
      
      setPosition({ x: centerX, y: centerY })
      setZoom(0.8) // Start with 80% zoom for better overview
      setIsInitialized(true)
    }
  }, [inductiveData, isInitialized])

  return (
    <div className="discovery-component">
      <h3 className="component-title">Inductive Algorithm</h3>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <div className="algorithm-layout">
        <div className="algorithm-left">
          <div className="algorithm-zoom-controls">
            <button className="zoom-button" onClick={zoomOut}>−</button>
            <span className="zoom-info">Zoom: {Math.round(zoom * 100)}%</span>
            <button className="zoom-button" onClick={zoomIn}>+</button>
            <button className="reset-button" onClick={resetView}>
              Reset
            </button>
          </div>
          
          {inductiveData && (
            <div 
              className="algorithm-svg-container"
              ref={svgContainerRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
            >
              <div
                className="algorithm-svg-content"
                style={{
                  transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
                  transformOrigin: '0 0'
                }}
                dangerouslySetInnerHTML={{ __html: inductiveData.svg_content }}
              />
            </div>
          )}
        </div>

        <div className="algorithm-right">
          <div className="discover-button-container">
            <button 
              className="discover-button-top"
              onClick={handleDiscover}
              disabled={loading}
            >
              {loading ? 'Discovering...' : 'Discover'}
            </button>
          </div>

          <div className="metrics-center-container">
            {inductiveData ? (
              <div className="algorithm-metrics">
                {/* Fitness Group */}
                <div className="metric-section">
                  <div className="section-header">Fitness</div>
                  <div className="metric-row">
                    <span className="metric-label">Mean</span>
                    <span className="metric-value primary">{(inductiveData.mean_fitness * 100).toFixed(2)}%</span>
                  </div>
                  <div className="metric-row sub">
                    <span className="metric-label">TBR</span>
                    <span className="metric-value">{(inductiveData.tbr_fitness * 100).toFixed(2)}%</span>
                  </div>
                  <div className="metric-row sub">
                    <span className="metric-label">Alignment</span>
                    <span className="metric-value">
                      {typeof inductiveData.align_fitness === 'string' 
                        ? inductiveData.align_fitness 
                        : `${(inductiveData.align_fitness * 100).toFixed(2)}%`}
                    </span>
                  </div>
                </div>
                
                {/* Precision Group */}
                <div className="metric-section">
                  <div className="section-header">Precision</div>
                  <div className="metric-row">
                    <span className="metric-label">Mean</span>
                    <span className="metric-value primary">{(inductiveData.mean_precision * 100).toFixed(2)}%</span>
                  </div>
                  <div className="metric-row sub">
                    <span className="metric-label">TBR</span>
                    <span className="metric-value">{(inductiveData.tbr_precision * 100).toFixed(2)}%</span>
                  </div>
                  <div className="metric-row sub">
                    <span className="metric-label">Alignment</span>
                    <span className="metric-value">
                      {typeof inductiveData.align_precision === 'string' 
                        ? inductiveData.align_precision 
                        : `${(inductiveData.align_precision * 100).toFixed(2)}%`}
                    </span>
                  </div>
                </div>
                
                {/* F1 Group */}
                <div className="metric-section">
                  <div className="section-header">F1-Score</div>
                  <div className="metric-row">
                    <span className="metric-label">TBR</span>
                    <span className="metric-value">{(inductiveData.tbr_f1 * 100).toFixed(2)}%</span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">Alignment</span>
                    <span className="metric-value">
                      {typeof inductiveData.align_f1 === 'string' 
                        ? inductiveData.align_f1 
                        : `${(inductiveData.align_f1 * 100).toFixed(2)}%`}
                    </span>
                  </div>
                </div>
                
                {/* Model Structure */}
                <div className="metric-section">
                  <div className="section-header">Model Structure</div>
                  <div className="metric-row">
                    <span className="metric-label">Places</span>
                    <span className="metric-value">{inductiveData.num_places}</span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">Transitions</span>
                    <span className="metric-value">{inductiveData.num_transitions}</span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">Arcs</span>
                    <span className="metric-value">{inductiveData.num_arcs}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="algorithm-metrics">
                {/* Fitness Group */}
                <div className="metric-section">
                  <div className="section-header">Fitness</div>
                  <div className="metric-row">
                    <span className="metric-label">Mean</span>
                    <span className="metric-value primary">-</span>
                  </div>
                  <div className="metric-row sub">
                    <span className="metric-label">TBR</span>
                    <span className="metric-value">-</span>
                  </div>
                  <div className="metric-row sub">
                    <span className="metric-label">Alignment</span>
                    <span className="metric-value">-</span>
                  </div>
                </div>
                
                {/* Precision Group */}
                <div className="metric-section">
                  <div className="section-header">Precision</div>
                  <div className="metric-row">
                    <span className="metric-label">Mean</span>
                    <span className="metric-value primary">-</span>
                  </div>
                  <div className="metric-row sub">
                    <span className="metric-label">TBR</span>
                    <span className="metric-value">-</span>
                  </div>
                  <div className="metric-row sub">
                    <span className="metric-label">Alignment</span>
                    <span className="metric-value">-</span>
                  </div>
                </div>
                
                {/* F1 Group */}
                <div className="metric-section">
                  <div className="section-header">F1-Score</div>
                  <div className="metric-row">
                    <span className="metric-label">TBR</span>
                    <span className="metric-value">-</span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">Alignment</span>
                    <span className="metric-value">-</span>
                  </div>
                </div>
                
                {/* Model Structure */}
                <div className="metric-section">
                  <div className="section-header">Model Structure</div>
                  <div className="metric-row">
                    <span className="metric-label">Places</span>
                    <span className="metric-value">-</span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">Transitions</span>
                    <span className="metric-value">-</span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">Arcs</span>
                    <span className="metric-value">-</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="sliders-bottom-container">
            <div className="vertical-slider-container">
              <div className="slider-label">Noise</div>
              <div className="slider-value-display">
                {noiseSliderValue.toFixed(2)}
              </div>
              <div 
                className="slider-track"
                ref={noiseSliderRef}
                onClick={handleNoiseSliderClick}
              >
                <div 
                  className="slider-thumb"
                  style={{
                    bottom: `${noiseSliderValue * 100}%`
                  }}
                  onMouseDown={handleNoiseSliderMouseDown}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ViewInductive
