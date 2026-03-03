import { useState } from 'react'
import { ChevronDown, ChevronUp, Link2, AlertCircle, CheckCircle2, Calculator, Mic, BookOpen } from 'lucide-react'
import StatusBadge from './StatusBadge'
import ProgressRigor from './ProgressRigor'
import IssueCard from './IssueCard'

/** Convert any timestamp string to seconds for sorting */
function tsToSec(ts) {
  if (!ts) return 9999
  const s = String(ts).trim()
  const msFmt = s.match(/^(\d+)m(\d+)s/)
  if (msFmt) return parseInt(msFmt[1], 10) * 60 + parseInt(msFmt[2], 10)
  const hms = s.match(/^(\d+):(\d{2}):(\d{2})/)
  if (hms) return parseInt(hms[1], 10) * 3600 + parseInt(hms[2], 10) * 60 + parseInt(hms[3], 10)
  const ms = s.match(/^(\d+):(\d{2})/)
  if (ms) return parseInt(ms[1], 10) * 60 + parseInt(ms[2], 10)
  return 9999
}

function shortLink(url) {
  try {
    const id = url.match(/[?&]id=([^&]+)/)?.[1] ?? url.match(/\/d\/([^/]+)/)?.[1] ?? url
    return `drive.google.com/…/${id.slice(0, 12)}`
  } catch {
    return url.slice(0, 40) + '…'
  }
}

// Category metadata for bucket tabs
const CAT_META = {
  'Math':         { icon: Calculator,   text: 'text-red-400',    bg: 'bg-red-500/12',    activeBg: 'bg-red-500/25',    border: 'border-red-500/30',    activeBorder: 'border-red-400/60' },
  'Audio-Visual': { icon: Mic,          text: 'text-amber-400',  bg: 'bg-amber-500/12',  activeBg: 'bg-amber-500/25',  border: 'border-amber-500/30',  activeBorder: 'border-amber-400/60' },
  'Grammar':      { icon: BookOpen,     text: 'text-blue-400',   bg: 'bg-blue-500/12',   activeBg: 'bg-blue-500/25',   border: 'border-blue-500/30',   activeBorder: 'border-blue-400/60' },
  'Logic':        { icon: AlertCircle,  text: 'text-purple-400', bg: 'bg-purple-500/12', activeBg: 'bg-purple-500/25', border: 'border-purple-500/30', activeBorder: 'border-purple-400/60' },
}
const OTHER_META = { icon: AlertCircle, text: 'text-slate-400', bg: 'bg-slate-700/30', activeBg: 'bg-slate-600/40', border: 'border-slate-600/30', activeBorder: 'border-slate-500/60' }

function getCatKey(category = '') {
  for (const key of Object.keys(CAT_META)) {
    if (category.toLowerCase().includes(key.toLowerCase())) return key
  }
  return 'Other'
}

function IssueBuckets({ issues }) {
  const [active, setActive] = useState('All')

  const sorted = [...issues].sort((a, b) => tsToSec(a.timestamp) - tsToSec(b.timestamp))

  // Build ordered category list (preserve insertion order, All first)
  const counts = {}
  sorted.forEach(issue => {
    const k = getCatKey(issue.category)
    counts[k] = (counts[k] || 0) + 1
  })
  const cats = Object.keys(counts)

  const displayed = active === 'All' ? sorted : sorted.filter(i => getCatKey(i.category) === active)

  return (
    <div className="space-y-3">
      {/* Category tab strip */}
      <div className="flex flex-wrap gap-2">
        {/* All tab */}
        {(() => {
          const isActive = active === 'All'
          return (
            <button
              onClick={() => setActive('All')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                isActive
                  ? 'bg-slate-600/50 border-slate-400/60 text-white'
                  : 'bg-slate-700/25 border-slate-600/30 text-slate-400 hover:text-slate-200 hover:border-slate-500/50'
              }`}
            >
              All
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/15 text-white' : 'bg-slate-600/40 text-slate-400'}`}>
                {issues.length}
              </span>
            </button>
          )
        })()}

        {/* Per-category tabs */}
        {cats.map(cat => {
          const meta = CAT_META[cat] ?? OTHER_META
          const Icon = meta.icon
          const isActive = active === cat
          return (
            <button
              key={cat}
              onClick={() => setActive(cat)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                isActive
                  ? `${meta.activeBg} ${meta.activeBorder} ${meta.text}`
                  : `${meta.bg} ${meta.border} ${meta.text} opacity-70 hover:opacity-100`
              }`}
            >
              <Icon size={11} />
              {cat}
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/15' : 'bg-white/8'}`}>
                {counts[cat]}
              </span>
            </button>
          )
        })}
      </div>

      {/* Mini category breakdown bar */}
      {cats.length > 1 && (
        <div className="flex h-1 rounded-full overflow-hidden gap-px">
          {cats.map(cat => {
            const meta = CAT_META[cat] ?? OTHER_META
            const pct = (counts[cat] / issues.length) * 100
            // Extract color from text class for background
            const barColor = meta.text.replace('text-', 'bg-').replace('/400', '/50')
            return (
              <div
                key={cat}
                className={`h-full transition-all ${barColor} ${active === cat ? 'opacity-100' : active === 'All' ? 'opacity-70' : 'opacity-25'}`}
                style={{ width: `${pct}%` }}
                title={`${cat}: ${counts[cat]}`}
              />
            )
          })}
        </div>
      )}

      {/* Issue list */}
      <div className="space-y-2">
        {displayed.map((issue, i) => (
          <IssueCard key={`${active}-${i}`} issue={issue} index={i} />
        ))}
      </div>
    </div>
  )
}

