import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import axios from 'axios'
import { Film, AlertCircle, CheckCircle2, ExternalLink } from 'lucide-react'
import IssueBuckets from '../components/IssueBuckets'

const PUBLIC = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  timeout: 30000,
})

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-9 h-9 rounded-full border-2 border-brand-purple/30 border-t-brand-purple animate-spin" />
    </div>
  )
}

function shortLink(url = '') {
  try {
    const id = url.match(/[?&]id=([^&]+)/)?.[1] ?? url.match(/\/d\/([^/]+)/)?.[1] ?? url
    return `drive.google.com/…/${id.slice(0, 16)}`
  } catch {
    return url.slice(0, 40) + '…'
  }
}

const SEV_COLORS = {
  Critical: 'text-red-400',
  Major:    'text-amber-400',
  Minor:    'text-blue-400',
}

export default function ShareView() {
  const { jobId, videoIndex } = useParams()
  const [data, setData]       = useState(null)
  const [error, setError]     = useState(null)

  useEffect(() => {
    PUBLIC.get(`/reviews/${jobId}/share/${videoIndex}`)
      .then(r => setData(r.data))
      .catch(() => setError('This feedback link is invalid or no longer available.'))
  }, [jobId, videoIndex])

  if (!data && !error) return <Spinner />

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
        <AlertCircle size={36} className="text-red-400" />
        <p className="text-slate-300 text-center">{error}</p>
        <Link to="/login" className="btn-primary text-sm">Sign in to view your reviews</Link>
      </div>
    )
  }

  const hasIssues = data.total_issues > 0

  // Build severity summary for the stat chips
  const sevCounts = { Critical: 0, Major: 0, Minor: 0 }
  ;(data.combined_issues ?? []).forEach(i => {
    if (i.severity in sevCounts) sevCounts[i.severity]++
  })
  const sevEntries = Object.entries(sevCounts).filter(([, n]) => n > 0)

  return (
    <div className="min-h-screen flex flex-col">
      {/* Minimal top bar */}
      <header className="border-b border-white/8 bg-dark-900/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-brand-purple/20 flex items-center justify-center">
              <Film size={14} className="text-purple-400" />
            </div>
            <span className="text-sm font-semibold text-white">Video Reviewer</span>
            <span className="text-slate-600 text-sm mx-1">·</span>
            <span className="text-xs text-slate-500">Shared feedback</span>
          </div>
          <Link to="/login" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
            Sign in →
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8 space-y-6">
        {/* Video info card */}
        <div className="glass rounded-2xl p-5 space-y-4 animate-slide-up">
          {/* Title */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-700/40 flex items-center justify-center shrink-0">
              <Film size={18} className="text-slate-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-bold text-white leading-snug truncate">
                {data.filename || shortLink(data.drive_link)}
              </h1>
              {data.job_name && (
                <p className="text-xs text-slate-500 mt-0.5">From job: {data.job_name}</p>
              )}
            </div>
            {data.drive_link && (
              <a
                href={data.drive_link}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/8 transition-colors"
                title="Open original video"
              >
                <ExternalLink size={14} />
              </a>
            )}
          </div>

          {/* Stats row */}
          <div className="flex flex-wrap gap-2">
            <span className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border ${
              hasIssues
                ? 'bg-red-500/15 border-red-500/30 text-red-300'
                : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
            }`}>
              {hasIssues ? (
                <><AlertCircle size={11} /> {data.total_issues} issue{data.total_issues !== 1 ? 's' : ''} found</>
              ) : (
                <><CheckCircle2 size={11} /> No issues</>
              )}
            </span>

            {sevEntries.map(([sev, count]) => (
              <span
                key={sev}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full border bg-white/5 border-white/10 ${SEV_COLORS[sev]}`}
              >
                {count} {sev}
              </span>
            ))}
          </div>
        </div>

        {/* Issues */}
        {hasIssues ? (
          <div className="glass rounded-2xl p-5 animate-slide-up" style={{ animationDelay: '60ms' }}>
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
              Issues
            </h2>
            <IssueBuckets issues={data.combined_issues} />
          </div>
        ) : (
          <div className="glass rounded-2xl p-8 text-center animate-slide-up" style={{ animationDelay: '60ms' }}>
            <div className="text-4xl mb-3">✅</div>
            <p className="text-emerald-400 font-semibold">Zero issues detected</p>
            <p className="text-xs text-slate-500 mt-1">All 3 review passes came back clean.</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-5">
        <p className="text-center text-xs text-slate-600">
          Generated by{' '}
          <Link to="/login" className="text-slate-500 hover:text-slate-300 transition-colors">
            Video Reviewer
          </Link>
        </p>
      </footer>
    </div>
  )
}
