import { create } from "zustand"
import { normalizeUrl } from "@/features/navigation/url"
import { arrangeViewports, moveViewport, viewportRows } from "@/features/viewport-management/arrangement"
import { defaultViewportZoom, devices, dimension, zoomLevel } from "@/features/viewport-management/devices"
import type { Device, FrameStatus, SyncSettings, Viewport } from "@/types"
import { errorText, isExtension } from "@/utils/browser"

interface Workspace {
  ready: boolean
  previewReady: boolean
  embedEnabled: boolean
  previewColorScheme: string
  url: string
  observedUrls: Record<string, string>
  viewports: Viewport[]
  selected: string
  layout: "horizontal" | "focus"
  workspaceZoom: number
  sync: SyncSettings
  statuses: Record<string, { status: FrameStatus; detail?: string }>
  notice: string
  announcement: string
  navigate: (url: string, source?: string) => void
  reload: (id?: string) => void
  add: (device: Device) => void
  remove: (id: string) => void
  reorder: (id: string, targetId: string, position: "before" | "after") => void
  arrange: (rows: string[][], movedId?: string) => void
  setLayout: (layout: Workspace["layout"]) => void
  update: (id: string, patch: Partial<Pick<Viewport, "name" | "width" | "height" | "zoom">>) => void
  setStatus: (id: string, status: FrameStatus, detail?: string) => void
}
export const MAX_VIEWPORTS = 12
const initial = [devices[1], devices[4], devices[8]].map((device, i) => ({
  ...device,
  id: `viewport-${i}`,
  zoom: defaultViewportZoom(device.category),
  url: "",
  revision: 0,
  row: 0,
}))
export const useWorkspace = create<Workspace>((set) => ({
  ready: false,
  previewReady: !isExtension(),
  embedEnabled: false,
  previewColorScheme: "normal",
  url: "",
  observedUrls: {},
  viewports: initial,
  selected: initial[0].id,
  layout: "horizontal",
  workspaceZoom: 100,
  sync: { enabled: true },
  statuses: {},
  notice: "",
  announcement: "",
  navigate: (input, source) => {
    const url = normalizeUrl(input)
    set((s) => ({
      url,
      viewports: s.viewports.map((v) => (v.url === url ? v : { ...v, url })),
      observedUrls: source ? { [source]: url } : {},
      statuses: source ? { [source]: s.statuses[source] ?? { status: "loading" } } : {},
    }))
  },
  reload: (id) =>
    set((s) => ({
      statuses: id ? { ...s.statuses, [id]: { status: "loading" } } : {},
      observedUrls: id ? s.observedUrls : {},
      viewports: s.viewports.map((v) =>
        !id || v.id === id
          ? { ...v, url: id ? (s.observedUrls[id] ?? v.url) : s.url || v.url, revision: v.revision + 1 }
          : v
      ),
    })),
  add: (device) =>
    set((s) => {
      if (s.viewports.length >= MAX_VIEWPORTS)
        return {
          notice: "A workspace supports up to 12 viewports to keep memory usage manageable.",
        }
      const id = crypto.randomUUID()
      return {
        selected: id,
        viewports: [
          ...s.viewports,
          {
            ...device,
            width: dimension(device.width),
            height: dimension(device.height),
            id,
            zoom: defaultViewportZoom(device.category),
            url: s.url,
            revision: 0,
            row: s.viewports.at(-1)?.row ?? 0,
          },
        ],
      }
    }),
  remove: (id) =>
    set((s) => {
      const index = s.viewports.findIndex((v) => v.id === id)
      if (index === -1) return s
      const viewports = s.viewports.filter((v) => v.id !== id)
      const statuses = { ...s.statuses }
      const observedUrls = { ...s.observedUrls }
      delete statuses[id]
      delete observedUrls[id]
      return {
        viewports,
        statuses,
        observedUrls,
        selected: s.selected === id ? (viewports[Math.min(index, viewports.length - 1)]?.id ?? "") : s.selected,
      }
    }),
  reorder(id, targetId, position) {
    set((s) => {
      if (id === targetId) return s
      const rows = viewportRows(s.viewports)
      const row = rows.findIndex((items) => items.includes(targetId))
      const source = s.viewports.find((viewport) => viewport.id === id)
      if (!source || row === -1) return s
      const index = rows[row].filter((item) => item !== id).indexOf(targetId) + Number(position === "after")
      const viewports = arrangeViewports(s.viewports, moveViewport(rows, id, row, index))
      if (viewports === s.viewports) return s
      return {
        viewports,
        announcement: `${source.name} moved to position ${viewports.findIndex((viewport) => viewport.id === id) + 1} of ${viewports.length}.`,
      }
    })
  },
  arrange: (rows, movedId) =>
    set((s) => {
      const viewports = arrangeViewports(s.viewports, rows)
      if (viewports === s.viewports) return s
      const moved = viewports.find((viewport) => viewport.id === movedId)
      return {
        viewports,
        announcement: moved
          ? `${moved.name} placed in row ${moved.row + 1}, position ${rows[moved.row].indexOf(moved.id) + 1}.`
          : "Device arrangement updated.",
      }
    }),
  setLayout: (layout) =>
    set((s) => ({
      layout,
      selected:
        layout === "focus" && !s.viewports.some((v) => v.id === s.selected) ? (s.viewports[0]?.id ?? "") : s.selected,
    })),
  update: (id, patch) =>
    set((s) => {
      const current = s.viewports.find((v) => v.id === id)
      if (!current) return s
      const next = {
        ...current,
        name: patch.name ?? current.name,
        width: dimension(patch.width ?? current.width),
        height: dimension(patch.height ?? current.height),
        zoom: zoomLevel(patch.zoom ?? current.zoom),
      }
      if (
        next.name === current.name &&
        next.width === current.width &&
        next.height === current.height &&
        next.zoom === current.zoom
      )
        return s
      return { viewports: s.viewports.map((v) => (v.id === id ? next : v)) }
    }),
  setStatus: (id, status, detail) =>
    set((s) =>
      !s.viewports.some((v) => v.id === id) || (s.statuses[id]?.status === status && s.statuses[id]?.detail === detail)
        ? s
        : { statuses: { ...s.statuses, [id]: { status, detail } } }
    ),
}))

