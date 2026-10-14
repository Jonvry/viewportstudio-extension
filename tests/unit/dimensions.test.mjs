import assert from "node:assert/strict"
import test from "node:test"
import { dimension, zoomLevel } from "../../src/features/viewport-management/dimensions.ts"

test("dimension rounds values and clamps to supported viewport limits", function dimensionLimits() {
  assert.equal(dimension(320.4), 320)
  assert.equal(dimension(239), 240)
  assert.equal(dimension(4000), 3840)
  assert.equal(dimension(Number.NaN), 390)
})

test("zoomLevel rounds percentages and clamps to supported limits", function zoomLimits() {
  assert.equal(zoomLevel(0.756), 0.76)
  assert.equal(zoomLevel(-1), 0.25)
  assert.equal(zoomLevel(2), 1)
  assert.equal(zoomLevel(Number.POSITIVE_INFINITY), 0.25)
})
