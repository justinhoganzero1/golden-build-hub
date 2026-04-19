import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Makes a floating button draggable. Persists position in localStorage.
 * Returns { ref, style, dragging, justDragged } — attach ref to the element,
 * spread style, and use justDragged to suppress the click that ends a drag.
 */
export function useDraggable(storageKey: string, defaultRight = 20, defaultBottom = 20) {
  const ref = useRef<HTMLButtonElement | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const draggingRef = useRef(false);
  const movedRef = useRef(false);
  const startRef = useRef({ x: 0, y: 0, px: 0, py: 0 });
  const [justDragged, setJustDragged] = useState(false);

  const clamp = (x: number, y: number) => {
    const el = ref.current;
    const w = el?.offsetWidth ?? 56;
    const h = el?.offsetHeight ?? 56;
    return {
      x: Math.max(8, Math.min(window.innerWidth - w - 8, x)),
      y: Math.max(8, Math.min(window.innerHeight - h - 8, y)),
    };
  };

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    draggingRef.current = true;
    movedRef.current = false;
    startRef.current = { x: e.clientX, y: e.clientY, px: rect.left, py: rect.top };
    el.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    const dx = e.clientX - startRef.current.x;
    const dy = e.clientY - startRef.current.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) movedRef.current = true;
    setPos(clamp(startRef.current.px + dx, startRef.current.py + dy));
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    try { ref.current?.releasePointerCapture(e.pointerId); } catch {}
    if (movedRef.current && pos) {
      try { localStorage.setItem(storageKey, JSON.stringify(pos)); } catch {}
      setJustDragged(true);
      setTimeout(() => setJustDragged(false), 50);
    }
  }, [pos, storageKey]);

  // Re-clamp on resize
  useEffect(() => {
    const onResize = () => { if (pos) setPos(clamp(pos.x, pos.y)); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [pos]);

  const style: React.CSSProperties = pos
    ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto", touchAction: "none" }
    : { right: defaultRight, bottom: defaultBottom, touchAction: "none" };

  return {
    ref,
    style,
    dragHandlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
    justDragged,
  };
}
