import { useState, useRef, useEffect } from 'react'

interface OCPMIMData {
  message: string
  svg_content: string
  status: string
}

interface ViewOCPMIMProps {
  ocelIndex: number
}

function ViewOCPMIM({ ocelIndex }: ViewOCPMIMProps) {
  const [ocpmImData, setOcpmImData] = useState<OCPMIMData | null>(null)
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
      formData.append('ocel_index', ocelIndex.toString())

      const response = await fetch('http://localhost:8000/api/discover_ocpm_im', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (result.status === 'success') {
        setOcpmImData(result)
        setIsInitialized(false) // Reset initialization flag for new discovery
      } else {
        setError(result.message || 'OCPM IM Discovery failed')
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
    if (ocpmImData && !isInitialized && svgContainerRef.current) {
      const container = svgContainerRef.current
      const containerRect = container.getBoundingClientRect()
      
      // Center the SVG within the container
      const centerX = (containerRect.width - containerRect.width * 0.8) / 2
      const centerY = (containerRect.height - containerRect.height * 0.8) / 2
      
      setPosition({ x: centerX, y: centerY })
      setZoom(0.8) // Start with 80% zoom for better overview
      setIsInitialized(true)
    }
  }, [ocpmImData, isInitialized])

  return (
    <div className="discovery-component">
      <h3 className="component-title">Inductive Miner (IM)</h3>

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
          
          {ocpmImData && (
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
                dangerouslySetInnerHTML={{ __html: ocpmImData.svg_content }}
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
            {ocpmImData ? (
              <div className="algorithm-metrics">
                <div className="metric-section">
                  <div className="section-header">OCPM IM Model</div>
                  <div className="metric-row">
                    <span className="metric-label">Status</span>
                    <span className="metric-value primary">Discovered</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="algorithm-metrics">
                <div className="metric-section">
                  <div className="section-header">OCPM IM Model</div>
                  <div className="metric-row">
                    <span className="metric-label">Status</span>
                    <span className="metric-value primary">Not Discovered</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ViewOCPMIM