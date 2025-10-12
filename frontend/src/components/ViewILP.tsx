import { useState, useRef, useEffect } from 'react'

interface ILPData {
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

function ViewILP() {
  const [ilpData, setIlpData] = useState<ILPData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const svgContainerRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [isInitialized, setIsInitialized] = useState(false)
  const [alphaSliderValue, setAlphaSliderValue] = useState(0.5)
  const [isAlphaSliderDragging, setIsAlphaSliderDragging] = useState(false)
  const alphaSliderRef = useRef<HTMLDivElement>(null)

  const handleDiscover = async () => {
    setLoading(true)
    setError(null)

    const formData = new FormData()
    formData.append('alpha', alphaSliderValue.toString())

    try {
      const response = await fetch('http://localhost:8000/api/discover_ilp', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()
      
      if (result.status === 'success') {
        setIlpData(result)
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

  // Alpha Slider functionality
  const handleAlphaSliderMouseDown = (e: React.MouseEvent) => {
    setIsAlphaSliderDragging(true)
    e.preventDefault()
  }

  const handleAlphaSliderClick = (e: React.MouseEvent) => {
    if (alphaSliderRef.current) {
      const rect = alphaSliderRef.current.getBoundingClientRect()
      const y = e.clientY - rect.top
      const percentage = Math.max(0, Math.min(1, y / rect.height))
      const newValue = 1 - percentage
      setAlphaSliderValue(newValue)
    }
  }

  // Global mouse events for alpha slider
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isAlphaSliderDragging && alphaSliderRef.current) {
        const rect = alphaSliderRef.current.getBoundingClientRect()
        const y = e.clientY - rect.top
        const percentage = Math.max(0, Math.min(1, y / rect.height))
        const newValue = 1 - percentage
        setAlphaSliderValue(newValue)
      }
    }

    const handleGlobalMouseUp = () => {
      setIsAlphaSliderDragging(false)
    }

    if (isAlphaSliderDragging) {
      document.addEventListener('mousemove', handleGlobalMouseMove)
      document.addEventListener('mouseup', handleGlobalMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove)
      document.removeEventListener('mouseup', handleGlobalMouseUp)
    }
  }, [isAlphaSliderDragging])

  // Center SVG when first loaded
  useEffect(() => {
    if (ilpData && !isInitialized && svgContainerRef.current) {
      const container = svgContainerRef.current
      const containerRect = container.getBoundingClientRect()
      
      // Center the SVG within the container
      const centerX = (containerRect.width - containerRect.width * 0.8) / 2
      const centerY = (containerRect.height - containerRect.height * 0.8) / 2
      
      setPosition({ x: centerX, y: centerY })
      setZoom(0.8) // Start with 80% zoom for better overview
      setIsInitialized(true)
    }
  }, [ilpData, isInitialized])

  return (
    <div className="discovery-component">
      <h3 className="component-title">ILP Algorithm</h3>

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
          
          {ilpData && (
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
                dangerouslySetInnerHTML={{ __html: ilpData.svg_content }}
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
            {ilpData ? (
              <div className="algorithm-metrics">
                <div className="metric-row">
                  <span className="metric-label">TBR Fitness:</span>
                  <span className="metric-value">{(ilpData.tbr_fitness * 100).toFixed(2)}%</span>
                </div>
                <div className="metric-row">
                  <span className="metric-label">Align Fitness:</span>
                  <span className="metric-value">
                    {typeof ilpData.align_fitness === 'string' 
                      ? ilpData.align_fitness 
                      : `${(ilpData.align_fitness * 100).toFixed(2)}%`}
                  </span>
                </div>
                <div className="metric-row">
                  <span className="metric-label">TBR Precision:</span>
                  <span className="metric-value">{(ilpData.tbr_precision * 100).toFixed(2)}%</span>
                </div>
                <div className="metric-row">
                  <span className="metric-label">Align Precision:</span>
                  <span className="metric-value">
                    {typeof ilpData.align_precision === 'string' 
                      ? ilpData.align_precision 
                      : `${(ilpData.align_precision * 100).toFixed(2)}%`}
                  </span>
                </div>
                <div className="metric-row">
                  <span className="metric-label">TBR F1:</span>
                  <span className="metric-value">{(ilpData.tbr_f1 * 100).toFixed(2)}%</span>
                </div>
                <div className="metric-row">
                  <span className="metric-label">Align F1:</span>
                  <span className="metric-value">
                    {typeof ilpData.align_f1 === 'string' 
                      ? ilpData.align_f1 
                      : `${(ilpData.align_f1 * 100).toFixed(2)}%`}
                  </span>
                </div>
                <div className="metric-row">
                  <span className="metric-label">Mean Fitness:</span>
                  <span className="metric-value">{(ilpData.mean_fitness * 100).toFixed(2)}%</span>
                </div>
                <div className="metric-row">
                  <span className="metric-label">Mean Precision:</span>
                  <span className="metric-value">{(ilpData.mean_precision * 100).toFixed(2)}%</span>
                </div>
                <div className="metric-row">
                  <span className="metric-label">Simplicity:</span>
                  <span className="metric-value">{ilpData.simplicity.toFixed(2)}</span>
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
              <div className="slider-label">Alpha</div>
              <div className="slider-value-display">
                {alphaSliderValue.toFixed(2)}
              </div>
              <div 
                className="slider-track"
                ref={alphaSliderRef}
                onClick={handleAlphaSliderClick}
              >
                <div 
                  className="slider-thumb"
                  style={{
                    bottom: `${alphaSliderValue * 100}%`
                  }}
                  onMouseDown={handleAlphaSliderMouseDown}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ViewILP
