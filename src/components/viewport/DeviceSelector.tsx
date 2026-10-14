import { useMemo, useRef, useState } from "react"
import {
  Add01Icon,
  Cancel01Icon,
  ComputerIcon,
  MultiplicationSignIcon,
  ResizeFieldIcon,
  Search01Icon,
  SmartPhone01Icon,
  Tablet01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogOverlay, DialogPopup, DialogPortal, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { TooltipHint } from "@/components/ui/tooltip"
import { devices } from "@/features/viewport-management/devices"
import { MAX_VIEWPORTS, useWorkspace } from "@/stores/workspace"
import type { Device } from "@/types"

const latestDeviceLimit: Record<Device["category"], number> = {
  Mobile: 6,
  Tablet: 3,
  Desktop: 4,
  Custom: 4,
}

function latestDevices(devices: Device[]) {
  const byCategory = new Map<Device["category"], Device[]>()
  for (const device of devices) {
    const group = byCategory.get(device.category)
    if (group) group.push(device)
    else byCategory.set(device.category, [device])
  }
  return [...byCategory.values()].flatMap((group) => group.slice(-latestDeviceLimit[group[0].category]).reverse())
}

export default function DeviceSelector({ onClose }: { onClose: () => void }) {
  const [custom, setCustom] = useState(false)
  const [category, setCategory] = useState("All")
  const [search, setSearch] = useState("")
  const [expandedBrands, setExpandedBrands] = useState<Set<string>>(() => new Set())
  const [name, setName] = useState("Custom viewport")
  const [width, setWidth] = useState("1280")
  const [height, setHeight] = useState("800")
  const searchInput = useRef<HTMLInputElement>(null)
  const viewportCount = useWorkspace((state) => state.viewports.length)
  const atCapacity = viewportCount >= MAX_VIEWPORTS
  const shadowRoot =
    typeof document === "undefined" ? undefined : document.getElementById("__viewportstudio_host")?.shadowRoot
  const filteredDevices = useMemo(
    () =>
      devices.filter(
        (device) =>
          (category === "All" || device.category === category) &&
          device.name.toLowerCase().includes(search.trim().toLowerCase())
      ),
    [category, search]
  )
  const groupedDevices = useMemo(() => {
    const groups = new Map<string, typeof devices>()

    for (const device of filteredDevices) {
      const brand = /^(iPhone|iPad|MacBook|iMac)/.test(device.name)
        ? "Apple"
        : device.name.startsWith("Google Pixel")
          ? "Google"
          : device.name.startsWith("Samsung ")
            ? "Samsung"
            : "Other"

      const group = groups.get(brand)
      if (group) group.push(device)
      else groups.set(brand, [device])
    }

    return [...groups]
  }, [filteredDevices])
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogPortal container={shadowRoot}>
        <DialogOverlay className="z-40 bg-black/55 backdrop-blur-[2px]" />
        <DialogPopup
          initialFocus={(interaction) => (interaction === "touch" ? true : searchInput.current)}
          className="fixed top-1/2 left-1/2 z-50 flex max-h-[min(760px,calc(100dvh-2rem))] min-h-[min(520px,calc(100dvh-2rem))] w-[min(520px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-hidden rounded-xl border border-border bg-popover p-5 text-sm text-popover-foreground shadow-2xl outline-none"
          aria-labelledby="add-viewport-dialog-title"
        >
          <div className="flex items-center justify-between border-b border-border pb-3">
            <DialogTitle id="add-viewport-dialog-title">Add a viewport</DialogTitle>
            <DialogClose
              aria-label="Close dialog"
              render={<Button variant="ghost" size="icon" className="size-8" title="Close dialog" />}
            >
              <HugeiconsIcon icon={Cancel01Icon} size={18} strokeWidth={2} aria-hidden="true" />
            </DialogClose>
          </div>
          <div className="workspace-dialog-scrollbar -mr-5 min-h-0 flex-1 space-y-4 overflow-y-auto pr-5">
            <div className="flex flex-col gap-3">
              <div className="relative">
                <HugeiconsIcon
                  icon={Search01Icon}
                  size={17}
                  strokeWidth={2}
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  ref={searchInput}
                  type="search"
                  aria-label="Search devices"
                  placeholder="Search devices…"
                  maxLength={100}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="h-10 border-2 bg-card pr-10 pl-9 shadow-none focus-visible:border-primary focus-visible:ring-0 [&::-webkit-search-cancel-button]:appearance-none"
                />
                {search && (
                  <button
                    type="button"
                    aria-label="Clear device search"
                    className="absolute top-1/2 right-1.5 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    onClick={() => {
                      setSearch("")
                      searchInput.current?.focus()
                    }}
                  >
                    <HugeiconsIcon icon={Cancel01Icon} size={14} strokeWidth={2} aria-hidden="true" />
                  </button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div
                  className="grid h-10 min-w-[min(100%,16rem)] flex-1 grid-cols-4 gap-1 rounded-lg border border-border/60 bg-muted/70 p-1"
                  role="group"
                  aria-label="Device category"
                >
                  {["All", "Mobile", "Tablet", "Desktop"].map((item) => (
                    <button
                      key={item}
                      type="button"
                      className={cn(
                        "flex h-full items-center justify-center rounded-md px-2 text-xs font-medium transition-colors",
                        !custom && category === item
                          ? "bg-card text-primary shadow-sm ring-1 ring-border/70"
                          : "text-muted-foreground hover:bg-card/70 hover:text-foreground"
                      )}
                      aria-pressed={!custom && category === item}
                      onClick={() => {
                        setCategory(item)
                        setCustom(false)
                      }}
                    >
                      {item}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className={cn(
                    "inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors",
                    custom
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                  )}
                  aria-pressed={custom}
                  onClick={() => setCustom(true)}
                >
                  <HugeiconsIcon icon={ResizeFieldIcon} size={15} strokeWidth={2} aria-hidden="true" />
                  Custom dimensions
                </button>
              </div>
            </div>
            {custom ? (
              <form
                id="custom-viewport-form"
                className="flex flex-col gap-3 [&_label]:flex [&_label]:min-w-0 [&_label]:flex-1 [&_label]:flex-col [&_label]:gap-1.5 [&_label]:text-xs [&_label]:font-medium"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (atCapacity) return
                  useWorkspace.getState().add({
                    name: name.trim() || "Custom viewport",
                    width: Number(width),
                    height: Number(height),
                    category: "Custom",
                  })
                  onClose()
                }}
              >
                <label>
                  Name
                  <Input
                    className="h-10 border-2 bg-card shadow-none focus-visible:border-primary focus-visible:ring-0"
                    required
                    maxLength={60}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <div className="grid grid-cols-[minmax(0,1fr)_1.5rem_minmax(0,1fr)] items-end gap-2">
                  <label>
                    Width, px
                    <Input
                      className="h-10 border-2 bg-card text-center tabular-nums shadow-none focus-visible:border-primary focus-visible:ring-0"
                      type="number"
                      min={240}
                      max={3840}
                      required
                      value={width}
                      onChange={(e) => setWidth(e.target.value)}
                    />
                  </label>
                  <span className="flex h-10 items-center justify-center text-muted-foreground" aria-hidden="true">
                    <HugeiconsIcon icon={MultiplicationSignIcon} size={14} strokeWidth={2} />
                  </span>
                  <label>
                    Height, px
                    <Input
                      className="h-10 border-2 bg-card text-center tabular-nums shadow-none focus-visible:border-primary focus-visible:ring-0"
                      type="number"
                      min={240}
                      max={3840}
                      required
                      value={height}
                      onChange={(e) => setHeight(e.target.value)}
                    />
                  </label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Dimensions define the actual CSS viewport, independent of zoom.
                </p>
              </form>
            ) : groupedDevices.length > 0 ? (
              <div className="space-y-4">
                {groupedDevices.map(([brand, brandDevices]) => {
                  const latest = latestDevices(brandDevices)
                  const expanded = expandedBrands.has(brand)
                  const showingAll = expanded || Boolean(search.trim())
                  const visibleDevices = showingAll ? [...brandDevices].reverse() : latest
                  const hiddenCount = brandDevices.length - latest.length

                  return (
                    <section key={brand} className="space-y-1.5" aria-label={`${brand} devices`}>
                      <h3 className="px-1 text-xs font-medium text-muted-foreground">{brand}</h3>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {visibleDevices.map((d) => {
                          const icon =
                            d.category === "Mobile"
                              ? SmartPhone01Icon
                              : d.category === "Tablet"
                                ? Tablet01Icon
                                : ComputerIcon
                          return (
                            <TooltipHint content={`Add ${d.name} (${d.width} × ${d.height})`} key={d.name}>
                              <button
                                type="button"
                                disabled={atCapacity}
                                aria-label={`Add ${d.name}, ${d.width} by ${d.height} pixels`}
                                className="flex w-full min-w-0 items-center gap-2 rounded-md border border-transparent px-2.5 py-2.5 text-left text-muted-foreground hover:border-border hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
                                onClick={() => {
                                  useWorkspace.getState().add(d)
                                  onClose()
                                }}
                              >
                                <HugeiconsIcon icon={icon} size={19} strokeWidth={2} aria-hidden="true" />
                                <span className="min-w-0 flex-1">
                                  <strong className="block truncate text-xs font-medium text-foreground">
                                    {d.name}
                                  </strong>
                                  <small className="mt-0.5 block truncate text-xs text-muted-foreground">
                                    {d.width} × {d.height} · {d.category}
                                  </small>
                                </span>
                                <HugeiconsIcon icon={Add01Icon} size={15} strokeWidth={2} aria-hidden="true" />
                              </button>
                            </TooltipHint>
                          )
                        })}
                      </div>
                      {hiddenCount > 0 && !search.trim() && (
                        <button
                          type="button"
                          className="px-2.5 py-1 text-xs font-medium text-primary hover:underline"
                          aria-expanded={expanded}
                          onClick={() =>
                            setExpandedBrands((previous) => {
                              const next = new Set(previous)
                              if (next.has(brand)) next.delete(brand)
                              else next.add(brand)
                              return next
                            })
                          }
                        >
                          {expanded ? "Show fewer devices" : `Show ${hiddenCount} older devices`}
                        </button>
                      )}
                    </section>
                  )
                })}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">No devices match that search.</p>
            )}
          </div>
          <p role="status" aria-live="polite" aria-atomic="true" className="text-xs text-muted-foreground">
            {atCapacity
              ? `All ${MAX_VIEWPORTS} slots are in use. Remove a viewport to add another.`
              : custom
                ? `${viewportCount} of ${MAX_VIEWPORTS} viewport slots in use.`
                : `${filteredDevices.length} devices available · ${viewportCount} of ${MAX_VIEWPORTS} slots in use.`}
          </p>
          {custom && (
            <div className="border-t border-border pt-3">
              <Button
                type="submit"
                disabled={atCapacity}
                form="custom-viewport-form"
                title="Add custom viewport"
                className="w-full rounded-lg"
              >
                <HugeiconsIcon icon={Add01Icon} size={16} strokeWidth={2} aria-hidden="true" />
                Add custom viewport
              </Button>
            </div>
          )}
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  )
}
