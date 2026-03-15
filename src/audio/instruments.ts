import * as Tone from "tone";
import { generateKickTimes, generateHihatTimes, generateMelody, getRandomBpm } from "./generate";

export interface AudioNodes {
  reverb: Tone.Reverb;
  delay: Tone.PingPongDelay;
  lowPass: Tone.Filter;
  kick: Tone.Oscillator;
  kickEnvelope: Tone.AmplitudeEnvelope;
  kickSnapEnv: Tone.FrequencyEnvelope;
  snare: Tone.NoiseSynth;
  snareFilter: Tone.Filter;
  openHiHat: Tone.NoiseSynth;
  tom: Tone.MembraneSynth;
  bass: Tone.Oscillator;
  bassFilter: Tone.Filter;
  bassEnvelope: Tone.AmplitudeEnvelope;
  rhodes: Tone.PolySynth;
  rhodesChorus: Tone.Chorus;
  rhodesFilter: Tone.Filter;
  pad: Tone.PolySynth;
  padFilter: Tone.Filter;
  melody1: Tone.Synth;
  melody1Filter: Tone.Filter;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  melody2: any;   // Tone.PolySynth — kept as any for cross-version compatibility
  melody2Filter: Tone.Filter;
  fft: Tone.FFT;
}

// ── Fixed bass line ────────────────────────────────────────────────────────────
const BASS_EVENTS: [string, string][] = [
  ["0:0:0", "C2"], ["0:0:2", "G2"], ["0:1:0", "Bb2"],
  ["0:2:0", "C2"], ["0:2:2", "G2"], ["0:3:0", "Eb2"],
  ["1:0:0", "G1"], ["1:0:2", "D2"], ["1:1:0", "F2"],
  ["1:2:0", "G1"], ["1:2:2", "Bb1"],["1:3:0", "D2"],
  ["2:0:0", "Ab1"],["2:0:2", "Eb2"],["2:1:0", "G2"],
  ["2:2:0", "Ab1"],["2:2:2", "C2"], ["2:3:0", "Eb2"],
  ["3:0:0", "F2"], ["3:0:2", "C2"], ["3:1:0", "Eb2"],
  ["3:2:0", "F2"], ["3:2:2", "Ab1"],["3:3:0", "C2"],
];

