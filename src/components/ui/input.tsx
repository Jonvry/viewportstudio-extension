import type { ComponentProps } from "react"
import { cn } from "cn"

function Input({ className, type, ...props }: ComponentProps<"input">) {
  return (
    <input
      data-slot="input"
      type={type}
      className={cn(
        "h-9 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-sm text-foreground shadow-sm transition-colors outline-none placeholder:text-muted-foreground/70 focus-visible:border-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-muted-foreground/15 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Input }
