import { useEffect } from "react";

/**
 * "Look at me" helpers for when the admin isn't watching this tab:
 * desktop (OS) notifications, an unread count in the tab title, and a red dot on the favicon.
 */

// ── Desktop notifications ────────────────────────────────────────────────────

const PREF_KEY = "daawat-desktop-alerts";
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

export function subscribeDesktopAlerts(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function desktopAlertsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export type DesktopAlertsState = "unsupported" | "denied" | "off" | "on" | "ask";

/** Snapshot for useSyncExternalStore. */
export function desktopAlertsState(): DesktopAlertsState {
  if (!desktopAlertsSupported()) return "unsupported";
  const permission = Notification.permission;
  if (permission === "denied") return "denied";
  if (permission === "default") return "ask";
  return localStorage.getItem(PREF_KEY) === "off" ? "off" : "on";
}

/** Must run from a click: browsers only show the permission prompt after a user gesture. */
export async function enableDesktopAlerts(): Promise<DesktopAlertsState> {
  if (!desktopAlertsSupported()) return "unsupported";
  localStorage.removeItem(PREF_KEY);
  if (Notification.permission === "default") {
    try {
      await Notification.requestPermission();
    } catch {
      // Older Safari: callback-only API. Ignore; state below reflects reality.
    }
  }
  emit();
  return desktopAlertsState();
}

export function disableDesktopAlerts() {
  if (typeof window === "undefined") return;
  localStorage.setItem(PREF_KEY, "off");
  emit();
}

function tabIsWatched(): boolean {
  return document.visibilityState === "visible" && document.hasFocus();
}

/**
 * Show an OS notification, only while the tab is hidden or not focused (the toast covers the
 * focused case). `tag` collapses repeats of the same thing into one notification.
 */
export function showDesktopAlert(opts: {
  title: string;
  body?: string;
  tag?: string;
  /** Keep it on screen until clicked (new orders, counter payments). */
  sticky?: boolean;
  onClick?: () => void;
}) {
  if (typeof window === "undefined" || desktopAlertsState() !== "on" || tabIsWatched()) return;
  try {
    const n = new Notification(opts.title, {
      body: opts.body,
      tag: opts.tag,
      icon: "/icon-192.png",
      badge: "/favicon-32x32.png",
      requireInteraction: opts.sticky ?? false,
    });
    n.onclick = () => {
      window.focus();
      opts.onClick?.();
      n.close();
    };
  } catch {
    // Some mobile browsers only allow notifications from a service worker. The toast still shows.
  }
}

// ── Tab title + favicon badge ────────────────────────────────────────────────

const COUNT_PREFIX = /^\(\d+\+?\)\s/;

function badgeText(count: number) {
  return count > 99 ? "99+" : String(count);
}

function applyTitle(count: number) {
  const base = document.title.replace(COUNT_PREFIX, "");
  const next = count > 0 ? `(${badgeText(count)}) ${base}` : base;
  if (document.title !== next) document.title = next;
}

type IconLink = { el: HTMLLinkElement; href: string };
let originalIcons: IconLink[] | null = null;
let badgedHref: string | null = null;

function iconLinks(): HTMLLinkElement[] {
  return Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]'));
}

async function drawBadgedIcon(): Promise<string | null> {
  if (badgedHref) return badgedHref;
  const img = new Image();
  img.src = "/favicon-32x32.png";
  try {
    await img.decode();
  } catch {
    return null;
  }
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, 32, 32);
  ctx.beginPath();
  ctx.arc(24, 8, 7.5, 0, Math.PI * 2);
  ctx.fillStyle = "#ef4444";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();
  badgedHref = canvas.toDataURL("image/png");
  return badgedHref;
}

async function applyFavicon(on: boolean) {
  if (on) {
    const href = await drawBadgedIcon();
    if (!href) return;
    const links = iconLinks();
    originalIcons ??= links.map((el) => ({ el, href: el.href }));
    for (const el of links) if (el.href !== href) el.href = href;
    return;
  }
  if (!originalIcons) return;
  for (const { el, href } of originalIcons) el.href = href;
  originalIcons = null;
}

/**
 * Keeps "(N) " in front of the tab title and a red dot on the favicon while N > 0.
 * Route changes rewrite the title, so a MutationObserver puts the count back.
 */
export function useTabAttention(count: number) {
  useEffect(() => {
    if (typeof document === "undefined") return;
    applyTitle(count);
    void applyFavicon(count > 0);

    const titleEl = document.querySelector("title");
    const observer = titleEl ? new MutationObserver(() => applyTitle(count)) : null;
    if (titleEl)
      observer?.observe(titleEl, { childList: true, characterData: true, subtree: true });
    // The head manager may also swap the <title> node itself.
    const headObserver = new MutationObserver(() => applyTitle(count));
    headObserver.observe(document.head, { childList: true });

    return () => {
      observer?.disconnect();
      headObserver.disconnect();
    };
  }, [count]);

  // Restore on unmount (logout).
  useEffect(
    () => () => {
      if (typeof document === "undefined") return;
      applyTitle(0);
      void applyFavicon(false);
    },
    [],
  );
}
