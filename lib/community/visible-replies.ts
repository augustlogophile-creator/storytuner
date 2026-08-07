export type CommunityThreadRow = {
  id: string
  parent_reply_id: string | null
  status: string
}

/**
 * Returns only replies that can actually be rendered in the visible thread.
 *
 * A reply is renderable when it is a top-level reply, or every parent in its
 * ancestry is present in the rows the current viewer is allowed to read.
 * This matters when moderation removes a parent reply: RLS hides the removed
 * row, so its still-active descendants must not be counted as visible responses.
 */
export function renderableCommunityReplies<T extends CommunityThreadRow>(rows: T[]): T[] {
  const byId = new Map(rows.map((row) => [row.id, row]))
  const memo = new Map<string, boolean>()

  function isRenderable(row: T, visiting = new Set<string>()): boolean {
    const cached = memo.get(row.id)
    if (cached !== undefined) return cached

    if (!row.parent_reply_id) {
      memo.set(row.id, true)
      return true
    }

    if (visiting.has(row.id)) {
      memo.set(row.id, false)
      return false
    }

    const parent = byId.get(row.parent_reply_id)
    if (!parent) {
      memo.set(row.id, false)
      return false
    }

    const nextVisiting = new Set(visiting)
    nextVisiting.add(row.id)
    const result = isRenderable(parent, nextVisiting)
    memo.set(row.id, result)
    return result
  }

  return rows.filter((row) => isRenderable(row))
}

export function countActiveRenderableReplies<T extends CommunityThreadRow>(rows: T[]): number {
  return renderableCommunityReplies(rows).filter((row) => row.status === "active").length
}
