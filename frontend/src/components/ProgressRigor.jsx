import { CheckCircle, Clock, Loader, Zap, Flame, Target } from 'lucide-react'

const RIGOR_META = {
  standard: { label: 'Standard', icon: Target, color: 'text-slate-300', barColor: 'bg-slate-500' },
  enhanced: { label: 'Enhanced', icon: Zap,    color: 'text-amber-400', barColor: 'bg-amber-500' },
  maximum:  { label: 'Maximum',  icon: Flame,  color: 'text-red-400',   barColor: 'bg-red-500'   },
}

function PassRow({ pass, index, isActive }) {
  const meta = RIGOR_META[pass?.rigor_level ?? 'standard']
  const Icon = meta.icon

  if (!pass) {
    return (
      <div className="flex items-center gap-3 opacity-40">
        <div className="w-6 h-6 rounded-full border border-slate-600 flex items-center justify-center">
          <span className="text-xs text-slate-500">{index + 1}</span>
        </div>
        <span className="text-sm text-slate-600">Pass {index + 1} — Waiting</span>
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-3 ${isActive ? 'opacity-100' : 'opacity-90'}`}>
      {/* Step circle */}
      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
        isActive
          ? 'bg-amber-500/20 border border-amber-500/50'
          : 'bg-emerald-500/15 border border-emerald-500/40'
      }`}>
        {isActive
          ? <Loader size={12} className="text-amber-400 animate-spin" />
          : <CheckCircle size={12} className="text-emerald-400" />
        }
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-medium text-slate-200">Pass {pass.pass_number}</span>
          <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
            pass.rigor_level === 'maximum'  ? 'badge-maximum'  :
            pass.rigor_level === 'enhanced' ? 'badge-enhanced' : 'badge-standard'
          }`}>
            <Icon size={10} className="inline mr-1" />
            {meta.label}
          </span>
          {!isActive && (
            <span className={`text-xs ml-auto font-mono ${
              pass.issues_found > 0 ? 'text-red-400' : 'text-emerald-400'
            }`}>
              {pass.issues_found} issue{pass.issues_found !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        {/* Progress bar showing issue count vs scale */}
        {!isActive && (
          <div className="h-1 bg-dark-600 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                pass.issues_found === 0 ? 'bg-emerald-500' : meta.barColor
              }`}
              style={{ width: `${Math.min(100, pass.issues_found * 8 + (pass.issues_found > 0 ? 10 : 0))}%` }}
            />
          </div>
        )}
      </div>
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
    <div className="space-y-3">
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
