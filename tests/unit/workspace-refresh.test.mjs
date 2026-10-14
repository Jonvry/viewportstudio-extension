import assert from "node:assert/strict"
import { resolve } from "node:path"
import test from "node:test"
import vm from "node:vm"
import { build } from "vite"

test("refresh retains the focused device with regenerated viewport IDs", async () => {
  const output = await build({
    configFile: false,
    logLevel: "silent",
    resolve: { alias: { "@": resolve("src") } },
    define: { "process.env.NODE_ENV": JSON.stringify("production") },
    build: {
      write: false,
      minify: false,
      lib: { entry: "src/stores/workspace.ts", name: "WorkspaceStore", formats: ["iife"] },
    },
  })
  const stored = {}
  const context = vm.createContext({
    crypto,
    URL,
    URLSearchParams,
    setTimeout,
    clearTimeout,
    location: { search: "" },
    chrome: {
      runtime: { id: "test-extension" },
      storage: { local: { get: async () => stored, set: async (value) => Object.assign(stored, value) } },
    },
  })
  vm.runInContext(output[0].output.find((chunk) => chunk.type === "chunk").code, context)
  const { initializeWorkspace, useWorkspace, flushWorkspace, restoreWorkspace } = context.WorkspaceStore
  await initializeWorkspace("https://example.com/")
  const device = useWorkspace.getState().viewports[1]
  useWorkspace.setState({ selected: device.id, layout: "focus" })
  await flushWorkspace()
  const saved = stored["viewportstudio.workspace.v1"]
  assert.equal(saved.selectedIndex, 1)
  const restored = restoreWorkspace(saved)
  assert.equal(restored.layout, "focus")
  assert.equal(restored.selected, restored.viewports[1].id)
  assert.notEqual(restored.selected, device.id)
  assert.equal(restored.viewports[1].name, device.name)
  for (const selectedIndex of [-1, 99, 1.5, "1", undefined]) {
    const fallback = restoreWorkspace({ ...saved, selectedIndex })
    assert.equal(fallback.selected, fallback.viewports[0].id)
  }
  useWorkspace.setState({ selected: useWorkspace.getState().viewports[0].id })
  await flushWorkspace()
  assert.equal(stored["viewportstudio.workspace.v1"].selectedIndex, 0)
})
