import { t } from './i18n'
import { createHash } from 'node:crypto'
import { open, realpath } from 'node:fs/promises'
import { join } from 'node:path'
import { CONFIG_MAX_BYTES, parseWorkflow, type WorkflowInfo } from './config'

/** Bounded read even when the file grows during the read. Never activates a partial config. */
export async function readWorkflow(root: string): Promise<WorkflowInfo> {
  try {
    const file = await open(join(root, 'openspec', 'pulse.json'), 'r')
    let text: string
    try {
      const info = await file.stat()
      if (!info.isFile() || info.size > CONFIG_MAX_BYTES) throw new Error(t("pulse.json must be a file of at most 64 KiB."))
      const buffer = Buffer.alloc(CONFIG_MAX_BYTES + 1)
      let length = 0
      while (length < buffer.length) {
        const { bytesRead } = await file.read(buffer, length, buffer.length - length, null)
        if (!bytesRead) break
        length += bytesRead
      }
      if (length > CONFIG_MAX_BYTES) throw new Error(t("pulse.json exceeds 64 KiB."))
      text = buffer.subarray(0, length).toString('utf8')
    } finally { await file.close() }
    const config = parseWorkflow(text)
    const roots = await Promise.all([realpath(root), realpath(join(root, 'openspec'))])
    const fingerprint = createHash('sha256').update(JSON.stringify(roots)).update('\0').update(text).digest('hex')
    return { config, fingerprint, error: null }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { config: null, fingerprint: null, error: null }
    return { config: null, fingerprint: null, error: `openspec/pulse.json: ${(error as Error).message}` }
  }
}
