import { useState } from "react"
import { cn } from "cn"
import { TooltipHint } from "@/components/ui/tooltip"
import { ViewportCard } from "@/components/viewport/ViewportCard"
import { useViewportReordering } from "@/features/viewport-management/useViewportReordering"
import { useWorkspace } from "@/stores/workspace"

export function ViewportGrid({ addDevice }: { addDevice: () => void }) {
  const viewports = useWorkspace((s) => s.viewports)
  const layout = useWorkspace((s) => s.layout)
  const workspaceZoom = useWorkspace((s) => s.workspaceZoom / 100)
  const selected = useWorkspace((s) => s.selected)
  const focusedId = viewports.some((v) => v.id === selected) ? selected : viewports[0]?.id
  const ids = viewports.map((viewport) => viewport.id)
  const [mountedIds, setMountedIds] = useState(ids)
  // CSS order moves cards without moving their DOM nodes and resetting iframe pages.
  // Update this list only when devices are added or removed, not during reordering.
  if (mountedIds.length !== ids.length || ids.some((id) => !mountedIds.includes(id))) {
    setMountedIds([...mountedIds.filter((id) => ids.includes(id)), ...ids.filter((id) => !mountedIds.includes(id))])
  }
  const { canvas, placeholder, rows, order, draggedId, start, move, finish } = useViewportReordering(viewports)
  const byId = new Map(viewports.map((viewport) => [viewport.id, viewport]))
  const visible = mountedIds.flatMap((id) => {
    const viewport = byId.get(id)
    return viewport && (layout !== "focus" || id === focusedId) ? [viewport] : []
  })
  const cardWidth = (id: string) => {
    const viewport = byId.get(id)
    return viewport ? Math.max(224, viewport.width * viewport.zoom * workspaceZoom + 2) : 0
  }
  const rowWidths = rows.map(
    (row) => row.reduce((width, id) => width + cardWidth(id), 0) + Math.max(0, row.length - 1) * 16
  )
  const canvasWidth = layout === "focus" ? cardWidth(focusedId ?? "") : Math.max(0, ...rowWidths)

  return (
    <main
      id="viewport-workspace"
      tabIndex={-1}
      aria-label="Viewport previews"
      className="min-h-0 flex-1 overflow-hidden bg-background"
    >
      <div
        ref={canvas}
        data-reordering={draggedId ? "true" : undefined}
        className="viewport-workspace relative h-full min-h-0 overflow-auto p-4"
        onPointerDown={(event) => {
          if (layout === "focus") return
          const target = event.target
          if (target instanceof Element && target.closest("article")) return
          useWorkspace.setState({ selected: "" })
        }}
      >
        <div
          className={cn(
            "flex min-h-full content-start items-start gap-x-4",
            layout === "horizontal" ? "flex-wrap" : "flex-nowrap justify-center"
          )}
          // Each row is wide enough for its devices. Only explicit row breaks wrap cards.
          style={{ width: canvasWidth + 1, minWidth: "100%" }}
        >
          {visible.map((viewport) => {
            const zoom = viewport.zoom * workspaceZoom
            return (
              <ViewportCard
                key={viewport.id}
                viewport={viewport}
                zoom={zoom}
                order={order.indexOf(viewport.id) * 2}
                rowIndex={rows.findIndex((row) => row.includes(viewport.id))}
                dragging={draggedId === viewport.id}
                reorderable={layout !== "focus" && viewports.length > 1}
                onReorderStart={start}
                onReorderMove={move}
                onReorderFinish={finish}
              />
            )
          })}
          {layout === "horizontal" &&
            rows
              .slice(1)
              .map((row, index) => (
                <span
                  key={`row-${index + 1}`}
                  aria-hidden="true"
                  className="h-0 basis-full"
                  style={{ order: order.indexOf(row[0]) * 2 - 1 }}
                />
              ))}
          {viewports.length === 0 && (
            <div className="m-auto flex max-w-sm flex-col items-center gap-4 py-8 text-center">
              <div>
                <h1 className="text-lg font-semibold">Your workspace is ready</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Add a device to start comparing your website across screen sizes.
                </p>
              </div>
              <TooltipHint content="Add a viewport device">
                <button
                  className="flex min-h-40 min-w-48 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-card text-sm text-muted-foreground transition-colors hover:border-primary hover:bg-accent hover:text-accent-foreground"
                  onClick={addDevice}
                >
                  <span aria-hidden="true" className="text-xl">
                    ＋
                  </span>
                  <strong className="font-medium">Add device</strong>
                </button>
              </TooltipHint>
            </div>
          )}
        </div>
        <div
          ref={placeholder}
          aria-hidden="true"
          className="pointer-events-none absolute hidden rounded-lg border-2 border-dashed border-primary/50 bg-primary/5"
        />
      </div>
    </main>
  )
}
