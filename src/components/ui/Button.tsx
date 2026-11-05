import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'accent' | 'subtle'
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm'

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-600 text-white shadow-sm shadow-brand-900/10 hover:bg-brand-700 active:bg-brand-800 disabled:bg-brand-300',
  accent: 'bg-accent-400 text-ink-950 shadow-sm hover:bg-accent-300 active:bg-accent-500 disabled:opacity-60',
  secondary: 'bg-ink-900 text-white shadow-sm hover:bg-ink-800 active:bg-ink-950 disabled:bg-ink-300',
  outline: 'border border-ink-200 bg-white text-ink-800 shadow-sm hover:bg-ink-50 hover:border-ink-300 active:bg-ink-100 disabled:text-ink-300',
  subtle: 'bg-brand-50 text-brand-800 hover:bg-brand-100 active:bg-brand-200 disabled:opacity-60',
  ghost: 'text-ink-600 hover:bg-ink-100 hover:text-ink-900 active:bg-ink-200 disabled:text-ink-300',
  danger: 'bg-red-600 text-white shadow-sm hover:bg-red-700 active:bg-red-800 disabled:bg-red-300',
}

const sizes: Record<ButtonSize, string> = {
  xs: 'h-7 px-2.5 text-xs gap-1 rounded-md',
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-lg',
  lg: 'h-12 px-5 text-[15px] gap-2 rounded-xl',
  icon: 'h-10 w-10 rounded-lg',
  'icon-sm': 'h-8 w-8 rounded-lg',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  icon?: ReactNode
  iconRight?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, icon, iconRight, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center font-medium whitespace-nowrap transition-all duration-150 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icon}
      {children}
      {!loading && iconRight}
    </button>
  )
})
