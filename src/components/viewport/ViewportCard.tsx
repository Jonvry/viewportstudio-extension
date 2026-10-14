import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  memo,
  useEffect,
  useRef,
  useState,
} from "react"
import type { RefObject } from "react"
import {
  ComputerIcon,
  DragDropVerticalIcon,
  InformationCircleIcon,
  LinkSquare02Icon,
  MultiplicationSignIcon,
  ResizeFieldIcon,
  SmartPhone01Icon,
  Tablet01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "cn"
import { TooltipHint } from "@/components/ui/tooltip"
import { DimensionInput, DimensionReadout, ViewportControls } from "@/components/viewport/ViewportControls"
import { ViewportFrame } from "@/components/viewport/ViewportFrame"
import { moveViewport, viewportRows } from "@/features/viewport-management/arrangement"
import { foldableCounterpart } from "@/features/viewport-management/devices"
import { useWorkspace } from "@/stores/workspace"
import type { FrameStatus, Viewport } from "@/types"
import { openExternal } from "@/utils/browser"

export const ViewportCard = memo(function ViewportCard({
  viewport,
  zoom = viewport.zoom,
  order,
  rowIndex,
  dragging,
  reorderable,
  onReorderStart,
  onReorderMove,
  onReorderFinish,
}: {
  viewport: Viewport
  zoom?: number
  order: number
  rowIndex: number
  dragging: boolean
  reorderable: boolean
  onReorderStart: (event: ReactPointerEvent<HTMLElement>, id: string) => void
  onReorderMove: (event: ReactPointerEvent<HTMLElement>) => void
  onReorderFinish: (commit: boolean) => void
}) {
  const observedURL = useWorkspace((state) => state.observedUrls[viewport.id])
  const workspaceURL = useWorkspace((state) => state.url)
  const selected = useWorkspace((state) => state.selected === viewport.id)
  const status = useWorkspace((state) => state.statuses[viewport.id])
  const [sizeAnimating, setSizeAnimating] = useState(false)
  const surface = useRef<HTMLDivElement>(null)
  const card = useRef<HTMLElement>(null)
  const sizeAnimationTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const foldableNext = foldableCounterpart(viewport.name)
  const foldableOpen = viewport.name.endsWith("(Unfolded)")

  useEffect(() => {
    if (selected) card.current?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" })
  }, [selected])

  function animateSizeChange() {
    if (sizeAnimationTimer.current) clearTimeout(sizeAnimationTimer.current)
    setSizeAnimating(true)
    sizeAnimationTimer.current = setTimeout(() => {
      setSizeAnimating(false)
      sizeAnimationTimer.current = null
    }, 320)
  }

  useEffect(
    () => () => {
      if (sizeAnimationTimer.current) clearTimeout(sizeAnimationTimer.current)
    },
    []
  )

  function toggleFoldable() {
    if (!foldableNext) return
    const landscape = viewport.width > viewport.height
    animateSizeChange()
    useWorkspace.getState().update(viewport.id, {
      name: foldableNext.name,
      width: landscape ? foldableNext.height : foldableNext.width,
      height: landscape ? foldableNext.width : foldableNext.height,
    })
  }

  function selectCard() {
    useWorkspace.setState({ selected: viewport.id })
  }

  function selectCardFromKeyboard(event: ReactKeyboardEvent<HTMLElement>) {
    const isActivationKey = event.key === "Enter" || event.key === " "
    if (event.target !== event.currentTarget || !isActivationKey) return
    event.preventDefault()
    selectCard()
  }

  function moveCardWithKeyboard(event: ReactKeyboardEvent<HTMLButtonElement>) {
    const direction =
      event.key === "ArrowLeft" || event.key === "ArrowUp"
        ? -1
        : event.key === "ArrowRight" || event.key === "ArrowDown"
          ? 1
          : 0
    if (!direction) return
    event.preventDefault()
    event.stopPropagation()
    const state = useWorkspace.getState()
    const viewports = state.viewports
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      const rows = viewportRows(viewports)
      const row = rows.findIndex((items) => items.includes(viewport.id))
      if (row === -1) return
      const target = row + direction
      const newRow = target < 0 || target >= rows.length
      const index = newRow ? 0 : Math.min(rows[row].indexOf(viewport.id), rows[target].length)
      state.arrange(moveViewport(rows, viewport.id, Math.max(0, target), index, newRow), viewport.id)
      requestAnimationFrame(() => card.current?.scrollIntoView({ block: "nearest", inline: "nearest" }))
      return
    }
    const index = viewports.findIndex((item) => item.id === viewport.id)
    const target = viewports[index + direction]
    if (target) {
      useWorkspace.getState().reorder(viewport.id, target.id, direction < 0 ? "before" : "after")
      requestAnimationFrame(() => card.current?.scrollIntoView({ block: "nearest", inline: "nearest" }))
    }
  }

  function rotateViewport() {
    animateSizeChange()
    useWorkspace.getState().update(viewport.id, { width: viewport.height, height: viewport.width })
  }

  return (
    <article
      ref={card}
      className={cn(
        "relative mb-4 shrink-0 overflow-clip rounded-lg border border-border bg-card text-card-foreground shadow-sm transition-[opacity,box-shadow] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        selected && "ring-2 ring-primary/60",
        dragging && "pointer-events-none z-30 opacity-90 shadow-xl ring-2 ring-primary",
        sizeAnimating && "transition-[width] duration-300 ease-in-out motion-reduce:transition-none"
      )}
      style={{ width: Math.max(224, viewport.width * zoom + 2), order }}
      data-viewport-id={viewport.id}
      data-row-index={rowIndex}
      onPointerDown={selectCard}
      onFocus={selectCard}
      onKeyDown={selectCardFromKeyboard}
      tabIndex={0}
      aria-current={selected ? "true" : undefined}
      aria-label={`${viewport.name} viewport${selected ? ", selected" : ""}`}
    >
      <ViewportCardHeader
        viewport={viewport}
        reorderable={reorderable}
        dragging={dragging}
        onReorderStart={onReorderStart}
        onReorderMove={onReorderMove}
        onReorderFinish={onReorderFinish}
        onMoveWithKeyboard={moveCardWithKeyboard}
      />
      {observedURL && observedURL !== viewport.url && observedURL !== workspaceURL && <ObservedURL url={observedURL} />}
      <ViewportPreview viewport={viewport} zoom={zoom} animating={sizeAnimating} surfaceRef={surface} />
      <ViewportControls
        viewport={viewport}
        foldableOpen={foldableOpen}
        toggleFoldable={foldableNext ? toggleFoldable : undefined}
        onRotate={rotateViewport}
      />
      <ViewportStatusNotice url={observedURL ?? viewport.url} status={status?.status} detail={status?.detail} />
    </article>
  )
})

