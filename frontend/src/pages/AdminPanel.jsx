import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminAPI } from '../api/client'
import StatusBadge from '../components/StatusBadge'
import {
  Users, Film, CheckCircle, Loader, AlertTriangle,
  ChevronRight, Shield, RefreshCw, TrendingUp
} from 'lucide-react'
import toast from 'react-hot-toast'

function StatTile({ icon: Icon, label, value, color, bg, note }) {
  return (
    <div className="glass p-5">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${bg}`}>
          <Icon size={18} className={color} />
        </div>
        {note && <span className="text-xs text-slate-600">{note}</span>}
      </div>
      <p className="text-3xl font-black text-white mb-0.5">{value}</p>
      <p className="text-xs text-slate-500 font-medium">{label}</p>
    </div>
  )
}

export default function AdminPanel() {
  const navigate = useNavigate()
  const [stats,  setStats]  = useState(null)
  const [jobs,   setJobs]   = useState([])
  const [users,  setUsers]  = useState([])
  const [tab,    setTab]    = useState('jobs')
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const [s, j, u] = await Promise.all([adminAPI.getStats(), adminAPI.getAllJobs(), adminAPI.getUsers()])
      setStats(s.data)
      setJobs(j.data)
      setUsers(u.data)
    } catch {
      toast.error('Failed to load admin data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between animate-slide-up">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#06b6d4,#7c3aed)' }}>
            <Shield size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">Admin Panel</h1>
            <p className="text-xs text-slate-500">Platform-wide overview</p>
          </div>
        </div>
        <button onClick={load} className="btn-ghost gap-2">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Stats grid */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 animate-slide-up" style={{ animationDelay: '60ms' }}>
          <StatTile icon={Users}         label="Total Users"    value={stats.total_users}         color="text-purple-400"  bg="bg-purple-500/15" />
          <StatTile icon={Film}          label="Total Jobs"     value={stats.total_jobs}          color="text-cyan-400"    bg="bg-cyan-500/15" />
          <StatTile icon={CheckCircle}   label="Completed"      value={stats.completed_jobs}      color="text-emerald-400" bg="bg-emerald-500/15" />
          <StatTile icon={Loader}        label="Processing"     value={stats.processing_jobs}     color="text-amber-400"   bg="bg-amber-500/15" />
          <StatTile icon={AlertTriangle} label="Issues Found"   value={stats.total_issues_found}  color="text-red-400"     bg="bg-red-500/15" />
        </div>
      )}

      {/* Tabs */}
      <div className="animate-slide-up" style={{ animationDelay: '120ms' }}>
        <div className="flex gap-1 mb-4 p-1 glass rounded-xl w-fit">
          {['jobs', 'users'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all capitalize ${
                tab === t
                  ? 'bg-brand-purple text-white shadow-lg'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t === 'jobs' ? `All Jobs (${jobs.length})` : `Users (${users.length})`}
            </button>
          ))}
        </div>

        {/* Jobs table */}
        {tab === 'jobs' && (
          <div className="glass rounded-2xl overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-white/5">
              <span>Job ID</span>
              <span>User</span>
              <span>Videos</span>
              <span>Issues</span>
              <span>Status</span>
            </div>
            {loading ? (
              <div className="p-4 space-y-2">
                {[1,2,3,4,5].map(i => <div key={i} className="skeleton h-12 rounded-xl" />)}
              </div>
            ) : jobs.length === 0 ? (
              <div className="text-center py-12 text-slate-500">No jobs yet</div>
            ) : (
              <div className="divide-y divide-white/5">
                {jobs.map(job => (
                  <button
                    key={job.id}
                    onClick={() => navigate(`/jobs/${job.id}`)}
                    className="w-full grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-5 py-3.5 text-left hover:bg-white/[0.025] transition-colors items-center"
                  >
                    <span className="font-mono text-xs text-slate-300">#{job.id?.slice(-10)}</span>
                    <span className="text-xs text-slate-400 text-right">{job.user_id?.slice(-8)}</span>
                    <span className="text-sm font-semibold text-white text-right">{job.total_videos}</span>
                    <span className={`text-sm font-semibold text-right ${
                      (job.total_issues ?? 0) > 0 ? 'text-red-400' : 'text-emerald-400'
                    }`}>
                      {job.total_issues ?? 0}
                    </span>
                    <StatusBadge status={job.status} size="sm" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Users table */}
        {tab === 'users' && (
          <div className="glass rounded-2xl overflow-hidden">
            <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-4 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-white/5">
              <span>Username</span>
              <span>Email</span>
              <span>Role</span>
              <span>Joined</span>
            </div>
            {loading ? (
              <div className="p-4 space-y-2">
                {[1,2,3].map(i => <div key={i} className="skeleton h-12 rounded-xl" />)}
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-12 text-slate-500">No users</div>
            ) : (
              <div className="divide-y divide-white/5">
                {users.map(u => (
                  <div key={u.id} className="grid grid-cols-[1fr_1fr_auto_auto] gap-4 px-5 py-3.5 items-center">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                        style={{ background: 'linear-gradient(135deg,#7c3aed,#06b6d4)' }}>
                        {u.username?.[0]?.toUpperCase()}
                      </div>
                      <span className="text-sm text-slate-200 font-medium">{u.username}</span>
                    </div>
                    <span className="text-sm text-slate-400 truncate">{u.email}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      u.role === 'admin'
                        ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                        : 'bg-slate-700/50 text-slate-400'
                    }`}>
                      {u.role}
                    </span>
                    <span className="text-xs text-slate-600">
                      {new Date(u.created_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
