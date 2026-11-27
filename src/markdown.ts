// Deliberately small Markdown subset. Raw HTML is always text; no HTML parser or innerHTML.
export type Inline = { kind: 'text' | 'code' | 'strong' | 'em'; text: string } | { kind: 'link'; text: string; href: string | null }
export type Block = { kind: 'heading' | 'paragraph' | 'quote' | 'item' | 'code'; text: string; level?: number }

export function safeLink(value: string): string | null {
  try {
    const url = new URL(value)
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null
  } catch { return null }
}
export function inlineMarkdown(text: string): Inline[] {
  const parts: Inline[] = []
  const pattern = /`([^`]+)`|\[([^\]]+)\]\(([^\s)]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*/g
  let offset = 0
  for (const match of text.matchAll(pattern)) {
    if (match.index! > offset) parts.push({ kind: 'text', text: text.slice(offset, match.index) })
    if (match[1]) parts.push({ kind: 'code', text: match[1] })
    else if (match[2]) parts.push({ kind: 'link', text: match[2], href: safeLink(match[3]) })
    else parts.push({ kind: match[4] ? 'strong' : 'em', text: match[4] ?? match[5] })
    offset = match.index! + match[0].length
  }
  if (offset < text.length) parts.push({ kind: 'text', text: text.slice(offset) })
  return parts
}
export function markdownBlocks(source: string): Block[] {
  const blocks: Block[] = []
  let fence: string | null = null
  let code: string[] = []
  for (const line of source.split(/\r?\n/)) {
    const marker = /^\s*(`{3,}|~{3,})/.exec(line)?.[1]
    if (marker && !fence) { fence = marker; code = []; continue }
    if (fence) {
      if (marker && marker[0] === fence[0] && marker.length >= fence.length) {
        blocks.push({ kind: 'code', text: code.join('\n') }); fence = null
      } else code.push(line)
      continue
    }
    if (!line.trim()) continue
    const heading = /^(#{1,6})\s+(.+)$/.exec(line)
    const item = /^\s*(?:[-*+]|\d+\.)\s+(.+)$/.exec(line)
    if (heading) blocks.push({ kind: 'heading', level: heading[1].length, text: heading[2] })
    else if (item) blocks.push({ kind: 'item', text: item[1] })
    else if (/^>\s?/.test(line)) blocks.push({ kind: 'quote', text: line.replace(/^>\s?/, '') })
    else blocks.push({ kind: 'paragraph', text: line })
  }
  if (fence) blocks.push({ kind: 'code', text: code.join('\n') })
  return blocks
}
