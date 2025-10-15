import { useNavigate, useLocation } from 'react-router-dom'
import './Sidebar.css'

interface SidebarProps {
  children: React.ReactNode
}

function Sidebar({ children }: SidebarProps) {
  const navigate = useNavigate()
  const location = useLocation()

  const navigationItems = [
    { path: '/', label: 'Home', icon: '🏠' },
    { path: '/data', label: 'Data', icon: '📊' },
    { path: '/exploration', label: 'Exploration', icon: '🔍' },
    { path: '/discovery', label: 'Discovery', icon: '🔎' },
    { path: '/conformance', label: 'Conformance', icon: '✅' },
    { path: '/autopm', label: 'AutoPM', icon: '🤖' },
    { path: '/ocpm-exploration', label: 'OCPM Exploration', icon: '📈' },
    { path: '/ocpm-discovery', label: 'OCPM Discovery', icon: '🔬' },
  ]

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <img 
            src="/icon.png" 
            alt="Oasis" 
            className="sidebar-logo" 
            onClick={() => navigate('/')}
          />
          <h2 className="sidebar-title">Oasis</h2>
        </div>
        
        <nav className="sidebar-nav">
          {navigationItems.map((item) => (
            <button
              key={item.path}
              className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>
      
      <main className="main-content">
        {children}
      </main>
    </div>
  )
}

export default Sidebar
