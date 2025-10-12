import React, { useState, useMemo } from 'react'
import './TraceVariantPieChart.css'

interface TraceVariant {
  activities: string[]
  frequency: number
  percentage: number
}

interface TraceVariantData {
  name: string
  activities: string[]
  frequency: number
  percentage: number
  color: string
  pattern: string
}

interface TraceVariantPieChartProps {
  traceVariants: TraceVariant[]
  totalCases: number
}

const TraceVariantPieChart: React.FC<TraceVariantPieChartProps> = ({ 
  traceVariants, 
  totalCases 
}) => {
  const [hiddenVariants, setHiddenVariants] = useState<Set<number>>(new Set())
  const [hoveredSector, setHoveredSector] = useState<number | null>(null)

  // Generate colors and patterns for trace variants
  const generateVariantData = useMemo(() => {
    return traceVariants.map((variant, index) => {
      const percentage = (variant.frequency / totalCases) * 100
      // Use different color scheme for variants
      const hue = (index * 45) % 360 // Different spacing for variants
      const color = `hsl(${hue}, 75%, 55%)`
      
      // Different patterns for visual distinction (no solid pattern)
      const patterns = [
        'diagonal-lines',
        'dots',
        'horizontal-lines',
        'vertical-lines',
        'crosshatch',
        'waves',
        'circles',
        'squares',
        'triangles',
        'grid'
      ]
      const pattern = patterns[index % patterns.length]
      
      // Use variant number for the name
      const name = `Variant ${index + 1}`
      
      return {
        name,
        activities: variant.activities,
        frequency: variant.frequency,
        percentage,
        color,
        pattern,
        index
      }
    })
  }, [traceVariants, totalCases])

  // Filter out hidden variants and recalculate percentages
  const visibleVariantData = useMemo(() => {
    const visible = generateVariantData.filter(variant => 
      !hiddenVariants.has(variant.index)
    )
    
    const visibleTotal = visible.reduce((sum, variant) => sum + variant.frequency, 0)
    
    return visible.map(variant => ({
      ...variant,
      percentage: (variant.frequency / visibleTotal) * 100
    }))
  }, [generateVariantData, hiddenVariants])

  // Calculate pie chart segments
  const pieSegments = useMemo(() => {
    let currentAngle = 0
    const radius = 180
    const centerX = 200
    const centerY = 200
    
    return visibleVariantData.map((variant) => {
      const angle = (variant.percentage / 100) * 360
      const startAngle = currentAngle
      const endAngle = currentAngle + angle
      
      // Calculate path for pie segment
      const startAngleRad = (startAngle * Math.PI) / 180
      const endAngleRad = (endAngle * Math.PI) / 180
      
      const x1 = centerX + radius * Math.cos(startAngleRad)
      const y1 = centerY + radius * Math.sin(startAngleRad)
      const x2 = centerX + radius * Math.cos(endAngleRad)
      const y2 = centerY + radius * Math.sin(endAngleRad)
      
      const largeArcFlag = angle > 180 ? 1 : 0
      
      const pathData = [
        `M ${centerX} ${centerY}`,
        `L ${x1} ${y1}`,
        `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
        'Z'
      ].join(' ')
      
      currentAngle += angle
      
      return {
        ...variant,
        pathData,
        startAngle,
        endAngle
      }
    })
  }, [visibleVariantData])

  const toggleVariant = (variantIndex: number) => {
    setHiddenVariants(prev => {
      const newSet = new Set(prev)
      if (newSet.has(variantIndex)) {
        newSet.delete(variantIndex)
      } else {
        newSet.add(variantIndex)
      }
      return newSet
    })
  }

  const resetAllVariants = () => {
    setHiddenVariants(new Set())
  }

  return (
    <div className="variant-pie-chart-container">
      <div className="variant-pie-chart-header">
        <h3 className="variant-pie-chart-title">Trace Variant Distribution</h3>
        <button 
          className="reset-variants-btn"
          onClick={resetAllVariants}
          disabled={hiddenVariants.size === 0}
        >
          Show All Variants
        </button>
      </div>
      
      <div className="variant-pie-chart-content">
        <div className="variant-pie-chart-wrapper">
          <svg 
            width="400" 
            height="400" 
            viewBox="0 0 400 400"
            className="variant-pie-chart-svg"
          >
            {pieSegments.map((segment) => (
              <g key={segment.index}>
                <defs>
                  <pattern 
                    id={`variant-pattern-${segment.index}`} 
                    patternUnits="userSpaceOnUse" 
                    width="12" 
                    height="12"
                  >
                    {/* Background color for the pattern */}
                    <rect width="12" height="12" fill={segment.color} opacity="0.3"/>
                    {segment.pattern === 'diagonal-lines' && (
                      <path 
                        d="M 0,12 L 12,0" 
                        stroke="white" 
                        strokeWidth="2" 
                        opacity="0.8"
                      />
                    )}
                    {segment.pattern === 'dots' && (
                      <>
                        <circle cx="3" cy="3" r="1.5" fill="white" opacity="0.9"/>
                        <circle cx="9" cy="9" r="1.5" fill="white" opacity="0.9"/>
                      </>
                    )}
                    {segment.pattern === 'horizontal-lines' && (
                      <path 
                        d="M 0,6 L 12,6" 
                        stroke="white" 
                        strokeWidth="2" 
                        opacity="0.8"
                      />
                    )}
                    {segment.pattern === 'vertical-lines' && (
                      <path 
                        d="M 6,0 L 6,12" 
                        stroke="white" 
                        strokeWidth="2" 
                        opacity="0.8"
                      />
                    )}
                    {segment.pattern === 'crosshatch' && (
                      <>
                        <path 
                          d="M 0,12 L 12,0" 
                          stroke="white" 
                          strokeWidth="1.5" 
                          opacity="0.6"
                        />
                        <path 
                          d="M 0,0 L 12,12" 
                          stroke="white" 
                          strokeWidth="1.5" 
                          opacity="0.6"
                        />
                      </>
                    )}
                    {segment.pattern === 'waves' && (
                      <path 
                        d="M 0,6 Q 3,0 6,6 T 12,6" 
                        stroke="white" 
                        strokeWidth="2" 
                        fill="none" 
                        opacity="0.8"
                      />
                    )}
                    {segment.pattern === 'circles' && (
                      <>
                        <circle cx="3" cy="3" r="2" fill="white" opacity="0.7"/>
                        <circle cx="9" cy="9" r="2" fill="white" opacity="0.7"/>
                      </>
                    )}
                    {segment.pattern === 'squares' && (
                      <>
                        <rect x="1" y="1" width="4" height="4" fill="white" opacity="0.8"/>
                        <rect x="7" y="7" width="4" height="4" fill="white" opacity="0.8"/>
                      </>
                    )}
                    {segment.pattern === 'triangles' && (
                      <>
                        <polygon points="3,1 1,5 5,5" fill="white" opacity="0.8"/>
                        <polygon points="9,7 7,11 11,11" fill="white" opacity="0.8"/>
                      </>
                    )}
                    {segment.pattern === 'grid' && (
                      <>
                        <path d="M 0,4 L 12,4" stroke="white" strokeWidth="1" opacity="0.6"/>
                        <path d="M 0,8 L 12,8" stroke="white" strokeWidth="1" opacity="0.6"/>
                        <path d="M 4,0 L 4,12" stroke="white" strokeWidth="1" opacity="0.6"/>
                        <path d="M 8,0 L 8,12" stroke="white" strokeWidth="1" opacity="0.6"/>
                      </>
                    )}
                  </pattern>
                </defs>
                
                <path
                  d={segment.pathData}
                  fill={`url(#variant-pattern-${segment.index})`}
                  stroke="white"
                  strokeWidth="3"
                  className={`variant-pie-segment ${hoveredSector === segment.index ? 'hovered' : ''}`}
                  onMouseEnter={() => setHoveredSector(segment.index)}
                  onMouseLeave={() => setHoveredSector(null)}
                  style={{
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                />
              </g>
            ))}
            
            {/* Center circle */}
            <circle 
              cx="200" 
              cy="200" 
              r="60" 
              fill="white" 
              stroke="#e0e0e0" 
              strokeWidth="3"
            />
            
            {/* Center text */}
            <text 
              x="200" 
              y="195" 
              textAnchor="middle" 
              className="variant-center-text"
            >
              {visibleVariantData.length}
            </text>
            <text 
              x="200" 
              y="215" 
              textAnchor="middle" 
              className="variant-center-subtext"
            >
              Variants
            </text>
          </svg>
          
          {/* Tooltip */}
          {hoveredSector !== null && (
            <div className="variant-pie-tooltip">
              {(() => {
                const segment = pieSegments.find(s => s.index === hoveredSector)
                return segment ? (
                  <>
                    <div className="variant-tooltip-title">{segment.name}</div>
                    <div className="variant-tooltip-percentage">{segment.percentage.toFixed(1)}%</div>
                    <div className="variant-tooltip-frequency">{segment.frequency} cases</div>
                  </>
                ) : null
              })()}
            </div>
          )}
        </div>
        
        <div className="variant-controls">
          <h4 className="variant-controls-title">Variant Controls</h4>
          <div className="variant-checkboxes">
            {generateVariantData.map((variant) => (
              <label 
                key={variant.index} 
                className={`variant-checkbox ${hiddenVariants.has(variant.index) ? 'hidden' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={!hiddenVariants.has(variant.index)}
                  onChange={() => toggleVariant(variant.index)}
                />
                <div 
                  className="variant-checkbox-indicator"
                  style={{ 
                    backgroundColor: variant.color,
                    backgroundImage: `url(#variant-pattern-${variant.index})`
                  }}
                />
                <div className="variant-info">
                  <span className="variant-name">{variant.name}</span>
                  <span className="variant-activities">
                    {variant.activities.join(' → ')}
                  </span>
                  <span className="variant-percentage">
                    ({variant.percentage.toFixed(1)}%)
                  </span>
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default TraceVariantPieChart
