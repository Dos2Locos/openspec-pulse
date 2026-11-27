import type { Change } from '../protocol'
import { changeState, STATE_ORDER } from '../state'

export const BOARD_PATH = '.orca/openspec.pulse-board'
export function boardMarker(workspaceId: string): string {
  return JSON.stringify({ schemaVersion: 1, workspaceId }) + '\n'
}
export function markerWorkspace(text: string): string | null {
  try {
    const value = JSON.parse(text)
    return value?.schemaVersion === 1 && typeof value.workspaceId === 'string' && value.workspaceId.length > 0
      ? value.workspaceId : null
  } catch { return null }
}

/** Input is already searched, ordered and paginated by the shared panel model. */
export function boardColumns(changes: readonly Change[]) {
  return STATE_ORDER.map(state => ({ state, changes: changes.filter(change => changeState(change) === state) }))
}
