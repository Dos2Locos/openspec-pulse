import { t, type UiMessage } from './i18n'
// Pure store contract. Paths received from the panel never select a read root.
export type RegisteredStore = { id: string; root: string }
export type OpenSpecRoot = {
  workspacePath: string; dataPath: string; kind: 'local' | 'store'; storeId: string | null
  prefixes: string[]; fingerprint: string; diagnostics: string[]
}
export type StoreInfo = { local?: boolean; workspaceId: string; root: OpenSpecRoot | null; stores: RegisteredStore[]; error: string | null; version: string | null }
export type StoreOperation = { action: 'link'; id: string } | { action: 'unlink' } | { action: 'create'; id: string; path: string }
export type StorePreview = { token: string; effects: string[]; messages?: UiMessage[] }
export const STORE_VERSION = '1.14.1'
export const STORE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function storeId(value: unknown): string {
  if (typeof value !== 'string' || value.length > 128 || !STORE_ID.test(value)) throw new Error(t("Use a lowercase kebab-case store ID."))
  return value
}

export function storePrefixes(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 32 || value.some(p => typeof p !== 'string' || !p.length || p.length > 128 || /[\s\\\u0000-\u001f]/.test(p) || p.startsWith('/') || p.includes('..'))) throw new Error(t("Use at most 32 nonempty literal system prefixes, without spaces or traversal."))
  return [...new Set(value as string[])]
}
export const inStoreScope = (name: string, prefixes: readonly string[]): boolean => !prefixes.length || prefixes.some(prefix => name.startsWith(prefix))
export const storeScopeKey = (workspaceId: string, dataPath: string): string => `stores:v1:${JSON.stringify([workspaceId, dataPath])}`

/** Read one top-level scalar; ambiguous YAML is never rewritten. All unrelated bytes stay intact. */
export function storeDeclaration(text: string): { id: string | null; start: number; end: number; comment: string } {
  if (/^(?:["']store["']\s*:|<<\s*:|\{|\[)/m.test(text)) throw new Error(t("Unsupported store declaration. Use a top-level store: ID scalar."))
  const matches = [...text.matchAll(/^store[ \t]*:([^\r\n]*)(?:\r?\n|$)/gm)]
  if (matches.length > 1) throw new Error(t("Duplicate store declaration."))
  if (!matches.length) return { id: null, start: text.length, end: text.length, comment: '' }
  const match = matches[0]
  const scalar = /^[ \t]*(?:([a-z0-9]+(?:-[a-z0-9]+)*)|'([a-z0-9]+(?:-[a-z0-9]+)*)'|"([a-z0-9]+(?:-[a-z0-9]+)*)")[ \t]*(#.*)?$/.exec(match[1])
  if (!scalar) throw new Error(t("Invalid store declaration. Use store: ID."))
  return { id: storeId(scalar[1] ?? scalar[2] ?? scalar[3]), start: match.index!, end: match.index! + match[0].length, comment: scalar[4] ?? '' }
}

export function patchStore(text: string, id: string | null): string {
  if (id !== null) storeId(id)
  const declaration = storeDeclaration(text)
  const eol = text.includes('\r\n') ? '\r\n' : '\n'
  const line = id === null ? declaration.comment ? declaration.comment + eol : '' : `store: ${id}${declaration.comment ? ' ' + declaration.comment : ''}${eol}`
  if (!declaration.id) return id === null ? text : text + (text && !text.endsWith('\n') ? eol : '') + line
  return text.slice(0, declaration.start) + line + text.slice(declaration.end)
}

export function parseStoreList(text: string): RegisteredStore[] {
  const value = JSON.parse(text)
  if (!Array.isArray(value.stores) || !Array.isArray(value.status) || value.status.length) throw new Error(t("Unsupported store list response."))
  const ids = new Set<string>()
  return value.stores.map((row: Record<string, unknown>) => {
    const id = storeId(row.id)
    if (ids.has(id) || typeof row.root !== 'string' || !row.root.startsWith('/') || /[\u0000-\u001f]/.test(row.root)) throw new Error(t("Invalid registered store identity or path."))
    ids.add(id)
    return { id, root: row.root }
  })
}
