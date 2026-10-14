import { useEffect, useEffectEvent, useState } from "react"
import {
  Add01Icon,
  Cancel01Icon,
  FoldHorizontalIcon,
  MinusSignIcon,
  ScreenRotationIcon,
  UnfoldHorizontalIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@/components/ui/button"
import { TooltipHint } from "@/components/ui/tooltip"
import { adjacentZoomLevel, maxViewportZoom, minViewportZoom } from "@/features/viewport-management/devices"
import { useWorkspace } from "@/stores/workspace"
import type { Viewport } from "@/types"

export function ViewportControls({
  viewport: v,
  foldableOpen,
  toggleFoldable,
  onRotate,
}: {
  viewport: Viewport
  foldableOpen: boolean
  toggleFoldable?: () => void
  onRotate: () => void
}) {
  const update = useWorkspace((s) => s.update)
  function setZoom(zoom: number) {
    update(v.id, { zoom })
  }
  const minimumZoom = minViewportZoom()
  const maximumZoom = maxViewportZoom()
  const atMinZoom = v.zoom <= minimumZoom
  const atMaxZoom = v.zoom >= maximumZoom
  const foldableName = v.name.replace(/ \(.+\)$/, "")
  return (
    <div className="flex flex-nowrap items-center justify-between gap-1 border-t border-border bg-accent px-1 py-0.5 text-muted-foreground">
      <div className="flex shrink-0 items-center">
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label={`Zoom out ${v.name}`}
          title={atMinZoom ? `Minimum zoom: ${minimumZoom * 100}%` : `Zoom out ${v.name}`}
          disabled={atMinZoom}
          onClick={() => setZoom(adjacentZoomLevel(v.zoom, -1))}
        >
          <HugeiconsIcon icon={MinusSignIcon} size={13} strokeWidth={2} aria-hidden="true" />
        </Button>
        <TooltipHint content="Reset zoom to 100%">
          <button
            className="min-h-7 min-w-9 rounded text-xs text-muted-foreground tabular-nums hover:bg-accent hover:text-accent-foreground"
            aria-label={`Reset ${v.name} zoom to 100%`}
            onClick={() => setZoom(1)}
          >
            {Math.round(v.zoom * 100)}%
          </button>
        </TooltipHint>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label={`Zoom in ${v.name}`}
          title={atMaxZoom ? `Maximum zoom: ${maximumZoom * 100}%` : `Zoom in ${v.name}`}
          disabled={atMaxZoom}
          onClick={() => setZoom(adjacentZoomLevel(v.zoom, 1))}
        >
          <HugeiconsIcon icon={Add01Icon} size={13} strokeWidth={2} aria-hidden="true" />
        </Button>
      </div>
      <div className="flex shrink-0 items-center">
        {toggleFoldable && (
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label={foldableOpen ? `Fold ${foldableName}` : `Unfold ${foldableName}`}
            title={foldableOpen ? "Fold to cover screen" : "Open inner screen"}
            onClick={toggleFoldable}
          >
            <HugeiconsIcon
              icon={foldableOpen ? FoldHorizontalIcon : UnfoldHorizontalIcon}
              size={16}
              strokeWidth={2}
              aria-hidden="true"
            />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label={`Rotate ${v.name}`}
          title={`Rotate ${v.name}`}
          onClick={onRotate}
        >
          <HugeiconsIcon icon={ScreenRotationIcon} size={16} strokeWidth={2} aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label={`Remove ${v.name}`}
          title={`Remove ${v.name}`}
          onClick={() => useWorkspace.getState().remove(v.id)}
        >
          <HugeiconsIcon icon={Cancel01Icon} size={14} strokeWidth={2} aria-hidden="true" />
        </Button>
      </div>
    </div>
  )
}
export function DimensionInput({
  value,
  label,
  onChange,
}: {
  value: number
  label: string
  onChange: (value: number) => void
}) {
  const commitDimension = useEffectEvent(onChange)
  const [draft, setDraft] = useState(String(value))
  const [editing, setEditing] = useState(false)
  const [previousValue, setPreviousValue] = useState(value)
  if (value !== previousValue) {
    setPreviousValue(value)
    setDraft(String(value))
  }
  useEffect(() => {
    if (!editing) return
    const n = Number(draft)
    if (!Number.isInteger(n) || n < 240 || n > 3840 || n === value) return
    const timer = setTimeout(() => commitDimension(n), 350)
    return () => clearTimeout(timer)
  }, [draft, editing, value])
  return (
    <input
      className="w-[6ch] [appearance:textfield] rounded-md border border-input bg-background py-0.5 pr-1 pl-1.5 text-center text-xs text-foreground tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      type="number"
      aria-label={label}
      title={`${label} (240–3840 px)`}
      min={240}
      max={3840}
      value={draft}
      onFocus={() => setEditing(true)}
      onChange={(e) => {
        setDraft(e.target.value)
        setEditing(true)
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur()
        if (event.key === "Escape") {
          event.stopPropagation()
          setDraft(String(value))
          setEditing(false)
        }
      }}
      onBlur={() => {
        const n = Number(draft)
        if (Number.isInteger(n) && n >= 240 && n <= 3840) onChange(n)
        else setDraft(String(value))
        setEditing(false)
      }}
    />
  )
}

export function DimensionReadout({ value, label }: { value: number; label: string }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded text-xs text-muted-foreground tabular-nums"
      aria-label={`${label}: ${value} pixels`}
      title={`${label}: ${value} px`}
    >
      {value}
    </span>
  )
}
