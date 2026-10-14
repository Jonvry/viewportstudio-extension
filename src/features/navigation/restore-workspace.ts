// Keep this bootstrap small: it runs at document_start without loading React.
export function dismissWorkspaceLoading() {
  const loading = document.getElementById("__viewportstudio_loading") as
    (HTMLElement & { __vsUnmount?: () => void }) | null
  loading?.__vsUnmount?.()
  loading?.remove()
}

export async function restoreWorkspaceOnLoad() {
  try {
    const state = await chrome.runtime.sendMessage({ type: "viewportstudio:overlay-state" })
    if (!state?.active || document.getElementById("__viewportstudio_host")) return
    const loading = document.createElement("div") as HTMLDivElement & { __vsUnmount?: () => void }
    loading.id = "__viewportstudio_loading"
    loading.style.cssText = "position:fixed;inset:0;z-index:2147483647;isolation:isolate;"
    const shadow = loading.attachShadow({ mode: "open" })
    const style = document.createElement("style")
    style.textContent = `
      :host{all:initial;color-scheme:light}
      .surface{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;
        gap:12px;background:#f0efed;color:#73716e;font:14px system-ui,sans-serif}
      .logo{display:flex;gap:4px;padding:6px;border-radius:8px;background:#bd4b00}
      .logo i{width:6px;height:20px;border-radius:3px;background:#fff}
      .logo i:last-child{opacity:.6}
    `
    const surface = document.createElement("div")
    surface.className = "surface"
    surface.setAttribute("role", "status")
    surface.setAttribute("lang", "en")
    const logo = document.createElement("span")
    logo.className = "logo"
    logo.setAttribute("aria-hidden", "true")
    logo.append(document.createElement("i"), document.createElement("i"))
    surface.append(logo, document.createTextNode("Opening your workspace…"))
    shadow.append(style, surface)
    document.documentElement.append(loading)
    const remove = () => {
      clearTimeout(timeout)
      window.removeEventListener("pagehide", remove)
      loading.remove()
    }
    // A failed module load or an extension reload must never cover the page indefinitely.
    const timeout = setTimeout(remove, 15000)
    loading.__vsUnmount = remove
    window.addEventListener("pagehide", remove, { once: true })
    const response = await chrome.runtime.sendMessage({ type: "viewportstudio:restore-workspace" })
    if (!response?.active || response.error) remove()
  } catch {
    dismissWorkspaceLoading()
  }
}
