export function getPreviewSandbox(url: string, parentOrigin: string, inOverlay: boolean): string | undefined {
  const permissions = [
    "allow-scripts",
    "allow-forms",
    "allow-popups",
    "allow-popups-to-escape-sandbox",
    "allow-downloads",
  ]

  if (url) {
    try {
      const preview = new URL(url)
      // An overlay's host page and its matching preview share an origin.
      // Preserve the page's normal origin so sites that rely on cookies,
      // storage, or origin checks can finish loading inside the preview.
      if (inOverlay && /^https?:$/.test(preview.protocol) && preview.origin === parentOrigin) return undefined
      // Keep blank/sample frames opaque, and never grant a preview access to
      // the extension workspace's own origin.
      if (preview.origin !== parentOrigin) permissions.push("allow-same-origin")
    } catch {
      // Invalid URLs stay on the stricter opaque-origin sandbox.
    }
  }

  return permissions.join(" ")
}

export function getOverlayPreviewURL(url: string, id: string, extensionOrigin: string): string {
  const bridge = new URL("preview-frame.html", `${extensionOrigin.replace(/\/$/, "")}/`)
  bridge.searchParams.set("url", url)
  bridge.searchParams.set("id", id)
  return bridge.href
}