function ViewportCardHeader({
  viewport,
  reorderable,
  dragging,
  onReorderStart,
  onReorderMove,
  onReorderFinish,
  onMoveWithKeyboard,
}: {
  viewport: Viewport
  reorderable: boolean
  dragging: boolean
  onReorderStart: (event: ReactPointerEvent<HTMLElement>, id: string) => void
  onReorderMove: (event: ReactPointerEvent<HTMLElement>) => void
  onReorderFinish: (commit: boolean) => void
  onMoveWithKeyboard: (event: ReactKeyboardEvent<HTMLButtonElement>) => void
}) {
  const icon =
    viewport.category === "Mobile" ? SmartPhone01Icon : viewport.category === "Tablet" ? Tablet01Icon : ComputerIcon
  const landscape = viewport.width > viewport.height
  const iconRotated =
    viewport.category === "Mobile" || viewport.category === "Tablet" ? landscape : viewport.height > viewport.width

  return (
    <div
      className="viewport-card-header flex min-w-0 items-center gap-1 border-b border-border bg-accent px-2 py-1"
      data-reorderable={reorderable ? "true" : undefined}
      data-dragging={dragging ? "true" : undefined}
      onPointerDown={(event) => {
        if (!reorderable) return
        const target = event.target
        // Dimension editors and future header actions keep their normal behavior.
        if (
          target instanceof Element &&
          target.closest('input,textarea,select,a,[contenteditable="true"],button:not([data-viewport-drag-handle])')
        )
          return
        onReorderStart(event, viewport.id)
      }}
      onPointerMove={onReorderMove}
      onPointerUp={() => onReorderFinish(true)}
      onPointerCancel={() => onReorderFinish(false)}
      onLostPointerCapture={() => onReorderFinish(false)}
    >
      <div className="relative min-w-0 flex-1">
        {reorderable && (
          <button
            type="button"
            data-viewport-drag-handle
            className="viewport-drag-handle absolute top-0 left-0 flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-background hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            aria-label={`Reorder ${viewport.name}`}
            title="Drag the header to reorder. Drop below a row to create one. Arrow keys move devices; Escape cancels dragging."
            onKeyDown={onMoveWithKeyboard}
          >
            <HugeiconsIcon icon={DragDropVerticalIcon} size={14} strokeWidth={2} aria-hidden="true" />
          </button>
        )}
        <div className="viewport-card-identity flex min-w-0 items-center gap-1">
          <span className="flex size-6 shrink-0 items-center justify-center text-muted-foreground">
            <HugeiconsIcon
              icon={icon}
              size={16}
              strokeWidth={2}
              className={cn(
                "transition-transform duration-200",
                iconRotated && "rotate-90",
                landscape && "text-primary"
              )}
              aria-hidden="true"
            />
          </span>
          <h2 className="min-w-0 flex-1 truncate text-xs font-medium">{viewport.name}</h2>
        </div>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-0.5 text-xs text-muted-foreground">
        {viewport.category === "Custom" ? (
          <>
            <DimensionInput
              label={`${viewport.name} width`}
              value={viewport.width}
              onChange={(width) => useWorkspace.getState().update(viewport.id, { width })}
            />
            <HugeiconsIcon icon={MultiplicationSignIcon} size={12} strokeWidth={2} aria-hidden="true" />
            <DimensionInput
              label={`${viewport.name} height`}
              value={viewport.height}
              onChange={(height) => useWorkspace.getState().update(viewport.id, { height })}
            />
          </>
        ) : (
          <>
            <DimensionReadout label={`${viewport.name} width`} value={viewport.width} />
            <HugeiconsIcon icon={MultiplicationSignIcon} size={12} strokeWidth={2} aria-hidden="true" />
            <DimensionReadout label={`${viewport.name} height`} value={viewport.height} />
          </>
        )}
        <span>px</span>
      </div>
    </div>
  )
}

