/**
 * Kitchen new-order RING (not a soft beep).
 * Classic dual-tone phone/restaurant tablet pattern — rings a few times.
 */

let sharedCtx: AudioContext | null = null;
let stopTimer: ReturnType<typeof setTimeout> | null = null;

const audioListeners = new Set<() => void>();

/** True once the browser has allowed sound (after a user gesture). */
export function isAudioUnlocked(): boolean {
  return sharedCtx?.state === "running";
}

/** Subscribe to unlocked/locked changes (for UI status). Returns unsubscribe. */
export function subscribeAudioState(fn: () => void): () => void {
  audioListeners.add(fn);
  return () => audioListeners.delete(fn);
}

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!sharedCtx || sharedCtx.state === "closed") {
    sharedCtx = new Ctor();
    sharedCtx.onstatechange = () => audioListeners.forEach((fn) => fn());
  }
  return sharedCtx;
}

function dualToneBurst(ctx: AudioContext, startAt: number, duration: number, volume: number) {
  // Classic ring pair (~440 + 480 Hz)
  for (const freq of [440, 480]) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.03);
    gain.gain.setValueAtTime(volume, startAt + duration - 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startAt);
    osc.stop(startAt + duration + 0.02);
  }
}

/**
 * Browsers keep AudioContext suspended until a user gesture. Call once at app
 * start so the first click/key/touch anywhere unlocks sound for later alerts.
 */
export function installAudioUnlock(): () => void {
  if (typeof window === "undefined") return () => {};
  getAudioContext();
  const events = ["pointerdown", "keydown", "touchstart"] as const;
  const unlock = () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === "suspended") void ctx.resume();
    if (ctx && ctx.state !== "suspended") {
      for (const e of events) window.removeEventListener(e, unlock);
    }
  };
  for (const e of events) window.addEventListener(e, unlock);
  return () => {
    for (const e of events) window.removeEventListener(e, unlock);
  };
}

/** Shorter two-pulse alert for cancellations / stock alerts. */
export function playAlertTone() {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") void ctx.resume();
    const now = ctx.currentTime;
    dualToneBurst(ctx, now, 0.3, 0.2);
    dualToneBurst(ctx, now + 0.45, 0.3, 0.2);
  } catch {
    // Autoplay blocked — toast still notifies.
  }
}

/** Loud repeating ring when a new order arrives. */
export function playNewOrderChime() {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    if (ctx.state === "suspended") {
      void ctx.resume();
    }

    if (stopTimer != null) {
      clearTimeout(stopTimer);
      stopTimer = null;
    }

    const now = ctx.currentTime;
    const burst = 0.4; // ring on
    const gap = 0.2; // short gap inside a double-ring
    const pause = 0.55; // silence between ring cycles
    const cycles = 4; // how many "rinng-rinng" groups
    const volume = 0.22;

    let t = now;
    for (let cycle = 0; cycle < cycles; cycle++) {
      dualToneBurst(ctx, t, burst, volume);
      t += burst + gap;
      dualToneBurst(ctx, t, burst, volume);
      t += burst + pause;
    }

    const totalMs = Math.ceil((t - now) * 1000) + 200;
    stopTimer = setTimeout(() => {
      stopTimer = null;
    }, totalMs);
  } catch {
    // Autoplay / AudioContext may be blocked — toast still notifies.
  }
}

/** Warning tone + spoken "Order is getting late" for a delayed order. */
export function playLateOrderAlert(code?: string) {
  playAlertTone();
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    const text = code ? `Order ${code} is getting late` : "Order is getting late";
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "en-IN";
    utter.rate = 0.95;
    utter.volume = 1;
    // Wait for the tone, then speak.
    window.setTimeout(() => window.speechSynthesis.speak(utter), 900);
  } catch {
    // Speech blocked — tone + red card still notify.
  }
}
