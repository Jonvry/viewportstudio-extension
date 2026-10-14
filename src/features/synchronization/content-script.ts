// Bundled as a standalone classic script. No page-world API bridge is exposed.
import { restoreWorkspaceOnLoad } from "@/features/navigation/restore-workspace"
import type { FrameMessage, Interaction, SyncSettings } from "@/types"

;(() => {
  if (window === window.top) {
    void restoreWorkspaceOnLoad()
    return
  }
  // Reloading an unpacked extension invalidates scripts in already-open pages.
  // Those scripts must stop without throwing on later identification messages.
  let extensionOrigin: string
  try {
    extensionOrigin = chrome.runtime.getURL("").replace(/\/$/, "")
  } catch {
    return
  }
  const parentOrigin = (() => {
    try {
      return document.referrer ? new URL(document.referrer).origin : ""
    } catch {
      return ""
    }
  })()
  let port: chrome.runtime.Port | undefined
  let sync: SyncSettings = { enabled: false }
  let cleanup = () => {}
  let invalidated = false
  function applyPreviewScrollbarStyle() {
    if (document.getElementById("__viewportstudio_preview_scrollbars")) return
    const style = document.createElement("style")
    style.id = "__viewportstudio_preview_scrollbars"
    const css = `
      *::-webkit-scrollbar { width: 4px !important; height: 4px !important; }
      *::-webkit-scrollbar-track { background: transparent !important; }
      *::-webkit-scrollbar-thumb {
        border: 1px solid transparent !important;
        border-radius: 999px !important;
        background: rgba(120, 120, 120, .5) !important;
        background-clip: padding-box !important;
      }
      *::-webkit-scrollbar-thumb:hover { background: #c04f00 !important; background-clip: padding-box !important; }
    `
    const firefoxCSS = `
      @supports not selector(::-webkit-scrollbar) {
        :root, * {
          scrollbar-color: rgba(120, 120, 120, .55) transparent !important;
          scrollbar-width: thin !important;
        }
      }
    `
    // The page's height can change substantially while its HTML and styles load.
    // Reserve the thin scrollbar immediately, then reveal its settled thumb.
    const loadingCSS = `
      *::-webkit-scrollbar-thumb, *::-webkit-scrollbar-thumb:hover { background: transparent !important; }
    `
    style.textContent = css + firefoxCSS + (document.readyState === "complete" ? "" : loadingCSS)
    if (document.readyState !== "complete") {
      window.addEventListener(
        "load",
        () => {
          style.textContent = css + firefoxCSS
        },
        { once: true }
      )
    }
    const appendStyle = () => {
      const parent = document.head ?? document.documentElement
      if (!parent) return false
      parent.append(style)
      return true
    }
    if (!appendStyle()) {
      const observer = new MutationObserver(() => {
        if (appendStyle()) observer.disconnect()
      })
      observer.observe(document, { childList: true, subtree: true })
    }
  }
  function connect(id: string) {
    if (port || invalidated) return
    try {
      if (!chrome.runtime.id) {
        invalidated = true
        return
      }
      port = chrome.runtime.connect({ name: "viewport-frame" })
    } catch {
      invalidated = true
      sync = { enabled: false }
      cleanup()
      return
    }
    const connection = port
    const send = (message: FrameMessage) => {
      try {
        port?.postMessage(message)
      } catch {
        cleanup()
        sync = { enabled: false }
        port = undefined
      }
    }
    let ignoreUntil = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    let previousURL = location.href
    const onScroll = () => {
      if (!sync.enabled || performance.now() < ignoreUntil || timer) return
      timer = setTimeout(() => {
        timer = undefined
        if (!sync.enabled || performance.now() < ignoreUntil) return
        const root = document.documentElement
        send({
          type: "interaction",
          event: {
            kind: "scroll",
            x: scrollX / Math.max(1, root.scrollWidth - innerWidth),
            y: scrollY / Math.max(1, root.scrollHeight - innerHeight),
          },
        })
      }, 60)
    }
    const onClick = (event: MouseEvent) => {
      if (
        !sync.enabled ||
        !event.isTrusted ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return
      const element =
        event.target instanceof Element
          ? event.target.closest('button,a,input[type="checkbox"],input[type="radio"],[role="button"],[role="tab"]')
          : null
      if (!element || element.closest("form") || (element instanceof HTMLInputElement && element.type === "file"))
        return
      // Let the website's own router handle links. Its resulting navigation is
      // observed by the worker, without cancelling SPA handlers or reloading the app.
      if (element instanceof HTMLAnchorElement) return
      const selector = stableSelector(element)
      if (selector) send({ type: "interaction", event: { kind: "click", selector } })
    }
    const onInput = (event: Event) => {
      if (!sync.enabled || !event.isTrusted) return
      const target = event.target
      if (!(
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ))
        return
      if (
        target.disabled ||
        ((target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) && target.readOnly) ||
        (target instanceof HTMLInputElement &&
          ["password", "file", "hidden", "checkbox", "radio", "button", "submit", "reset", "image"].includes(
            target.type
          ))
      )
        return
      const selector = stableSelector(target)
      if (!selector || target.value.length > 8192) return
      const selectionStart =
        target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement ? target.selectionStart : null
      const selectionEnd =
        target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement ? target.selectionEnd : null
      send({
        type: "interaction",
        event: { kind: "input", selector, value: target.value, selectionStart, selectionEnd },
      })
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    document.addEventListener("click", onClick, true)
    document.addEventListener("input", onInput, true)
    const reportNavigation = () => {
      if (previousURL !== location.href) {
        previousURL = location.href
        send({ type: "navigate", url: previousURL, replace: true })
      }
    }
    const interval = setInterval(reportNavigation, 350)
    window.addEventListener("popstate", reportNavigation)
    window.addEventListener("hashchange", reportNavigation)
    cleanup = () => {
      window.removeEventListener("scroll", onScroll)
      document.removeEventListener("click", onClick, true)
      document.removeEventListener("input", onInput, true)
      window.removeEventListener("popstate", reportNavigation)
      window.removeEventListener("hashchange", reportNavigation)
      clearInterval(interval)
      clearTimeout(timer)
    }
    connection.onDisconnect.addListener(() => {
      // Reading lastError handles Chrome's "receiving end does not exist" error.
      try {
        void chrome.runtime.lastError
      } catch {
        invalidated = true
      }
      if (port !== connection) return
      cleanup()
      sync = { enabled: false }
      port = undefined
    })
    connection.onMessage.addListener(
      (message: { type: "settings"; sync: SyncSettings } | { type: "apply"; event: Interaction }) => {
        if (port !== connection) return
        if (message.type === "settings") {
          sync = message.sync
          applyPreviewScrollbarStyle()
          return
        }
        const event = message.event
        if (event.kind === "scroll" && sync.enabled) {
          ignoreUntil = performance.now() + 180
          const root = document.documentElement
          window.scrollTo({
            left: event.x * Math.max(0, root.scrollWidth - innerWidth),
            top: event.y * Math.max(0, root.scrollHeight - innerHeight),
            behavior: "instant",
          })
        } else if (event.kind === "click" && sync.enabled) {
          try {
            const matches = document.querySelectorAll(event.selector)
            const target = matches.length === 1 ? matches[0] : null
            if (
              !(target instanceof HTMLElement) ||
              target.closest("form") ||
              target instanceof HTMLAnchorElement ||
              target.getClientRects().length === 0 ||
              target.matches(':disabled,[aria-disabled="true"]')
            ) {
              send({ type: "miss", reason: "missing" })
              return
            }
            if (!target.matches('button,input[type="checkbox"],input[type="radio"],[role="button"],[role="tab"]'))
              return
            target.click()
          } catch {
            send({ type: "miss", reason: "selector" })
          }
        } else if (event.kind === "input" && sync.enabled) {
          try {
            const matches = document.querySelectorAll(event.selector)
            const target = matches.length === 1 ? matches[0] : null
            if (
              !(
                target instanceof HTMLInputElement ||
                target instanceof HTMLTextAreaElement ||
                target instanceof HTMLSelectElement
              ) ||
              target.disabled ||
              ((target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) && target.readOnly) ||
              (target instanceof HTMLInputElement &&
                ["password", "file", "hidden", "checkbox", "radio", "button", "submit", "reset", "image"].includes(
                  target.type
                )) ||
              target.getClientRects().length === 0 ||
              target.value.length > 8192
            ) {
              send({ type: "miss", reason: "missing" })
              return
            }
            if (target instanceof HTMLInputElement)
              Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(target, event.value)
            else if (target instanceof HTMLTextAreaElement)
              Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(target, event.value)
            else Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set?.call(target, event.value)
            target.dispatchEvent(new Event("input", { bubbles: true }))
            target.dispatchEvent(new Event("change", { bubbles: true }))
            if (
              (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) &&
              event.selectionStart !== null &&
              event.selectionEnd !== null
            ) {
              try {
                target.setSelectionRange(event.selectionStart, event.selectionEnd)
              } catch {
                /* Some input types do not support text selections. */
              }
            }
          } catch {
            send({ type: "miss", reason: "selector" })
          }
        }
      }
    )
    send({ type: "identify", id })
  }
  function stableSelector(element: Element) {
    const candidates: string[] = []
    if (element.id) candidates.push(`#${CSS.escape(element.id)}`)
    for (const attr of ["data-testid", "data-test", "aria-label", "name"]) {
      const value = element.getAttribute(attr)
      if (value) candidates.push(`${element.tagName.toLowerCase()}[${attr}="${CSS.escape(value)}"]`)
    }
    const stable = candidates.find(
      (selector) => selector.length < 2048 && document.querySelectorAll(selector).length === 1
    )
    if (stable) return stable

    const path: string[] = []
    let current: Element | null = element
    while (current && current !== document.documentElement) {
      const tag = current.tagName.toLowerCase()
      const tagName = current.tagName
      const parentElement: Element | null = current.parentElement
      const siblings: Element[] = parentElement
        ? Array.from(parentElement.children).filter((sibling: Element) => sibling.tagName === tagName)
        : []
      const position = siblings.length > 1 ? `:nth-of-type(${siblings.indexOf(current) + 1})` : ""
      path.unshift(`${tag}${position}`)
      const selector = path.join(" > ")
      if (selector.length >= 2048) return undefined
      if (document.querySelectorAll(selector).length === 1) return selector
      current = parentElement
    }
    return undefined
  }
  window.addEventListener("message", (event) => {
    if (
      event.source !== window.parent ||
      (event.origin !== extensionOrigin && event.origin !== parentOrigin) ||
      event.data?.type !== "VIEWPORTSTUDIO_IDENTIFY" ||
      typeof event.data.id !== "string" ||
      event.data.id.length > 80
    )
      return
    connect(event.data.id)
  })
  // Preview names are assigned before navigation. Connect at document_start,
  // instead of waiting for the parent's load event or one-second probe.
  // The worker still verifies the workspace ID and direct parent before styling.
  // Chrome clears window.name on cross-site navigation. Bridge previews are
  // identified by the worker from their trusted parent, so they also connect
  // when the website's name has been cleared.
  connect(/^(?:viewport-\d+|[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12})$/i.test(window.name) ? window.name : "")
  window.addEventListener("pagehide", () => {
    cleanup()
    try {
      port?.disconnect()
    } catch {
      // The extension may have been reloaded while this page was open.
    }
    sync = { enabled: false }
    port = undefined
  })
})()
