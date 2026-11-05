import { cn } from '../../lib/utils'

/** Text-based brand mark: a pharmacy cross with a marigold "lamp" dot. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn('h-9 w-9 shrink-0', className)} aria-hidden>
      <defs>
        <linearGradient id="sms-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#14a378" />
          <stop offset="1" stopColor="#075441" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill="url(#sms-mark)" />
      <path d="M20 9.5v21M9.5 20h21" stroke="#fff" strokeWidth="5.5" strokeLinecap="round" />
      <circle cx="30" cy="10.5" r="4" fill="#f8b33d" stroke="#0b6e52" strokeWidth="1.5" />
    </svg>
  )
}

export function BrandLogo({ collapsed, inverted, className }: { collapsed?: boolean; inverted?: boolean; className?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <BrandMark />
      {!collapsed && (
        <div className="leading-none">
          <div className={cn('font-display text-[15px] font-extrabold tracking-tight', inverted ? 'text-white' : 'text-ink-950')}>
            Saraswati<span className={inverted ? 'text-accent-300' : 'text-brand-600'}>.</span>
          </div>
          <div className={cn('mt-1 text-[10px] font-semibold tracking-[0.18em] uppercase', inverted ? 'text-brand-200/80' : 'text-ink-400')}>Medicines Store</div>
        </div>
      )}
    </div>
  )
}