function ObservedURL({ url }: { url: string }) {
  return (
    <div
      className="h-5 shrink-0 truncate border-b border-border bg-muted/50 px-3 py-1 text-[10px] text-muted-foreground"
      title={url}
      aria-label={`Observed URL: ${url}`}
    >
      {url}
    </div>
  )
}

function ViewportPreview({
  viewport,
  zoom,
  animating,
  surfaceRef,
}: {
  viewport: Viewport
  zoom: number
  animating: boolean
  surfaceRef: RefObject<HTMLDivElement | null>
}) {
  return (
    <div className="flex justify-center overflow-clip bg-muted/50">
      <div
        className={cn(
          "relative shrink-0 overflow-clip bg-white",
          animating && "transition-[width,height] duration-300 ease-in-out motion-reduce:transition-none"
        )}
        ref={surfaceRef}
        style={{ width: viewport.width * zoom, height: viewport.height * zoom }}
      >
        <ViewportFrame key={viewport.revision} viewport={viewport} zoom={zoom} />
        {viewport.category === "Custom" && <CustomViewportResizeHandle viewport={viewport} zoom={zoom} />}
      </div>
    </div>
  )
}

function CustomViewportResizeHandle({ viewport, zoom }: { viewport: Viewport; zoom: number }) {
  const resizeStart = useRef<{ pointerId: number; x: number; y: number; width: number; height: number } | null>(null)
  const pendingSize = useRef<{ width: number; height: number } | null>(null)
  const animationFrame = useRef<number | null>(null)
  const instructionsId = `resize-${viewport.id}`

  useEffect(
    () => () => {
      if (animationFrame.current !== null) cancelAnimationFrame(animationFrame.current)
    },
    []
  )

  function flushResize() {
    if (animationFrame.current !== null) cancelAnimationFrame(animationFrame.current)
    animationFrame.current = null
    const size = pendingSize.current
    pendingSize.current = null
    if (size) useWorkspace.getState().update(viewport.id, size)
  }

  function startResize(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    useWorkspace.setState({ selected: viewport.id })
    resizeStart.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      width: viewport.width,
      height: viewport.height,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function resize(event: ReactPointerEvent<HTMLButtonElement>) {
    const start = resizeStart.current
    if (!start || start.pointerId !== event.pointerId) return
    pendingSize.current = {
      width: Math.round(start.width + (event.clientX - start.x) / zoom),
      height: Math.round(start.height + (event.clientY - start.y) / zoom),
    }
    if (animationFrame.current === null) animationFrame.current = requestAnimationFrame(flushResize)
  }

  function finishResize(event: ReactPointerEvent<HTMLButtonElement>) {
    if (resizeStart.current?.pointerId !== event.pointerId) return
    flushResize()
    resizeStart.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId)
  }

  function resizeWithKeyboard(event: ReactKeyboardEvent<HTMLButtonElement>) {
    const step = event.shiftKey ? 100 : 10
    const sizes = {
      ArrowRight: { width: viewport.width + step },
      ArrowLeft: { width: viewport.width - step },
      ArrowDown: { height: viewport.height + step },
      ArrowUp: { height: viewport.height - step },
    }
    const size = sizes[event.key as keyof typeof sizes]
    if (!size) return
    event.preventDefault()
    event.stopPropagation()
    useWorkspace.getState().update(viewport.id, size)
  }

  function clearResize() {
    flushResize()
    resizeStart.current = null
  }

  return (
    <>
      <span id={instructionsId} className="sr-only">
        Drag to resize, or use arrow keys for 10 pixel steps. Hold Shift for 100 pixel steps.
      </span>
      <button
        type="button"
        className="absolute right-0 bottom-0 z-10 flex size-6 cursor-nwse-resize touch-none items-end justify-end rounded-tl border-t border-l border-border bg-background/90 p-1 text-muted-foreground shadow-sm hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        aria-label={`Resize ${viewport.name}`}
        aria-describedby={instructionsId}
        title="Drag to resize; use arrow keys to adjust dimensions"
        onPointerDown={startResize}
        onPointerMove={resize}
        onPointerUp={finishResize}
        onPointerCancel={finishResize}
        onLostPointerCapture={clearResize}
        onKeyDown={resizeWithKeyboard}
      >
        <HugeiconsIcon icon={ResizeFieldIcon} size={14} strokeWidth={2} aria-hidden="true" />
      </button>
    </>
  )
}

