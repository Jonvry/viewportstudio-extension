export const isExtension = () => typeof chrome !== "undefined" && Boolean(chrome.runtime?.id)
export const isExtensionPage = () => isExtension() && location.protocol === "chrome-extension:"

export function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

export async function openExternal(url: string) {
  if (!isExtension()) {
    window.open(url, "_blank", "noopener,noreferrer")
    return
  }

  // Content scripts have a runtime ID but do not expose chrome.tabs.
  if (chrome.tabs?.create) {
    await chrome.tabs.create({ url })
    return
  }

  await chrome.runtime.sendMessage({ type: "viewportstudio:open-external", url })
}
