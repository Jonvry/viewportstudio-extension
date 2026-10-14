import { useEffect, useState } from "react"
import { Cancel01Icon, InformationCircleIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Toolbar } from "@/components/layout/Toolbar"
import { TooltipHint } from "@/components/ui/tooltip"
import DeviceSelector from "@/components/viewport/DeviceSelector"
import { ViewportGrid } from "@/components/viewport/ViewportGrid"
import InformationDialog from "@/features/information/InformationDialog"
import { connectWorkspace } from "@/features/synchronization/bridge"
import { useShortcuts } from "@/hooks/useShortcuts"
import { flushWorkspace, initializeWorkspace, useWorkspace } from "@/stores/workspace"

export default function App({
  initialURL,
}: {
  initialURL?: string
} = {}) {
  const ready = useWorkspace((s) => s.ready)
  const notice = useWorkspace((s) => s.notice)
  const announcement = useWorkspace((s) => s.announcement)
  const [dialog, setDialog] = useState<"devices" | "information" | null>(null)
  useEffect(() => {
    void initializeWorkspace(initialURL)
  }, [initialURL])
  useEffect(() => {
    if (ready) return connectWorkspace()
  }, [ready])
  useEffect(() => {
    if (!ready) return
    window.addEventListener("pagehide", flushWorkspace)
    return () => {
      window.removeEventListener("pagehide", flushWorkspace)
      flushWorkspace()
    }
  }, [ready])
  useShortcuts()
  if (!ready)
    return (
      <div role="status" className="flex h-dvh items-center justify-center gap-3 bg-background">
        <span className="grid size-8 grid-cols-2 gap-1 rounded-lg bg-primary p-1.5">
          <i className="rounded-sm bg-primary-foreground" />
          <i className="rounded-sm bg-primary-foreground/60" />
        </span>
        Opening your workspace…
      </div>
    )
  return (
    <div className="flex h-svh min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <a
        href="#viewport-workspace"
        onClick={(event) => {
          event.preventDefault()
          const root = event.currentTarget.getRootNode() as Document | ShadowRoot
          root.getElementById("viewport-workspace")?.focus()
        }}
        className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to previews
      </a>
      <Toolbar addDevice={() => setDialog("devices")} openInformation={() => setDialog("information")} />
      <ViewportGrid addDevice={() => setDialog("devices")} />
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {notice}
      </div>
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>
      {notice && (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-end justify-center p-4">
          <div className="pointer-events-auto flex max-w-[min(36rem,calc(100vw-2rem))] items-center gap-3 rounded-lg border border-border bg-popover px-4 py-3 text-sm text-popover-foreground shadow-lg">
            <HugeiconsIcon
              className="shrink-0"
              icon={InformationCircleIcon}
              size={18}
              strokeWidth={2}
              aria-hidden="true"
            />
            <span>{notice}</span>
            <TooltipHint content="Dismiss notification">
              <button
                className="shrink-0 rounded p-1 hover:bg-accent"
                aria-label="Dismiss notification"
                onClick={() => useWorkspace.setState({ notice: "" })}
              >
                <HugeiconsIcon icon={Cancel01Icon} size={16} strokeWidth={2} aria-hidden="true" />
              </button>
            </TooltipHint>
          </div>
        </div>
      )}
      {dialog === "devices" && <DeviceSelector onClose={() => setDialog(null)} />}
      {dialog === "information" && <InformationDialog onClose={() => setDialog(null)} />}
    </div>
  )
}
