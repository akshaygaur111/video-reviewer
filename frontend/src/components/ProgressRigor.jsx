import { CheckCircle, Clock, Loader, Zap, Flame, Target } from 'lucide-react'

const PASS_NAMES = ['Initial Scan', 'Deep Dive', 'Final Check']

const RIGOR_META = {
  standard: { label: 'Standard', icon: Target, badge: 'badge-standard', dot: 'bg-slate-400' },
  enhanced: { label: 'Enhanced', icon: Zap,    badge: 'badge-enhanced', dot: 'bg-amber-400' },
  maximum:  { label: 'Maximum',  icon: Flame,  badge: 'badge-maximum',  dot: 'bg-red-400'   },
}

function PassRow({ pass, index, isActive }) {
  const rigor = pass?.rigor_level ?? 'standard'
  const meta  = RIGOR_META[rigor]
  const Icon  = meta.icon
  const name  = PASS_NAMES[index]

  /* Waiting state */
  if (!pass) {
    return (
      <div className="flex items-center justify-between py-2.5 px-3 rounded-xl opacity-35"
           style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-2.5">
          <Clock size={13} className="text-slate-600" />
          <span className="text-sm text-slate-600 font-medium">{name}</span>
        </div>
        <span className="text-xs text-slate-700 font-mono">waiting…</span>
      </div>
    )
  }

  /* Active (currently running) */
  if (isActive) {
    return (
      <div className="flex items-center justify-between py-2.5 px-3 rounded-xl"
           style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
        <div className="flex items-center gap-2.5">
          <Loader size={13} className="text-amber-400 animate-spin" />
          <span className="text-sm font-semibold text-amber-200">{name}</span>
          <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${meta.badge}`}>
            <Icon size={9} className="inline mr-0.5" />{meta.label}
          </span>
        </div>
        <span className="text-xs text-amber-400 animate-pulse">Running…</span>
      </div>
    )
  }

  /* Completed */
  const clean = pass.issues_found === 0
  return (
    <div className="flex items-center justify-between py-2.5 px-3 rounded-xl"
         style={{
           background: clean ? 'rgba(16,185,129,0.06)' : 'rgba(255,255,255,0.025)',
           border: clean ? '1px solid rgba(16,185,129,0.18)' : '1px solid rgba(255,255,255,0.06)',
         }}>
      <div className="flex items-center gap-2.5">
        <CheckCircle size={13} className="text-emerald-400 shrink-0" />
        <span className="text-sm font-semibold text-slate-200">{name}</span>
        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${meta.badge}`}>
          <Icon size={9} className="inline mr-0.5" />{meta.label}
        </span>
      </div>
      <span className={`text-xs font-semibold font-mono ${clean ? 'text-emerald-400' : 'text-red-400'}`}>
        {clean ? '✓ Clean' : `${pass.issues_found} issue${pass.issues_found !== 1 ? 's' : ''}`}
      </span>
    </div>
  )
}

export default function ProgressRigor({ passes = [], videoStatus }) {
  const filledPasses = [
    passes[0] ?? null,
    passes[1] ?? null,
    passes[2] ?? null,
  ]

  return (
    <div className="space-y-2">
      {filledPasses.map((p, i) => (
        <PassRow
          key={i}
          pass={p}
          index={i}
          isActive={videoStatus === 'processing' && passes.length === i}
        />
      ))}
    </div>
  )
}
