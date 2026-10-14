import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { sampleDocument } from "@/components/viewport/sample"
import { getOverlayPreviewURL, getPreviewSandbox } from "@/features/navigation/preview-sandbox"
import { useWorkspace } from "@/stores/workspace"
import type { Viewport } from "@/types"
import { isExtension, isExtensionPage } from "@/utils/browser"

export const ViewportFrame = memo(function ViewportFrame({
  viewport: v,
  zoom = v.zoom,
}: {
  viewport: Viewport
  zoom?: number
}) {
  const frame = useRef<HTMLIFrameElement>(null)
  const [initialURL] = useState(v.url)
  const requestedURL = useRef(v.url)
  const previewReady = useWorkspace((state) => state.previewReady)
  const previewColorScheme = useWorkspace((state) => state.previewColorScheme)
  const hasURL = Boolean(v.url)
  const inOverlay = Boolean(document.getElementById("__viewportstudio_host")?.shadowRoot)
  const useOverlayBridge = inOverlay && isExtension()
  const previewSource = useCallback(
    (url: string) => (useOverlayBridge ? getOverlayPreviewURL(url, v.id, chrome.runtime.getURL("")) : url),
    [useOverlayBridge, v.id]
  )
  useEffect(() => {
    if (!v.url || !previewReady || requestedURL.current === v.url) return
    requestedURL.current = v.url
    // The source website already performed this navigation in its own router.
    if (useWorkspace.getState().observedUrls[v.id] === v.url) return
    useWorkspace.getState().setStatus(v.id, "loading")
    const target = frame.current
    if (!target) return
    const timeout = setTimeout(() => {
      const state = useWorkspace.getState()
      if (state.statuses[v.id]?.status === "loading") state.setStatus(v.id, "unverified")
    }, 10000)
    if (useOverlayBridge) {
      target.src = previewSource(v.url)
      return () => clearTimeout(timeout)
    }
    try {
      // Replacements keep mirrored frames out of the browser's Back/Forward stack.
      target.contentWindow?.location.replace(v.url)
      return () => clearTimeout(timeout)
    } catch {
      // Cross-origin frames need Chrome's isolated script context to replace their URL.
    }
    let cancelled = false
    void (async () => {
      if (isExtension()) {
        const tab = isExtensionPage() ? await chrome.tabs.getCurrent() : undefined
        if (cancelled) return
        const response = await chrome.runtime.sendMessage({
          type: "viewportstudio:navigate-preview",
          id: v.id,
          url: v.url,
          tabId: tab?.id,
        })
        if (response?.navigated) return
      }
      // A blocked or unidentified frame cannot run a replacement script yet.
      if (!cancelled) target.src = v.url
    })().catch(() => {
      if (!cancelled) target.src = v.url
    })
    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [v.id, v.url, previewReady, previewSource, useOverlayBridge])
  useEffect(() => {
    if (!hasURL || !previewReady) return
    useWorkspace.getState().setStatus(v.id, "loading")
    function probe() {
      const target = frame.current?.contentWindow
      // Identification only. The recipient validates the extension origin; no capabilities or secrets are sent.
      target?.postMessage({ type: "VIEWPORTSTUDIO_IDENTIFY", id: v.id }, "*")
    }
    const interval = setInterval(probe, 1000)
    const timeout = setTimeout(() => {
      const state = useWorkspace.getState()
      if (state.statuses[v.id]?.status === "loading") state.setStatus(v.id, "unverified")
    }, 10000)
    probe()
    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [v.id, hasURL, previewReady])
  function handleLoad() {
    frame.current?.contentWindow?.postMessage({ type: "VIEWPORTSTUDIO_IDENTIFY", id: v.id }, "*")
  }

  function handleError() {
    useWorkspace
      .getState()
      .setStatus(v.id, "error", "This preview could not load. Check the URL, server, and embedding policy.")
  }

  // Manage srcdoc separately from React's source props. An empty srcdoc still
  // takes precedence over src, including when previews become ready later.
  useLayoutEffect(() => {
    const target = frame.current
    if (!target) return
    if (hasURL) target.removeAttribute("srcdoc")
    else if (target.getAttribute("srcdoc") !== sampleDocument) target.setAttribute("srcdoc", sampleDocument)
  })
  useEffect(() => {
    const target = frame.current
    if (!target || !hasURL) return
    // Page scripts and other extensions can write srcdoc after React commits.
    // Website previews must always navigate using their URL.
    const observer = new MutationObserver(() => {
      if (target.hasAttribute("srcdoc")) target.removeAttribute("srcdoc")
    })
    observer.observe(target, { attributes: true, attributeFilter: ["srcdoc"] })
    return () => observer.disconnect()
  }, [hasURL])

  return (
    <iframe
      key={hasURL ? "website" : "sample"}
      ref={frame}
      title={`${v.name} preview`}
      data-preview-source={hasURL ? "website" : "sample"}
      name={useOverlayBridge ? `${v.id}-bridge` : v.id}
      src={hasURL && previewReady && initialURL ? previewSource(initialURL) : undefined}
      width={v.width}
      height={v.height}
      // Previews should render the site's player chrome without starting a
      // second media decode alongside the source page.
      allow="autoplay 'none'"
      // The packaged bridge applies the website sandbox to its child frame.
      // Keep its own extension document outside that sandbox.
      sandbox={useOverlayBridge ? undefined : getPreviewSandbox(v.url, window.location.origin, false)}
      referrerPolicy="strict-origin-when-cross-origin"
      style={{
        display: "block",
        border: 0,
        width: v.width,
        height: v.height,
        // CSS zoom preserves the iframe's viewport dimensions without adding
        // a transformed compositing surface around video/animated pages.
        zoom,
        colorScheme: previewColorScheme,
      }}
      onLoad={handleLoad}
      onError={handleError}
    />
  )
})
