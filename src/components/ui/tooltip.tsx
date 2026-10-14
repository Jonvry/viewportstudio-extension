import { type ReactElement, type ReactNode, cloneElement } from "react"
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip"
import { cn } from "cn"
import { getPopupContainer } from "@/utils/popup-container"

function TooltipHint({
  content,
  children,
  delay = 500,
}: {
  content: ReactNode
  children: ReactElement
  delay?: number
}) {
  const trigger = cloneElement(children, { title: undefined } as never)
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger render={trigger} delay={delay} />
      <TooltipPrimitive.Portal container={getPopupContainer()}>
        <TooltipPrimitive.Positioner className="z-60" side="top" sideOffset={6}>
          <TooltipPrimitive.Popup
            className={cn(
              "z-60 max-w-64 rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md"
            )}
          >
            {content}
          </TooltipPrimitive.Popup>
        </TooltipPrimitive.Positioner>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}

export { TooltipHint }
