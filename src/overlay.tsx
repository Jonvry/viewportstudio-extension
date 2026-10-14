import { StrictMode, useLayoutEffect } from "react"
import geistFont from "@fontsource-variable/geist/files/geist-latin-wght-normal.woff2?inline"
import { createRoot } from "react-dom/client"
import App from "@/App"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { dismissWorkspaceLoading } from "@/features/navigation/restore-workspace"
import styles from "@/index.css?inline"
import { useWorkspace } from "@/stores/workspace"

function OverlayWorkspace({ initialURL }: { initialURL: string }) {
  useLayoutEffect(dismissWorkspaceLoading, [])
  return <App initialURL={initialURL} />
}

export async function mountWorkspace() {
  // Module loads can finish after the user has already closed the workspace.
  const response = await chrome.runtime.sendMessage({ type: "viewportstudio:overlay-state" })
  if (!response?.active || document.getElementById("__viewportstudio_host")) {
    dismissWorkspaceLoading()
    return
  }
  // Chrome caches imported modules. Reopening must use the current page and
  // reconnect its previews rather than reuse the previous connection state.
  if (useWorkspace.getState().ready) useWorkspace.getState().navigate(location.href)
  useWorkspace.setState({ previewReady: false, embedEnabled: false, notice: "" })
  // Embedded pages inherit the iframe's color scheme. Preserve the site's
  // scheme before applying the workspace's own light UI inside its shadow root.
  const sourceColorScheme = () => {
    const scheme = getComputedStyle(document.documentElement).colorScheme
    return scheme && scheme !== "normal"
      ? scheme
      : matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
  }
  useWorkspace.setState({ previewColorScheme: sourceColorScheme() })
  const previousFocus = document.activeElement
  const previousOverflow = document.documentElement.style.getPropertyValue("overflow")
  const previousOverflowPriority = document.documentElement.style.getPropertyPriority("overflow")
  // The overlay loads the current URL again in its preview frames. Pause media
  // in the now-hidden source page so video-heavy sites do not run two players
  // (and decoders) at once. Restore only media that was playing before the
  // workspace opened when it closes.
  const pageMediaToResume = new Set<HTMLMediaElement>()
  const pausePageMedia = (media: HTMLMediaElement) => {
    if (!media.isConnected || media.paused) return
    pageMediaToResume.add(media)
    media.pause()
  }
  const pauseNewlyPlayingMedia = (event: Event) => {
    if (event.target instanceof HTMLMediaElement) pausePageMedia(event.target)
  }
  for (const media of document.querySelectorAll<HTMLMediaElement>("audio, video")) pausePageMedia(media)
  document.addEventListener("play", pauseNewlyPlayingMedia, true)
  const host = document.createElement("div") as HTMLDivElement & { __vsUnmount?: () => void; __vsInitialURL?: string }
  host.id = "__viewportstudio_host"
  host.__vsInitialURL = location.href
  host.style.cssText = "position:fixed;inset:0;z-index:2147483647;isolation:isolate;"
  const shadow = host.attachShadow({ mode: "open" })
  const style = document.createElement("style")
  // Keep the app's Tailwind/CSS rules inside the shadow root so the site cannot
  // restyle the workspace and the workspace cannot alter the site.
  style.textContent = styles
    .replaceAll(":root", ":host")
    .concat(
      "\n:host{all:initial;font-family:'ViewportStudio Geist',sans-serif;color:#202020;background:#fff;color-scheme:light}#root{position:fixed;inset:0;width:100vw;height:100dvh;overflow:hidden;font-family:'ViewportStudio Geist',sans-serif}"
    )
  shadow.append(style)
  // Register the bundled font at document scope: shadow-root @font-face rules
  // cannot reliably load it. A private family name keeps the site's fonts intact.
  const workspaceFont = new FontFace(
    "ViewportStudio Geist",
    Uint8Array.from(atob(geistFont.split(",")[1]), (character) => character.charCodeAt(0)),
    { weight: "100 900", display: "swap" }
  )
  document.fonts.add(workspaceFont)
  const rootElement = document.createElement("div")
  rootElement.id = "root"
  rootElement.setAttribute("role", "dialog")
  rootElement.setAttribute("aria-modal", "true")
  rootElement.setAttribute("aria-label", "ViewportStudio workspace")
  rootElement.setAttribute("lang", "en")
  rootElement.tabIndex = -1
  shadow.append(rootElement)
  document.documentElement.append(host)
  // Keep keyboard and screen reader navigation inside the full-screen workspace.
  const pageElements = new Map<HTMLElement, boolean>()
  const isolatePageElements = () => {
    // Some sites apply inert to every sibling of their page/modal. Our host
    // must remain interactive, including after the site's own DOM updates.
    if (host.inert) host.inert = false
    for (const element of document.documentElement.children) {
      if (
        !(element instanceof HTMLElement) ||
        element.id === "__viewportstudio_host" ||
        element.id === "__viewportstudio_loading" ||
        pageElements.has(element)
      )
        continue
      pageElements.set(element, element.inert)
      element.inert = true
    }
  }
  isolatePageElements()
  // At document_start the parser may not have created the body yet.
  const pageObserver = new MutationObserver(isolatePageElements)
  pageObserver.observe(document.documentElement, { childList: true })
  pageObserver.observe(host, { attributes: true, attributeFilter: ["inert"] })
  const updateSourceColorScheme = () => {
    useWorkspace.setState({ previewColorScheme: sourceColorScheme() })
  }
  // Read again after the source site's styles have loaded.
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", updateSourceColorScheme, { once: true })
  document.documentElement.style.setProperty("overflow", "hidden")
  rootElement.focus({ preventScroll: true })
  const reactRoot = createRoot(rootElement)
  const restoreFromHistory = (event: PageTransitionEvent) => {
    if (!event.persisted || !host.isConnected) return
    void chrome.runtime
      .sendMessage({ type: "viewportstudio:overlay-state" })
      .then((response) => {
        if (!host.isConnected) return
        if (!response?.active) {
          host.__vsUnmount?.()
          host.remove()
          return
        }
        useWorkspace.setState({ previewColorScheme: sourceColorScheme() })
        useWorkspace.getState().navigate(location.href)
      })
      .catch(() => {
        // A cached document may belong to an extension build that was reloaded.
        host.__vsUnmount?.()
        host.remove()
      })
  }
  window.addEventListener("pageshow", restoreFromHistory)
  host.__vsUnmount = () => {
    pageObserver.disconnect()
    document.removeEventListener("DOMContentLoaded", updateSourceColorScheme)
    document.removeEventListener("play", pauseNewlyPlayingMedia, true)
    window.removeEventListener("pageshow", restoreFromHistory)
    dismissWorkspaceLoading()
    reactRoot.unmount()
    document.fonts.delete(workspaceFont)
    for (const [element, inert] of pageElements) element.inert = inert
    for (const media of pageMediaToResume) {
      if (media.isConnected) void media.play().catch(() => {})
    }
    if (previousOverflow)
      document.documentElement.style.setProperty("overflow", previousOverflow, previousOverflowPriority)
    else document.documentElement.style.removeProperty("overflow")
    if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true })
  }
  const initialURL = location.href
  reactRoot.render(
    <StrictMode>
      <ErrorBoundary>
        <OverlayWorkspace initialURL={initialURL} />
      </ErrorBoundary>
    </StrictMode>
  )
}
