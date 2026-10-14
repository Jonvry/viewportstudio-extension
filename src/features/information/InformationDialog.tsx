import { Cancel01Icon, LinkSquare02Icon, ShieldCheckIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogOverlay, DialogPopup, DialogPortal, DialogTitle } from "@/components/ui/dialog"
import { openExternal } from "@/utils/browser"

const repositoryUrl = "https://github.com/Jonvry/viewportstudio-extension"

export default function InformationDialog({ onClose }: { onClose: () => void }) {
  const isMac = /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent)
  const shortcutModifier = isMac ? "Option" : "Alt"
  const browserModifier = isMac ? "Cmd" : "Ctrl"
  const shadowRoot =
    typeof document === "undefined" ? undefined : document.getElementById("__viewportstudio_host")?.shadowRoot
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogPortal container={shadowRoot}>
        <DialogOverlay className="z-40 bg-black/55 backdrop-blur-[2px]" />
        <DialogPopup
          className="fixed top-1/2 left-1/2 z-50 flex max-h-[min(760px,calc(100dvh-2rem))] w-[min(520px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-hidden rounded-xl border border-border bg-popover p-5 text-sm text-popover-foreground shadow-2xl outline-none"
          aria-labelledby="workspace-information-dialog-title"
        >
          <div className="flex items-center justify-between border-b border-border pb-3">
            <DialogTitle id="workspace-information-dialog-title">ViewportStudio information</DialogTitle>
            <DialogClose
              aria-label="Close dialog"
              render={<Button variant="ghost" size="icon" className="size-8" title="Close dialog" />}
            >
              <HugeiconsIcon icon={Cancel01Icon} size={18} strokeWidth={2} aria-hidden="true" />
            </DialogClose>
          </div>
          <div className="workspace-dialog-scrollbar -mr-5 min-h-0 space-y-4 overflow-y-auto pr-5">
            <section className="space-y-2 text-xs leading-relaxed text-muted-foreground">
              <h3 className="text-xs font-semibold tracking-wide text-foreground uppercase">About ViewportStudio</h3>
              <p>ViewportStudio is open source under the MIT License. Explore the project or report an issue.</p>
              <button
                type="button"
                className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                onClick={() => void openExternal(repositoryUrl)}
              >
                View on GitHub
                <HugeiconsIcon icon={LinkSquare02Icon} size={13} strokeWidth={2} aria-hidden="true" />
              </button>
            </section>
            <section className="space-y-2 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-foreground uppercase">
                <HugeiconsIcon icon={ShieldCheckIcon} size={15} strokeWidth={2} aria-hidden="true" /> Site access
              </h3>
              <p>
                Website access is granted during installation. Preview interactions connect automatically. Manage or
                restrict website access in Chrome’s extension settings.
              </p>
              <p>
                Interaction scripts activate only in identified preview frames. Passwords and file inputs are excluded
                from synchronization.
              </p>
            </section>
            <section className="space-y-2 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
              <h3 className="text-xs font-semibold tracking-wide text-foreground uppercase">Keyboard shortcuts</h3>
              <div className="flex items-center justify-between">
                <span>Reload previews</span>
                <kbd className="rounded border border-border bg-muted px-2 py-0.5 text-[11px] text-foreground">
                  {shortcutModifier} + R
                </kbd>
              </div>
              <div className="flex items-center justify-between">
                <span>Zoom selected viewport</span>
                <kbd className="rounded border border-border bg-muted px-2 py-0.5 text-[11px] text-foreground">
                  {shortcutModifier} + + / −
                </kbd>
              </div>
              <div className="flex items-center justify-between">
                <span>Close dialog</span>
                <kbd className="rounded border border-border bg-muted px-2 py-0.5 text-[11px] text-foreground">Esc</kbd>
              </div>
              <p>
                Shortcuts work while focus is in the workspace UI. Chrome keeps {browserModifier} + L, R, and +/− for
                its own navigation and zoom.
              </p>
            </section>
            <section className="space-y-2 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
              <h3 className="text-xs font-semibold tracking-wide text-foreground uppercase">Embed policy exception</h3>
              <p>
                Automatic embed handling starts when you open a workspace. It removes X-Frame-Options and
                Content-Security-Policy response headers from HTTP and HTTPS iframes in that workspace tab. The globe
                turns it off or on without an approval dialog. Header changes end when you close the workspace or
                navigate away; other tabs keep their normal policies. This changes site protections in the workspace and
                cannot bypass every browser restriction or site frame-busting script.
              </p>
              <p>Shared cookies and storage mean previews are not independent browser profiles.</p>
            </section>
          </div>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  )
}