const KEY = "viewportstudio.workspace.v1"
export function restoreWorkspace(raw: unknown): Partial<Workspace> {
  if (!raw || typeof raw !== "object") return {}
  const data = raw as Record<string, unknown>
  let url = ""
  try {
    if (typeof data.url === "string" && data.url) url = normalizeUrl(data.url)
  } catch {
    /* Discard invalid persisted URLs. */
  }
  const viewports = Array.isArray(data.viewports)
    ? data.viewports.slice(0, MAX_VIEWPORTS).flatMap((v: unknown): Viewport[] => {
        if (!v || typeof v !== "object") return []
        const d = v as Record<string, unknown>
        if (typeof d.name !== "string" || typeof d.width !== "number" || typeof d.height !== "number") return []
        const category = ["Mobile", "Tablet", "Desktop", "Custom"].includes(String(d.category))
          ? (d.category as Device["category"])
          : "Custom"
        const savedZoom = typeof d.zoom === "number" ? d.zoom : defaultViewportZoom(category)
        return [
          {
            id: crypto.randomUUID(),
            name: d.name.slice(0, 60),
            width: dimension(d.width),
            height: dimension(d.height),
            category,
            zoom: zoomLevel(category === "Desktop" && savedZoom === 0.5 ? 0.4 : savedZoom),
            url,
            revision: 0,
            row:
              typeof d.row === "number" && Number.isInteger(d.row) && d.row >= 0 && d.row < MAX_VIEWPORTS ? d.row : 0,
          },
        ]
      })
    : initial.map((v) => ({ ...v, url }))
  const sync = data.sync && typeof data.sync === "object" ? (data.sync as Record<string, unknown>) : {}
  const syncEnabled =
    typeof sync.enabled === "boolean"
      ? sync.enabled
      : sync.scroll !== false || sync.clicks === true || sync.navigation !== false || sync.inputs === true
  return {
    url,
    viewports,
    selected:
      typeof data.selectedIndex === "number" && Number.isInteger(data.selectedIndex)
        ? (viewports[data.selectedIndex]?.id ?? viewports[0]?.id ?? "")
        : (viewports[0]?.id ?? ""),
    layout: data.layout === "focus" ? "focus" : "horizontal",
    workspaceZoom:
      typeof data.workspaceZoom === "number" && Number.isFinite(data.workspaceZoom)
        ? Math.round(Math.max(50, Math.min(100, data.workspaceZoom)))
        : 100,
    sync: { enabled: syncEnabled },
  }
}
let initialized: Promise<void> | undefined
let flushPendingSave = () => Promise.resolve()
export function flushWorkspace() {
  return flushPendingSave()
}
export function initializeWorkspace(initialURL?: string) {
  if (initialized)
    return initialized.then(() => {
      if (initialURL && initialURL !== useWorkspace.getState().url) useWorkspace.getState().navigate(initialURL)
    })
  return (initialized ??= (async () => {
    try {
      const raw = isExtension()
        ? (await chrome.storage.local.get(KEY))[KEY]
        : JSON.parse(localStorage.getItem(KEY) ?? "null")
      useWorkspace.setState({ ...restoreWorkspace(raw), ready: true })
      const params = new URLSearchParams(location.search)
      const startupURL = initialURL ?? params.get("url")
      if (startupURL) {
        try {
          useWorkspace.getState().navigate(startupURL)
        } catch {
          useWorkspace.setState({
            notice: "The source tab URL could not be opened. Open an HTTP or HTTPS page and try again.",
          })
        }
      } else if (params.has("unsupported")) {
        useWorkspace.setState({
          notice:
            "Chrome internal pages cannot be previewed. Open an HTTP or HTTPS site and click ViewportStudio again.",
        })
      }
    } catch (e) {
      useWorkspace.setState({
        ready: true,
        notice: `Could not restore settings: ${errorText(e)}`,
      })
    }
    let timer: ReturnType<typeof setTimeout> | undefined
    let previous = ""
    let writes = Promise.resolve()
    let pending: { data: ReturnType<typeof savedWorkspace>; serialized: string } | undefined
    function savedWorkspace(s: Workspace) {
      const { url, viewports, selected, layout, workspaceZoom, sync } = s
      return {
        url,
        viewports: viewports.map(({ name, width, height, zoom, category, row }) => ({
          name,
          width,
          height,
          zoom,
          category,
          row,
        })),
        layout,
        // IDs are regenerated on restore; the position preserves the focused device.
        selectedIndex: viewports.findIndex((viewport) => viewport.id === selected),
        workspaceZoom,
        sync,
      }
    }
    flushPendingSave = () => {
      clearTimeout(timer)
      if (!pending) return writes
      const { data, serialized } = pending
      pending = undefined
      // Local storage is synchronous, so flush it before the document is torn down.
      if (!isExtension()) {
        try {
          localStorage.setItem(KEY, serialized)
        } catch (e) {
          useWorkspace.setState({ notice: `Could not save settings: ${errorText(e)}` })
        }
        return writes
      }
      writes = writes
        .then(() => chrome.storage.local.set({ [KEY]: data }))
        .catch((e) => useWorkspace.setState({ notice: `Could not save settings: ${errorText(e)}` }))
      return writes
    }
    useWorkspace.subscribe((s, previousState) => {
      if (
        s.url === previousState.url &&
        s.viewports === previousState.viewports &&
        s.layout === previousState.layout &&
        s.selected === previousState.selected &&
        s.workspaceZoom === previousState.workspaceZoom &&
        s.sync === previousState.sync
      )
        return
      const data = savedWorkspace(s)
      const serialized = JSON.stringify(data)
      if (serialized === previous) return
      previous = serialized
      clearTimeout(timer)
      pending = { data, serialized }
      timer = setTimeout(flushPendingSave, 250)
    })
  })())
}
