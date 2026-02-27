import { AlertTriangle, Mic, Calculator, BookOpen, ChevronRight } from 'lucide-react'
import { useState } from 'react'

const CATEGORY_STYLE = {
  'Math':          { icon: Calculator,   bg: 'bg-red-500/10',    border: 'border-red-500/25',    text: 'text-red-400',    label: 'text-red-300' },
  'Audio-Visual':  { icon: Mic,          bg: 'bg-amber-500/10',  border: 'border-amber-500/25',  text: 'text-amber-400',  label: 'text-amber-300' },
  'Grammar':       { icon: BookOpen,     bg: 'bg-blue-500/10',   border: 'border-blue-500/25',   text: 'text-blue-400',   label: 'text-blue-300' },
  'Logic':         { icon: ChevronRight, bg: 'bg-purple-500/10', border: 'border-purple-500/25', text: 'text-purple-400', label: 'text-purple-300' },
}

function getStyle(category = '') {
  for (const [key, val] of Object.entries(CATEGORY_STYLE)) {
    if (category.toLowerCase().includes(key.toLowerCase())) return val
  }
  return {
    icon: AlertTriangle,
    bg: 'bg-slate-700/30', border: 'border-slate-600/30', text: 'text-slate-400', label: 'text-slate-300',
  }
}

export default function IssueCard({ issue, index }) {
  const [open, setOpen] = useState(false)
  const style = getStyle(issue.category)
  const Icon  = style.icon

  return (
    <div className={`rounded-xl border ${style.bg} ${style.border} overflow-hidden transition-all`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 p-3 text-left"
      >
        <span className={`text-xs font-mono font-bold min-w-[3.5rem] ${style.text}`}>
          {issue.timestamp || '--:--'}
        </span>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${style.bg} ${style.label} border ${style.border} whitespace-nowrap`}>
          {issue.category || 'Issue'}
        </span>
        <span className="flex-1 text-sm text-slate-300 line-clamp-1 text-left">
          {issue.description}
        </span>
        <Icon size={14} className={`shrink-0 ${style.text} transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>

      {open && (
        <div className="px-4 pb-3 pt-0 space-y-2 border-t border-white/5 animate-fade-in">
          <p className="text-sm text-slate-300 leading-relaxed">{issue.description}</p>
          {issue.suggestion && (
            <div className="flex gap-2 mt-2">
              <span className="text-xs text-slate-500 shrink-0 mt-0.5">Suggestion:</span>
              <p className="text-xs text-emerald-400">{issue.suggestion}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
