import type { Device } from "@/types"

const galaxyZFold5Cover: Device = {
  name: "Samsung Galaxy Z Fold5 (Cover)",
  width: 344,
  height: 882,
  category: "Mobile",
}
const galaxyZFold5Unfolded: Device = {
  name: "Samsung Galaxy Z Fold5 (Unfolded)",
  width: 690,
  height: 829,
  category: "Mobile",
}
const iPhoneDuoCover: Device = {
  name: "iPhone Duo (Cover)",
  width: 466,
  height: 678,
  category: "Mobile",
}
const iPhoneDuoUnfolded: Device = {
  name: "iPhone Duo (Unfolded)",
  width: 626,
  height: 890,
  category: "Mobile",
}

export const foldableDevicePairs = [
  { folded: galaxyZFold5Cover, unfolded: galaxyZFold5Unfolded },
  { folded: iPhoneDuoCover, unfolded: iPhoneDuoUnfolded },
]

export function foldableCounterpart(name: string) {
  const pair = foldableDevicePairs.find(({ folded, unfolded }) => folded.name === name || unfolded.name === name)
  if (!pair) return undefined
  return pair.folded.name === name ? pair.unfolded : pair.folded
}

const mobileDevices: Device[] = [
  // Apple
  { name: "iPhone SE", width: 375, height: 667, category: "Mobile" },
  { name: "iPhone 11", width: 414, height: 896, category: "Mobile" },
  { name: "iPhone 11 Pro", width: 375, height: 812, category: "Mobile" },
  { name: "iPhone 11 Pro Max", width: 414, height: 896, category: "Mobile" },
  { name: "iPhone 12 mini", width: 375, height: 812, category: "Mobile" },
  { name: "iPhone 12", width: 390, height: 844, category: "Mobile" },
  { name: "iPhone 12 Pro", width: 390, height: 844, category: "Mobile" },
  { name: "iPhone 12 Pro Max", width: 428, height: 926, category: "Mobile" },
  { name: "iPhone 13 mini", width: 375, height: 812, category: "Mobile" },
  { name: "iPhone 13", width: 390, height: 844, category: "Mobile" },
  { name: "iPhone 13 Pro", width: 390, height: 844, category: "Mobile" },
  { name: "iPhone 13 Pro Max", width: 428, height: 926, category: "Mobile" },
  { name: "iPhone 14", width: 390, height: 844, category: "Mobile" },
  { name: "iPhone 14 Plus", width: 428, height: 926, category: "Mobile" },
  { name: "iPhone 14 Pro", width: 393, height: 852, category: "Mobile" },
  { name: "iPhone 14 Pro Max", width: 430, height: 932, category: "Mobile" },
  { name: "iPhone 15", width: 393, height: 852, category: "Mobile" },
  { name: "iPhone 15 Plus", width: 430, height: 932, category: "Mobile" },
  { name: "iPhone 15 Pro", width: 393, height: 852, category: "Mobile" },
  { name: "iPhone 15 Pro Max", width: 430, height: 932, category: "Mobile" },
  { name: "iPhone 16e", width: 390, height: 844, category: "Mobile" },
  { name: "iPhone 16", width: 402, height: 874, category: "Mobile" },
  { name: "iPhone 16 Plus", width: 440, height: 956, category: "Mobile" },
  { name: "iPhone 16 Pro", width: 402, height: 874, category: "Mobile" },
  { name: "iPhone 16 Pro Max", width: 440, height: 956, category: "Mobile" },
  { name: "iPhone 17e", width: 390, height: 844, category: "Mobile" },
  { name: "iPhone 17", width: 402, height: 874, category: "Mobile" },
  { name: "iPhone 17 Pro", width: 402, height: 874, category: "Mobile" },
  { name: "iPhone 17 Pro Max", width: 440, height: 956, category: "Mobile" },
  { name: "iPhone Air", width: 420, height: 912, category: "Mobile" },
  { name: "iPhone 18 Pro", width: 402, height: 874, category: "Mobile" },
  { name: "iPhone 18 Pro Max", width: 440, height: 956, category: "Mobile" },
  ...foldableDevicePairs.filter(({ folded }) => folded.name.startsWith("iPhone ")).map(({ folded }) => folded),
  // Google
  { name: "Google Pixel 8", width: 412, height: 915, category: "Mobile" },
  { name: "Google Pixel 8 Pro", width: 430, height: 932, category: "Mobile" },
  { name: "Google Pixel 9", width: 412, height: 923, category: "Mobile" },
  { name: "Google Pixel 9 Pro", width: 410, height: 914, category: "Mobile" },
  { name: "Google Pixel 9 Pro XL", width: 430, height: 932, category: "Mobile" },
  // Samsung
  { name: "Samsung Galaxy A51", width: 412, height: 915, category: "Mobile" },
  { name: "Samsung Galaxy S23", width: 360, height: 780, category: "Mobile" },
  { name: "Samsung Galaxy S24", width: 360, height: 780, category: "Mobile" },
  { name: "Samsung Galaxy S24+", width: 384, height: 854, category: "Mobile" },
  { name: "Samsung Galaxy S24 Ultra", width: 412, height: 915, category: "Mobile" },
  ...foldableDevicePairs.filter(({ folded }) => folded.name.startsWith("Samsung ")).map(({ folded }) => folded),
]

const tabletDevices: Device[] = [
  // Apple
  { name: "iPad Mini", width: 768, height: 1024, category: "Tablet" },
  { name: "iPad Air", width: 820, height: 1180, category: "Tablet" },
  { name: "iPad Pro", width: 1024, height: 1366, category: "Tablet" },
  { name: "iPad Air 13-inch (M4)", width: 1024, height: 1366, category: "Tablet" },
  { name: "iPad Pro 11-inch (M5)", width: 834, height: 1210, category: "Tablet" },
  { name: "iPad Pro 13-inch (M5)", width: 1032, height: 1376, category: "Tablet" },
  // Samsung
  { name: "Samsung Galaxy Tab S4", width: 800, height: 1280, category: "Tablet" },
  { name: "Samsung Galaxy Tab S11", width: 800, height: 1280, category: "Tablet" },
  { name: "Samsung Galaxy Tab S12+", width: 876, height: 1400, category: "Tablet" },
  { name: "Samsung Galaxy Tab S12 Ultra", width: 924, height: 1480, category: "Tablet" },
  { name: "Samsung Galaxy Tab S10 FE+", width: 900, height: 1440, category: "Tablet" },
]

const desktopDevices: Device[] = [
  // Apple Mac
  { name: "MacBook Air 13-inch", width: 1470, height: 956, category: "Desktop" },
  { name: "MacBook Air 15-inch", width: 1710, height: 1107, category: "Desktop" },
  { name: "MacBook Pro 14-inch", width: 1512, height: 982, category: "Desktop" },
  { name: "MacBook Pro 16-inch", width: 1728, height: 1117, category: "Desktop" },
  { name: "iMac 24-inch", width: 2240, height: 1260, category: "Desktop" },
  // Generic desktop sizes
  { name: "Laptop", width: 1280, height: 800, category: "Desktop" },
  { name: "Desktop", width: 1440, height: 900, category: "Desktop" },
  { name: "Full HD", width: 1920, height: 1080, category: "Desktop" },
  { name: "QHD (2K)", width: 2560, height: 1440, category: "Desktop" },
]

export const devices: Device[] = [...mobileDevices, ...tabletDevices, ...desktopDevices]
