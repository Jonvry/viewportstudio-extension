import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import { moveViewport, viewportRows } from "@/features/viewport-management/arrangement"
import { useWorkspace } from "@/stores/workspace"
import type { Viewport } from "@/types"

interface CardPosition {
  id: string
  element: HTMLElement
  left: number
  top: number
  width: number
  height: number
  row: number
}

interface DragSession {
  id: string
  pointerId: number
  handle: HTMLElement
  startX: number
  startY: number
  x: number
  y: number
  offsetX: number
  offsetY: number
  active: boolean
  rows: string[][]
  lastTime: number
}

function cardPositions(canvas: HTMLElement): CardPosition[] {
  return Array.from(canvas.querySelectorAll<HTMLElement>("article[data-viewport-id]")).map((element) => ({
    id: element.dataset.viewportId!,
    element,
    // Offsets describe the chosen rows, unaffected by drag/FLIP transforms.
    left: element.offsetLeft,
    top: element.offsetTop,
    width: element.offsetWidth,
    height: element.offsetHeight,
    row: Number(element.dataset.rowIndex),
  }))
}

function insertionTarget(cards: CardPosition[], id: string, x: number, y: number) {
  const rows = [...new Set(cards.map((card) => card.row))]
    .toSorted((a, b) => a - b)
    .map((index) => {
      const items = cards.filter((card) => card.row === index).toSorted((a, b) => a.left - b.left)
      return {
        index,
        top: Math.min(...items.map((card) => card.top)),
        bottom: Math.max(...items.map((card) => card.top + card.height)),
        cards: items.filter((card) => card.id !== id),
      }
    })
  if (!rows.length) return
  // The spaces above, between, and below rows are intentional new-row targets.
  if (y < rows[0].top - 8) return { row: 0, index: 0, newRow: true }
  for (let index = 0; index < rows.length - 1; index++) {
    if (y > rows[index].bottom + 3 && y < rows[index + 1].top - 3)
      return { row: rows[index + 1].index, index: 0, newRow: true }
  }
  if (y > rows.at(-1)!.bottom + 4) return { row: rows.at(-1)!.index + 1, index: 0, newRow: true }
  const distance = (row: (typeof rows)[number]) => Math.max(row.top - y, y - row.bottom, 0)
  const row = rows.reduce<(typeof rows)[number] | undefined>(
    (nearest, candidate) => (!nearest || distance(candidate) < distance(nearest) ? candidate : nearest),
    undefined
  )
  if (!row) return
  const next = row.cards.findIndex((card) => x < card.left + card.width / 2)
  return { row: row.index, index: next === -1 ? row.cards.length : next, newRow: false }
}

