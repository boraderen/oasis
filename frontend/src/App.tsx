import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Exploration from './pages/Exploration'
import Discovery from './pages/Discovery'
import OCPM from './pages/OCPM'
import Conformance from './pages/Conformance'
import AutoPM from './pages/AutoPM'
import './App.css'

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/exploration" element={<Exploration />} />
          <Route path="/discovery" element={<Discovery />} />
          <Route path="/conformance" element={<Conformance />} />
          <Route path="/autopm" element={<AutoPM />} />
          <Route path="/ocpm" element={<OCPM />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App