export function setupAudio(
  toneObjectsRef: { current: Record<string, unknown> },
): {
  nodes: AudioNodes;
  disposables: Array<{ dispose(): void }>;
  bpm: number;
} {
  const bpm = getRandomBpm();
  Tone.getTransport().bpm.value = bpm;

  // ── Code execution tracker ────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const codeExec: Record<string, any> = {
    kick: 0, snare: 0, hihat: 0, tom: 0,
    bass:   { t: 0, note: "" },
    rhodes: { t: 0, chord: "" },
    pad:    { t: 0, chord: "" },
    melody: { t: 0, note: "" },
  };
  toneObjectsRef.current.codeExec     = codeExec;
  toneObjectsRef.current.melodyEnvVal = 0;

  // ── Active lead reference — swapped at runtime for seamless switching ─────────
  // The melody Part closes over this object. Changing `.synth` immediately affects
  // the next scheduled note without touching the transport or any other voice.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const activeLead: { synth: any } = { synth: null }; // filled after synths are created
  toneObjectsRef.current.activeLead = activeLead;

  // ── Global FX ────────────────────────────────────────────────────────────────
  const reverb  = new Tone.Reverb({ decay: 4.5, wet: 0.38 }).toDestination();
  const delay   = new Tone.PingPongDelay("8n.", 0.4).toDestination();
  const lowPass = new Tone.Filter({ frequency: 9000 }).toDestination();

  // ── Kick ─────────────────────────────────────────────────────────────────────
  const kickEnvelope = new Tone.AmplitudeEnvelope({ attack: 0.001, decay: 0.22, sustain: 0 }).toDestination();
  const kick         = new Tone.Oscillator("C1").connect(kickEnvelope).start();
  const kickSnapEnv  = new Tone.FrequencyEnvelope({
    attack: 0.001, decay: 0.08, sustain: 0, baseFrequency: "C1", octaves: 4,
  }).connect(kick.frequency);
  const kickPart = new Tone.Part(
    (time) => {
      kickEnvelope.triggerAttack(time);
      kickSnapEnv.triggerAttack(time);
      if (toneObjectsRef.current.kickEnabled !== false) codeExec.kick = Date.now();
    },
    generateKickTimes(),
  ).start(0);
  kickPart.loop = true; kickPart.loopEnd = "4:0";

  // ── Snare ─────────────────────────────────────────────────────────────────────
  const snareFilter = new Tone.Filter({ frequency: 2200, type: "highpass", Q: 1.2 }).toDestination();
  const snare = new Tone.NoiseSynth({
    volume: -6, noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.18, sustain: 0 },
  }).connect(snareFilter);
  const snarePart = new Tone.Part(
    (time) => {
      snare.triggerAttack(time);
      if (toneObjectsRef.current.snareEnabled !== false) codeExec.snare = Date.now();
    },
    ["0:1", "0:3", "1:1", "1:3", "2:1", "2:3", "3:1", "3:3"],
  ).start(0);
  snarePart.loop = true; snarePart.loopEnd = "4:0";

  // ── Hi-Hat ────────────────────────────────────────────────────────────────────
  const openHiHat = new Tone.NoiseSynth({
    volume: -16, envelope: { attack: 0.005, decay: 0.09 },
  }).connect(lowPass);
  const hiHatPart = new Tone.Part(
    (time) => {
      openHiHat.triggerAttack(time);
      if (toneObjectsRef.current.hihatEnabled !== false) {
        toneObjectsRef.current.hihatTick = ((toneObjectsRef.current.hihatTick as number) || 0) + 1;
        codeExec.hihat = Date.now();
      }
    },
    generateHihatTimes(),
  ).start(0);
  hiHatPart.loop = true; hiHatPart.loopEnd = "4:0";

  // ── Tom ───────────────────────────────────────────────────────────────────────
  const tom = new Tone.MembraneSynth({
    volume: -6, pitchDecay: 0.05, octaves: 4,
    envelope: { attack: 0.001, decay: 0.4, sustain: 0 },
  }).toDestination();
  const tomPart = new Tone.Part(
    (time, note) => {
      tom.triggerAttack(note, time);
      if (toneObjectsRef.current.tomEnabled !== false) codeExec.tom = Date.now();
    },
    [["3:3:0", "G1"], ["3:3:2", "C1"]],
  ).start(0);
  tomPart.loop = true; tomPart.loopEnd = "4:0";

  // ── Bass ──────────────────────────────────────────────────────────────────────
  const bassEnvelope = new Tone.AmplitudeEnvelope({ attack: 0.001, decay: 0.55, sustain: 0 }).toDestination();
  const bassFilter   = new Tone.Filter({ frequency: 900, Q: 2.5 }).connect(bassEnvelope);
  const bass         = new Tone.Oscillator("C2", "sawtooth").connect(bassFilter).start();
  bass.volume.value  = -4;
  const bassPart = new Tone.Part(
    (time, note) => {
      bass.frequency.setValueAtTime(note, time);
      bassEnvelope.triggerAttack(time);
      if (toneObjectsRef.current.bassEnabled !== false) codeExec.bass = { t: Date.now(), note };
    },
    BASS_EVENTS,
  ).start(0);
  bassPart.loop = true; bassPart.loopEnd = "4:0";

  // ── Rhodes ────────────────────────────────────────────────────────────────────
  const rhodesChorus = new Tone.Chorus(3.5, 3, 0.45).start();
  const rhodesReverb = new Tone.Reverb({ decay: 2.5, wet: 0.3 }).toDestination();
  const rhodesFilter = new Tone.Filter({ frequency: 3000, type: "lowpass" });
  const rhodes = new Tone.PolySynth(Tone.Synth, {
    volume: -16,
    oscillator: { type: "triangle" },
    envelope: { attack: 0.004, decay: 1.2, sustain: 0.1, release: 2.0 },
  });
  rhodes.connect(rhodesChorus);
  rhodesChorus.connect(rhodesFilter);
  rhodesFilter.connect(rhodesReverb);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rhodesPart = new Tone.Part<any>((time: number, notes: any) => {
    rhodes.triggerAttackRelease(notes, "4n", time);
    if (toneObjectsRef.current.rhodesEnabled !== false)
      codeExec.rhodes = { t: Date.now(), chord: Array.isArray(notes) ? notes.join(" ") : notes };
  }, [
    ["0:1:2", ["Eb3", "G3", "Bb3"]],
    ["1:1:2", ["D3",  "F3", "Bb3"]],
    ["2:1:2", ["Eb3", "G3", "C4"]],
    ["3:1:2", ["C3",  "Eb3","Ab3"]],
  ]).start(0);
  rhodesPart.loop = true; rhodesPart.loopEnd = "4:0";

  // ── Pad ───────────────────────────────────────────────────────────────────────
  const padReverb = new Tone.Reverb({ decay: 8, wet: 0.7 }).toDestination();
  const padFilter = new Tone.Filter({ frequency: 1600, type: "lowpass", Q: 0.7 });
  const pad = new Tone.PolySynth(Tone.Synth, {
    volume: -24,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    oscillator: { type: "fatsawtooth", count: 2, spread: 20 } as any,
    envelope: { attack: 1.0, decay: 1.5, sustain: 0.65, release: 4.0 },
  });
  pad.connect(padFilter);
  padFilter.connect(padReverb);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const padPart = new Tone.Part<any>((time: number, notes: any) => {
    pad.triggerAttackRelease(notes, "1n", time);
    if (toneObjectsRef.current.padEnabled !== false)
      codeExec.pad = { t: Date.now(), chord: Array.isArray(notes) ? notes.join(" ") : notes };
  }, [
    ["0:0:0", ["C2", "G3", "Bb3", "Eb4"]],
    ["1:0:0", ["G2", "D3", "F3",  "Bb3"]],
    ["2:0:0", ["Ab2","Eb3","G3",  "C4"]],
    ["3:0:0", ["F2", "C3", "Eb3", "Ab3"]],
  ]).start(0);
  padPart.loop = true; padPart.loopEnd = "4:0";

  // ── Lead Synth — both presets always loaded ────────────────────────────────────
  //
  //  Preset 1: Tone.Synth with fatsawtooth×5 (thick, warm, wide)
  //  Preset 2: Tone.PolySynth with fatsawtooth×3 (punchy, bright, tight envelope)
  //
  //  Only ONE is triggered per note — whichever activeLead.synth points to.
  //  Switching is instant: just reassign activeLead.synth from App.tsx.
  //  The transport and all other voices continue uninterrupted.
  //
  const melody1Filter = new Tone.Filter({ frequency: 3200, type: "lowpass", Q: 1.8 }).connect(reverb);
  const melody1 = new Tone.Synth({
    volume: -2,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    oscillator: { type: "fatsawtooth", count: 5, spread: 35 } as any,
    envelope: { attack: 0.04, decay: 0.55, sustain: 0.55, release: 2.2 },
  }).connect(melody1Filter);

  const melody2Filter = new Tone.Filter({ frequency: 4500, type: "lowpass", Q: 1.2 }).connect(reverb);
  const melody2 = new Tone.PolySynth(Tone.Synth, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    oscillator: { type: "fatsawtooth", count: 3, spread: 30 } as any,
    envelope: {
      attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.4,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      attackCurve: "exponential" as any,
    },
  }).connect(melody2Filter);
  melody2.volume.value = -3;

  // Default: start with preset 1
  activeLead.synth = melody1;

  const melodyPart = new Tone.Part(
    (time: string, note: string) => {
      // Always use whichever synth activeLead points to — no transport stop needed to switch
      activeLead.synth.triggerAttackRelease(note, "8n", time);
      if (toneObjectsRef.current.melodyEnabled !== false) {
        toneObjectsRef.current.melodyEnvVal = 1.0;
        codeExec.melody = { t: Date.now(), note };
      }
    },
    generateMelody(),
  ).start(0);

  // ── Transport: 16-bar loop ────────────────────────────────────────────────────
  Tone.getTransport().loopStart = 0;
  Tone.getTransport().loopEnd   = "16:0";
  Tone.getTransport().loop      = true;

  const fft = new Tone.FFT(128);
  Tone.getDestination().connect(fft);

  // ── Collect & return ──────────────────────────────────────────────────────────
  const nodes: AudioNodes = {
    reverb, delay, lowPass,
    kick, kickEnvelope, kickSnapEnv,
    snare, snareFilter,
    openHiHat,
    tom,
    bass, bassFilter, bassEnvelope,
    rhodes, rhodesChorus, rhodesFilter,
    pad, padFilter,
    melody1, melody1Filter,
    melody2, melody2Filter,
    fft,
  };

  const disposables = [
    reverb, delay, lowPass,
    kick, kickEnvelope, kickSnapEnv, kickPart,
    snare, snareFilter, snarePart,
    openHiHat, hiHatPart,
    tom, tomPart,
    bass, bassFilter, bassEnvelope, bassPart,
    rhodes, rhodesChorus, rhodesFilter, rhodesReverb, rhodesPart,
    pad, padFilter, padReverb, padPart,
    melody1, melody1Filter,
    melody2, melody2Filter,
    melodyPart,
    fft,
  ];

  return { nodes, disposables, bpm };
}
