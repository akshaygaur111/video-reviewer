import { AlertTriangle, Mic, Calculator, BookOpen, ChevronDown, ChevronUp, Lightbulb } from 'lucide-react'
import { useState } from 'react'

const CATEGORY_STYLE = {
  'Math':          { icon: Calculator,   bg: 'bg-red-500/10',    border: 'border-red-500/25',    text: 'text-red-400',    label: 'text-red-300',    badge: 'bg-red-500/15 border-red-500/30' },
  'Audio-Visual':  { icon: Mic,          bg: 'bg-amber-500/10',  border: 'border-amber-500/25',  text: 'text-amber-400',  label: 'text-amber-300',  badge: 'bg-amber-500/15 border-amber-500/30' },
  'Grammar':       { icon: BookOpen,     bg: 'bg-blue-500/10',   border: 'border-blue-500/25',   text: 'text-blue-400',   label: 'text-blue-300',   badge: 'bg-blue-500/15 border-blue-500/30' },
  'Logic':         { icon: AlertTriangle,bg: 'bg-purple-500/10', border: 'border-purple-500/25', text: 'text-purple-400', label: 'text-purple-300', badge: 'bg-purple-500/15 border-purple-500/30' },
}

function getStyle(category = '') {
  for (const [key, val] of Object.entries(CATEGORY_STYLE)) {
    if (category.toLowerCase().includes(key.toLowerCase())) return val
  }
  return {
    icon: AlertTriangle,
    bg: 'bg-slate-700/30', border: 'border-slate-600/30',
    text: 'text-slate-400', label: 'text-slate-300',
    badge: 'bg-slate-700/40 border-slate-600/30',
  }
}

/**
 * Normalise any timestamp Gemini returns into M:SS
 *   "2m21s636ms"  → "2:21"
 *   "0m21s"       → "0:21"
 *   "1:23.456"    → "1:23"
 *   "00:01:23"    → "1:23"
 *   "0:24"        → "0:24"  (pass-through)
 */
function formatTimestamp(ts) {
  if (!ts) return '--:--'
  const s = String(ts).trim()

  // "2m21s636ms" or "2m21s"
  const msFmt = s.match(/^(\d+)m(\d+)s/)
  if (msFmt) {
    const m   = parseInt(msFmt[1], 10)
    const sec = String(parseInt(msFmt[2], 10)).padStart(2, '0')
    return `${m}:${sec}`
  }

  // "00:01:23" (HH:MM:SS) → drop hours if 0
  const hms = s.match(/^(\d+):(\d{2}):(\d{2})/)
  if (hms) {
    const h = parseInt(hms[1], 10)
    const m = parseInt(hms[2], 10) + h * 60
    const sec = hms[3]
    return `${m}:${sec}`
  }

  // "1:23.456" → strip ms
  return s.replace(/(\d+:\d{2})\.\d+$/, '$1') || '--:--'
}

export default function IssueCard({ issue, index }) {
  const [open, setOpen] = useState(false)
  const style = getStyle(issue.category)
  const Icon  = style.icon
  const ts    = formatTimestamp(issue.timestamp)

  return (
    <div className={`rounded-xl border ${style.border} overflow-hidden transition-all`}
         style={{ background: 'rgba(255,255,255,0.025)' }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-white/[0.025] transition-colors"
      >
        {/* Timestamp */}
        <span className={`text-xs font-mono font-bold mt-0.5 min-w-[3.2rem] ${style.text}`}>
          {ts}
        </span>

        {/* Category badge */}
        <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap mt-0.5 ${style.badge} ${style.label}`}>
          <Icon size={10} />
          {issue.category || 'Issue'}
        </span>

        {/* Description — 2 lines visible */}
        <span className="flex-1 text-sm text-slate-200 leading-snug line-clamp-2 text-left">
          {issue.description}
        </span>

        {/* Expand toggle */}
        <span className={`shrink-0 mt-0.5 ${style.text}`}>
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </button>

      {open && (
        <div className={`px-4 pb-4 pt-2 space-y-3 border-t ${style.border} animate-fade-in`}
             style={{ background: 'rgba(255,255,255,0.02)' }}>
          <p className="text-sm text-slate-200 leading-relaxed">{issue.description}</p>
          {issue.suggestion && (
            <div className="flex gap-2 p-2.5 rounded-lg bg-emerald-500/8 border border-emerald-500/20">
              <Lightbulb size={14} className="text-emerald-400 shrink-0 mt-0.5" />
              <p className="text-xs text-emerald-300 leading-relaxed">{issue.suggestion}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
