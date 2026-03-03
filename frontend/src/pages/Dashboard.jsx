import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { reviewsAPI, adminAPI } from '../api/client'
import { useAuth } from '../contexts/AuthContext'
import StatusBadge from '../components/StatusBadge'
import {
  Plus, Trash2, Send, Film, Clock, CheckCircle, AlertTriangle,
  ChevronRight, Loader, Video, GraduationCap, Lightbulb,
  BookOpen, ChevronDown, ChevronUp, Link
} from 'lucide-react'
import toast from 'react-hot-toast'

// Backend stores UTC but returns naive ISO strings without 'Z'.
// Appending 'Z' forces the browser to interpret them as UTC,
// so toLocaleString with timeZone:'Asia/Kolkata' shows correct IST.
const utc = (s) => new Date(s?.endsWith('Z') ? s : (s ?? '') + 'Z')

const IST_DATE = { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' }
const IST_DATETIME = { ...IST_DATE, hour: '2-digit', minute: '2-digit', hour12: true }

function StatCard({ icon: Icon, label, value, color, bg }) {
  return (
    <div className="glass p-5 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${bg}`}>
        <Icon size={20} className={color} />
      </div>
      <div>
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="text-xs text-slate-500 font-medium">{label}</p>
      </div>
    </div>
  )
}

function JobRow({ job, onClick, username }) {
  const isActive = job.status === 'processing' || job.status === 'pending'
  return (
    <button
      onClick={onClick}
      className="glass-hover w-full flex items-center gap-4 p-4 rounded-xl text-left transition-all"
    >
      {/* Icon */}
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
        job.status === 'completed' ? 'bg-emerald-500/15' :
        job.status === 'failed'    ? 'bg-red-500/15'     :
        job.status === 'processing'? 'bg-amber-500/15'   : 'bg-slate-700/40'
      }`}>
        {isActive
          ? <Loader size={18} className="text-amber-400 animate-spin" />
          : job.status === 'completed'
          ? <CheckCircle size={18} className="text-emerald-400" />
          : job.status === 'failed'
          ? <AlertTriangle size={18} className="text-red-400" />
          : <Clock size={18} className="text-slate-400" />
        }
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-semibold text-slate-200 truncate">
            {job.job_name || `Job #${job.id?.slice(-8)}`}
          </span>
          <StatusBadge status={job.status} size="sm" />
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          {username && (
            <>
              <span className="text-cyan-400 font-semibold">{username}</span>
              <span>•</span>
            </>
          )}
          <span>{job.total_videos} video{job.total_videos !== 1 ? 's' : ''}</span>
          <span>•</span>
          <span>{utc(job.created_at).toLocaleString('en-IN', IST_DATETIME)} IST</span>
          {job.status === 'completed' && (
            <>
              <span>•</span>
              <span className={job.total_issues > 0 ? 'text-red-400' : 'text-emerald-400'}>
                {job.total_issues} issue{job.total_issues !== 1 ? 's' : ''}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Progress for active jobs */}
      {isActive && (
        <div className="hidden sm:block w-24">
          <div className="text-xs text-slate-500 mb-1 text-right">
            {job.completed_videos}/{job.total_videos}
          </div>
          <div className="h-1.5 bg-dark-600 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full transition-all duration-500"
              style={{ width: `${job.total_videos > 0 ? (job.completed_videos / job.total_videos) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      <ChevronRight size={16} className="text-slate-600 shrink-0" />
    </button>
  )
}

export default function Dashboard() {
  const { user }  = useAuth()
  const navigate  = useNavigate()
  const isAdmin   = user?.role === 'admin'

  const [myJobs,  setMyJobs]  = useState([])
  const [allJobs, setAllJobs] = useState([])
  const [users,   setUsers]   = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [links, setLinks]       = useState([''])
  const [grade, setGrade]       = useState('')
  const [includeSuggestions, setIncludeSuggestions] = useState(true)
  const [referenceLink, setReferenceLink] = useState('')
  const [showReference, setShowReference] = useState(false)
  const [viewTab, setViewTab]   = useState('mine')   // admin only: 'mine' | 'all'
  const [filterUserId, setFilterUserId] = useState('')
  const intervalRef = useRef(null)

  const fetchMyJobs = useCallback(async () => {
    try {
      const res = await reviewsAPI.list()
      setMyJobs(res.data)
    } catch (_) {}
  }, [])

  const fetchAllData = useCallback(async () => {
    if (!isAdmin) return
    try {
      const [jobsRes, usersRes] = await Promise.all([adminAPI.getAllJobs(), adminAPI.getUsers()])
      setAllJobs(jobsRes.data)
      setUsers(usersRes.data)
    } catch (_) {}
  }, [isAdmin])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    await Promise.all([fetchMyJobs(), fetchAllData()])
    setLoading(false)
  }, [fetchMyJobs, fetchAllData])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Poll while any of my jobs is active
  useEffect(() => {
    const hasActive = myJobs.some(j => j.status === 'processing' || j.status === 'pending')
    if (hasActive) {
      intervalRef.current = setInterval(() => {
        fetchMyJobs()
        if (isAdmin) fetchAllData()
      }, 4000)
    } else {
      clearInterval(intervalRef.current)
    }
    return () => clearInterval(intervalRef.current)
  }, [myJobs, fetchMyJobs, fetchAllData, isAdmin])

  const addLink  = () => setLinks([...links, ''])
  const rmLink   = (i) => setLinks(links.filter((_, idx) => idx !== i))
  const setLink  = (i, v) => setLinks(links.map((l, idx) => idx === i ? v : l))

  const handlePaste = (i, e) => {
    const text = e.clipboardData.getData('text')
    const parts = text.split(/[\n\r,]+/).map(s => s.trim()).filter(Boolean)
    if (parts.length > 1) {
      e.preventDefault()
      const before = links.slice(0, i)
      const after  = links.slice(i + 1).filter(Boolean)
      const merged = [...before, ...parts, ...after].slice(0, 50)
      setLinks(merged)
      toast.success(`${parts.length} links detected`)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const clean = links.map(l => l.trim()).filter(Boolean)
    if (!clean.length) { toast.error('Add at least one Drive link'); return }
    setSubmitting(true)
    try {
      const payload = { drive_links: clean, include_suggestions: includeSuggestions }
      if (grade) payload.grade = grade
      if (referenceLink.trim()) payload.reference_drive_link = referenceLink.trim()
      const res = await reviewsAPI.create(payload)
      toast.success(`Review job started for ${clean.length} video${clean.length !== 1 ? 's' : ''}!`)
      setLinks([''])
      await fetchAll()
      navigate(`/jobs/${res.data.job_id}`)
    } catch (err) {
      toast.error(err.response?.data?.detail ?? 'Failed to start review')
    } finally {
      setSubmitting(false)
    }
  }

  // Stats always reflect the admin's own jobs
  const statsJobs  = myJobs
  const total      = statsJobs.length
  const active     = statsJobs.filter(j => j.status === 'processing' || j.status === 'pending').length
  const completed  = statsJobs.filter(j => j.status === 'completed').length
  const allIssues  = statsJobs.reduce((s, j) => s + (j.total_issues ?? 0), 0)

  // For the "All" tab
  const userMap      = Object.fromEntries(users.map(u => [u.id, u.username]))
  const filteredJobs = filterUserId ? allJobs.filter(j => j.user_id === filterUserId) : allJobs
  const activeAll    = allJobs.filter(j => j.status === 'processing' || j.status === 'pending').length

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="animate-slide-up">
        <h1 className="text-3xl font-black text-white mb-1">
          Hey, <span className="grad-text">{user?.username}</span> 👋
        </h1>
        <p className="text-slate-500">Submit Google Drive video links for AI-powered QA review.</p>
      </div>

      {/* Stats (always personal) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-slide-up" style={{ animationDelay: '60ms' }}>
        <StatCard icon={Film}         label="My Total Jobs"  value={total}     color="text-purple-400" bg="bg-purple-500/15" />
        <StatCard icon={Loader}       label="Processing"     value={active}    color="text-amber-400"  bg="bg-amber-500/15" />
        <StatCard icon={CheckCircle}  label="Completed"      value={completed} color="text-emerald-400" bg="bg-emerald-500/15" />
        <StatCard icon={AlertTriangle} label="Issues Found"  value={allIssues} color="text-red-400"    bg="bg-red-500/15" />
      </div>

      {/* Submit form */}
      <div className="glass p-6 animate-slide-up" style={{ animationDelay: '120ms' }}>
        <div className="flex items-center gap-2 mb-5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#7c3aed,#06b6d4)' }}>
            <Video size={16} className="text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">New Review Job</h2>
            <p className="text-xs text-slate-500">Paste one link per field, or paste multiple links at once (newline-separated)</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {links.map((link, i) => (
            <div key={i} className="flex gap-2">
              <input
                type="url"
                value={link}
                onChange={e => setLink(i, e.target.value)}
                onPaste={e => handlePaste(i, e)}
                placeholder={`https://drive.google.com/file/d/…/view  (video ${i + 1})`}
                className="input flex-1 font-mono text-xs"
              />
              {links.length > 1 && (
                <button type="button" onClick={() => rmLink(i)}
                  className="btn-ghost !px-2.5 text-red-400 hover:text-red-300 hover:bg-red-500/10">
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          ))}

          {/* Grade + suggestions row */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <div className="flex items-center gap-2">
              <GraduationCap size={14} className="text-slate-500 shrink-0" />
              <select
                value={grade}
                onChange={e => setGrade(e.target.value)}
                className="input !py-1.5 !px-2.5 text-xs pr-7 appearance-none cursor-pointer min-w-[130px]"
                style={{ backgroundImage: 'none' }}
              >
                <option value="">Grade (optional)</option>
                <option value="Kindergarten">Kindergarten</option>
                {[1,2,3,4,5,6,7,8,9,10,11,12].map(g => (
                  <option key={g} value={`Grade ${g}`}>Grade {g}</option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <div
                onClick={() => setIncludeSuggestions(v => !v)}
                className={`relative w-8 h-4 rounded-full transition-colors duration-200 ${includeSuggestions ? 'bg-violet-600' : 'bg-slate-600'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform duration-200 ${includeSuggestions ? 'translate-x-4' : ''}`} />
              </div>
              <Lightbulb size={13} className={includeSuggestions ? 'text-violet-400' : 'text-slate-500'} />
              <span className="text-xs text-slate-400">Include suggestions</span>
            </label>
          </div>

          {/* Reference video toggle */}
          <div className="border border-dashed border-slate-700 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowReference(v => !v)}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-slate-800/40 transition-colors"
            >
              <BookOpen size={14} className="text-cyan-400 shrink-0" />
              <span className="text-xs font-medium text-slate-300">Compare with Reference Video</span>
              <span className="text-xs text-slate-500 ml-1">(e.g. IXL benchmark)</span>
              {showReference
                ? <ChevronUp size={13} className="ml-auto text-slate-500" />
                : <ChevronDown size={13} className="ml-auto text-slate-500" />
              }
            </button>

            {showReference && (
              <div className="px-4 pb-4 pt-1 space-y-2.5 border-t border-slate-700/50">
                <p className="text-xs text-slate-500 leading-relaxed">
                  The AI will first deeply analyse the reference video — every concept taught,
                  the pedagogy, sequencing, and even small details. It will then review your
                  video with the goal of matching the reference's scope while flagging where
                  yours can <span className="text-cyan-400 font-medium">go beyond it</span>.
                </p>
                <div className="flex items-center gap-2">
                  <Link size={13} className="text-slate-500 shrink-0" />
                  <input
                    type="url"
                    value={referenceLink}
                    onChange={e => setReferenceLink(e.target.value)}
                    placeholder="https://drive.google.com/file/d/…/view  (reference video)"
                    className="input flex-1 font-mono text-xs"
                  />
                  {referenceLink && (
                    <button
                      type="button"
                      onClick={() => setReferenceLink('')}
                      className="btn-ghost !px-2 text-slate-500 hover:text-red-400"
                      title="Clear reference link"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
                {referenceLink && (
                  <p className="text-xs text-cyan-400/80 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block" />
                    Reference video set — Phase 0 analysis will run before the review
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-1">
            {links.length < 50 && (
              <button type="button" onClick={addLink} className="btn-ghost gap-1.5">
                <Plus size={15} />
                Add Link
              </button>
            )}
            <button type="submit" disabled={submitting} className="btn-primary ml-auto gap-2">
              {submitting
                ? <><span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Submitting…</>
                : <><Send size={15} /> Submit for Review</>
              }
            </button>
          </div>
        </form>
      </div>

      {/* Jobs list */}
      <div className="animate-slide-up" style={{ animationDelay: '180ms' }}>

        {/* Admin: tab switcher */}
        {isAdmin && (
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-1 p-1 glass rounded-xl w-fit">
              <button
                onClick={() => setViewTab('mine')}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                  viewTab === 'mine' ? 'bg-brand-purple text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Mine ({myJobs.length})
              </button>
              <button
                onClick={() => setViewTab('all')}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                  viewTab === 'all' ? 'bg-brand-purple text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All ({filteredJobs.length}{filterUserId ? `/${allJobs.length}` : ''})
                {activeAll > 0 && (
                  <span className="ml-1.5 text-xs font-semibold text-amber-400 bg-amber-500/15 px-1.5 py-0.5 rounded-full">
                    {activeAll}
                  </span>
                )}
              </button>
            </div>

            {/* User filter — only visible on "All" tab */}
            {viewTab === 'all' && (
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
          </div>
        )}

        {/* Section label for non-admin */}
        {!isAdmin && (
          <h2 className="text-base font-bold text-white mb-3">
            Your Review History
            {active > 0 && (
              <span className="ml-2 text-xs font-semibold text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded-full">
                {active} active
              </span>
            )}
          </h2>
        )}

        {/* "Mine" tab / regular user list */}
        {(!isAdmin || viewTab === 'mine') && (
          loading ? (
            <div className="space-y-2">
              {[1,2,3].map(i => <div key={i} className="skeleton h-16 rounded-xl" />)}
            </div>
          ) : myJobs.length === 0 ? (
            <div className="glass text-center py-16">
              <div className="text-5xl mb-3">🎬</div>
              <p className="text-slate-400 font-medium">No reviews yet</p>
              <p className="text-slate-600 text-sm mt-1">Submit your first Drive link above to get started</p>
            </div>
          ) : (
            <div className="space-y-2">
              {myJobs.map(job => (
                <JobRow key={job.id} job={job} onClick={() => navigate(`/jobs/${job.id}`)} />
              ))}
            </div>
          )
        )}

        {/* "All" tab — admin only */}
        {isAdmin && viewTab === 'all' && (
          loading ? (
            <div className="space-y-2">
              {[1,2,3].map(i => <div key={i} className="skeleton h-16 rounded-xl" />)}
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="glass text-center py-16">
              <div className="text-5xl mb-3">🎬</div>
              <p className="text-slate-400 font-medium">{filterUserId ? 'No jobs for this user' : 'No jobs yet'}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredJobs.map(job => (
                <JobRow
                  key={job.id}
                  job={job}
                  onClick={() => navigate(`/jobs/${job.id}`)}
                  username={userMap[job.user_id]}
                />
              ))}
            </div>
          )
        )}
      </div>
    </div>
  )
}