export default function VideoReviewCard({ video, globalIndex }) {
  const [expanded, setExpanded] = useState(video.status === 'processing')

  const hasIssues    = (video.combined_issues ?? []).length > 0
  const isProcessing = video.status === 'processing'
  const isPending    = video.status === 'pending'

  return (
    <div className="glass rounded-2xl overflow-hidden animate-slide-up" style={{ animationDelay: `${globalIndex * 60}ms` }}>
      {/* Header */}
      <button
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-white/[0.02] transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Index bubble */}
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 font-bold text-sm"
          style={{
            background: isProcessing
              ? 'linear-gradient(135deg, #f59e0b40, #d9770640)'
              : video.status === 'completed'
              ? 'linear-gradient(135deg, #10b98140, #05966940)'
              : video.status === 'failed'
              ? 'linear-gradient(135deg, #ef444440, #dc262640)'
              : 'rgba(255,255,255,0.06)',
          }}
        >
          <span className={
            isProcessing ? 'text-amber-400' :
            video.status === 'completed' ? 'text-emerald-400' :
            video.status === 'failed' ? 'text-red-400' : 'text-slate-400'
          }>
            {globalIndex + 1}
          </span>
        </div>

        {/* Link / filename */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-0.5">
            <Link2 size={11} />
            <span className="truncate">{video.filename || shortLink(video.drive_link)}</span>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={video.status} size="sm" />
            {video.status === 'completed' && (
              <span className={`text-xs font-semibold ${hasIssues ? 'text-red-400' : 'text-emerald-400'}`}>
                {hasIssues
                  ? `${video.total_issues} issue${video.total_issues !== 1 ? 's' : ''} found`
                  : '✓ No issues'}
              </span>
            )}
          </div>
        </div>

        {/* Expand toggle */}
        {expanded ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
      </button>

      {/* Body */}
      {expanded && (
        <div className="border-t border-white/5 p-4 space-y-5 animate-fade-in">
          {/* Processing shimmer */}
          {(isPending || isProcessing) && (
            <div className="space-y-2">
              <div className="skeleton h-4 w-3/4" />
              <div className="skeleton h-4 w-1/2" />
              <div className="skeleton h-4 w-2/3" />
            </div>
          )}

          {/* Passes */}
          {(video.passes?.length > 0 || isProcessing) && (
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                Review Passes
              </h4>
              <ProgressRigor passes={video.passes ?? []} videoStatus={video.status} />
            </div>
          )}

          {/* Error */}
          {video.status === 'failed' && video.error && (
            <div className="flex gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/25">
              <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-300">{video.error}</p>
            </div>
          )}

          {/* Combined issues */}
          {video.status === 'completed' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Issues
                  </h4>
                  {hasIssues && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                      {video.total_issues}
                    </span>
                  )}
                </div>
                {!hasIssues && (
                  <span className="flex items-center gap-1 text-xs text-emerald-400 font-medium">
                    <CheckCircle2 size={12} />
                    All clear
                  </span>
                )}
              </div>

              {hasIssues ? (
                <IssueBuckets issues={video.combined_issues} />
              ) : (
                <div className="text-center py-6">
                  <div className="text-3xl mb-2">✅</div>
                  <p className="text-sm text-emerald-400 font-medium">Zero issues detected</p>
                  <p className="text-xs text-slate-500 mt-1">Initial Scan → Deep Dive → Final Check — all 3 passes clean</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
