import { useState, useRef, useEffect } from 'react'

interface AlphaData {
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
  simplicity: number
  status: string
}

interface ViewAlphaProps {
  logIndex: number
}

function ViewAlpha({ logIndex }: ViewAlphaProps) {
  const [alphaData, setAlphaData] = useState<AlphaData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const svgContainerRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [isInitialized, setIsInitialized] = useState(false)

  const handleDiscover = async () => {
    setLoading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('log_index', logIndex.toString())

      const response = await fetch('http://localhost:8000/api/discover_alpha', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()
      
      if (result.status === 'success') {
        setAlphaData(result)
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

  // Center SVG when first loaded
  useEffect(() => {
    if (alphaData && !isInitialized && svgContainerRef.current) {
      const container = svgContainerRef.current
      const containerRect = container.getBoundingClientRect()
      
      // Center the SVG within the container
      const centerX = (containerRect.width - containerRect.width * 0.8) / 2
      const centerY = (containerRect.height - containerRect.height * 0.8) / 2
      
      setPosition({ x: centerX, y: centerY })
      setZoom(0.8) // Start with 80% zoom for better overview
      setIsInitialized(true)
    }
  }, [alphaData, isInitialized])

  return (
    <div className="discovery-component">
      <h3 className="component-title">Alpha Algorithm</h3>

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
          
          {alphaData && (
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
                dangerouslySetInnerHTML={{ __html: alphaData.svg_content }}
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
            {alphaData ? (
              <div className="algorithm-metrics">
                {/* Fitness Group */}
                <div className="metric-section">
                  <div className="section-header">Fitness</div>
                  <div className="metric-row">
                    <span className="metric-label">Mean</span>
                    <span className="metric-value primary">{(alphaData.mean_fitness * 100).toFixed(2)}%</span>
                  </div>
                  <div className="metric-row sub">
                    <span className="metric-label">TBR</span>
                    <span className="metric-value">{(alphaData.tbr_fitness * 100).toFixed(2)}%</span>
                  </div>
                  <div className="metric-row sub">
                    <span className="metric-label">Alignment</span>
                    <span className="metric-value">
                      {typeof alphaData.align_fitness === 'string' 
                        ? alphaData.align_fitness 
                        : `${(alphaData.align_fitness * 100).toFixed(2)}%`}
                    </span>
                  </div>
                </div>
                
                {/* Precision Group */}
                <div className="metric-section">
                  <div className="section-header">Precision</div>
                  <div className="metric-row">
                    <span className="metric-label">Mean</span>
                    <span className="metric-value primary">{(alphaData.mean_precision * 100).toFixed(2)}%</span>
                  </div>
                  <div className="metric-row sub">
                    <span className="metric-label">TBR</span>
                    <span className="metric-value">{(alphaData.tbr_precision * 100).toFixed(2)}%</span>
                  </div>
                  <div className="metric-row sub">
                    <span className="metric-label">Alignment</span>
                    <span className="metric-value">
                      {typeof alphaData.align_precision === 'string' 
                        ? alphaData.align_precision 
                        : `${(alphaData.align_precision * 100).toFixed(2)}%`}
                    </span>
                  </div>
                </div>
                
                {/* F1 Group */}
                <div className="metric-section">
                  <div className="section-header">F1-Score</div>
                  <div className="metric-row">
                    <span className="metric-label">TBR</span>
                    <span className="metric-value">{(alphaData.tbr_f1 * 100).toFixed(2)}%</span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">Alignment</span>
                    <span className="metric-value">
                      {typeof alphaData.align_f1 === 'string' 
                        ? alphaData.align_f1 
                        : `${(alphaData.align_f1 * 100).toFixed(2)}%`}
                    </span>
                  </div>
                </div>
                
                {/* Simplicity */}
                <div className="metric-row">
                  <span className="metric-label">Simplicity</span>
                  <span className="metric-value">{alphaData.simplicity.toFixed(2)}</span>
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
            {/* Alpha algorithm has no sliders */}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ViewAlpha
