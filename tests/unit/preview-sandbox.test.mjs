import assert from "node:assert/strict"
import test from "node:test"
import { getOverlayPreviewURL, getPreviewSandbox } from "../../src/features/navigation/preview-sandbox.ts"

test("overlay previews load through the extension-origin bridge", () => {
  const url = getOverlayPreviewURL(
    "https://www.youtube.com/watch?v=example",
    "viewport-id",
    "chrome-extension://extension-id/"
  )
  const parsed = new URL(url)
  assert.equal(parsed.protocol, "chrome-extension:")
  assert.equal(parsed.host, "extension-id")
  assert.equal(parsed.pathname, "/preview-frame.html")
  assert.equal(parsed.searchParams.get("url"), "https://www.youtube.com/watch?v=example")
  assert.equal(parsed.searchParams.get("id"), "viewport-id")
})

test("same-origin website overlays preserve the site's native origin", () => {
  for (const url of ["https://www.youtube.com/watch?v=example", "http://localhost:5173/path"]) {
    assert.equal(getPreviewSandbox(url, new URL(url).origin, true), undefined)
  }
})

test("cross-origin previews retain sandbox restrictions and their website origin", () => {
  for (const overlay of [false, true]) {
    const sandbox = getPreviewSandbox("https://other.example/path", "https://example.com", overlay)
    const tokens = sandbox.split(" ")
    assert.ok(tokens.includes("allow-scripts"))
    assert.ok(tokens.includes("allow-same-origin"))
    assert.ok(!tokens.includes("allow-top-navigation"))
    assert.ok(!tokens.includes("allow-top-navigation-by-user-activation"))
  }
})

test("blank, sample, and invalid previews keep an opaque origin", () => {
  for (const url of ["", "not a URL"]) {
    const sandbox = getPreviewSandbox(url, "https://example.com", true)
    assert.ok(sandbox.includes("allow-scripts"))
    assert.ok(!sandbox.includes("allow-same-origin"))
  }
})

test("a workspace's own origin remains sandboxed outside website overlays", () => {
  for (const overlay of [false, true]) {
    const sandbox = getPreviewSandbox("chrome-extension://example/index.html", "null", overlay)
    assert.ok(sandbox.includes("allow-scripts"))
    assert.ok(!sandbox.includes("allow-same-origin"))
  }
  assert.ok(!getPreviewSandbox("https://example.com", "https://example.com", false).includes("allow-same-origin"))
})
