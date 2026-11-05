/** Client-side export helpers (CSV download and print). */

export interface CsvColumn<T> {
  header: string
  value: (row: T) => string | number | boolean | undefined | null
}

const BOM = String.fromCharCode(0xfeff)

function escapeCsv(value: unknown): string {
  if (value === undefined || value === null) return ''
  const s = String(value)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const head = columns.map((c) => escapeCsv(c.header)).join(',')
  const body = rows.map((r) => columns.map((c) => escapeCsv(c.value(r))).join(','))
  return [head, ...body].join('\r\n')
}

/** Triggers a CSV download. Returns false if the host blocks downloads. */
export function downloadCsv<T>(filename: string, rows: T[], columns: CsvColumn<T>[]): boolean {
  try {
    const blob = new Blob([BOM + toCsv(rows, columns)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    return true
  } catch {
    return false
  }
}

export function printPage(): void {
  try {
    window.print()
  } catch {
    /* printing unavailable in some embedded hosts */
  }
}