function ViewportStatusNotice({ url, status, detail }: { url: string; status?: FrameStatus; detail?: string }) {
  const currentStatus = url ? (status ?? "loading") : "sample"
  if (currentStatus !== "unverified" && currentStatus !== "error" && currentStatus !== "blocked") return null

  return (
    <div className="flex gap-2 border-t border-border bg-muted/50 p-3 text-xs text-muted-foreground">
      <HugeiconsIcon icon={InformationCircleIcon} size={14} strokeWidth={2} aria-hidden="true" />
      <div>
        <strong className="text-foreground">
          {currentStatus === "blocked"
            ? "Preview blocked"
            : currentStatus === "error"
              ? "Preview unavailable"
              : "Interactions unavailable"}
        </strong>
        <p className="mt-1 leading-relaxed">
          {detail ??
            "Interactions connect automatically. If they remain unavailable, check ViewportStudio’s site access in Chrome’s extension settings."}
        </p>
        <TooltipHint content="Open preview in a browser tab">
          <button
            className="mt-2 inline-flex items-center gap-1 text-primary hover:underline"
            onClick={() => void openExternal(url)}
          >
            Open in a tab <HugeiconsIcon icon={LinkSquare02Icon} size={11} strokeWidth={2} aria-hidden="true" />
          </button>
        </TooltipHint>
      </div>
    </div>
  )
}
