import assert from "node:assert/strict"
import test from "node:test"
import { build } from "vite"

test("overlay build is self-contained and sizing is independent of the host page", async () => {
  const results = await build({
    configFile: "vite.overlay.config.ts",
    logLevel: "silent",
    build: { write: false, minify: false },
  })
  const result = Array.isArray(results) ? results[0] : results
  const entry = result.output.find((output) => output.type === "chunk" && output.isEntry)
  assert.ok(entry)
  assert.equal(entry.fileName, "overlay.js")
  assert.equal(result.output.length, 1)
  assert.equal(entry.imports.length, 0)
  // Rolldown may report inlined imports as references to this same chunk.
  assert.ok(entry.dynamicImports.every((fileName) => fileName === entry.fileName))
  assert.doesNotMatch(entry.code, /\bimport\s*\(/)
  assert.ok(!entry.code.includes("import.meta"))
  assert.ok(!entry.code.includes("__vitePreload"))
  assert.ok(entry.code.endsWith("ViewportStudioOverlay.mountWorkspace()\n"))

  // Check compiled CSS values, including expressions, while retaining the
  // rem-containing utility names used by the React markup.
  assert.match(entry.code, /--spacing:\s*4px/)
  assert.match(entry.code, /--text-sm:\s*14px/)
  assert.match(entry.code, /max-height:\s*min\(320px/)
  assert.ok(entry.code.includes("20rem"))
})
