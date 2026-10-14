import { Component } from "react"
import type { ErrorInfo, ReactNode } from "react"
import { Button } from "@/components/ui/button"

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ViewportStudio rendering error", error, info.componentStack)
  }
  render() {
    if (this.state.failed)
      return (
        <div className="flex h-dvh items-center justify-center bg-background px-6 text-foreground" role="alert">
          <div className="max-w-md space-y-3 text-center">
            <h1 className="text-xl font-semibold">The workspace could not render.</h1>
            <p className="text-sm text-muted-foreground">
              Your saved settings are still on this device. Reload to try again.
            </p>
            <Button title="Reload workspace" onClick={() => location.reload()}>
              Reload workspace
            </Button>
          </div>
        </div>
      )
    return this.props.children
  }
}
