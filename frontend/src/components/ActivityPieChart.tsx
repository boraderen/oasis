import React, { useState, useMemo } from 'react'
import './ActivityPieChart.css'

interface ActivityData {
  name: string
  frequency: number
  percentage: number
  color: string
  pattern: string
}

interface ActivityPieChartProps {
  activityFrequencies: Record<string, number>
  totalEvents: number
}

const ActivityPieChart: React.FC<ActivityPieChartProps> = ({ 
  activityFrequencies, 
  totalEvents 
}) => {
  const [hiddenActivities, setHiddenActivities] = useState<Set<string>>(new Set())
  const [hoveredSector, setHoveredSector] = useState<string | null>(null)

  // Generate colors and patterns for activities
  const generateActivityData = useMemo(() => {
    const sortedActivities = Object.entries(activityFrequencies)
      .sort(([,a], [,b]) => b - a)
      .map(([name, frequency], index) => {
        const percentage = (frequency / totalEvents) * 100
        // Use the same color assignment as the bar chart above
        const color = `hsl(${(index * 60) % 360}, 70%, 60%)`
        
        return {
          name,
          frequency,
          percentage,
          color
        }
      })
    
    return sortedActivities
  }, [activityFrequencies, totalEvents])

  // Filter out hidden activities and recalculate percentages
  const visibleActivityData = useMemo(() => {
    const visible = generateActivityData.filter(activity => 
      !hiddenActivities.has(activity.name)
    )
    
    const visibleTotal = visible.reduce((sum, activity) => sum + activity.frequency, 0)
    
    return visible.map(activity => ({
      ...activity,
      percentage: (activity.frequency / visibleTotal) * 100
    }))
  }, [generateActivityData, hiddenActivities])

  // Calculate pie chart segments
  const pieSegments = useMemo(() => {
    let currentAngle = 0
    const radius = 180
    const centerX = 200
    const centerY = 200
    
    return visibleActivityData.map((activity, index) => {
      const angle = (activity.percentage / 100) * 360
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
        ...activity,
        pathData,
        startAngle,
        endAngle,
        index
      }
    })
  }, [visibleActivityData])

  const toggleActivity = (activityName: string) => {
    setHiddenActivities(prev => {
      const newSet = new Set(prev)
      if (newSet.has(activityName)) {
        newSet.delete(activityName)
      } else {
        newSet.add(activityName)
      }
      return newSet
    })
  }

  const resetAllActivities = () => {
    setHiddenActivities(new Set())
  }

  return (
    <div className="pie-chart-container">
      <div className="pie-chart-header">
        <h3 className="pie-chart-title">Activity Distribution</h3>
        <button 
          className="reset-activities-btn"
          onClick={resetAllActivities}
          disabled={hiddenActivities.size === 0}
        >
          Show All Activities
        </button>
      </div>
      
      <div className="pie-chart-content">
        <div className="pie-chart-wrapper">
           <svg 
             width="400" 
             height="400" 
             viewBox="0 0 400 400"
             className="pie-chart-svg"
           >
            {pieSegments.map((segment) => (
              <path
                key={segment.name}
                d={segment.pathData}
                fill={segment.color}
                stroke="white"
                strokeWidth="2"
                className={`pie-segment ${hoveredSector === segment.name ? 'hovered' : ''}`}
                onMouseEnter={() => setHoveredSector(segment.name)}
                onMouseLeave={() => setHoveredSector(null)}
                style={{
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              />
            ))}
            
             {/* Center circle */}
             <circle 
               cx="200" 
               cy="200" 
               r="60" 
               fill="white" 
               stroke="#e0e0e0" 
               strokeWidth="2"
             />
             
             {/* Center text */}
             <text 
               x="200" 
               y="195" 
               textAnchor="middle" 
               className="center-text"
             >
               {visibleActivityData.length}
             </text>
             <text 
               x="200" 
               y="215" 
               textAnchor="middle" 
               className="center-subtext"
             >
               Activities
             </text>
          </svg>
          
          {/* Tooltip */}
          {hoveredSector && (
            <div className="pie-tooltip">
              {(() => {
                const segment = pieSegments.find(s => s.name === hoveredSector)
                return segment ? (
                  <>
                    <div className="tooltip-title">{segment.name}</div>
                    <div className="tooltip-percentage">{segment.percentage.toFixed(1)}%</div>
                    <div className="tooltip-frequency">{segment.frequency} events</div>
                  </>
                ) : null
              })()}
            </div>
          )}
        </div>
        
        <div className="activity-controls">
          <h4 className="controls-title">Activity Controls</h4>
          <div className="activity-checkboxes">
            {generateActivityData.map((activity) => (
              <label 
                key={activity.name} 
                className={`activity-checkbox ${hiddenActivities.has(activity.name) ? 'hidden' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={!hiddenActivities.has(activity.name)}
                  onChange={() => toggleActivity(activity.name)}
                />
                <div 
                  className="checkbox-indicator"
                  style={{ 
                    backgroundColor: activity.color
                  }}
                />
                <span className="activity-name">{activity.name}</span>
                <span className="activity-percentage">
                  ({activity.percentage.toFixed(1)}%)
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ActivityPieChart
