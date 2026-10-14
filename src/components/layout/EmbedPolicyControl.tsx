import { useId, useState } from "react"
import { Globe02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { useWorkspace } from "@/stores/workspace"
import type { ExtensionRuntimeResponse } from "@/types"
import { errorText, isExtension, isExtensionPage } from "@/utils/browser"

export function EmbedPolicyControl() {
  const url = useWorkspace((state) => state.url)
  const enabled = useWorkspace((state) => state.embedEnabled)
  const ready = useWorkspace((state) => state.previewReady)
  const previewBlocked = useWorkspace((state) =>
    state.viewports.some((viewport) => state.statuses[viewport.id]?.status === "blocked")
  )
  const hintId = useId()
  const [updating, setUpdating] = useState(false)
  const needsAttention = Boolean(url) && previewBlocked
  const label = enabled ? "Automatic embed handling on; turn off" : "Automatic embed handling off; turn on"

  async function togglePolicy() {
    if (!isExtension()) {
      useWorkspace.setState({ notice: "Automatic embed handling is available in the installed extension." })
      return
    }
    setUpdating(true)
    try {
      const tab = isExtensionPage() ? await chrome.tabs.getCurrent() : undefined
      const result = (await chrome.runtime.sendMessage({
        type: "viewportstudio:set-frame-policy",
        tabId: tab?.id,
        enabled: !enabled,
      })) as ExtensionRuntimeResponse | undefined
      if (result?.error || typeof result?.enabled !== "boolean")
        throw new Error(result?.error ?? "Chrome could not update automatic embed handling.")
      useWorkspace.setState({
        embedEnabled: result.enabled,
        notice: result.enabled
          ? "Automatic embed handling enabled for this workspace. Reloading previews."
          : "Automatic embed handling disabled for this workspace. Reloading previews.",
      })
      useWorkspace.getState().reload()
    } catch (error) {
      useWorkspace.setState({ notice: errorText(error) })
    } finally {
      setUpdating(false)
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "relative size-9 rounded-lg",
          enabled && "text-primary",
          needsAttention && "bg-primary/10 text-primary ring-1 ring-primary/40 hover:bg-primary/15",
          needsAttention && !updating && "preview-attention"
        )}
        aria-label={label}
        title={needsAttention ? `Preview blocked. ${label}.` : label}
        aria-describedby={needsAttention ? hintId : undefined}
        aria-pressed={enabled}
        aria-busy={updating}
        disabled={!url || !ready || updating}
        onClick={() => void togglePolicy()}
      >
        <HugeiconsIcon icon={Globe02Icon} size={15} strokeWidth={2} aria-hidden="true" />
      </Button>
      <span id={hintId} role="status" aria-live="polite" className="sr-only">
        {needsAttention
          ? enabled
            ? "A preview is still blocked with automatic embed handling enabled. Open the preview in a browser tab."
            : "A preview is blocked. Use the globe control to turn on automatic embed handling."
          : ""}
      </span>
    </>
  )
}
