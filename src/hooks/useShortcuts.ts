import { useEffect } from "react"
import { adjacentZoomLevel } from "@/features/viewport-management/devices"
import { useWorkspace } from "@/stores/workspace"

export function useShortcuts() {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.defaultPrevented || !event.altKey || event.ctrlKey || event.metaKey) return
      // Events are retargeted to the host when the workspace runs in a shadow root.
      const root = document.getElementById("__viewportstudio_host")?.shadowRoot ?? document
      if (root.querySelector('[role="dialog"]:not(#root), [role="alertdialog"], dialog[open]')) return
      const target = event.composedPath()[0]
      if (!(target instanceof HTMLElement) || target.matches("input,textarea,select") || target.isContentEditable)
        return
      const state = useWorkspace.getState()
      if (event.code === "KeyR") {
        event.preventDefault()
        state.reload()
      }
      if (event.code === "Equal" || event.code === "Minus") {
        event.preventDefault()
        const v = state.viewports.find((v) => v.id === state.selected)
        if (v)
          state.update(v.id, {
            zoom: adjacentZoomLevel(v.zoom, event.code === "Equal" ? 1 : -1),
          })
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])
}
