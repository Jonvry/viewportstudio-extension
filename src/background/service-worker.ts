import {
  clearAllFramePolicies,
  clearFramePolicy,
  prepareFramePolicy,
  removeLegacyFramePolicy,
  setFramePolicy,
} from "@/background/frame-policy"
import type {
  ExtensionRuntimeMessage,
  FrameMessage,
  Interaction,
  SyncSettings,
  UIMessage,
  WorkerMessage,
} from "@/types"

const workspaceURL = chrome.runtime.getURL("index.html")
const isWorkspaceURL = (url: string | undefined) => {
  if (!url) return false
  try {
    const candidate = new URL(url)
    const workspace = new URL(workspaceURL)
    return candidate.origin === workspace.origin && candidate.pathname === workspace.pathname
  } catch {
    return false
  }
}
const supportedPageURL = (url: string | undefined): url is string =>
  typeof url === "string" && /^https?:\/\//i.test(url)
interface Session {
  port: chrome.runtime.Port
  ids: Set<string>
  sync: SyncSettings
  frames: Map<number, { id: string; port?: chrome.runtime.Port }>
  bridges: Map<number, { id: string; port: chrome.runtime.Port }>
}
const sessions = new Map<number, Session>()
const OVERLAY_TABS_KEY = "viewportstudio.activeOverlayTabs"
const overlayTabs = new Set<number>()
const restoreOverlayTabs = chrome.storage.session.get(OVERLAY_TABS_KEY).then((stored) => {
  if (Array.isArray(stored[OVERLAY_TABS_KEY]))
    for (const id of stored[OVERLAY_TABS_KEY]) if (Number.isInteger(id) && id >= 0) overlayTabs.add(id)
})
let overlayWrites = Promise.resolve()
async function setOverlayActive(tabId: number, active: boolean) {
  await restoreOverlayTabs
  if (active) overlayTabs.add(tabId)
  else overlayTabs.delete(tabId)
  const snapshot = [...overlayTabs]
  overlayWrites = overlayWrites.catch(() => {}).then(() => chrome.storage.session.set({ [OVERLAY_TABS_KEY]: snapshot }))
  await overlayWrites
}
const restoring = new Map<number, Promise<void>>()
async function restoreOverlay(tabId: number, url: string, documentId?: string) {
  await initialization
  const previous = restoring.get(tabId)
  if (previous) {
    await previous.catch(() => {})
    return restoreOverlay(tabId, url, documentId)
  }
  if (!overlayTabs.has(tabId) || !supportedPageURL(url)) return
  // A refresh can keep the same URL while replacing the document. Target the
  // requesting document so a late restoration cannot inject into its successor.
  const target = documentId ? { tabId, documentIds: [documentId] } : { tabId }
  const operation = (async () => {
    const tab = await chrome.tabs.get(tabId)
    if (tab.url !== url || !overlayTabs.has(tabId)) return
    const results = await chrome.scripting.executeScript({
      target,
      injectImmediately: true,
      func: () => Boolean(document.getElementById("__viewportstudio_host")),
    })
    if (results.some(({ result }) => result === true) || !overlayTabs.has(tabId)) return
    await prepareFramePolicy(tabId)
    const current = await chrome.tabs.get(tabId)
    if (overlayTabs.has(tabId) && current.url === url)
      await chrome.scripting.executeScript({ target, files: ["overlay.js"], injectImmediately: true })
  })()
  restoring.set(tabId, operation)
  try {
    await operation
  } finally {
    if (restoring.get(tabId) === operation) restoring.delete(tabId)
  }
}
const initialization = (async () => {
  await restoreOverlayTabs
  await removeLegacyFramePolicy()
  // Static manifest scripts replace the previous per-host registrations.
  const scripts = await chrome.scripting.getRegisteredContentScripts()
  const legacyIds = scripts.filter((script) => script.id.startsWith("site-")).map((script) => script.id)
  if (legacyIds.length) await chrome.scripting.unregisterContentScripts({ ids: legacyIds })
  await chrome.storage.local.remove("approvedEmbedPatterns")
  await chrome.storage.session.remove("overlayTabId")
})()
void initialization.catch(console.error)
async function closeOverlay(tabId: number) {
  // Persist the close before removing the UI or waiting on pending injections.
  await setOverlayActive(tabId, false)
  await restoring.get(tabId)?.catch(() => {})
  await clearFramePolicy(tabId)
  await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const loading = document.getElementById("__viewportstudio_loading") as
        (HTMLElement & { __vsUnmount?: () => void }) | null
      loading?.__vsUnmount?.()
      loading?.remove()
      const host = document.getElementById("__viewportstudio_host") as
        (HTMLDivElement & { __vsUnmount?: () => void; __vsInitialURL?: string }) | null
      const changedRoute = Boolean(host?.__vsInitialURL && host.__vsInitialURL !== location.href)
      host?.__vsUnmount?.()
      host?.remove()
      // In-place preview routes only update the address bar. Show the matching
      // real page after the workspace has been explicitly closed.
      if (changedRoute) location.reload()
    },
  })
}
let opening: Promise<void> | undefined
chrome.action.onClicked.addListener((clickedTab) => {
  opening ??= (async () => {
    if (clickedTab.id === undefined || !supportedPageURL(clickedTab.url)) return
    await initialization
    const results = await chrome.scripting.executeScript({
      target: { tabId: clickedTab.id },
      func: () => Boolean(document.getElementById("__viewportstudio_host")),
    })
    if (results.some(({ result }) => result === true) || overlayTabs.has(clickedTab.id)) {
      await closeOverlay(clickedTab.id)
      return
    }
    await setOverlayActive(clickedTab.id, true)
    try {
      await prepareFramePolicy(clickedTab.id)
      await chrome.scripting.executeScript({ target: { tabId: clickedTab.id }, files: ["overlay.js"] })
    } catch (error) {
      await setOverlayActive(clickedTab.id, false)
      await clearFramePolicy(clickedTab.id)
      throw error
    }
  })()
    .catch(console.error)
    .finally(() => {
      opening = undefined
    })
})
chrome.runtime.onMessage.addListener((message: ExtensionRuntimeMessage, sender, respond) => {
  const senderTabId = sender.tab?.id
  if (message?.type === "viewportstudio:overlay-state" && senderTabId !== undefined && sender.frameId === 0) {
    void initialization
      .then(() => respond({ active: overlayTabs.has(senderTabId) }))
      .catch(() => respond({ active: false }))
    return true
  }
  if (
    message?.type === "viewportstudio:restore-workspace" &&
    senderTabId !== undefined &&
    sender.frameId === 0 &&
    supportedPageURL(sender.url)
  ) {
    void restoreOverlay(senderTabId, sender.url, sender.documentId)
      .then(() => respond({ active: overlayTabs.has(senderTabId) }))
      .catch((error: unknown) => respond({ error: error instanceof Error ? error.message : String(error) }))
    return true
  }
  if (
    message?.type === "viewportstudio:close-workspace" &&
    senderTabId !== undefined &&
    sender.frameId === 0 &&
    supportedPageURL(sender.url)
  ) {
    // Closing must also work while the workspace port reconnects after a worker restart.
    void initialization
      .then(() => closeOverlay(senderTabId))
      .then(() => respond({ active: false }))
      .catch((error: unknown) => respond({ error: error instanceof Error ? error.message : String(error) }))
    return true
  }
  const authorizedOverlay = senderTabId !== undefined && sender.frameId === 0 && sessions.has(senderTabId)
  const authorizedWorkspace = isWorkspaceURL(sender.url)
  if (!authorizedWorkspace && !authorizedOverlay) {
    respond({ error: "This action is only available in the ViewportStudio workspace." })
    return
  }
  if (message?.type === "viewportstudio:navigate-preview") {
    void (async () => {
      const tabId = authorizedOverlay ? senderTabId : message.tabId
      if (tabId === undefined || !Number.isInteger(tabId) || typeof message.id !== "string" || !validURL(message.url))
        throw new Error("This preview route could not be identified.")
      if (!authorizedOverlay) {
        const tab = await chrome.tabs.get(tabId)
        if (!isWorkspaceURL(tab.url)) throw new Error("The target tab is not a ViewportStudio workspace.")
      }
      const session = sessions.get(tabId)
      const frame = session?.ids.has(message.id)
        ? [...session.frames].find(([, candidate]) => candidate.id === message.id)
        : undefined
      if (!frame) {
        respond({ navigated: false })
        return
      }
      await chrome.scripting.executeScript({
        target: { tabId, frameIds: [frame[0]] },
        func: (url: string) => {
          if (location.href !== url) location.replace(url)
        },
        args: [message.url],
      })
      respond({ navigated: true })
    })().catch((error: unknown) => respond({ error: error instanceof Error ? error.message : String(error) }))
    return true
  }
  if (message?.type === "viewportstudio:navigate-tab") {
    if (
      !authorizedOverlay ||
      senderTabId === undefined ||
      !validURL(message.url) ||
      typeof message.replace !== "boolean"
    ) {
      respond({ error: "This route can only be opened from an active website workspace." })
      return
    }
    void (async () => {
      await initialization
      if (!overlayTabs.has(senderTabId)) throw new Error("This workspace has closed.")
      const tab = await chrome.tabs.get(senderTabId)
      if (tab.url !== message.url) {
        if (message.replace && tab.url && new URL(tab.url).origin === new URL(message.url).origin)
          await chrome.scripting.executeScript({
            target: { tabId: senderTabId },
            func: (url: string) => history.replaceState(history.state, "", url),
            args: [message.url],
          })
        else if (message.replace)
          await chrome.scripting.executeScript({
            target: { tabId: senderTabId },
            func: (url: string) => location.replace(url),
            args: [message.url],
          })
        else await chrome.tabs.update(senderTabId, { url: message.url })
      }
      respond({ url: message.url })
    })().catch((error: unknown) => respond({ error: error instanceof Error ? error.message : String(error) }))
    return true
  }
  if (message?.type === "viewportstudio:set-frame-policy") {
    void (async () => {
      const tabId = authorizedOverlay ? senderTabId : message.tabId
      if (tabId === undefined || !Number.isInteger(tabId) || typeof message.enabled !== "boolean")
        throw new Error("The current workspace tab could not be identified.")
      if (!authorizedOverlay) {
        const tab = await chrome.tabs.get(tabId)
        if (!isWorkspaceURL(tab.url)) throw new Error("The target tab is not a ViewportStudio workspace.")
      }
      await initialization
      const enabled = await setFramePolicy(tabId, message.enabled)
      const session = sessions.get(tabId)
      if (session) send(session, { type: "workspace-ready", embedEnabled: enabled })
      respond({ enabled })
    })().catch((error: unknown) => {
      respond({ error: error instanceof Error ? error.message : "Could not update the embed policy." })
    })
    return true
  }
  return
})
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && supportedPageURL(tab.url))
    void restoreOverlay(tabId, tab.url).catch(console.error)
})
chrome.tabs.onRemoved.addListener((tabId) => {
  void setOverlayActive(tabId, false)
    .then(() => clearFramePolicy(tabId))
    .catch(console.error)
  sessions.get(tabId)?.port.disconnect()
})
chrome.webNavigation.onDOMContentLoaded.addListener((event) => {
  if (event.frameId === 0) void restoreOverlay(event.tabId, event.url, event.documentId).catch(console.error)
})
chrome.webNavigation.onCompleted.addListener((event) => {
  // Back/Forward Cache restores skip DOMContentLoaded.
  if (event.frameId === 0) void restoreOverlay(event.tabId, event.url, event.documentId).catch(console.error)
})
const send = (session: Session, message: WorkerMessage) => {
  try {
    session.port.postMessage(message)
  } catch {
    /* Port already closed. */
  }
}
const validURL = (url: unknown): url is string =>
  typeof url === "string" && url.length < 8192 && /^https?:\/\//.test(url)
