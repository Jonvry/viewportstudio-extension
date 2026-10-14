import { cn } from "cn"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useWorkspace } from "@/stores/workspace"
import type { Viewport } from "@/types"

export default function FocusedViewportPicker({ viewports, selected }: { viewports: Viewport[]; selected: string }) {
  const focused = viewports.find((viewport) => viewport.id === selected) ?? viewports[0]

  function selectViewport(value: string | null) {
    if (value) useWorkspace.setState({ selected: value })
  }

  return (
    <Select value={focused.id} onValueChange={selectViewport}>
      <SelectTrigger
        aria-label={`Focused viewport: ${focused.name}, ${focused.width} by ${focused.height} pixels`}
        className="h-9 max-w-64 min-w-24 rounded-lg border-border bg-background px-2 text-xs font-medium"
      >
        <SelectValue className="min-w-0 truncate">
          {focused.name} · {focused.width} × {focused.height}
        </SelectValue>
      </SelectTrigger>
      <SelectContent
        align="start"
        alignItemWithTrigger={false}
        aria-label="Choose focused viewport"
        className="max-h-[min(20rem,var(--available-height))] w-[min(16rem,calc(100vw-2rem))] rounded-lg p-1"
      >
        {viewports.map((viewport) => (
          <SelectItem
            key={viewport.id}
            value={viewport.id}
            className="min-w-0 rounded-md px-2.5 py-2 text-xs data-[selected]:bg-accent data-[selected]:text-primary"
          >
            <span className="min-w-0 flex-1 whitespace-normal">
              <span className={cn("block truncate font-medium", viewport.id === focused.id && "!text-primary")}>
                {viewport.name}
              </span>
              <span
                className={cn("block text-xs text-muted-foreground", viewport.id === focused.id && "!text-foreground")}
              >
                {viewport.width} × {viewport.height} px
              </span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
