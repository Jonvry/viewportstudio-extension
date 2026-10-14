export const dimension = (value: number) =>
  Math.round(Math.max(240, Math.min(3840, Number.isFinite(value) ? value : 390)))

export const VIEWPORT_ZOOM_STATES = [0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.6, 0.75, 0.9, 1] as const

export const minViewportZoom = () => VIEWPORT_ZOOM_STATES[0]
export const maxViewportZoom = () => VIEWPORT_ZOOM_STATES[VIEWPORT_ZOOM_STATES.length - 1]

export function zoomLevel(value: number) {
  const target = Number.isFinite(value) ? value : minViewportZoom()
  return Math.round(Math.max(minViewportZoom(), Math.min(maxViewportZoom(), target)) * 100) / 100
}

export function adjacentZoomLevel(value: number, direction: -1 | 1) {
  const current = zoomLevel(value)
  if (direction === 1) return VIEWPORT_ZOOM_STATES.find((level) => level > current) ?? maxViewportZoom()
  return [...VIEWPORT_ZOOM_STATES].reverse().find((level) => level < current) ?? minViewportZoom()
}
