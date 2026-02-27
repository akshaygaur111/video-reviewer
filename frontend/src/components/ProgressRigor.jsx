import { CheckCircle, Clock, Loader, Zap, Flame, Target } from 'lucide-react'

const PASS_NAMES  = ['Initial Scan', 'Deep Dive', 'Final Check']
const PASS_DESCS  = ['Standard audit', 'Enhanced scrutiny', 'Maximum scrutiny']

const RIGOR_META = {
  standard: { label: 'Standard', icon: Target, barFrom: 'from-slate-500', barTo: 'to-slate-400' },
  enhanced: { label: 'Enhanced', icon: Zap,    barFrom: 'from-amber-500', barTo: 'to-amber-400' },
  maximum:  { label: 'Maximum',  icon: Flame,  barFrom: 'from-red-500',   barTo: 'to-red-400'   },
}

function PassRow({ pass, index, isActive }) {
  const meta = RIGOR_META[pass?.rigor_level ?? 'standard']
  const Icon = meta.icon
  const name = PASS_NAMES[index]
  const desc = PASS_DESCS[index]

  if (!pass) {
    return (
      <div className="flex items-center gap-3 opacity-35">
        <div className="w-7 h-7 rounded-full border border-slate-700 flex items-center justify-center shrink-0">
          <Clock size={12} className="text-slate-600" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-sm text-slate-600 font-medium">{name}</span>
            <span className="text-xs text-slate-700">— waiting</span>
          </div>
          <div className="h-1.5 bg-white/5 rounded-full" />
        </div>
      </div>
    )
  }

  /* Bar fills 100% for clean passes (green), proportional for issues (colored) */
  const barWidth = pass.issues_found === 0
    ? 100
    : Math.min(95, pass.issues_found * 12 + 20)
  const barClass = pass.issues_found === 0
    ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
    : `bg-gradient-to-r ${meta.barFrom} ${meta.barTo}`

  return (
    <div className={`flex items-center gap-3 ${isActive ? 'opacity-100' : 'opacity-95'}`}>
      {/* Circle */}
      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
        isActive
          ? 'bg-amber-500/20 border border-amber-500/50'
          : 'bg-emerald-500/15 border border-emerald-500/40'
      }`}>
        {isActive
          ? <Loader size={13} className="text-amber-400 animate-spin" />
          : <CheckCircle size={13} className="text-emerald-400" />
        }
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-sm font-semibold text-slate-200">{name}</span>
          <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
            pass.rigor_level === 'maximum'  ? 'badge-maximum'  :
            pass.rigor_level === 'enhanced' ? 'badge-enhanced' : 'badge-standard'
          }`}>
            <Icon size={9} className="inline mr-0.5" />
            {meta.label}
          </span>
          {!isActive && (
            <span className={`text-xs ml-auto font-mono font-semibold ${
              pass.issues_found > 0 ? 'text-red-400' : 'text-emerald-400'
            }`}>
              {pass.issues_found === 0
                ? '✓ Clean'
                : `${pass.issues_found} issue${pass.issues_found !== 1 ? 's' : ''}`}
            </span>
          )}
        </div>

        {/* Progress bar */}
        {!isActive && (
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${barClass}`}
              style={{ width: `${barWidth}%` }}
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
    <div className="space-y-4">
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
