import { useState, useRef, useEffect } from 'react'

interface HeuristicsData {
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

function ViewHeuristics() {
  const [heuristicsData, setHeuristicsData] = useState<HeuristicsData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const svgContainerRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [isInitialized, setIsInitialized] = useState(false)
  
  // Slider values
  const [dependencySliderValue, setDependencySliderValue] = useState(0.9)
  const [andSliderValue, setAndSliderValue] = useState(0.9)
  const [loopSliderValue, setLoopSliderValue] = useState(0.9)
  
  // Slider dragging states
  const [isDependencySliderDragging, setIsDependencySliderDragging] = useState(false)
  const [isAndSliderDragging, setIsAndSliderDragging] = useState(false)
  const [isLoopSliderDragging, setIsLoopSliderDragging] = useState(false)
  
  // Slider refs
  const dependencySliderRef = useRef<HTMLDivElement>(null)
  const andSliderRef = useRef<HTMLDivElement>(null)
  const loopSliderRef = useRef<HTMLDivElement>(null)

  const handleDiscover = async () => {
    setLoading(true)
    setError(null)

    const formData = new FormData()
    formData.append('dependency_threshold', dependencySliderValue.toString())
    formData.append('and_threshold', andSliderValue.toString())
    formData.append('loop_two_threshold', loopSliderValue.toString())

    try {
      const response = await fetch('http://localhost:8000/api/discover_heuristics', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()
      
      if (result.status === 'success') {
        setHeuristicsData(result)
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

  // Slider functionality helpers
  const createSliderHandler = (setter: (value: number) => void, draggingSetter: (value: boolean) => void, ref: React.RefObject<HTMLDivElement | null>) => {
    const handleMouseDown = (e: React.MouseEvent) => {
      draggingSetter(true)
      e.preventDefault()
    }

    const handleClick = (e: React.MouseEvent) => {
      if (ref.current) {
        const rect = ref.current.getBoundingClientRect()
        const y = e.clientY - rect.top
        const percentage = Math.max(0, Math.min(1, y / rect.height))
        const newValue = 1 - percentage
        setter(newValue)
      }
    }

    return { handleMouseDown, handleClick }
  }

  const dependencySlider = createSliderHandler(setDependencySliderValue, setIsDependencySliderDragging, dependencySliderRef)
  const andSlider = createSliderHandler(setAndSliderValue, setIsAndSliderDragging, andSliderRef)
  const loopSlider = createSliderHandler(setLoopSliderValue, setIsLoopSliderDragging, loopSliderRef)

  // Global mouse events for sliders
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isDependencySliderDragging && dependencySliderRef.current) {
        const rect = dependencySliderRef.current.getBoundingClientRect()
        const y = e.clientY - rect.top
        const percentage = Math.max(0, Math.min(1, y / rect.height))
        const newValue = 1 - percentage
        setDependencySliderValue(newValue)
      }
      if (isAndSliderDragging && andSliderRef.current) {
        const rect = andSliderRef.current.getBoundingClientRect()
        const y = e.clientY - rect.top
        const percentage = Math.max(0, Math.min(1, y / rect.height))
        const newValue = 1 - percentage
        setAndSliderValue(newValue)
      }
      if (isLoopSliderDragging && loopSliderRef.current) {
        const rect = loopSliderRef.current.getBoundingClientRect()
        const y = e.clientY - rect.top
        const percentage = Math.max(0, Math.min(1, y / rect.height))
        const newValue = 1 - percentage
        setLoopSliderValue(newValue)
      }
    }

    const handleGlobalMouseUp = () => {
      setIsDependencySliderDragging(false)
      setIsAndSliderDragging(false)
      setIsLoopSliderDragging(false)
    }

    if (isDependencySliderDragging || isAndSliderDragging || isLoopSliderDragging) {
      document.addEventListener('mousemove', handleGlobalMouseMove)
      document.addEventListener('mouseup', handleGlobalMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove)
      document.removeEventListener('mouseup', handleGlobalMouseUp)
    }
  }, [isDependencySliderDragging, isAndSliderDragging, isLoopSliderDragging])

  // Center SVG when first loaded
  useEffect(() => {
    if (heuristicsData && !isInitialized && svgContainerRef.current) {
      const container = svgContainerRef.current
      const containerRect = container.getBoundingClientRect()
      
      // Center the SVG within the container
      const centerX = (containerRect.width - containerRect.width * 0.8) / 2
      const centerY = (containerRect.height - containerRect.height * 0.8) / 2
      
      setPosition({ x: centerX, y: centerY })
      setZoom(0.8) // Start with 80% zoom for better overview
      setIsInitialized(true)
    }
  }, [heuristicsData, isInitialized])

  return (
    <div className="discovery-component">
      <h3 className="component-title">Heuristics Algorithm</h3>

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
          
          {heuristicsData && (
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
                dangerouslySetInnerHTML={{ __html: heuristicsData.svg_content }}
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
            {heuristicsData ? (
              <div className="algorithm-metrics">
                <div className="metric-row">
                  <span className="metric-label">TBR Fitness:</span>
                  <span className="metric-value">{(heuristicsData.tbr_fitness * 100).toFixed(2)}%</span>
                </div>
                <div className="metric-row">
                  <span className="metric-label">Align Fitness:</span>
                  <span className="metric-value">
                    {typeof heuristicsData.align_fitness === 'string' 
                      ? heuristicsData.align_fitness 
                      : `${(heuristicsData.align_fitness * 100).toFixed(2)}%`}
                  </span>
                </div>
                <div className="metric-row">
                  <span className="metric-label">TBR Precision:</span>
                  <span className="metric-value">{(heuristicsData.tbr_precision * 100).toFixed(2)}%</span>
                </div>
                <div className="metric-row">
                  <span className="metric-label">Align Precision:</span>
                  <span className="metric-value">
                    {typeof heuristicsData.align_precision === 'string' 
                      ? heuristicsData.align_precision 
                      : `${(heuristicsData.align_precision * 100).toFixed(2)}%`}
                  </span>
                </div>
                <div className="metric-row">
                  <span className="metric-label">TBR F1:</span>
                  <span className="metric-value">{(heuristicsData.tbr_f1 * 100).toFixed(2)}%</span>
                </div>
                <div className="metric-row">
                  <span className="metric-label">Align F1:</span>
                  <span className="metric-value">
                    {typeof heuristicsData.align_f1 === 'string' 
                      ? heuristicsData.align_f1 
                      : `${(heuristicsData.align_f1 * 100).toFixed(2)}%`}
                  </span>
                </div>
                <div className="metric-row">
                  <span className="metric-label">Mean Fitness:</span>
                  <span className="metric-value">{(heuristicsData.mean_fitness * 100).toFixed(2)}%</span>
                </div>
                <div className="metric-row">
                  <span className="metric-label">Mean Precision:</span>
                  <span className="metric-value">{(heuristicsData.mean_precision * 100).toFixed(2)}%</span>
                </div>
                <div className="metric-row">
                  <span className="metric-label">Simplicity:</span>
                  <span className="metric-value">{heuristicsData.simplicity.toFixed(2)}</span>
                </div>
              </div>
            ) : (
              <div className="algorithm-metrics">
                <div className="metric-row">
                  <span className="metric-label">TBR Fitness:</span>
                  <span className="metric-value">0.00%</span>
                </div>
                <div className="metric-row">
                  <span className="metric-label">Align Fitness:</span>
                  <span className="metric-value">0.00%</span>
                </div>
                <div className="metric-row">
                  <span className="metric-label">TBR Precision:</span>
                  <span className="metric-value">0.00%</span>
                </div>
                <div className="metric-row">
                  <span className="metric-label">Align Precision:</span>
                  <span className="metric-value">0.00%</span>
                </div>
                <div className="metric-row">
                  <span className="metric-label">TBR F1:</span>
                  <span className="metric-value">0.00%</span>
                </div>
                <div className="metric-row">
                  <span className="metric-label">Align F1:</span>
                  <span className="metric-value">0.00%</span>
                </div>
                <div className="metric-row">
                  <span className="metric-label">Mean Fitness:</span>
                  <span className="metric-value">0.00%</span>
                </div>
                <div className="metric-row">
                  <span className="metric-label">Mean Precision:</span>
                  <span className="metric-value">0.00%</span>
                </div>
                <div className="metric-row">
                  <span className="metric-label">Simplicity:</span>
                  <span className="metric-value">0.00</span>
                </div>
              </div>
            )}
          </div>

          <div className="sliders-bottom-container">
            <div className="vertical-slider-container">
              <div className="slider-label">Dependency</div>
              <div className="slider-value-display">
                {dependencySliderValue.toFixed(2)}
              </div>
              <div 
                className="slider-track"
                ref={dependencySliderRef}
                onClick={dependencySlider.handleClick}
              >
                <div 
                  className="slider-thumb"
                  style={{
                    bottom: `${dependencySliderValue * 100}%`
                  }}
                  onMouseDown={dependencySlider.handleMouseDown}
                />
              </div>
            </div>
            
            <div className="vertical-slider-container">
              <div className="slider-label">And</div>
              <div className="slider-value-display">
                {andSliderValue.toFixed(2)}
              </div>
              <div 
                className="slider-track"
                ref={andSliderRef}
                onClick={andSlider.handleClick}
              >
                <div 
                  className="slider-thumb"
                  style={{
                    bottom: `${andSliderValue * 100}%`
                  }}
                  onMouseDown={andSlider.handleMouseDown}
                />
              </div>
            </div>
            
            <div className="vertical-slider-container">
              <div className="slider-label">Loop</div>
              <div className="slider-value-display">
                {loopSliderValue.toFixed(2)}
              </div>
              <div 
                className="slider-track"
                ref={loopSliderRef}
                onClick={loopSlider.handleClick}
              >
                <div 
                  className="slider-thumb"
                  style={{
                    bottom: `${loopSliderValue * 100}%`
                  }}
                  onMouseDown={loopSlider.handleMouseDown}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ViewHeuristics
