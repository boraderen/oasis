import React, { useState } from 'react'
import './Page.css'

interface AlgorithmConfig {
  name: string
  enabled: boolean
  parameters: {
    [key: string]: {
      value: number | string
      min?: number
      max?: number
      step?: number
      type: 'range' | 'select' | 'number'
      options?: string[]
    }
  }
}

const AutoPM: React.FC = () => {
  const [selectedAlgorithms, setSelectedAlgorithms] = useState<string[]>(['alpha', 'heuristics'])
  const [searchSpaceTechnique, setSearchSpaceTechnique] = useState<string>('grid')
  const [optimizationRounds, setOptimizationRounds] = useState<number>(10)
  const [crossValidationFolds, setCrossValidationFolds] = useState<number>(5)
  const [optimizationMetric, setOptimizationMetric] = useState<string>('f1')
  const [isRunning, setIsRunning] = useState(false)

  const algorithms: AlgorithmConfig[] = [
    {
      name: 'alpha',
      enabled: true,
      parameters: {
        noiseThreshold: { value: 0.2, min: 0.0, max: 1.0, step: 0.1, type: 'range' },
        startActivities: { value: 'auto', type: 'select', options: ['auto', 'manual'] },
        endActivities: { value: 'auto', type: 'select', options: ['auto', 'manual'] }
      }
    },
    {
      name: 'heuristics',
      enabled: true,
      parameters: {
        dependencyThreshold: { value: 0.5, min: 0.0, max: 1.0, step: 0.1, type: 'range' },
        andThreshold: { value: 0.1, min: 0.0, max: 1.0, step: 0.05, type: 'range' },
        loopTwoThreshold: { value: 0.1, min: 0.0, max: 1.0, step: 0.05, type: 'range' }
      }
    },
    {
      name: 'inductive',
      enabled: false,
      parameters: {
        noiseThreshold: { value: 0.2, min: 0.0, max: 1.0, step: 0.1, type: 'range' },
        minOccurrenceRatio: { value: 0.1, min: 0.0, max: 1.0, step: 0.05, type: 'range' }
      }
    },
    {
      name: 'ilp',
      enabled: false,
      parameters: {
        maxDepth: { value: 10, min: 1, max: 50, step: 1, type: 'range' },
        maxConcurrentActivities: { value: 5, min: 1, max: 20, step: 1, type: 'range' }
      }
    }
  ]

  const searchSpaceTechniques = [
    { value: 'grid', label: 'Grid Search' },
    { value: 'random', label: 'Random Search' },
    { value: 'bayesian', label: 'Bayesian Optimization' },
    { value: 'evolutionary', label: 'Evolutionary Algorithm' }
  ]

  const optimizationMetrics = [
    { value: 'f1', label: 'F1-Score' },
    { value: 'fitness', label: 'Fitness' },
    { value: 'precision', label: 'Precision' },
    { value: 'simplicity', label: 'Simplicity' },
    { value: 'generalization', label: 'Generalization' }
  ]

  const handleAlgorithmToggle = (algorithmName: string) => {
    setSelectedAlgorithms(prev => 
      prev.includes(algorithmName) 
        ? prev.filter(name => name !== algorithmName)
        : [...prev, algorithmName]
    )
  }

  const handleParameterChange = (algorithmName: string, paramName: string, value: number | string) => {
    // This would update the parameter value in a real implementation
    console.log(`Updated ${algorithmName}.${paramName} to ${value}`)
  }

  const handleRunOptimization = async () => {
    setIsRunning(true)
    try {
      // Simulate optimization process
      await new Promise(resolve => setTimeout(resolve, 2000))
      console.log('Optimization completed')
    } catch (error) {
      console.error('Optimization failed:', error)
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>AutoPM - Automated Process Mining</h1>
        <p>Automatically discover optimal process models through hyperparameter tuning</p>
      </div>

      <div className="page-content">
        {/* Algorithm Selection */}
        <div className="configuration-section">
          <h2>Algorithm Selection</h2>
          <div className="algorithms-grid">
            {algorithms.map((algorithm) => (
              <div key={algorithm.name} className="algorithm-card">
                <div className="algorithm-header">
                  <label className="algorithm-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedAlgorithms.includes(algorithm.name)}
                      onChange={() => handleAlgorithmToggle(algorithm.name)}
                    />
                    <span className="algorithm-name">
                      {algorithm.name.charAt(0).toUpperCase() + algorithm.name.slice(1)} Miner
                    </span>
                  </label>
                </div>
                
                {selectedAlgorithms.includes(algorithm.name) && (
                  <div className="hyperparameters">
                    <h4>Hyperparameters</h4>
                    {Object.entries(algorithm.parameters).map(([paramName, config]) => (
                      <div key={paramName} className="param-group">
                        <label>{paramName.replace(/([A-Z])/g, ' $1').toLowerCase()}</label>
                        {config.type === 'range' ? (
                          <div>
                            <input
                              type="range"
                              min={config.min}
                              max={config.max}
                              step={config.step}
                              value={config.value}
                              onChange={(e) => handleParameterChange(algorithm.name, paramName, parseFloat(e.target.value))}
                            />
                            <span>{config.value}</span>
                          </div>
                        ) : config.type === 'select' ? (
                          <select
                            value={config.value as string}
                            onChange={(e) => handleParameterChange(algorithm.name, paramName, e.target.value)}
                          >
                            {config.options?.map(option => (
                              <option key={option} value={option}>{option}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="number"
                            min={config.min}
                            max={config.max}
                            step={config.step}
                            value={config.value as number}
                            onChange={(e) => handleParameterChange(algorithm.name, paramName, parseFloat(e.target.value))}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Search Space Configuration */}
        <div className="configuration-section">
          <h2>Search Space Configuration</h2>
          <div className="search-space-config">
            <div className="config-group">
              <label>Search Technique</label>
              <select
                value={searchSpaceTechnique}
                onChange={(e) => setSearchSpaceTechnique(e.target.value)}
              >
                {searchSpaceTechniques.map(technique => (
                  <option key={technique.value} value={technique.value}>
                    {technique.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="config-group">
              <label>Optimization Metric</label>
              <select
                value={optimizationMetric}
                onChange={(e) => setOptimizationMetric(e.target.value)}
              >
                {optimizationMetrics.map(metric => (
                  <option key={metric.value} value={metric.value}>
                    {metric.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="optimization-settings">
            <h3>Optimization Settings</h3>
            <div className="settings-grid">
              <div className="setting-group">
                <label>Optimization Rounds</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={optimizationRounds}
                  onChange={(e) => setOptimizationRounds(parseInt(e.target.value))}
                />
              </div>
              <div className="setting-group">
                <label>Cross-Validation Folds</label>
                <input
                  type="number"
                  min="2"
                  max="10"
                  value={crossValidationFolds}
                  onChange={(e) => setCrossValidationFolds(parseInt(e.target.value))}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Run Optimization */}
        <div className="optimization-button-container">
          <button
            className="optimization-button"
            onClick={handleRunOptimization}
            disabled={isRunning || selectedAlgorithms.length === 0}
          >
            {isRunning ? 'Running Optimization...' : 'Start Optimization'}
          </button>
        </div>

        {/* Results Section (placeholder) */}
        {isRunning && (
          <div className="configuration-section">
            <h2>Optimization Progress</h2>
            <div className="progress-placeholder">
              <p>Optimization in progress...</p>
              <div className="progress-bar">
                <div className="progress-fill"></div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AutoPM
