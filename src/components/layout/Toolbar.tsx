import { useState } from "react"
import {
  Add01Icon,
  ArrowDataTransferHorizontalIcon,
  Cancel01Icon,
  InformationCircleIcon,
  RefreshIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "cn"
import { EmbedPolicyControl } from "@/components/layout/EmbedPolicyControl"
import { ViewportLayoutControl } from "@/components/layout/ViewportLayoutControl"
import { WorkspaceZoomControl } from "@/components/layout/WorkspaceZoomControl"
import { Button } from "@/components/ui/button"
import { MAX_VIEWPORTS, useWorkspace } from "@/stores/workspace"
import { errorText, isExtension } from "@/utils/browser"

export function Toolbar({ addDevice, openInformation }: { addDevice: () => void; openInformation: () => void }) {
  const url = useWorkspace((state) => state.url)
  const syncEnabled = useWorkspace((state) => state.sync.enabled)
  const viewportCount = useWorkspace((state) => state.viewports.length)
  const [closing, setClosing] = useState(false)

  function reloadViewports() {
    useWorkspace.getState().reload()
  }

  function toggleSync() {
    useWorkspace.setState({ sync: { enabled: !syncEnabled } })
  }

  async function closeWorkspace() {
    if (closing) return
    const host = document.getElementById("__viewportstudio_host") as
      (HTMLDivElement & { __vsUnmount?: () => void }) | null
    if (host) {
      if (!isExtension()) {
        host.__vsUnmount?.()
        host.remove()
        return
      }
      setClosing(true)
      try {
        const response = await chrome.runtime.sendMessage({ type: "viewportstudio:close-workspace" })
        if (response?.error) throw new Error(response.error)
      } catch (error) {
        useWorkspace.setState({ notice: `Could not close workspace: ${errorText(error)}` })
      } finally {
        if (host.isConnected) setClosing(false)
      }
      return
    }
    window.close()
  }

  return (
    <header className="flex min-h-14 shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-card px-4 py-1.5 shadow-sm">
      <div className="flex items-center gap-1.5" role="group" aria-label="Workspace">
        <span className="grid size-7 grid-cols-2 gap-1 rounded-lg bg-primary p-1.5">
          <i className="rounded-sm bg-primary-foreground" />
          <i className="rounded-sm bg-primary-foreground/60" />
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="size-9 rounded-lg"
          aria-label="Reload all viewports"
          title="Reload all viewports"
          disabled={!url}
          onClick={reloadViewports}
        >
          <HugeiconsIcon icon={RefreshIcon} size={15} strokeWidth={2} aria-hidden="true" />
        </Button>
      </div>
      <span className="hidden h-7 w-px bg-border sm:block" aria-hidden="true" />
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Viewport controls">
        <Button
          title={
            viewportCount >= MAX_VIEWPORTS ? `Maximum of ${MAX_VIEWPORTS} viewports reached` : "Add a viewport device"
          }
          disabled={viewportCount >= MAX_VIEWPORTS}
          className="h-9 rounded-lg px-3 text-xs"
          onClick={addDevice}
        >
          <HugeiconsIcon icon={Add01Icon} size={16} strokeWidth={2} aria-hidden="true" />
          <span>Device</span>
        </Button>
        <ViewportLayoutControl />
        <WorkspaceZoomControl />
      </div>
      <div
        className="ml-auto flex items-center gap-0.5 border-l border-border pl-2"
        role="group"
        aria-label="Workspace actions"
      >
        <div className="flex items-center gap-0.5" role="group" aria-label="Preview options">
          <Button
            variant="ghost"
            size="icon"
            className={cn("size-9 rounded-lg", syncEnabled ? "text-primary" : "text-muted-foreground")}
            aria-label={`Synchronization ${syncEnabled ? "on" : "off"}`}
            title={`Synchronize all previews ${syncEnabled ? "on" : "off"}`}
            aria-pressed={syncEnabled}
            onClick={toggleSync}
          >
            <HugeiconsIcon icon={ArrowDataTransferHorizontalIcon} size={15} strokeWidth={2} aria-hidden="true" />
          </Button>
          <EmbedPolicyControl />
        </div>
        <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
        <Button
          variant="ghost"
          size="icon"
          className="size-9 rounded-lg"
          aria-label="Information"
          title="Information"
          onClick={openInformation}
        >
          <HugeiconsIcon icon={InformationCircleIcon} size={16} strokeWidth={2} aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-9 rounded-lg"
          aria-label="Close workspace"
          title="Close workspace"
          disabled={closing}
          onClick={() => void closeWorkspace()}
        >
          <HugeiconsIcon icon={Cancel01Icon} size={16} strokeWidth={2} aria-hidden="true" />
        </Button>
      </div>
    </header>
  )
}
