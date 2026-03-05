import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Navbar    from './components/Navbar'
import Login     from './pages/Login'
import Register  from './pages/Register'
import Dashboard from './pages/Dashboard'
import JobDetail from './pages/JobDetail'
import AdminPanel from './pages/AdminPanel'
import ShareView from './pages/ShareView'

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-9 h-9 rounded-full border-2 border-brand-purple/30 border-t-brand-purple animate-spin" />
    </div>
  )
}

function Guard({ children, adminOnly = false }) {
  const { user, loading } = useAuth()
  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  if (adminOnly && user.role !== 'admin') return <Navigate to="/dashboard" replace />
  return children
}

function Shell({ children }) {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="pt-16">{children}</main>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login"    element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={
            <Guard><Shell><Dashboard /></Shell></Guard>
          } />
          <Route path="/jobs/:jobId" element={
            <Guard><Shell><JobDetail /></Shell></Guard>
          } />
          <Route path="/admin" element={
            <Guard adminOnly><Shell><AdminPanel /></Shell></Guard>
          } />
          <Route path="/share/:jobId/:videoIndex" element={<ShareView />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
