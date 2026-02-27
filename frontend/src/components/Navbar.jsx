import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { LogOut, LayoutDashboard, Shield, Video } from 'lucide-react'

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const isActive = (path) => location.pathname.startsWith(path)

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 h-16 flex items-center px-6"
      style={{
        background: 'rgba(5,5,15,0.85)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Logo */}
      <Link to="/dashboard" className="flex items-center gap-2.5 mr-8">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{
          background: 'linear-gradient(135deg, #7c3aed, #06b6d4)',
        }}>
          <Video size={16} className="text-white" />
        </div>
        <span className="font-bold text-lg grad-text">VideoIQ</span>
      </Link>

      {/* Nav links */}
      <div className="flex items-center gap-1 flex-1">
        <Link
          to="/dashboard"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
            isActive('/dashboard')
              ? 'bg-brand-purple/15 text-purple-400'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
        >
          <LayoutDashboard size={15} />
          Dashboard
        </Link>

        {user?.role === 'admin' && (
          <Link
            to="/admin"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              isActive('/admin')
                ? 'bg-cyan-500/15 text-cyan-400'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <Shield size={15} />
            Admin
          </Link>
        )}
      </div>

      {/* User info */}
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex flex-col items-end">
          <span className="text-sm font-medium text-slate-200">{user?.username}</span>
          <span className={`text-xs font-medium ${user?.role === 'admin' ? 'text-cyan-400' : 'text-slate-500'}`}>
            {user?.role}
          </span>
        </div>
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm text-white"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #06b6d4)' }}
        >
          {user?.username?.[0]?.toUpperCase()}
        </div>
        <button
          onClick={handleLogout}
          className="btn-ghost !px-2.5 !py-2"
          title="Logout"
        >
          <LogOut size={16} />
        </button>
      </div>
    </nav>
  )
}
