export function getPopupContainer() {
  if (typeof document === "undefined") return undefined
  return document.getElementById("__viewportstudio_host")?.shadowRoot ?? undefined
}
