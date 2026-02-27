import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { reviewsAPI } from '../api/client'
import StatusBadge from '../components/StatusBadge'
import VideoReviewCard from '../components/VideoReviewCard'
import { ArrowLeft, RefreshCw, BarChart3, Film } from 'lucide-react'
import toast from 'react-hot-toast'

function OverallProgress({ job }) {
  const pct = job.total_videos > 0
    ? Math.round((job.completed_videos / job.total_videos) * 100)
    : 0

  return (
    <div className="glass p-5 space-y-4">
      {/* Top row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-purple/20 flex items-center justify-center">
            <BarChart3 size={18} className="text-purple-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Overall Progress</p>
            <p className="text-xs text-slate-500">
              {job.completed_videos} of {job.total_videos} video{job.total_videos !== 1 ? 's' : ''} done
            </p>
          </div>
        </div>
        <StatusBadge status={job.status} />
      </div>

      {/* Progress bar */}
      <div className="h-2.5 bg-dark-600 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: job.status === 'failed'
              ? 'linear-gradient(90deg,#ef4444,#dc2626)'
              : 'linear-gradient(90deg,#7c3aed,#06b6d4)',
          }}
        />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="glass rounded-xl py-3">
          <p className="text-lg font-bold text-white">{job.total_videos}</p>
          <p className="text-xs text-slate-500">Videos</p>
        </div>
        <div className="glass rounded-xl py-3">
          <p className={`text-lg font-bold ${job.total_issues > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
            {job.total_issues}
          </p>
          <p className="text-xs text-slate-500">Issues</p>
        </div>
        <div className="glass rounded-xl py-3">
          <p className="text-lg font-bold text-slate-300">{pct}%</p>
          <p className="text-xs text-slate-500">Complete</p>
        </div>
      </div>
    </div>
  )
}

export default function JobDetail() {
  const { jobId }  = useParams()
  const navigate   = useNavigate()
  const [job, setJob]         = useState(null)
  const [loading, setLoading] = useState(true)
  const intervalRef           = useRef(null)

  const fetch = useCallback(async () => {
    try {
      const res = await reviewsAPI.get(jobId)
      setJob(res.data)
    } catch (err) {
      toast.error('Could not load job')
      navigate('/dashboard')
    } finally {
      setLoading(false)
    }
  }, [jobId, navigate])

  useEffect(() => { fetch() }, [fetch])

  useEffect(() => {
    if (!job) return
    const active = job.status === 'processing' || job.status === 'pending'
    if (active) {
      intervalRef.current = setInterval(fetch, 3500)
    } else {
      clearInterval(intervalRef.current)
    }
    return () => clearInterval(intervalRef.current)
  }, [job, fetch])

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
        <div className="skeleton h-8 w-48 rounded-xl" />
        <div className="skeleton h-40 rounded-2xl" />
        <div className="skeleton h-32 rounded-2xl" />
        <div className="skeleton h-32 rounded-2xl" />
      </div>
    )
  }

  if (!job) return null

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Back + header */}
      <div className="flex items-center gap-3 animate-slide-up">
        <button onClick={() => navigate('/dashboard')} className="btn-ghost !px-2.5 !py-2">
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Film size={16} className="text-slate-500" />
            <h1 className="text-lg font-bold text-white truncate">
              {job.job_name || `Job #${job.id?.slice(-8)}`}
            </h1>
          </div>
          <p className="text-xs text-slate-500">
            Submitted {new Date(job.created_at).toLocaleString('en-IN', {
              timeZone: 'Asia/Kolkata',
              day: '2-digit', month: 'short', year: 'numeric',
              hour: '2-digit', minute: '2-digit', hour12: true,
            })} IST
          </p>
        </div>
        <button onClick={fetch} className="btn-ghost !px-2.5 !py-2" title="Refresh">
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Overall progress */}
      <div className="animate-slide-up" style={{ animationDelay: '60ms' }}>
        <OverallProgress job={job} />
      </div>

      {/* Active indicator banner */}
      {(job.status === 'processing' || job.status === 'pending') && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/25 animate-fade-in">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
          <p className="text-sm text-amber-300">
            Review in progress — this page auto-updates every 3.5 seconds
          </p>
        </div>
      )}

      {/* Video cards */}
      <div className="space-y-3">
        {(job.videos ?? []).map((video, i) => (
          <VideoReviewCard key={i} video={video} globalIndex={i} />
        ))}
      </div>
    </div>
  )
}
