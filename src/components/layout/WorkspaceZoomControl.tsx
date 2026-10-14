import { Slider } from "@/components/ui/slider"
import { useWorkspace } from "@/stores/workspace"

export function WorkspaceZoomControl() {
  const workspaceZoom = useWorkspace((state) => state.workspaceZoom)

  function handleZoomChange(value: number) {
    useWorkspace.setState({ workspaceZoom: value })
  }

  return (
    <div className="flex h-9 w-54 shrink-0 items-center rounded-lg border border-border bg-background px-2">
      <span className="w-10 shrink-0 text-xs text-muted-foreground">Zoom</span>
      <Slider
        aria-label="Workspace zoom"
        className="min-w-0 flex-1"
        min={50}
        max={100}
        step={1}
        value={workspaceZoom}
        onValueChange={handleZoomChange}
      />
      <span className="w-10 shrink-0 text-right text-xs text-muted-foreground tabular-nums">{workspaceZoom}%</span>
    </div>
  )
}
