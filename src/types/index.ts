export type Category = "Mobile" | "Tablet" | "Desktop" | "Custom"
export interface Device {
  name: string
  width: number
  height: number
  category: Category
}
export interface Viewport extends Device {
  id: string
  zoom: number
  url: string
  revision: number
  row: number
}
export interface SyncSettings {
  enabled: boolean
}
export type FrameStatus = "loading" | "connected" | "unverified" | "blocked" | "error"
export type Interaction =
  | { kind: "scroll"; x: number; y: number }
  | { kind: "click"; selector: string }
  | { kind: "input"; selector: string; value: string; selectionStart: number | null; selectionEnd: number | null }
export type UIMessage = { type: "configure"; tabId?: number; ids: string[]; sync: SyncSettings }
export type ExtensionRuntimeMessage =
  | { type: "viewportstudio:set-frame-policy"; tabId?: number; enabled: boolean }
  | { type: "viewportstudio:navigate-tab"; url: string; replace: boolean }
  | { type: "viewportstudio:overlay-state" }
  | { type: "viewportstudio:restore-workspace" }
  | { type: "viewportstudio:close-workspace" }
  | { type: "viewportstudio:navigate-preview"; id: string; url: string; tabId?: number }
export interface ExtensionRuntimeResponse {
  url?: string
  enabled?: boolean
  active?: boolean
  navigated?: boolean
  error?: string
}
export type FrameMessage =
  | { type: "identify"; id: string }
  | { type: "interaction"; event: Interaction }
  | { type: "navigate"; url: string; replace?: boolean }
  | { type: "miss"; reason: string }
export type WorkerMessage =
  | { type: "open-url"; url: string }
  | { type: "status"; id: string; status: FrameStatus; detail?: string }
  | { type: "preview-error"; url: string; status: "blocked" | "error"; detail: string }
  | { type: "navigate"; id: string; url: string; replace?: boolean }
  | { type: "notice"; text: string }
  | { type: "workspace-ready"; embedEnabled: boolean }
