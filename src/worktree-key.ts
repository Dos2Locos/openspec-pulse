/** Stable even when two worktrees contain an identically named change or capability. */
export const worktreeItemKey = (workspaceId: string, kind: string, name: string): string => JSON.stringify([workspaceId, kind, name])
