import { flushWorkspace, useWorkspace } from "@/stores/workspace"
import type { WorkerMessage } from "@/types"
import { errorText, isExtension, isExtensionPage } from "@/utils/browser"

export function connectWorkspace(): () => void {
  if (!isExtension()) return () => {}
  let stopped = false
  let connection: chrome.runtime.Port | undefined
  let retry: ReturnType<typeof setTimeout>
  let unsubscribe = () => {}
  const inOverlay = !isExtensionPage()
  function updateHistory(url: string, replace: boolean) {
    const address = new URL(location.href)
    address.searchParams.set("url", url)
    if (replace) history.replaceState(history.state, "", address)
    else history.pushState(history.state, "", address)
  }
  function restoreFromHistory() {
    const url = new URLSearchParams(location.search).get("url")
    if (url && url !== useWorkspace.getState().url) useWorkspace.getState().navigate(url)
  }
  if (!inOverlay) {
    const url = useWorkspace.getState().url
    if (url) updateHistory(url, true)
    window.addEventListener("popstate", restoreFromHistory)
  }
  async function navigateTab(url: string, replace: boolean, source: string) {
    const previousURL = useWorkspace.getState().url
    const sameSite = replace && new URL(url).origin === location.origin
    // The source preview has already navigated. Keep its iframe and SPA state;
    // only update the other previews and the address bar.
    if (sameSite) useWorkspace.getState().navigate(url, source)
    else useWorkspace.setState({ url })
    try {
      // A different origin requires a real tab navigation and tears down the UI.
      if (!sameSite) await flushWorkspace()
      if (stopped || useWorkspace.getState().url !== url) return
      const response = await chrome.runtime.sendMessage({ type: "viewportstudio:navigate-tab", url, replace })
      if (response?.error) throw new Error(response.error)
    } catch (error) {
      if (!sameSite && !stopped && useWorkspace.getState().url === url) useWorkspace.setState({ url: previousURL })
      throw error
    }
  }
  const connect = async () => {
    try {
      const tab = isExtensionPage() ? await chrome.tabs.getCurrent() : undefined
      if (stopped) return
      connection = chrome.runtime.connect({ name: "workspace" })
      const configure = () => {
        const state = useWorkspace.getState()
        connection?.postMessage({
          type: "configure",
          tabId: tab?.id,
          ids: state.viewports.map((v) => v.id),
          sync: state.sync,
        })
      }
      configure()
      let previous = JSON.stringify([useWorkspace.getState().viewports.map((v) => v.id), useWorkspace.getState().sync])
      unsubscribe = useWorkspace.subscribe((s, previousState) => {
        if (s.viewports === previousState.viewports && s.sync === previousState.sync) return
        const key = JSON.stringify([s.viewports.map((v) => v.id), s.sync])
        if (key !== previous) {
          previous = key
          configure()
        }
      })
      connection.onMessage.addListener((message: WorkerMessage) => {
        const state = useWorkspace.getState()
        if (message.type === "open-url") {
          try {
            // Ignore the worker's echo of our own address-bar update. Reloading
            // here would discard the source iframe's in-place SPA navigation.
            if (state.url !== message.url) state.navigate(message.url)
          } catch {
            useWorkspace.setState({ notice: "The active browser tab URL could not be opened." })
          }
        }
        if (message.type === "status" && state.viewports.some((v) => v.id === message.id)) {
          const previousStatus = state.statuses[message.id]?.status
          // A delayed disconnect must not erase a confirmed navigation failure.
          if (message.status !== "unverified" || (previousStatus !== "blocked" && previousStatus !== "error"))
            state.setStatus(message.id, message.status, message.detail)
        }
        if (message.type === "preview-error") {
          for (const viewport of state.viewports) {
            if ((state.observedUrls[viewport.id] ?? viewport.url) === message.url)
              state.setStatus(viewport.id, message.status, message.detail)
          }
        }
        if (message.type === "navigate" && !state.viewports.some((v) => v.id === message.id)) return
        if (message.type === "navigate")
          useWorkspace.setState((s) => ({ observedUrls: { ...s.observedUrls, [message.id]: message.url } }))
        if (message.type === "navigate" && state.sync.enabled && state.url !== message.url) {
          if (inOverlay)
            void navigateTab(message.url, message.replace !== false, message.id).catch((error) =>
              useWorkspace.setState({ notice: `Could not open preview route: ${errorText(error)}` })
            )
          else {
            updateHistory(message.url, message.replace !== false)
            state.navigate(message.url, message.replace === false ? undefined : message.id)
          }
        }
        if (message.type === "notice") useWorkspace.setState({ notice: message.text })
        if (message.type === "workspace-ready")
          useWorkspace.setState({ previewReady: true, embedEnabled: message.embedEnabled })
      })
      connection.onDisconnect.addListener(() => {
        unsubscribe()
        if (!stopped) retry = setTimeout(() => void connect(), 500)
      })
    } catch {
      if (!stopped) retry = setTimeout(() => void connect(), 1500)
    }
  }
  void connect()
  return () => {
    stopped = true
    clearTimeout(retry)
    unsubscribe()
    window.removeEventListener("popstate", restoreFromHistory)
    connection?.disconnect()
  }
}