export function useViewportReordering(viewports: Viewport[]) {
  const canvas = useRef<HTMLDivElement>(null)
  const placeholder = useRef<HTMLDivElement>(null)
  const session = useRef<DragSession | null>(null)
  const frame = useRef<number | null>(null)
  const previousPositions = useRef(new Map<string, CardPosition>())
  const animations = useRef(new Map<string, Animation>())
  const [draft, setDraft] = useState<string[][] | null>(null)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const rows = draft ?? viewportRows(viewports)
  const order = rows.flat()
  const orderKey = JSON.stringify(rows)

  const positionDraggedCard = useCallback((current: DragSession, cards: CardPosition[]) => {
    const container = canvas.current
    const card = cards.find((item) => item.id === current.id)
    if (!container || !card) return
    const bounds = container.getBoundingClientRect()
    const x = current.x - bounds.left - container.clientLeft + container.scrollLeft - current.offsetX - card.left
    const y = current.y - bounds.top - container.clientTop + container.scrollTop - current.offsetY - card.top
    card.element.style.transform = `translate3d(${x}px, ${y}px, 0)`
    if (placeholder.current)
      placeholder.current.style.cssText = `display:block;left:${card.left}px;top:${card.top}px;width:${card.width}px;height:${card.height}px;`
  }, [])

  const finish = useCallback((commit: boolean) => {
    const current = session.current
    if (!current) return
    session.current = null
    if (frame.current !== null) cancelAnimationFrame(frame.current)
    frame.current = null
    placeholder.current?.style.removeProperty("display")
    if (current.handle.hasPointerCapture(current.pointerId)) current.handle.releasePointerCapture(current.pointerId)
    if (commit && current.active) useWorkspace.getState().arrange(current.rows, current.id)
    setDraft(null)
    setDraggedId(null)
  }, [])

  const tick = useCallback(
    function tick(time: number) {
      const current = session.current
      const container = canvas.current
      if (!current?.active || !container) return
      const state = useWorkspace.getState()
      const ids = current.rows.flat()
      if (
        state.layout === "focus" ||
        state.viewports.length !== ids.length ||
        state.viewports.some((viewport) => !ids.includes(viewport.id))
      ) {
        finish(false)
        return
      }
      const bounds = container.getBoundingClientRect()
      const elapsed = Math.min(time - current.lastTime, 32) / 1000
      current.lastTime = time
      const speed = (coordinate: number, start: number, end: number) => {
        const edge = Math.min(64, (end - start) / 4)
        if (coordinate < start + edge) return -Math.min(1, (start + edge - coordinate) / edge) * 800
        if (coordinate > end - edge) return Math.min(1, (coordinate - end + edge) / edge) * 800
        return 0
      }
      container.scrollBy(
        speed(current.x, bounds.left, bounds.right) * elapsed,
        speed(current.y, bounds.top, bounds.bottom) * elapsed
      )
      const cards = cardPositions(container)
      positionDraggedCard(current, cards)
      const x = current.x - bounds.left - container.clientLeft + container.scrollLeft
      const y = current.y - bounds.top - container.clientTop + container.scrollTop
      const slot = cards.find((card) => card.id === current.id)
      // Keep the current slot until the pointer leaves it, avoiding jitter at boundaries.
      if (!slot || x < slot.left || x > slot.left + slot.width || y < slot.top || y > slot.top + slot.height) {
        const target = insertionTarget(cards, current.id, x, y)
        if (target) {
          const next = moveViewport(current.rows, current.id, target.row, target.index, target.newRow)
          if (JSON.stringify(next) !== JSON.stringify(current.rows)) {
            current.rows = next
            setDraft(next)
          }
        }
      }
      frame.current = requestAnimationFrame(tick)
    },
    [finish, positionDraggedCard]
  )

  const start = useCallback((event: ReactPointerEvent<HTMLElement>, id: string) => {
    if (!event.isPrimary || event.button !== 0 || session.current) return
    const element = event.currentTarget.closest("article")
    if (!element) return
    const bounds = element.getBoundingClientRect()
    const state = useWorkspace.getState()
    if (state.layout === "focus" || state.viewports.length < 2) return
    event.currentTarget.setPointerCapture(event.pointerId)
    session.current = {
      id,
      pointerId: event.pointerId,
      handle: event.currentTarget,
      startX: event.clientX,
      startY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      offsetX: event.clientX - bounds.left,
      offsetY: event.clientY - bounds.top,
      active: false,
      rows: viewportRows(state.viewports),
      lastTime: performance.now(),
    }
  }, [])

  const move = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const current = session.current
      if (!current || event.pointerId !== current.pointerId) return
      current.x = event.clientX
      current.y = event.clientY
      if (!current.active && Math.hypot(current.x - current.startX, current.y - current.startY) >= 6) {
        current.active = true
        animations.current.get(current.id)?.cancel()
        setDraggedId(current.id)
        setDraft(current.rows)
        frame.current = requestAnimationFrame(tick)
      }
      if (current.active) event.preventDefault()
    },
    [tick]
  )

  useLayoutEffect(() => {
    const container = canvas.current
    if (!container) return
    const cards = cardPositions(container)
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches
    for (const [id, animation] of animations.current) {
      if (cards.some((card) => card.id === id)) continue
      animation.cancel()
      animations.current.delete(id)
    }
    for (const card of cards) {
      if (card.id === session.current?.id) continue
      const previous = previousPositions.current.get(card.id)
      const transform = getComputedStyle(card.element).transform
      const translation = transform === "none" ? undefined : new DOMMatrixReadOnly(transform)
      const x = (previous ? previous.left - card.left : 0) + (translation?.m41 ?? 0)
      const y = (previous ? previous.top - card.top : 0) + (translation?.m42 ?? 0)
      animations.current.get(card.id)?.cancel()
      card.element.style.removeProperty("transform")
      if (!reducedMotion && (x || y))
        animations.current.set(
          card.id,
          card.element.animate([{ transform: `translate(${x}px, ${y}px)` }, { transform: "translate(0, 0)" }], {
            duration: 180,
            easing: "cubic-bezier(.2,.8,.2,1)",
          })
        )
    }
    previousPositions.current = new Map(cards.map((card) => [card.id, card]))
    if (session.current?.active) positionDraggedCard(session.current, cards)
  }, [orderKey, draggedId, positionDraggedCard])

  useEffect(() => {
    const animationMap = animations.current
    const cancel = (event: KeyboardEvent) => {
      if (event.key === "Escape" && session.current) {
        event.preventDefault()
        event.stopPropagation()
        finish(false)
      }
    }
    window.addEventListener("keydown", cancel, true)
    return () => {
      window.removeEventListener("keydown", cancel, true)
      if (frame.current !== null) cancelAnimationFrame(frame.current)
      for (const animation of animationMap.values()) animation.cancel()
      const current = session.current
      session.current = null
      if (current?.handle.hasPointerCapture(current.pointerId)) current.handle.releasePointerCapture(current.pointerId)
    }
  }, [finish])

  return { canvas, placeholder, rows, order, draggedId, start, move, finish }
}
