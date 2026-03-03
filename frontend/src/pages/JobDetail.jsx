import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { reviewsAPI } from '../api/client'
import StatusBadge from '../components/StatusBadge'
import VideoReviewCard from '../components/VideoReviewCard'
import { ArrowLeft, RefreshCw, BarChart3, Film, BookOpen, ChevronDown, ChevronUp, Loader } from 'lucide-react'
import toast from 'react-hot-toast'

const utc = (s) => new Date(s?.endsWith('Z') ? s : (s ?? '') + 'Z')

function ReferenceAnalysisCard({ job }) {
  const [expanded, setExpanded] = useState(false)

  if (!job.reference_drive_link) return null

  const status = job.reference_analysis_status
  const analysis = job.reference_analysis

  return (
    <div className="glass border border-cyan-500/20 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4">
        <div className="w-9 h-9 rounded-xl bg-cyan-500/15 flex items-center justify-center shrink-0">
          <BookOpen size={16} className="text-cyan-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">Phase 0 — Reference Video Analysis</p>
          <p className="text-xs text-slate-500 truncate">
            {status === 'analyzing'
              ? 'Analysing benchmark video…'
              : status === 'completed'
              ? 'IXL benchmark analysed — informing the review'
              : status === 'failed'
              ? 'Reference analysis failed — review continues without it'
              : 'Queued'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {status === 'analyzing' && (
            <Loader size={15} className="text-cyan-400 animate-spin" />
          )}
          {status === 'completed' && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400">Done</span>
          )}
          {status === 'failed' && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-500/15 text-red-400">Failed</span>
          )}
          {analysis && (
            <button
              onClick={() => setExpanded(v => !v)}
              className="btn-ghost !px-2 !py-1"
              title={expanded ? 'Collapse' : 'Expand'}
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
        </div>
      </div>

      {/* Expanded details */}
      {expanded && analysis && !analysis.raw && (
        <div className="border-t border-slate-700/50 px-5 py-4 space-y-4 text-xs">
          {/* Topic */}
          {analysis.topic && (
            <div>
              <p className="text-slate-500 font-semibold uppercase tracking-wide mb-1">Topic</p>
              <p className="text-slate-200">{analysis.topic}</p>
            </div>
          )}

          {/* Concepts covered */}
          {analysis.concepts_covered?.length > 0 && (
            <div>
              <p className="text-slate-500 font-semibold uppercase tracking-wide mb-1.5">Concepts Covered</p>
              <ul className="space-y-1">
                {analysis.concepts_covered.map((c, i) => (
                  <li key={i} className="flex gap-2 text-slate-300">
                    <span className="text-cyan-500 shrink-0">•</span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Examples */}
          {analysis.examples_used?.length > 0 && (
            <div>
              <p className="text-slate-500 font-semibold uppercase tracking-wide mb-1.5">Examples Used</p>
              <ul className="space-y-1">
                {analysis.examples_used.map((ex, i) => (
                  <li key={i} className="flex gap-2 text-slate-300 font-mono">
                    <span className="text-cyan-500 shrink-0">{i + 1}.</span>
                    <span>{ex}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Pedagogical approach */}
          {analysis.pedagogical_approach && (
            <div>
              <p className="text-slate-500 font-semibold uppercase tracking-wide mb-1.5">Pedagogical Approach</p>
              <div className="space-y-1.5">
                {Object.entries(analysis.pedagogical_approach).map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <span className="text-slate-500 capitalize shrink-0 min-w-[130px]">{k.replace(/_/g, ' ')}:</span>
                    <span className="text-slate-300">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Key vocabulary */}
          {analysis.key_vocabulary?.length > 0 && (
            <div>
              <p className="text-slate-500 font-semibold uppercase tracking-wide mb-1.5">Key Vocabulary</p>
              <div className="flex flex-wrap gap-1.5">
                {analysis.key_vocabulary.map((w, i) => (
                  <span key={i} className="px-2 py-0.5 rounded-full bg-slate-700/60 text-slate-300">{w}</span>
                ))}
              </div>
            </div>
          )}

          {/* Scope boundaries */}
          {analysis.scope_boundaries && (
            <div>
              <p className="text-slate-500 font-semibold uppercase tracking-wide mb-1.5">Scope</p>
              {analysis.scope_boundaries.what_is_included && (
                <p className="text-slate-300 mb-1">
                  <span className="text-emerald-400 font-semibold">Includes: </span>
                  {analysis.scope_boundaries.what_is_included}
                </p>
              )}
              {analysis.scope_boundaries.what_is_excluded && (
                <p className="text-slate-300">
                  <span className="text-slate-500 font-semibold">Excludes: </span>
                  {analysis.scope_boundaries.what_is_excluded}
                </p>
              )}
            </div>
          )}

          {/* Small details */}
          {analysis.small_but_important_details?.length > 0 && (
            <div>
              <p className="text-slate-500 font-semibold uppercase tracking-wide mb-1.5">Small but Important Details</p>
              <ul className="space-y-1">
                {analysis.small_but_important_details.map((d, i) => (
                  <li key={i} className="flex gap-2 text-slate-300">
                    <span className="text-amber-400 shrink-0">★</span>
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Raw fallback */}
      {expanded && analysis?.raw && (
        <div className="border-t border-slate-700/50 px-5 py-4">
          <pre className="text-xs text-slate-400 whitespace-pre-wrap">{analysis.raw}</pre>
        </div>
      )}
    </div>
  )
}


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
            Submitted {utc(job.created_at).toLocaleString('en-IN', {
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

      {/* Reference analysis card (Phase 0) */}
      {job.reference_drive_link && (
        <div className="animate-slide-up" style={{ animationDelay: '90ms' }}>
          <ReferenceAnalysisCard job={job} />
        </div>
      )}

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
