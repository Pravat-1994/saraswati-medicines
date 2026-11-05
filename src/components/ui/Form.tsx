import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '../../lib/utils'

const control =
  'w-full rounded-lg border border-ink-200 bg-white text-sm text-ink-900 shadow-[0_1px_0_rgb(16_24_40/0.02)] placeholder:text-ink-400 transition-colors duration-150 hover:border-ink-300 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 focus:outline-none disabled:cursor-not-allowed disabled:bg-ink-50 disabled:text-ink-400 aria-[invalid=true]:border-red-400 aria-[invalid=true]:focus:ring-red-500/15'

export interface FieldProps {
  label?: ReactNode
  hint?: ReactNode
  error?: string
  required?: boolean
  className?: string
  children: (id: string, describedBy?: string) => ReactNode
}

/** Label + control + hint/error. Children receive the generated id for a11y wiring. */
export function Field({ label, hint, error, required, className, children }: FieldProps) {
  const id = useId()
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={id} className="text-[13px] font-medium text-ink-700">
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
      )}
      {children(id, describedBy)}
      {error ? (
        <p id={`${id}-error`} className="text-xs font-medium text-red-600" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-ink-500">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean
  leading?: ReactNode
  trailing?: ReactNode
  inputSize?: 'sm' | 'md' | 'lg'
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ invalid, leading, trailing, className, inputSize = 'md', ...rest }, ref) {
  const h = inputSize === 'sm' ? 'h-8 text-[13px]' : inputSize === 'lg' ? 'h-12 text-base' : 'h-10'
  if (!leading && !trailing) {
    return <input ref={ref} aria-invalid={invalid || undefined} className={cn(control, h, 'px-3', className)} {...rest} />
  }
  return (
    <div className={cn('relative flex items-center', className)}>
      {leading && <span className="pointer-events-none absolute left-3 flex items-center text-ink-400">{leading}</span>}
      <input ref={ref} aria-invalid={invalid || undefined} className={cn(control, h, leading ? 'pl-9' : 'pl-3', trailing ? 'pr-10' : 'pr-3')} {...rest} />
      {trailing && <span className="absolute right-2 flex items-center text-ink-400">{trailing}</span>}
    </div>
  )
})

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(function Textarea(
  { invalid, className, rows = 3, ...rest },
  ref,
) {
  return <textarea ref={ref} rows={rows} aria-invalid={invalid || undefined} className={cn(control, 'px-3 py-2 leading-relaxed', className)} {...rest} />
})

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  options: SelectOption[]
  placeholder?: string
  invalid?: boolean
  selectSize?: 'sm' | 'md'
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({ options, placeholder, invalid, className, selectSize = 'md', ...rest }, ref) {
  return (
    <div className={cn('relative', className)}>
      <select
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(control, 'appearance-none pr-9 pl-3', selectSize === 'sm' ? 'h-8 text-[13px]' : 'h-10')}
        {...rest}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden />
    </div>
  )
})

export function Checkbox({ label, description, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; description?: ReactNode }) {
  const id = useId()
  return (
    <label htmlFor={id} className={cn('flex cursor-pointer items-start gap-2.5', className)}>
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-ink-300 accent-brand-600"
        {...rest}
      />
      <span className="flex flex-col">
        <span className="text-sm font-medium text-ink-800">{label}</span>
        {description && <span className="text-xs text-ink-500">{description}</span>}
      </span>
    </label>
  )
}

export function Switch({ checked, onChange, label, description, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; description?: ReactNode; disabled?: boolean }) {
  const id = useId()
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex flex-col">
        <label htmlFor={id} className="text-sm font-medium text-ink-800">
          {label}
        </label>
        {description && <span className="text-xs text-ink-500">{description}</span>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 disabled:opacity-50',
          checked ? 'bg-brand-600' : 'bg-ink-200',
        )}
      >
        <span className={cn('inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200', checked ? 'translate-x-5.5' : 'translate-x-0.5')} />
      </button>
    </div>
  )
}

/** Grouped form section with a title and description column. */
export function FormSection({ title, description, children, className }: { title: string; description?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn('grid gap-x-8 gap-y-4 border-b border-ink-100 py-6 last:border-0 lg:grid-cols-[240px_1fr]', className)}>
      <div>
        <h3 className="font-display text-sm font-semibold text-ink-900">{title}</h3>
        {description && <p className="mt-1 text-xs leading-relaxed text-ink-500">{description}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  )
}
