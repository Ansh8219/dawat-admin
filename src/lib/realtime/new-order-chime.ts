/**
 * Kitchen new-order RING (not a soft beep).
 * Classic dual-tone phone/restaurant tablet pattern — rings a few times.
 */

let sharedCtx: AudioContext | null = null;
let stopTimer: ReturnType<typeof setTimeout> | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!sharedCtx || sharedCtx.state === "closed") {
    sharedCtx = new Ctor();
  }
  return sharedCtx;
}

function dualToneBurst(
  ctx: AudioContext,
  startAt: number,
  duration: number,
  volume: number,
) {
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
