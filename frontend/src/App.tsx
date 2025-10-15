import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Data from './pages/Data'
import Exploration from './pages/Exploration'
import Discovery from './pages/Discovery'
import OCPMExploration from './pages/OCPM-Exploration'
import OCPMDiscovery from './pages/OCPM-Discovery'
import Conformance from './pages/Conformance'
import AutoPM from './pages/AutoPM'
import Sidebar from './components/Sidebar'
import './App.css'

function App() {
  return (
    <Router>
      <Sidebar>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/data" element={<Data />} />
          <Route path="/exploration" element={<Exploration />} />
          <Route path="/discovery" element={<Discovery />} />
          <Route path="/conformance" element={<Conformance />} />
          <Route path="/autopm" element={<AutoPM />} />
          <Route path="/ocpm-exploration" element={<OCPMExploration />} />
          <Route path="/ocpm-discovery" element={<OCPMDiscovery />} />
        </Routes>
      </Sidebar>
    </Router>
  )
}

export default App
