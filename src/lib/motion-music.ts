/**
 * Background music for the "ForgeX in two minutes" motion film.
 *
 * A fully self-contained, synthesized music-box loop (no audio files, no
 * licensing): a gentle C → Am → F → G progression with a whisper-quiet,
 * low-passed pad, a warm sine bass and a sparkly celesta/music-box arpeggio
 * two octaves up, sent through a dreamy dotted-eighth delay. No percussion —
 * just a sweet, calming lullaby bed that sits softly under the film.
 *
 * The loop is scheduled ahead of time on a lookahead timer; pausing suspends
 * the AudioContext (freezing the timeline) and resuming continues it — the
 * film's play/pause maps 1:1 to the music.
 */

export type MotionMusic = {
  resume: () => void;
  suspend: () => void;
  setMuted: (muted: boolean) => void;
  dispose: () => void;
  /** True once dispose() has run — callers should recreate instead of reusing. */
  readonly disposed: boolean;
};

export function createMotionMusic(): MotionMusic | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;

  const ctx = new Ctor();

  // master → mute gain → destination (mute gain is just a volume cut)
  const master = ctx.createGain();
  master.gain.value = 0.4;
  const muteGain = ctx.createGain();
  muteGain.gain.value = 1;
  master.connect(muteGain).connect(ctx.destination);

  const midi = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

  const BPM = 72;
  const beat = 60 / BPM;
  const barDur = beat * 4;
  const eighth = beat / 2;

  // C → Am → F → G — warm, open, easy to hum
  const chords = [
    { root: midi(48), tones: [0, 4, 7] }, // C major
    { root: midi(45), tones: [0, 3, 7] }, // A minor
    { root: midi(41), tones: [0, 4, 7] }, // F major
    { root: midi(43), tones: [0, 4, 7] }, // G major
  ];

  // Pad — one soft low-passed triangle per chord tone, barely there
  const padFilter = ctx.createBiquadFilter();
  padFilter.type = "lowpass";
  padFilter.frequency.value = 900;
  padFilter.Q.value = 0.4;
  padFilter.connect(muteGain);

  // Dreamy dotted-eighth delay bus the music box rings through
  const delay = ctx.createDelay(1.0);
  delay.delayTime.value = eighth * 1.5;
  const delayFilter = ctx.createBiquadFilter();
  delayFilter.type = "lowpass";
  delayFilter.frequency.value = 3600;
  const delayFb = ctx.createGain();
  delayFb.gain.value = 0.32;
  delay.connect(delayFilter).connect(delayFb).connect(delay);
  delayFilter.connect(muteGain);

  function playNote(
    freq: number,
    t: number,
    dur: number,
    type: OscillatorType,
    peak: number,
    dest: AudioNode,
    attack = 0.02,
    release = 0.08,
  ) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.setValueAtTime(peak, Math.max(t + attack, t + dur - release));
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(dest);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  /** Music-box pluck — bell-like sine + shimmering octave, long natural decay. */
  function pluck(freq: number, t: number, peak: number) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    const bright = ctx.createOscillator();
    bright.type = "triangle";
    bright.frequency.value = freq * 2;
    const brightGain = ctx.createGain();
    brightGain.gain.value = 0.35;
    bright.connect(brightGain).connect(g);

    osc.connect(g);
    g.connect(muteGain); // dry
    g.connect(delay); // wet — the dreamy repeats
    osc.start(t);
    osc.stop(t + 1.5);
    bright.start(t);
    bright.stop(t + 1.5);
  }

  function scheduleBar(chordIdx: number, t: number) {
    const c = chords[chordIdx % chords.length];

    // Pad — whisper-quiet, slow attack
    for (const tone of c.tones) {
      playNote(
        c.root * Math.pow(2, tone / 12),
        t,
        barDur - 0.1,
        "triangle",
        0.018,
        padFilter,
        0.8,
        0.5,
      );
    }

    // Bass — warm sine root on beats 1 and 3
    playNote(c.root, t, beat * 1.9, "sine", 0.1, muteGain, 0.05, 0.25);
    playNote(c.root, t + beat * 2, beat * 1.9, "sine", 0.09, muteGain, 0.05, 0.25);

    // Music box — gentle rising/falling arpeggio, two octaves up
    const arp = [0, 4, 7, 12, 16, 12, 7, 4];
    arp.forEach((tone, i) => {
      pluck(c.root * Math.pow(2, (24 + tone) / 12), t + i * eighth, 0.055);
    });
  }

  // Lookahead scheduler — keeps the loop rolling indefinitely.
  let barIdx = 0;
  let nextBarTime = ctx.currentTime + 0.1;
  const timer = window.setInterval(() => {
    while (nextBarTime < ctx.currentTime + 0.5) {
      scheduleBar(barIdx, nextBarTime);
      nextBarTime += barDur;
      barIdx = (barIdx + 1) % chords.length;
    }
  }, 120);

  // Once closed, every AudioContext call throws or rejects — remember it so
  // stale handles (StrictMode double-mount, late play/pause taps, tab
  // visibility toggles) no-op instead of surfacing "Cannot resume/close a
  // closed AudioContext". Promise rejections are swallowed explicitly too,
  // since `resume()`/`close()` on a closed context reject asynchronously and
  // an unhandled rejection would still crash the app.
  let disposed = false;

  return {
    get disposed() {
      return disposed;
    },
    resume() {
      if (disposed || ctx.state === "closed") return;
      if (ctx.state !== "running") ctx.resume().catch(() => {});
    },
    suspend() {
      if (disposed || ctx.state !== "running") return;
      ctx.suspend().catch(() => {});
    },
    setMuted(muted: boolean) {
      if (disposed || ctx.state === "closed") return;
      muteGain.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.05);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      window.clearInterval(timer);
      if (ctx.state !== "closed") ctx.close().catch(() => {});
    },
  };
}