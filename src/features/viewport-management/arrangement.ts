import type { Viewport } from "@/types"

export function viewportRows(viewports: Pick<Viewport, "id" | "row">[]): string[][] {
  const rows = new Map<number, string[]>()
  for (const viewport of viewports) {
    const row = rows.get(viewport.row) ?? []
    row.push(viewport.id)
    rows.set(viewport.row, row)
  }
  return [...rows.values()]
}

export function moveViewport(rows: string[][], id: string, row: number, index: number, newRow = false) {
  const next = rows.map((items) => items.filter((item) => item !== id))
  if (newRow) next.splice(row, 0, [id])
  else next[row]?.splice(index, 0, id)
  return next.filter((items) => items.length > 0)
}

export function arrangeViewports(viewports: Viewport[], rows: string[][]) {
  const ids = rows.flat()
  const byId = new Map(viewports.map((viewport) => [viewport.id, viewport]))
  if (
    rows.some((row) => row.length === 0) ||
    ids.length !== viewports.length ||
    new Set(ids).size !== ids.length ||
    ids.some((id) => !byId.has(id))
  )
    return viewports
  const next = rows.flatMap((ids, row) =>
    ids.map((id) => {
      const viewport = byId.get(id)!
      return viewport.row === row ? viewport : { ...viewport, row }
    })
  )
  return next.every((viewport, index) => viewport === viewports[index]) ? viewports : next
}
