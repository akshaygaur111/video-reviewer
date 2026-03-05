import { useState } from 'react'
import { Flame, AlertTriangle, Info, AlertCircle } from 'lucide-react'
import IssueCard from './IssueCard'

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

const SEVERITY_BUCKETS = [
  {
    key: 'Critical',
    icon: Flame,
    text: 'text-red-400',
    bg: 'bg-red-500/12',
    activeBg: 'bg-red-500/25',
    border: 'border-red-500/30',
    activeBorder: 'border-red-400/70',
    bar: 'bg-red-500/60',
    description: 'Factual / math errors',
  },
  {
    key: 'Major',
    icon: AlertTriangle,
    text: 'text-amber-400',
    bg: 'bg-amber-500/12',
    activeBg: 'bg-amber-500/25',
    border: 'border-amber-500/30',
    activeBorder: 'border-amber-400/70',
    bar: 'bg-amber-500/60',
    description: 'Pedagogical / sync flaws',
  },
  {
    key: 'Minor',
    icon: Info,
    text: 'text-blue-400',
    bg: 'bg-blue-500/12',
    activeBg: 'bg-blue-500/25',
    border: 'border-blue-500/30',
    activeBorder: 'border-blue-400/70',
    bar: 'bg-blue-500/60',
    description: 'Cosmetic / consistency',
  },
]

const UNKNOWN_BUCKET = {
  key: 'Other',
  icon: AlertCircle,
  text: 'text-slate-400',
  bg: 'bg-slate-700/25',
  activeBg: 'bg-slate-600/40',
  border: 'border-slate-600/30',
  activeBorder: 'border-slate-500/60',
  bar: 'bg-slate-500/40',
  description: 'Unclassified',
}

export function getSeverityBucket(severity = '') {
  return SEVERITY_BUCKETS.find(b => b.key === severity) ?? UNKNOWN_BUCKET
}

export default function IssueBuckets({ issues }) {
  const [active, setActive] = useState('All')

  const sorted = [...issues].sort((a, b) => tsToSec(a.timestamp) - tsToSec(b.timestamp))

  const counts = {}
  sorted.forEach(issue => {
    const k = getSeverityBucket(issue.severity).key
    counts[k] = (counts[k] || 0) + 1
  })

  const activeBuckets = [
    ...SEVERITY_BUCKETS.filter(b => counts[b.key] > 0),
    ...(counts['Other'] ? [UNKNOWN_BUCKET] : []),
  ]

  const displayed = active === 'All'
    ? sorted
    : sorted.filter(i => getSeverityBucket(i.severity).key === active)

  return (
    <div className="space-y-3">
      {/* Severity tab strip */}
      <div className="flex flex-wrap gap-2">
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

        {activeBuckets.map(bucket => {
          const Icon = bucket.icon
          const isActive = active === bucket.key
          return (
            <button
              key={bucket.key}
              onClick={() => setActive(bucket.key)}
              title={bucket.description}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                isActive
                  ? `${bucket.activeBg} ${bucket.activeBorder} ${bucket.text}`
                  : `${bucket.bg} ${bucket.border} ${bucket.text} opacity-70 hover:opacity-100`
              }`}
            >
              <Icon size={11} />
              {bucket.key}
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/15' : 'bg-white/8'}`}>
                {counts[bucket.key]}
              </span>
            </button>
          )
        })}
      </div>

      {/* Proportional breakdown bar */}
      {activeBuckets.length > 1 && (
        <div className="flex h-1 rounded-full overflow-hidden gap-px">
          {activeBuckets.map(bucket => (
            <div
              key={bucket.key}
              className={`h-full transition-all ${bucket.bar} ${
                active === bucket.key ? 'opacity-100' : active === 'All' ? 'opacity-70' : 'opacity-20'
              }`}
              style={{ width: `${(counts[bucket.key] / issues.length) * 100}%` }}
              title={`${bucket.key}: ${counts[bucket.key]}`}
            />
          ))}
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
