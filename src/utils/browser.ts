export const isExtension = () => typeof chrome !== "undefined" && Boolean(chrome.runtime?.id)
export const isExtensionPage = () => isExtension() && location.protocol === "chrome-extension:"

export function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

export async function openExternal(url: string) {
  if (isExtension()) await chrome.tabs.create({ url })
  else window.open(url, "_blank", "noopener,noreferrer")
}
