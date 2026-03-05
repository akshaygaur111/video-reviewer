import { useState } from 'react'
import { ChevronDown, ChevronUp, Link2, AlertCircle, CheckCircle2, Share2 } from 'lucide-react'
import StatusBadge from './StatusBadge'
import ProgressRigor from './ProgressRigor'
import IssueBuckets from './IssueBuckets'
import toast from 'react-hot-toast'

function shortLink(url) {
  try {
    const id = url.match(/[?&]id=([^&]+)/)?.[1] ?? url.match(/\/d\/([^/]+)/)?.[1] ?? url
    return `drive.google.com/…/${id.slice(0, 12)}`
  } catch {
    return url.slice(0, 40) + '…'
  }
}

export default function VideoReviewCard({ video, globalIndex, jobId }) {
  const [expanded, setExpanded] = useState(video.status === 'processing')

  const hasIssues    = (video.combined_issues ?? []).length > 0
  const isProcessing = video.status === 'processing'
  const isPending    = video.status === 'pending'

  function handleShare(e) {
    e.stopPropagation()
    const url = `${window.location.origin}/share/${jobId}/${globalIndex}`
    navigator.clipboard.writeText(url).then(() => {
      toast.success('Share link copied!')
    }).catch(() => {
      toast.error('Could not copy link')
    })
  }

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

        {/* Share button (completed videos only) */}
        {video.status === 'completed' && jobId && (
          <button
            onClick={handleShare}
            className="shrink-0 p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/8 transition-colors"
            title="Copy shareable link"
          >
            <Share2 size={14} />
          </button>
        )}

        {/* Expand toggle */}
        {expanded ? <ChevronUp size={16} className="text-slate-500 shrink-0" /> : <ChevronDown size={16} className="text-slate-500 shrink-0" />}
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
