import type { Device } from "@/types"

export { devices, foldableCounterpart } from "@/constants/devices"

export {
  dimension,
  VIEWPORT_ZOOM_STATES,
  minViewportZoom,
  maxViewportZoom,
  zoomLevel,
  adjacentZoomLevel,
} from "./dimensions"

export const defaultViewportZoom = (category: Device["category"]) =>
  category === "Mobile" ? 0.7 : category === "Tablet" ? 0.65 : category === "Desktop" ? 0.4 : 0.75
