import assert from "node:assert/strict"
import test from "node:test"
import { normalizeUrl } from "../../src/features/navigation/url.ts"

test("normalizeUrl trims input and adds the expected scheme", function normalizeDefaults() {
  assert.equal(normalizeUrl("  example.com/path  "), "https://example.com/path")
  assert.equal(normalizeUrl("localhost:5173"), "http://localhost:5173/")
})

test("normalizeUrl accepts explicit HTTP and HTTPS URLs", function acceptsSupportedSchemes() {
  assert.equal(normalizeUrl("http://example.com"), "http://example.com/")
  assert.equal(normalizeUrl("https://example.com"), "https://example.com/")
})

test("normalizeUrl rejects unsupported protocols, whitespace, and embedded credentials", function rejectsInvalidInput() {
  assert.throws(() => normalizeUrl(""), /valid HTTP or HTTPS URL/)
  assert.throws(() => normalizeUrl("https://example.com/a b"), /without spaces/)
  assert.throws(() => normalizeUrl("javascript:alert(1)"), /Only HTTP and HTTPS/)
  assert.throws(() => normalizeUrl("https://user:secret@example.com"), /embedded credentials/)
})
