import { cn, initials } from '../../lib/utils'

const PALETTES = [
  ['#0b8a64', '#064e3b'],
  ['#2a78d6', '#1e3a8a'],
  ['#6250d6', '#3b2f8a'],
  ['#d9467a', '#831843'],
  ['#cc6a08', '#7c2d12'],
  ['#0e7490', '#164e63'],
]

/**
 * Doctor/patient avatar. Shows the uploaded photo when present; otherwise a
 * generated monogram (no stock photos of real people are used).
 */
export function PersonAvatar({ name, photoUrl, size = 'md', online, className }: { name: string; photoUrl?: string; size?: 'sm' | 'md' | 'lg' | 'xl'; online?: boolean; className?: string }) {
  const dims = { sm: 'h-8 w-8 text-[11px]', md: 'h-11 w-11 text-sm', lg: 'h-16 w-16 text-lg', xl: 'h-24 w-24 text-2xl' }[size]
  const hash = [...name].reduce((a, c) => a + c.charCodeAt(0), 0)
  const [from, to] = PALETTES[hash % PALETTES.length]
  const label = initials(name.replace(/^Dr\.?\s+/i, ''))
  return (
    <span className={cn('relative inline-flex shrink-0', className)}>
      {photoUrl ? (
        <img src={photoUrl} alt={name} className={cn('rounded-2xl object-cover ring-2 ring-white', dims)} />
      ) : (
        <span className={cn('flex items-center justify-center rounded-2xl font-display font-bold text-white ring-2 ring-white', dims)} style={{ background: `linear-gradient(135deg, ${from}, ${to})` }} aria-hidden>
          {label}
        </span>
      )}
      {online !== undefined && (
        <span
          className={cn('absolute -right-0.5 -bottom-0.5 h-3.5 w-3.5 rounded-full ring-2 ring-white', online ? 'bg-emerald-500' : 'bg-ink-300')}
          title={online ? 'Available online' : 'Offline'}
          aria-label={online ? 'Available online' : 'Offline'}
        />
      )}
    </span>
  )
}
