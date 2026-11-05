import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Form'

/** Editable list of short values shown as removable chips. */
export function ChipListEditor({
  id,
  value,
  onChange,
  placeholder,
  numeric,
  format = (v) => v,
  validate,
  invalid,
}: {
  id?: string
  value: string[]
  onChange: (v: string[]) => void
  placeholder: string
  numeric?: boolean
  format?: (v: string) => string
  validate?: (v: string) => string | undefined
  invalid?: boolean
}) {
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string>()
  const add = () => {
    const v = draft.trim()
    if (!v) return
    const err = validate?.(v) ?? (value.some((x) => x.toLowerCase() === v.toLowerCase()) ? 'Already in the list' : undefined)
    if (err) {
      setError(err)
      return
    }
    onChange([...value, v])
    setDraft('')
    setError(undefined)
  }
  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap gap-1.5">
        {value.length === 0 && <span className="text-xs text-ink-400">None added</span>}
        {value.map((v) => (
          <span key={v} className="inline-flex items-center gap-1 rounded-full border border-brand-200/70 bg-brand-50 py-1 pr-1 pl-2.5 text-xs font-medium text-brand-800">
            {format(v)}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== v))} className="rounded-full p-0.5 text-brand-600 hover:bg-brand-100 hover:text-brand-900" aria-label={`Remove ${format(v)}`}>
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          id={id}
          inputSize="sm"
          className="flex-1"
          value={draft}
          type={numeric ? 'number' : 'text'}
          invalid={invalid || !!error}
          placeholder={placeholder}
          onChange={(e) => {
            setDraft(e.target.value)
            setError(undefined)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
        />
        <Button variant="outline" size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={add} disabled={!draft.trim()}>
          Add
        </Button>
      </div>
      {error && <p className="text-xs font-medium text-red-600">{error}</p>}
    </div>
  )
}
