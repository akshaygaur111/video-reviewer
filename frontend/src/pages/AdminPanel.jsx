import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminAPI } from '../api/client'
import StatusBadge from '../components/StatusBadge'
import {
  Users, Film, CheckCircle, Loader, AlertTriangle,
  Shield, RefreshCw, UserPlus, X
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

function CreateUserModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ email: '', username: '', password: '' })
  const [saving, setSaving] = useState(false)

  const handle = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await adminAPI.createUser(form)
      toast.success(`User "${form.username}" created`)
      onCreated()
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.detail ?? 'Failed to create user')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="glass w-full max-w-md p-7 rounded-2xl animate-slide-up">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-white">Create User</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handle} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Username</label>
            <input
              type="text" required minLength={3}
              value={form.username}
              onChange={e => setForm({ ...form, username: e.target.value })}
              placeholder="john_doe"
              className="input"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Email</label>
            <input
              type="email" required
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              placeholder="john@company.com"
              className="input"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Password</label>
            <input
              type="password" required minLength={6}
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              placeholder="Minimum 6 characters"
              className="input"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving
                ? <><span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Creating…</>
                : 'Create User'
              }
            </button>
          </div>
        </form>
      </div>
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
  const [showCreate, setShowCreate] = useState(false)
  const [filterUserId, setFilterUserId] = useState('')

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
      {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} onCreated={load} />}

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
        {(() => {
          const userMap = Object.fromEntries(users.map(u => [u.id, u.username]))
          const filteredJobs = filterUserId ? jobs.filter(j => j.user_id === filterUserId) : jobs
          return (<>
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-1 p-1 glass rounded-xl w-fit">
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
                {t === 'jobs' ? `All Jobs (${filteredJobs.length}${filterUserId ? `/${jobs.length}` : ''})` : `Users (${users.length})`}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {tab === 'jobs' && (
              <select
                value={filterUserId}
                onChange={e => setFilterUserId(e.target.value)}
                className="text-xs bg-slate-800 border border-white/10 text-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-violet-500"
              >
                <option value="">All Users</option>
                {users.filter(u => u.role !== 'admin').map(u => (
                  <option key={u.id} value={u.id}>{u.username}</option>
                ))}
              </select>
            )}
            {tab === 'users' && (
              <button onClick={() => setShowCreate(true)} className="btn-primary gap-2 text-sm px-4 py-2">
                <UserPlus size={14} />
                Create User
              </button>
            )}
          </div>
        </div>

        {/* Jobs table */}
        {tab === 'jobs' && (
          <div className="glass rounded-2xl overflow-hidden">
            <div className="grid grid-cols-[1fr_150px_72px_72px_110px] px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-white/5">
              <span>Job Name / ID</span>
              <span>User</span>
              <span className="text-center">Videos</span>
              <span className="text-center">Issues</span>
              <span className="text-center">Status</span>
            </div>
            {loading ? (
              <div className="p-4 space-y-2">
                {[1,2,3,4,5].map(i => <div key={i} className="skeleton h-12 rounded-xl" />)}
              </div>
            ) : filteredJobs.length === 0 ? (
              <div className="text-center py-12 text-slate-500">No jobs yet</div>
            ) : (
              <div className="divide-y divide-white/5">
                {filteredJobs.map(job => (
                  <button
                    key={job.id}
                    onClick={() => navigate(`/jobs/${job.id}`)}
                    className="w-full grid grid-cols-[1fr_150px_72px_72px_110px] px-5 py-3.5 text-left hover:bg-white/[0.025] transition-colors items-center"
                  >
                    <div className="min-w-0 pr-4">
                      <span className="text-sm text-slate-200 truncate block">
                        {job.job_name || `Job #${job.id?.slice(-8)}`}
                      </span>
                      <span className="font-mono text-xs text-slate-600">#{job.id?.slice(-10)}</span>
                    </div>
                    <span
                      className="text-sm font-semibold text-cyan-400 truncate cursor-pointer hover:underline"
                      onClick={e => { e.stopPropagation(); setFilterUserId(job.user_id === filterUserId ? '' : job.user_id) }}
                    >
                      {userMap[job.user_id] || job.user_id?.slice(-8)}
                    </span>
                    <span className="text-sm font-bold text-white text-center">{job.total_videos}</span>
                    <span className={`text-sm font-bold text-center ${
                      (job.total_issues ?? 0) > 0 ? 'text-red-400' : 'text-emerald-400'
                    }`}>
                      {job.total_issues ?? 0}
                    </span>
                    <div className="flex justify-center">
                      <StatusBadge status={job.status} size="sm" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
          </>)
        })()}

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
                      <button
                        className="text-sm text-slate-200 font-medium hover:text-cyan-400 transition-colors text-left"
                        onClick={() => { setFilterUserId(u.id); setTab('jobs') }}
                        title="View jobs for this user"
                      >
                        {u.username}
                      </button>
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
                      {u.created_at ? new Date(u.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
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
