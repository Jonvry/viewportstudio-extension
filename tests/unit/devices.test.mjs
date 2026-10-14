import assert from "node:assert/strict"
import test from "node:test"
import { devices, foldableCounterpart } from "../../src/constants/devices.ts"

test("device catalog entries have distinct names and usable dimensions", function validDeviceCatalog() {
  const names = devices.map((device) => device.name)
  assert.equal(new Set(names).size, names.length)
  assert.ok(devices.length >= 30)
  assert.ok(devices.every((device) => device.width >= 240 && device.height >= 240))
})

test("foldable presets switch between matching cover and unfolded dimensions", function foldablePairs() {
  const cover = devices.find((device) => device.name === "Samsung Galaxy Z Fold5 (Cover)")
  const unfolded = foldableCounterpart(cover.name)
  const iPhoneCover = devices.find((device) => device.name === "iPhone Duo (Cover)")
  const iPhoneUnfolded = foldableCounterpart(iPhoneCover.name)

  assert.deepEqual(foldableCounterpart(cover.name), unfolded)
  assert.deepEqual(foldableCounterpart(unfolded.name), cover)
  assert.equal(cover.width, 344)
  assert.equal(cover.height, 882)
  assert.equal(unfolded.width, 690)
  assert.equal(unfolded.height, 829)
  assert.deepEqual(foldableCounterpart(iPhoneCover.name), iPhoneUnfolded)
  assert.deepEqual(foldableCounterpart(iPhoneUnfolded.name), iPhoneCover)
  assert.equal(
    devices.some((device) => device.name === unfolded.name),
    false
  )
  assert.equal(iPhoneCover.width, 466)
  assert.equal(iPhoneCover.height, 678)
  assert.equal(iPhoneUnfolded.width, 626)
  assert.equal(iPhoneUnfolded.height, 890)
  assert.equal(
    devices.some((device) => device.name === iPhoneUnfolded.name),
    false
  )
  assert.equal(foldableCounterpart("iPhone SE"), undefined)
})

test("requested Apple and Samsung models are available", function requestedModels() {
  const names = new Set(devices.map((device) => device.name))
  for (const name of [
    "iPhone 18 Pro",
    "iPhone 18 Pro Max",
    "iPhone Duo (Cover)",
    "Samsung Galaxy Tab S4",
    "Samsung Galaxy A51",
    "QHD (2K)",
  ]) {
    assert.ok(names.has(name), `${name} should be in the device catalog`)
  }
  assert.deepEqual(
    devices.find((device) => device.name === "QHD (2K)"),
    {
      name: "QHD (2K)",
      width: 2560,
      height: 1440,
      category: "Desktop",
    }
  )
})
