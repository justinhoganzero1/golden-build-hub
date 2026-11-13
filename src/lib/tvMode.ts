/**
 * Google TV / Android TV support: the remote's arrow keys move a clear focus
 * highlight between buttons and links, OK presses them, and the play/pause key
 * controls videos. Only switched on for TVs, so phones and computers keep
 * their normal arrow-key scrolling.
 */

const TV_UA = /\b(OracleLunarTV|Android TV|AndroidTV|GoogleTV|Google TV|SmartTV|SMART-TV|BRAVIA|AFT[A-Z0-9]+|CrKey|Tizen|Web0S|WebOS|HbbTV|NetCast|Aquos|Kogan.*TV)\b/i;

export function isTvUserAgent(ua: string): boolean {
  return TV_UA.test(ua || "");
}

export function isTvDevice(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (new URLSearchParams(window.location.search).get("tv") === "1") sessionStorage.setItem("oracle-tv-mode", "1");
    if (sessionStorage.getItem("oracle-tv-mode") === "1") return true;
  } catch { /* storage blocked */ }
  return isTvUserAgent(navigator.userAgent);
}

export type Dir = "up" | "down" | "left" | "right";
export type Box = { left: number; top: number; right: number; bottom: number };

const KEY_DIR: Record<string, Dir> = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };

/** Picks the closest box in a direction (pure, so it can be tested). */
export function pickNext(from: Box, dir: Dir, candidates: Box[]): number {
  const cx = (from.left + from.right) / 2;
  const cy = (from.top + from.bottom) / 2;
  let best = -1;
  let bestScore = Infinity;
  candidates.forEach((b, i) => {
    const bx = (b.left + b.right) / 2;
    const by = (b.top + b.bottom) / 2;
    let primary: number;
    let offset: number;
    if (dir === "down" || dir === "up") {
      primary = dir === "down" ? b.top - from.bottom : from.top - b.bottom;
      if ((dir === "down" ? by - cy : cy - by) <= 1) return;
      const overlap = Math.min(from.right, b.right) - Math.max(from.left, b.left);
      offset = overlap > 0 ? 0 : Math.abs(bx - cx);
    } else {
      primary = dir === "right" ? b.left - from.right : from.left - b.right;
      if ((dir === "right" ? bx - cx : cx - bx) <= 1) return;
      const overlap = Math.min(from.bottom, b.bottom) - Math.max(from.top, b.top);
      offset = overlap > 0 ? 0 : Math.abs(by - cy);
    }
    const score = Math.max(primary, -8) + offset * 2.5;
    if (score < bestScore) { bestScore = score; best = i; }
  });
  return best;
}

const FOCUSABLE = [
  "a[href]", "button", "input:not([type=hidden])", "select", "textarea", "video[controls]", "summary",
  "[role=button]", "[role=link]", "[role=tab]", "[role=menuitem]", "[role=option]", "[role=switch]", "[role=checkbox]",
  "[tabindex]", "[contenteditable=true]",
].join(",");

function isVisible(el: HTMLElement): boolean {
  if ((el as HTMLButtonElement).disabled || el.getAttribute("tabindex") === "-1") return false;
  if (el.closest("[inert],[aria-hidden=true]")) return false;
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return false;
  const style = getComputedStyle(el);
  return style.visibility !== "hidden" && style.display !== "none" && Number(style.opacity) > 0.05;
}

function scope(): ParentNode {
  const dialogs = document.querySelectorAll<HTMLElement>('[role=dialog][data-state=open],[role=alertdialog][data-state=open],[aria-modal=true]');
  return dialogs.length ? dialogs[dialogs.length - 1] : document;
}

function focusables(): HTMLElement[] {
  return Array.from(scope().querySelectorAll<HTMLElement>(FOCUSABLE)).filter(isVisible);
}

function box(el: Element): Box {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
}

function moveFocus(el: HTMLElement) {
  el.focus({ preventScroll: true });
  el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
}

function isTextEntry(el: Element | null): el is HTMLInputElement | HTMLTextAreaElement {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLInputElement) return !["button", "submit", "checkbox", "radio", "range", "file", "color", "reset", "image"].includes(el.type);
  return (el as HTMLElement).isContentEditable;
}

function caretAtEdge(el: HTMLInputElement | HTMLTextAreaElement, dir: Dir): boolean {
  try {
    const len = (el.value || "").length;
    if (dir === "left") return (el.selectionStart ?? 0) === 0;
    if (dir === "right") return (el.selectionEnd ?? len) === len;
  } catch { /* some inputs have no caret */ }
  return true;
}

function toggleVideo(target?: Element | null) {
  const video = (target instanceof HTMLVideoElement ? target : null)
    || Array.from(document.querySelectorAll("video")).find((v) => !v.paused)
    || Array.from(document.querySelectorAll("video")).find((v) => isVisible(v));
  if (!video) return false;
  if (video.paused) void video.play().catch(() => {});
  else video.pause();
  return true;
}

function onKey(e: KeyboardEvent) {
  if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
  const active = document.activeElement as HTMLElement | null;

  if (e.key === "MediaPlayPause" || e.key === "MediaPlay" || e.key === "MediaPause") {
    if (toggleVideo(active)) e.preventDefault();
    return;
  }
  if ((e.key === "Enter" || e.key === " ") && active instanceof HTMLVideoElement) {
    e.preventDefault();
    toggleVideo(active);
    return;
  }

  const dir = KEY_DIR[e.key];
  if (!dir) return;
  if (active instanceof HTMLSelectElement || (active instanceof HTMLInputElement && active.type === "range")) return;
  if (active?.closest("[role=listbox],[role=menu],[role=radiogroup],[role=slider]") && !active.matches("[role=menuitem],[role=option]")) return;
  if (isTextEntry(active)) {
    if (dir === "left" || dir === "right") { if (!caretAtEdge(active, dir)) return; }
    else if (active instanceof HTMLTextAreaElement && active.value.includes("\n")) return;
  }

  const items = focusables();
  const hasFocus = active && active !== document.body && items.includes(active);
  if (!hasFocus) {
    if (!items.length) return;
    const vh = window.innerHeight;
    const onScreen = items.filter((el) => { const b = box(el); return b.bottom > 0 && b.top < vh; });
    e.preventDefault();
    moveFocus((onScreen[0] || items[0]));
    return;
  }

  const others = items.filter((el) => el !== active);
  const idx = pickNext(box(active!), dir, others.map(box));
  if (idx >= 0) {
    e.preventDefault();
    moveFocus(others[idx]);
  } else if (dir === "up" || dir === "down") {
    e.preventDefault();
    window.scrollBy({ top: (dir === "down" ? 1 : -1) * window.innerHeight * 0.6, behavior: "smooth" });
  }
}

let installed = false;

export function installTvNavigation(force = false) {
  if (installed || typeof document === "undefined") return;
  if (!force && !isTvDevice()) return;
  installed = true;
  document.documentElement.classList.add("tv-mode");
  window.addEventListener("keydown", onKey, true);
}
