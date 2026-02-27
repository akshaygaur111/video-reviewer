const CONFIG = {
  pending:    { dot: 'dot-pending',    text: 'Pending',    label: 'text-slate-400' },
  processing: { dot: 'dot-processing', text: 'Processing', label: 'text-amber-400' },
  completed:  { dot: 'dot-completed',  text: 'Completed',  label: 'text-emerald-400' },
  failed:     { dot: 'dot-failed',     text: 'Failed',     label: 'text-red-400' },
}

export default function StatusBadge({ status, size = 'md' }) {
  const c = CONFIG[status] ?? CONFIG.pending
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm'

  return (
    <span className={`inline-flex items-center gap-1.5 font-medium ${textSize} ${c.label}`}>
      <span className={c.dot} />
      {c.text}
    </span>
  )
}
