export function normalizeUrl(input: string): string {
  const trimmed = input.trim()
  if (!trimmed || /\s/.test(trimmed)) throw new Error("Enter a valid HTTP or HTTPS URL without spaces.")
  const local = /^(localhost|127\.0\.0\.1|\[::1\])(?=[:/]|$)/i.test(trimmed)
  const hasScheme = /^[a-z][a-z\d+.-]*:/i.test(trimmed) && !local && !/^[^/:]+\.([^/:]+):\d+(?:\/|$)/.test(trimmed)
  const url = new URL(hasScheme ? trimmed : `${local ? "http" : "https"}://${trimmed}`)
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Only HTTP and HTTPS websites are supported.")
  if (url.username || url.password) throw new Error("URLs with embedded credentials are not supported.")
  if (!url.hostname || url.href.length > 8192) throw new Error("That website address is not valid.")
  return url.href
}
