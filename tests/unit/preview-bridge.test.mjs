import assert from "node:assert/strict"
import { resolve } from "node:path"
import test from "node:test"
import vm from "node:vm"
import { build } from "vite"

const event = () => {
  const listeners = []
  return {
    addListener: (listener) => listeners.push(listener),
    emit: (...args) => listeners.forEach((listener) => listener(...args)),
  }
}
const port = (name, frameId, url) => ({
  name,
  sender: { tab: { id: 1 }, frameId, url },
  onMessage: event(),
  onDisconnect: event(),
  messages: [],
  disconnected: false,
  postMessage(message) {
    this.messages.push(message)
  },
  disconnect() {
    this.disconnected = true
    this.onDisconnect.emit()
  },
})
const flush = () => new Promise((done) => setImmediate(done))

test("extension bridges identify previews without a webNavigation parent document", async () => {
  const output = await build({
    configFile: false,
    logLevel: "silent",
    resolve: { alias: { "@": resolve("src") } },
    build: {
      write: false,
      minify: false,
      lib: { entry: "src/background/service-worker.ts", name: "Worker", formats: ["iife"] },
    },
  })
  const extensionURL = "chrome-extension://test-extension/"
  const frames = new Map([
    [11, { parentFrameId: 10, url: "https://example.com/" }],
    [12, { parentFrameId: 20, url: "https://example.com/advertisement" }],
    [13, { parentFrameId: 0, url: "https://example.com/" }],
  ])
  const navigation = Object.fromEntries(
    [
      "onDOMContentLoaded",
      "onCompleted",
      "onCommitted",
      "onHistoryStateUpdated",
      "onReferenceFragmentUpdated",
      "onErrorOccurred",
    ].map((name) => [name, event()])
  )
  const chrome = {
    runtime: { getURL: (path) => extensionURL + path, onMessage: event(), onConnect: event() },
    action: { onClicked: event() },
    tabs: { onUpdated: event(), onRemoved: event() },
    permissions: { onRemoved: event() },
    webNavigation: { ...navigation, getFrame: async ({ frameId }) => frames.get(frameId) ?? null },
    storage: {
      session: { get: async () => ({}), set: async () => {}, remove: async () => {} },
      local: { remove: async () => {} },
    },
    scripting: { getRegisteredContentScripts: async () => [] },
    declarativeNetRequest: { getSessionRules: async () => [], updateSessionRules: async () => {} },
  }
  const context = vm.createContext({ chrome, URL, console, setTimeout })
  vm.runInContext(output[0].output.find((chunk) => chunk.type === "chunk").code, context)
  const workspace = port("workspace", 0, "https://example.com/")
  chrome.runtime.onConnect.emit(workspace)
  const configure = (ids) => workspace.onMessage.emit({ type: "configure", ids, sync: { enabled: true } })
  configure(["viewport-1", "viewport-2"])
  await flush()

  const bridge = port("preview-bridge", 10, extensionURL + "preview-frame.html?id=viewport-1")
  chrome.runtime.onConnect.emit(bridge)
  const preview = port("viewport-frame", 11, "https://example.com/")
  chrome.runtime.onConnect.emit(preview)
  // Cross-origin navigation may clear window.name. Trust the registered parent.
  preview.onMessage.emit({ type: "identify", id: "" })
  await flush()
  assert.equal(preview.messages[0]?.type, "settings")
  assert.ok(workspace.messages.some((message) => message.id === "viewport-1" && message.status === "connected"))

  const unrelated = port("viewport-frame", 12, "https://example.com/advertisement")
  chrome.runtime.onConnect.emit(unrelated)
  unrelated.onMessage.emit({ type: "identify", id: "viewport-1" })
  await flush()
  assert.equal(unrelated.messages.length, 0)
  for (const url of [
    "https://example.com/preview-frame.html?id=viewport-1",
    extensionURL + "index.html?id=viewport-1",
    extensionURL + "preview-frame.html?id=unknown",
  ]) {
    const fake = port("preview-bridge", 20, url)
    chrome.runtime.onConnect.emit(fake)
    assert.equal(fake.disconnected, true)
  }

  const direct = port("viewport-frame", 13, "https://example.com/")
  chrome.runtime.onConnect.emit(direct)
  direct.onMessage.emit({ type: "identify", id: "viewport-2" })
  await flush()
  assert.equal(direct.messages[0]?.type, "settings")
  preview.onMessage.emit({ type: "interaction", event: { kind: "scroll", x: 0, y: 0.5 } })
  assert.equal(direct.messages.at(-1)?.type, "apply")

  // A refused site cannot identify itself; its bridge still supplies the ID.
  chrome.webNavigation.onErrorOccurred.emit({
    tabId: 1,
    frameId: 14,
    parentFrameId: 10,
    url: "https://example.com/blocked",
    error: "net::ERR_BLOCKED_BY_RESPONSE",
  })
  assert.equal(workspace.messages.at(-1)?.status, "blocked")
  assert.equal(workspace.messages.at(-1)?.id, "viewport-1")

  configure(["viewport-2"])
  assert.equal(bridge.disconnected, true)
  assert.equal(preview.disconnected, true)
  workspace.disconnect()
  assert.equal(direct.disconnected, true)
})
