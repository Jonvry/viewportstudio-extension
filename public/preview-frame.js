const parameters = new URLSearchParams(location.search)
const url = parameters.get("url")
const id = parameters.get("id")

if (url && id) {
  try {
    const target = new URL(url)
    if (target.protocol === "http:" || target.protocol === "https:") {
      // Register this extension-owned parent before the nested website loads.
      // Chrome's webNavigation API omits extension-scheme frame documents.
      let bridge
      let reconnect
      let closed = false
      const register = () => {
        if (closed) return
        bridge = chrome.runtime.connect({ name: "preview-bridge" })
        bridge.onDisconnect.addListener(() => {
          if (!closed) reconnect = setTimeout(register, 500)
        })
      }
      register()
      window.addEventListener(
        "pagehide",
        () => {
          closed = true
          clearTimeout(reconnect)
          bridge?.disconnect()
        },
        { once: true }
      )
      const frame = document.createElement("iframe")
      frame.name = id
      frame.title = "Website preview"
      frame.referrerPolicy = "strict-origin-when-cross-origin"
      frame.setAttribute(
        "sandbox",
        "allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads allow-same-origin"
      )
      frame.setAttribute("allow", "autoplay 'none'")
      const identify = () => frame.contentWindow?.postMessage({ type: "VIEWPORTSTUDIO_IDENTIFY", id }, "*")
      frame.addEventListener("load", identify)
      window.addEventListener("message", (event) => {
        if (event.source === window.parent && event.data?.type === "VIEWPORTSTUDIO_IDENTIFY" && event.data.id === id)
          identify()
      })
      frame.src = target.href
      document.body.append(frame)
    }
  } catch {
    // Invalid preview URLs remain empty inside the bridge frame.
  }
}
