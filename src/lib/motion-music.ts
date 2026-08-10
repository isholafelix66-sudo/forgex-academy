/**
 * Background music for the "ForgeX in two minutes" motion film.
 *
 * A fully self-contained, synthesized loop (no audio files, no licensing):
 * a warm Am → F → C → G progression with a soft pad, bass, an eighth-note
 * arpeggio and a light kick/hat groove. Generated live with the Web Audio API,
 * so it always plays as long as the browser supports AudioContext.
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
  master.gain.value = 0.5;
  const muteGain = ctx.createGain();
  muteGain.gain.value = 1;
  master.connect(muteGain).connect(ctx.destination);

  const midi = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

  const BPM = 84;
  const beat = 60 / BPM;
  const barDur = beat * 4;
  const eighth = beat / 2;

  // Am → F → C → G — warm and uplifting
  const chords = [
    { root: midi(45), tones: [0, 3, 7] }, // A minor
    { root: midi(41), tones: [0, 4, 7] }, // F major
    { root: midi(48), tones: [0, 4, 7] }, // C major
    { root: midi(43), tones: [0, 4, 7] }, // G major
  ];

  const padFilter = ctx.createBiquadFilter();
  padFilter.type = "lowpass";
  padFilter.frequency.value = 1400;
  padFilter.connect(muteGain);

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

  function kick(t: number, peak = 0.45) {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    const g = ctx.createGain();
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(48, t + 0.11);
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
    osc.connect(g).connect(muteGain);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  const noiseBuf = (() => {
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.08), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  })();

  function hat(t: number, peak = 0.05) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    src.connect(hp).connect(g).connect(muteGain);
    src.start(t);
    src.stop(t + 0.06);
  }

  function scheduleBar(chordIdx: number, t: number) {
    const c = chords[chordIdx % chords.length];
    // Pad — one soft triangle per chord tone
    for (const tone of c.tones) {
      playNote(
        c.root * Math.pow(2, tone / 12),
        t,
        barDur - 0.15,
        "triangle",
        0.05,
        padFilter,
        0.6,
        0.4,
      );
    }
    // Bass — root on beats 1 and 3
    playNote(c.root / 2, t, beat * 1.8, "sine", 0.22, muteGain);
    playNote(c.root / 2, t + beat * 2, beat * 1.8, "sine", 0.22, muteGain);
    // Arpeggio — eighth notes over the chord
    const arp = [0, 7, 12, 7, 0, 7, 14, 7];
    arp.forEach((tone, i) => {
      playNote(
        c.root * Math.pow(2, tone / 12),
        t + i * eighth,
        eighth * 0.9,
        "triangle",
        0.09,
        muteGain,
        0.01,
        0.1,
      );
    });
    // Light groove
    kick(t, 0.45);
    hat(t + eighth, 0.05);
    kick(t + beat * 2, 0.4);
    hat(t + eighth * 3, 0.05);
    hat(t + eighth * 5, 0.05);
    hat(t + eighth * 7, 0.06);
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

  return {
    resume() {
      if (ctx.state !== "running") void ctx.resume();
    },
    suspend() {
      if (ctx.state === "running") void ctx.suspend();
    },
    setMuted(muted: boolean) {
      muteGain.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.05);
    },
    dispose() {
      window.clearInterval(timer);
      void ctx.close();
    },
  };
}
