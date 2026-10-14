const RULE_ID = 70001
const DISABLED_KEY = "viewportstudio.embedDisabledTabs"
let pending: Promise<unknown> = Promise.resolve()

// Chrome's rule updates are asynchronous. Serialize changes so each workspace
// preserves the other tabs' rules, even when opens and closes happen together.
function serialize<T>(operation: () => Promise<T>): Promise<T> {
  const result = pending.then(operation)
  pending = result.catch(() => {})
  return result
}

async function readPolicy() {
  const rules = await chrome.declarativeNetRequest.getSessionRules()
  const rule = rules.find((candidate) => candidate.id === RULE_ID)
  const stored = await chrome.storage.session.get(DISABLED_KEY)
  const disabled: number[] = Array.isArray(stored[DISABLED_KEY])
    ? stored[DISABLED_KEY].filter((id: unknown): id is number => Number.isInteger(id) && Number(id) >= 0)
    : []
  return { tabs: rule?.condition.tabIds ?? [], disabled }
}

async function writePolicy(tabs: number[]) {
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [RULE_ID],
    addRules: tabs.length
      ? [
          {
            id: RULE_ID,
            priority: 1,
            action: {
              type: "modifyHeaders",
              requestHeaders: [{ header: "sec-fetch-dest", operation: "set", value: "document" }],
              responseHeaders: [
                { header: "x-frame-options", operation: "remove" },
                { header: "content-security-policy", operation: "remove" },
              ],
            },
            condition: {
              regexFilter: "^https?://",
              resourceTypes: ["sub_frame"],
              tabIds: [...new Set(tabs)],
            },
          },
        ]
      : [],
  })
}

export function prepareFramePolicy(tabId: number) {
  return serialize(async () => {
    const { tabs, disabled } = await readPolicy()
    const enabled = !disabled.includes(tabId)
    if (tabs.includes(tabId) !== enabled)
      await writePolicy([...tabs.filter((id) => id !== tabId), ...(enabled ? [tabId] : [])])
    return enabled
  })
}

export function setFramePolicy(tabId: number, enabled: boolean) {
  return serialize(async () => {
    const { tabs, disabled } = await readPolicy()
    await writePolicy([...tabs.filter((id) => id !== tabId), ...(enabled ? [tabId] : [])])
    await chrome.storage.session.set({
      [DISABLED_KEY]: [...disabled.filter((id) => id !== tabId), ...(!enabled ? [tabId] : [])],
    })
    return enabled
  })
}

export function clearFramePolicy(tabId: number, forgetDisabled = true) {
  return serialize(async () => {
    const { tabs, disabled } = await readPolicy()
    if (tabs.includes(tabId)) await writePolicy(tabs.filter((id) => id !== tabId))
    if (forgetDisabled && disabled.includes(tabId))
      await chrome.storage.session.set({ [DISABLED_KEY]: disabled.filter((id) => id !== tabId) })
  })
}

export function clearAllFramePolicies() {
  return serialize(async () => {
    await writePolicy([])
    await chrome.storage.session.remove(DISABLED_KEY)
  })
}

export function removeLegacyFramePolicy() {
  return serialize(async () => {
    const rules = await chrome.declarativeNetRequest.getSessionRules()
    const rule = rules.find((candidate) => candidate.id === RULE_ID)
    if (rule?.condition.urlFilter) await writePolicy([])
    else if (rule && !rule.action.requestHeaders?.some((header) => header.header === "sec-fetch-dest"))
      await writePolicy(rule.condition.tabIds ?? [])
  })
}
