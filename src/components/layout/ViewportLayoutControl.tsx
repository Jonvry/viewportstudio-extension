import { Suspense, lazy } from "react"
import { ComputerIcon, Layout3ColumnIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { useWorkspace } from "@/stores/workspace"

const FocusedViewportPicker = lazy(() => import("@/components/layout/FocusedViewportPicker"))

const layouts = [
  { value: "horizontal", label: "Horizontal layout", icon: Layout3ColumnIcon },
  { value: "focus", label: "Focus selected viewport", icon: ComputerIcon },
] as const

export function ViewportLayoutControl() {
  const layout = useWorkspace((state) => state.layout)
  const viewports = useWorkspace((state) => state.viewports)
  const selected = useWorkspace((state) => state.selected)
  const setLayout = useWorkspace((state) => state.setLayout)

  return (
    <>
      <div
        className="flex h-9 items-center gap-0.5 rounded-lg border border-border bg-muted/60 p-0.5"
        aria-label="Viewport layout"
        role="group"
      >
        {layouts.map(({ value, label, icon }) => (
          <Button
            key={value}
            variant="ghost"
            size="icon"
            className={cn(
              "size-8 rounded-[calc(var(--radius)-3px)] p-0",
              layout === value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
            )}
            aria-label={label}
            title={label}
            aria-pressed={layout === value}
            disabled={value === "focus" && viewports.length === 0}
            onClick={() => setLayout(value)}
          >
            <HugeiconsIcon icon={icon} size={16} strokeWidth={2} aria-hidden="true" />
          </Button>
        ))}
      </div>
      {layout === "focus" && viewports.length > 0 && (
        <Suspense
          fallback={
            <span
              role="status"
              className="flex h-9 max-w-64 min-w-24 items-center rounded-lg border border-border bg-background px-2 text-xs text-muted-foreground"
            >
              Loading devices…
            </span>
          }
        >
          <FocusedViewportPicker viewports={viewports} selected={selected} />
        </Suspense>
      )}
    </>
  )
}
