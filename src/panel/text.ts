import { uiLocale } from '../i18n'
// Presentation helpers for task text. Pure functions, shared by the panel and its tests.

const SUMMARY_MAX_CHARS = 160

export type Segment = { text: string; code: boolean }

/** Splits `inline code` spans out of a task text; an unmatched backtick stays as plain text. */
export function codeSegments(text: string): Segment[] {
  const parts = text.split('`')
  // An even number of parts means one backtick has no partner: glue it back to the last part.
  if (parts.length % 2 === 0) parts.splice(-2, 2, `${parts[parts.length - 2]}\`${parts[parts.length - 1]}`)
  return parts
    .map((part, index) => ({ text: part, code: index % 2 === 1 }))
    .filter((segment) => segment.text !== '')
}

/**
 * The first sentence of a task, or its first ~160 characters cut at a word; `truncated` says
 * whether anything was left out.
 */
export function summarize(text: string): { summary: string; truncated: boolean } {
  const sentenceEnd = text.search(/[.!?](\s|$)/)
  if (sentenceEnd !== -1 && sentenceEnd < SUMMARY_MAX_CHARS) {
    const summary = text.slice(0, sentenceEnd + 1)
    return { summary, truncated: summary.length < text.trim().length }
  }
  if (text.length <= SUMMARY_MAX_CHARS) return { summary: text, truncated: false }
  const cut = text.lastIndexOf(' ', SUMMARY_MAX_CHARS)
  return { summary: `${text.slice(0, cut > 0 ? cut : SUMMARY_MAX_CHARS)}…`, truncated: true }
}

/** Calendar dates retain their date across timezones. */
export function formatDate(date: string): string {
  const instant = new Date(date + 'T00:00:00Z')
  if (!Number.isFinite(instant.getTime())) return date
  return new Intl.DateTimeFormat(uiLocale(), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(instant)
}