const validInteraction = (event: Interaction) =>
  event &&
  ((event.kind === "scroll" &&
    Number.isFinite(event.x) &&
    Number.isFinite(event.y) &&
    event.x >= 0 &&
    event.x <= 1 &&
    event.y >= 0 &&
    event.y <= 1) ||
    (event.kind === "click" && typeof event.selector === "string" && event.selector.length < 2048) ||
    (event.kind === "input" &&
      typeof event.selector === "string" &&
      event.selector.length < 2048 &&
      typeof event.value === "string" &&
      event.value.length <= 8192 &&
      (event.selectionStart === null || (Number.isInteger(event.selectionStart) && event.selectionStart >= 0)) &&
      (event.selectionEnd === null || (Number.isInteger(event.selectionEnd) && event.selectionEnd >= 0))))

chrome.runtime.onConnect.addListener((port) => {
  const senderTabId = port.sender?.tab?.id
  const senderIsWorkspace = isWorkspaceURL(port.sender?.url)
  const senderIsOverlay = senderTabId !== undefined && port.sender?.frameId === 0
  // Only this extension's injected top-frame overlay opens this port on websites.
  if (port.name === "workspace" && (senderIsWorkspace || senderIsOverlay)) {
    let tabId: number | undefined = senderIsOverlay ? port.sender?.tab?.id : undefined
    port.onMessage.addListener((message: UIMessage) => {
      if (
        message.type === "configure" &&
        Array.isArray(message.ids) &&
        message.ids.length <= 12 &&
        (senderIsOverlay || Number.isInteger(message.tabId))
      ) {
        const configuredTabId = senderIsOverlay ? port.sender?.tab?.id : message.tabId
        if (configuredTabId === undefined) return
        const applyConfiguration = () => {
          tabId = configuredTabId
          const previous = sessions.get(tabId)
          const firstConfiguration = previous?.port !== port
          const session: Session = {
            port,
            ids: new Set(message.ids),
            sync: message.sync,
            frames: previous?.frames ?? new Map(),
            bridges: previous?.bridges ?? new Map(),
          }
          for (const [frameId, frame] of session.frames)
            if (!session.ids.has(frame.id)) {
              frame.port?.disconnect()
              session.frames.delete(frameId)
            }
          for (const [frameId, bridge] of session.bridges)
            if (!session.ids.has(bridge.id)) {
              bridge.port.disconnect()
              session.bridges.delete(frameId)
            }
          sessions.set(tabId, session)
          for (const frame of session.frames.values()) frame.port?.postMessage({ type: "settings", sync: session.sync })
          if (firstConfiguration) {
            const workspaceTabId = tabId
            void (async () => {
              await initialization
              if (sessions.get(workspaceTabId)?.port !== port) return
              const embedEnabled = await prepareFramePolicy(workspaceTabId)
              const current = sessions.get(workspaceTabId)
              if (current?.port === port) send(current, { type: "workspace-ready", embedEnabled })
              else if (!current && !overlayTabs.has(workspaceTabId)) await clearFramePolicy(workspaceTabId, false)
            })().catch((error: unknown) => {
              const current = sessions.get(workspaceTabId)
              if (current?.port !== port) return
              send(current, { type: "workspace-ready", embedEnabled: false })
              send(current, { type: "notice", text: `Automatic embed setup failed: ${String(error)}` })
            })
          }
        }
        if (senderIsOverlay) {
          applyConfiguration()
        } else {
          void chrome.tabs
            .get(configuredTabId)
            .then((tab) => {
              if (isWorkspaceURL(tab.url)) applyConfiguration()
            })
            .catch(() => {})
        }
      }
    })
    port.onDisconnect.addListener(() => {
      if (tabId !== undefined && sessions.get(tabId)?.port === port) {
        const s = sessions.get(tabId)
        sessions.delete(tabId)
        s?.frames.forEach((f) => f.port?.disconnect())
        s?.bridges.forEach((bridge) => bridge.port.disconnect())
        if (!overlayTabs.has(tabId)) void clearFramePolicy(tabId, false).catch(console.error)
      }
    })
    return
  }
  const sender = port.sender
  if (port.name === "preview-bridge") {
    const tabId = sender?.tab?.id
    const frameId = sender?.frameId
    const bridgeURL = sender?.url ? new URL(sender.url) : undefined
    const extensionURL = new URL(chrome.runtime.getURL("preview-frame.html"))
    const id = bridgeURL?.searchParams.get("id")
    const session = tabId === undefined ? undefined : sessions.get(tabId)
    if (
      !session ||
      !frameId ||
      !id ||
      !session.ids.has(id) ||
      bridgeURL?.protocol !== extensionURL.protocol ||
      bridgeURL.host !== extensionURL.host ||
      bridgeURL.pathname !== extensionURL.pathname
    ) {
      port.disconnect()
      return
    }
    session.bridges.set(frameId, { id, port })
    port.onDisconnect.addListener(() => {
      if (session.bridges.get(frameId)?.port === port) session.bridges.delete(frameId)
    })
    return
  }
  if (port.name !== "viewport-frame" || sender?.tab?.id === undefined || !sender.frameId) {
    port.disconnect()
    return
  }
  const tabId = sender.tab.id
  const frameId = sender.frameId
  let identified = false
  let lastScroll = 0
  let lastClick = 0
  port.onMessage.addListener((message: FrameMessage) => {
    const session = sessions.get(tabId)
    if (!session) {
      port.disconnect()
      return
    }
    if (message.type === "identify" && typeof message.id === "string") {
      void chrome.webNavigation
        .getFrame({ tabId, frameId })
        .then(async (frame) => {
          if (!frame || sessions.get(tabId) !== session) return
          // Overlay previews use a small extension-origin document as a
          // renderer boundary, then load the site one frame below it. Only
          // accept that explicit bridge as an alternative parent; arbitrary
          // nested frames must never be able to claim a workspace viewport.
          let viewportId = message.id
          if (frame.parentFrameId !== 0) {
            // webNavigation does not expose extension-scheme parents. Their
            // runtime ports supply Chrome-verified URL and frame identity.
            const bridgeId = session.bridges.get(frame.parentFrameId)?.id
            if (!validURL(frame.url)) return
            if (!bridgeId || (viewportId && viewportId !== bridgeId)) return
            viewportId = bridgeId
          }
          if (!session.ids.has(viewportId) || sessions.get(tabId) !== session) return
          identified = true
          const previous = session.frames.get(frameId)
          if (previous?.port && previous.port !== port) previous.port.disconnect()
          for (const [oldFrameId, oldFrame] of session.frames) {
            if (oldFrameId !== frameId && oldFrame.id === viewportId) {
              oldFrame.port?.disconnect()
              session.frames.delete(oldFrameId)
            }
          }
          session.frames.set(frameId, { id: viewportId, port })
          port.postMessage({ type: "settings", sync: session.sync })
          send(session, {
            type: "status",
            id: viewportId,
            status: "connected",
          })
        })
        .catch(() => {})
      return
    }
    const frame = session.frames.get(frameId)
    if (!identified || frame?.port !== port || !session.ids.has(frame.id)) return
    if (message.type === "interaction" && validInteraction(message.event)) {
      const event = message.event
      const now = Date.now()
      if (!session.sync.enabled) return
      if (event.kind === "scroll" && now - lastScroll < 30) return
      if (event.kind === "click" && now - lastClick < 80) return
      if (event.kind === "scroll") lastScroll = now
      else if (event.kind === "click") lastClick = now
      for (const [otherId, target] of session.frames)
        if (otherId !== frameId && target.port) {
          try {
            target.port.postMessage({ type: "apply", event })
          } catch {
            /* Target navigated. */
          }
        }
    } else if (message.type === "navigate" && validURL(message.url))
      send(session, { type: "navigate", id: frame.id, url: message.url, replace: message.replace })
    else if (message.type === "miss")
      send(session, {
        type: "notice",
        text: "A synchronized click was skipped: no unique equivalent control exists in one preview.",
      })
  })
  port.onDisconnect.addListener(() => {
    const s = sessions.get(tabId)
    const f = s?.frames.get(frameId)
    if (s && f?.port === port) {
      f.port = undefined
      setTimeout(() => {
        const current = sessions.get(tabId)
        const replacement = current?.frames.get(frameId)
        if (current === s && replacement?.id === f.id && !replacement.port)
          send(s, { type: "status", id: f.id, status: "unverified" })
      }, 500)
    }
  })
})
function reportFrameNavigation(event: { tabId: number; frameId: number; url: string }) {
  const session = sessions.get(event.tabId)
  const frame = session?.frames.get(event.frameId)
  if (!session || !frame || !session.ids.has(frame.id) || !validURL(event.url)) return
  send(session, { type: "navigate", id: frame.id, url: event.url, replace: true })
}
chrome.webNavigation.onCommitted.addListener((event) => {
  if (event.frameId !== 0) {
    reportFrameNavigation(event)
    return
  }
  void initialization
    .then(async () => {
      if (!overlayTabs.has(event.tabId) || !supportedPageURL(event.url)) {
        if (overlayTabs.has(event.tabId)) await setOverlayActive(event.tabId, false)
        await clearFramePolicy(event.tabId)
      }
    })
    .catch(console.error)
})
function reportSameDocumentNavigation(event: { tabId: number; frameId: number; url: string }) {
  if (event.frameId !== 0) reportFrameNavigation(event)
  else {
    const session = sessions.get(event.tabId)
    if (session && overlayTabs.has(event.tabId) && validURL(event.url))
      send(session, { type: "open-url", url: event.url })
  }
}
chrome.webNavigation.onHistoryStateUpdated.addListener(reportSameDocumentNavigation)
chrome.webNavigation.onReferenceFragmentUpdated.addListener(reportSameDocumentNavigation)
chrome.webNavigation.onErrorOccurred.addListener((event) => {
  const session = sessions.get(event.tabId)
  if (!session || event.error === "net::ERR_ABORTED") return
  const bridge = session.bridges.get(event.parentFrameId)
  if (event.parentFrameId !== 0 && !bridge) return
  const frame = session.frames.get(event.frameId)
  const status = /^net::ERR_BLOCKED_BY_(RESPONSE|CSP)$/.test(event.error) ? "blocked" : "error"
  const detail =
    status === "blocked"
      ? "The site refused to load inside a preview. If automatic embed handling is off, enable it with the globe control. Otherwise, this site may require a browser tab."
      : `Chrome could not load this preview (${event.error}). Check the server and its embedding policy.`
  if (frame || bridge)
    send(session, {
      type: "status",
      id: frame?.id ?? bridge!.id,
      status,
      detail,
    })
  // A refused iframe cannot run the script that identifies its viewport ID.
  // Report its URL so the workspace can still mark the affected previews.
  else if (validURL(event.url)) send(session, { type: "preview-error", url: event.url, status, detail })
})
chrome.permissions.onRemoved.addListener(() => {
  void clearAllFramePolicies().catch(console.error)
  for (const session of sessions.values()) {
    send(session, { type: "workspace-ready", embedEnabled: false })
    for (const frame of session.frames.values()) frame.port?.disconnect()
  }
})
