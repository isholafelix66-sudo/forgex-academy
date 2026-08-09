/**
 * WhatsApp-style message notification sound, synthesized with the Web Audio
 * API (no audio asset needed). Browsers require a user gesture before audio
 * can play, so call `unlockAudio()` once on first interaction.
 */

const SOUND_KEY = "forgex-chat-sound";

export function getChatSoundEnabled(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setChatSoundEnabled(on: boolean) {
  try {
    localStorage.setItem(SOUND_KEY, on ? "on" : "off");
  } catch {
    /* storage unavailable */
  }
}

let audioCtx: AudioContext | null = null;

function ensureCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return null;
    if (!audioCtx) audioCtx = new AC();
    if (audioCtx.state === "suspended") void audioCtx.resume();
    return audioCtx;
  } catch {
    // Audio unavailable in this environment (e.g. restricted iframe) — the
    // app must never crash because a notification sound couldn't be created.
    return null;
  }
}

/** Resume the audio context on the first user gesture (required by iOS). */
export function unlockAudio() {
  ensureCtx();
}

/** Bright two-tone “pop” (A5 → E6), similar to WhatsApp's new-message ping. */
export function playMessageSound() {
  try {
    if (!getChatSoundEnabled()) return;
    const c = ensureCtx();
    if (!c) return;
    const now = c.currentTime;
    const notes = [880, 1318.51]; // A5, E6
    for (let i = 0; i < notes.length; i++) {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = "sine";
      osc.frequency.value = notes[i];
      const t0 = now + i * 0.1;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.22, t0 + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.28);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(t0);
      osc.stop(t0 + 0.32);
    }
  } catch {
    /* audio unavailable — never crash the app */
  }
}
