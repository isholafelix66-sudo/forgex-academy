import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Reusable draggable floating action button.
 *
 * - Pointer events only (works for mouse + touch, `touch-action: none`).
 * - The FAB can be dragged anywhere but is always clamped fully inside the
 *   viewport (4px margin) so it can never get lost off-screen.
 * - A press that moves less than DRAG_THRESHOLD px is treated as a click and
 *   fires `onClick` — so normal taps still open the attached panel.
 *
 * Positioning is done by the caller via `className` (fixed bottom/right
 * utilities); dragging applies a CSS transform on top of that base position.
 */
const DRAG_THRESHOLD = 8; // px — smaller than this is treated as a click
const EDGE_MARGIN = 4; // px — minimum distance kept from every viewport edge

export function DraggableFab({
  onClick,
  children,
  className,
  title,
  ariaLabel,
  unreadCount,
}: {
  onClick: () => void;
  children: React.ReactNode;
  /** Fixed-position classes, e.g. "fixed ... bottom-6 right-4". */
  className?: string;
  title?: string;
  ariaLabel?: string;
  /** Optional badge count rendered top-right (chat-style). */
  unreadCount?: number;
}) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const dragging = useRef(false);
  const start = useRef({ x: 0, y: 0, ox: 0, oy: 0, left: 0, top: 0, w: 0, h: 0 });
  const moved = useRef(false);

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    // Only the primary button / first touch starts a drag.
    if (e.button !== 0 && e.pointerType !== "touch") return;
    const rect = btnRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragging.current = true;
    moved.current = false;
    start.current = {
      x: e.clientX,
      y: e.clientY,
      ox: offset.x,
      oy: offset.y,
      left: rect.left,
      top: rect.top,
      w: rect.width,
      h: rect.height,
    };
    btnRef.current?.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragging.current) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;
    if (!moved.current && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
      moved.current = true;
    }
    if (!moved.current) return;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let nx = start.current.ox + dx;
    let ny = start.current.oy + dy;

    // Clamp so the (base position + transform) rect stays fully on screen.
    const minLeft = EDGE_MARGIN;
    const maxLeft = vw - start.current.w - EDGE_MARGIN;
    const minTop = EDGE_MARGIN;
    const maxTop = vh - start.current.h - EDGE_MARGIN;
    const newLeft = start.current.left + nx;
    const newTop = start.current.top + ny;
    if (newLeft < minLeft) nx += minLeft - newLeft;
    if (newLeft > maxLeft) nx -= newLeft - maxLeft;
    if (newTop < minTop) ny += minTop - newTop;
    if (newTop > maxTop) ny -= newTop - maxTop;

    setOffset({ x: nx, y: ny });
  };

  const onPointerEnd = () => {
    if (!dragging.current) return;
    dragging.current = false;
    if (!moved.current) onClick();
  };

  return (
    <button
      ref={btnRef}
      type="button"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      className={cn("select-none", className)}
      style={{
        touchAction: "none",
        transform: `translate(${offset.x}px, ${offset.y}px)`,
        userSelect: "none",
      }}
      title={title}
      aria-label={ariaLabel}
    >
      {children}
      {unreadCount !== undefined && unreadCount > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex size-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white ring-2 ring-background">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </button>
  );
}
