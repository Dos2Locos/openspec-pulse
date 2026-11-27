import { inlineMarkdown, markdownBlocks } from '../markdown'
import { h, type Child } from './dom'

function inline(text: string): Child[] {
  return inlineMarkdown(text).map(part => {
    if (part.kind === 'text') return part.text
    if (part.kind === 'link') return part.href ? h('button', {
      type: 'button', class: 'markdown-link', title: part.href,
      onclick: () => { void orca.shell?.openExternal(part.href!) }
    }, [part.text]) : part.text
    return h(part.kind, {}, [part.text])
  })
}
/** All content enters through DOM text nodes, including raw HTML and fenced code. */
export function markdownView(source: string): HTMLElement {
  return h('div', { class: 'markdown' }, markdownBlocks(source).map(block => {
    if (block.kind === 'code') return h('pre', {}, [h('code', {}, [block.text])])
    if (block.kind === 'heading') return h(`h${block.level}`, {}, inline(block.text))
    if (block.kind === 'quote') return h('blockquote', {}, inline(block.text))
    if (block.kind === 'item') return h('p', { class: 'markdown-item' }, ['• ', ...inline(block.text)])
    return h('p', {}, inline(block.text))
  }))
}
