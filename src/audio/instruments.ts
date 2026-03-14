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
  closedHiHat: Tone.NoiseSynth;
  tom: Tone.MembraneSynth;
  bass: Tone.Oscillator;
  bassFilter: Tone.Filter;
  bassEnvelope: Tone.AmplitudeEnvelope;
  rhodes: Tone.PolySynth;
  rhodesChorus: Tone.Chorus;
  rhodesFilter: Tone.Filter;
  arp: Tone.Synth;
  arpFilter: Tone.Filter;
  pad: Tone.PolySynth;
  padFilter: Tone.Filter;
  melody: Tone.Synth;
  melodyFilter: Tone.Filter;
  fft: Tone.FFT;
}

// Bass chord notes per bar: Cm7 | Gm7 | Abmaj7 | Fm7
const BASS_CHORD_NOTES: string[][] = [
  ["C2", "Eb2", "G2", "Bb2"],  // Bar 0: Cm7
  ["G1", "D2",  "F2", "Bb1"],  // Bar 1: Gm7
  ["Ab1","Eb2", "G2", "C2"],   // Bar 2: Abmaj7
  ["F2", "C2",  "Eb2","Ab1"],  // Bar 3: Fm7
];

function generateCityPopBass(): [string, string][] {
  const events: [string, string][] = [];
  const hitPattern = [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 0, 0];
  for (let bar = 0; bar < 4; bar++) {
    const notes = BASS_CHORD_NOTES[bar];
    for (let s = 0; s < 16; s++) {
      if (hitPattern[s] === 1) {
        const time = `${bar}:${Math.floor(s / 4)}:${s % 4}`;
        const rand = Math.random();
        // Downbeat always root; other hits: 60% root / 30% fifth / 10% seventh
        const note = s === 0 ? notes[0]
          : rand < 0.6 ? notes[0]
          : rand < 0.9 ? notes[1]
          : notes[2];
        events.push([time, note]);
      }
    }
  }
  return events;
}

export function setupAudio(toneObjectsRef: { current: Record<string, unknown> }): {
  nodes: AudioNodes;
  disposables: Array<{ dispose(): void }>;
  bpm: number;
} {
  const bpm = getRandomBpm();
  Tone.getTransport().bpm.value = bpm;

  // ── Code execution tracker — written by callbacks, read by CodePanel ──────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const codeExec: Record<string, any> = {
    kick: 0, snare: 0, hihat: 0, tom: 0,
    bass:   { t: 0, note: "" },
    rhodes: { t: 0, chord: "" },
    arp:    { t: 0, note: "" },
    pad:    { t: 0, chord: "" },
    melody: { t: 0, note: "" },
  };
  toneObjectsRef.current.codeExec = codeExec;

  // ── Global FX ────────────────────────────────────────────────────────────────
  const reverb  = new Tone.Reverb({ decay: 4, wet: 0.4 }).toDestination();
  const delay   = new Tone.PingPongDelay("8n.", 0.5).toDestination();
  const lowPass = new Tone.Filter({ frequency: 8000 }).toDestination();

  // ── Kick ─────────────────────────────────────────────────────────────────────
  const kickEnvelope = new Tone.AmplitudeEnvelope({ attack: 0.001, decay: 0.2, sustain: 0 }).toDestination();
  const kick         = new Tone.Oscillator("C1").connect(kickEnvelope).start();
  const kickSnapEnv  = new Tone.FrequencyEnvelope({
    attack: 0.001, decay: 0.1, sustain: 0, baseFrequency: "C1", octaves: 4,
  }).connect(kick.frequency);
  // Euclidean kick pattern — unique 16th-note groove every session
  const kickPart = new Tone.Part(
    (time) => {
      kickEnvelope.triggerAttack(time);
      kickSnapEnv.triggerAttack(time);
      codeExec.kick = Date.now();
    },
    generateKickTimes(),
  ).start(0);
  kickPart.loop = true; kickPart.loopEnd = "4:0";

  // ── Snare ─────────────────────────────────────────────────────────────────────
  const snareFilter = new Tone.Filter({ frequency: 2000, type: "highpass", Q: 1 }).toDestination();
  const snare = new Tone.NoiseSynth({
    volume: -5, noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.2, sustain: 0 },
  }).connect(snareFilter);
  const snarePart = new Tone.Part(
    (time) => { snare.triggerAttack(time); codeExec.snare = Date.now(); },
    ["0:1","0:3","1:1","1:3","2:1","2:3","3:1","3:3"],
  ).start(0);
  snarePart.loop = true; snarePart.loopEnd = "4:0";

  // ── Hi-Hats ───────────────────────────────────────────────────────────────────
  const openHiHat = new Tone.NoiseSynth({
    volume: -15, envelope: { attack: 0.01, decay: 0.3 },
  }).connect(lowPass);
  // Euclidean open hi-hat — sparser than kick, always offset to off-beats
  const openHiHatPart = new Tone.Part(
    (time) => {
      openHiHat.triggerAttack(time);
      toneObjectsRef.current.hihatTick = ((toneObjectsRef.current.hihatTick as number) || 0) + 1;
      codeExec.hihat = Date.now();
    },
    generateHihatTimes(),
  ).start(0);
  openHiHatPart.loop = true; openHiHatPart.loopEnd = "4:0";
  const closedHiHat = new Tone.NoiseSynth({
    volume: -18, envelope: { attack: 0.005, decay: 0.05 },
  }).connect(lowPass);
  const closedHatLoop = new Tone.Loop((time) => {
    closedHiHat.volume.value = Math.random() > 0.5 ? -18 : -24;
    closedHiHat.triggerAttack(time);
    toneObjectsRef.current.hihatTick = ((toneObjectsRef.current.hihatTick as number) || 0) + 1;
    codeExec.hihat = Date.now();
  }, "16n").start(0);

  // ── Tom ───────────────────────────────────────────────────────────────────────
  const tom = new Tone.MembraneSynth({
    volume: -5, pitchDecay: 0.05, octaves: 4,
    envelope: { attack: 0.001, decay: 0.4, sustain: 0 },
  }).toDestination();
  const tomPart = new Tone.Part(
    (time, note) => { tom.triggerAttack(note, time); codeExec.tom = Date.now(); },
    [["3:3:0", "G1"], ["3:3:2", "C1"]],
  ).start(0);
  tomPart.loop = true; tomPart.loopEnd = "4:0";

  // ── Bass ──────────────────────────────────────────────────────────────────────
  const bassEnvelope = new Tone.AmplitudeEnvelope({ attack: 0.001, decay: 0.66, sustain: 0 }).toDestination();
  const bassFilter   = new Tone.Filter({ frequency: 800, Q: 3 }).connect(bassEnvelope);
  const bass         = new Tone.Oscillator("C2", "sawtooth").connect(bassFilter).start();
  bass.volume.value  = -5;
  const bassPart = new Tone.Part(
    (time, note) => {
      bass.frequency.setValueAtTime(note, time);
      bassEnvelope.triggerAttack(time);
      codeExec.bass = { t: Date.now(), note };
    },
    generateCityPopBass(),
  ).start(0);
  bassPart.loop = true; bassPart.loopEnd = "4:0";

  // ── Rhodes (electric piano: triangle + chorus) ────────────────────────────────
  const rhodesChorus = new Tone.Chorus(3.5, 3, 0.5).start();
  const rhodesReverb = new Tone.Reverb({ decay: 2.5, wet: 0.35 }).toDestination();
  const rhodesFilter = new Tone.Filter({ frequency: 3200, type: "lowpass" });
  const rhodes = new Tone.PolySynth(Tone.Synth, {
    volume: -14,
    oscillator: { type: "triangle" },
    envelope: { attack: 0.003, decay: 1.4, sustain: 0.12, release: 2.0 },
  });
  rhodes.connect(rhodesChorus);
  rhodesChorus.connect(rhodesFilter);
  rhodesFilter.connect(rhodesReverb);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rhodesPart = new Tone.Part<any>((time: number, notes: any) => {
    rhodes.triggerAttackRelease(notes, "4n", time);
    codeExec.rhodes = { t: Date.now(), chord: Array.isArray(notes) ? notes.join(" ") : notes };
  }, [
    // Bar 0: Cm7 — syncopated comping
    ["0:1:0", ["C3","G3","Bb3"]], ["0:2:2", ["C3","Eb3","G3","Bb3"]], ["0:3:2", ["Eb3","G3","Bb3"]],
    // Bar 1: Gm7
    ["1:0:2", ["G2","F3","Bb3"]], ["1:1:0", ["G2","D3","F3","Bb3"]], ["1:2:2", ["G2","F3","Bb3"]], ["1:3:2", ["D3","F3","Bb3"]],
    // Bar 2: Abmaj7
    ["2:0:2", ["Ab2","G3","C4"]], ["2:1:0", ["Ab2","Eb3","G3","C4"]], ["2:2:2", ["Ab2","G3","C4"]], ["2:3:2", ["Eb3","G3","C4"]],
    // Bar 3: Fm7
    ["3:0:2", ["F2","Eb3","Ab3"]], ["3:1:0", ["F2","C3","Eb3","Ab3"]], ["3:2:2", ["F2","Eb3","Ab3"]], ["3:3:2", ["C3","Eb3","Ab3"]],
  ]).start(0);
  rhodesPart.loop = true; rhodesPart.loopEnd = "4:0";

  // ── Arp (sawtooth + bandpass + delay — retro City Pop texture) ────────────────
  const arpDelay  = new Tone.FeedbackDelay("8n.", 0.28).connect(reverb);
  const arpFilter = new Tone.Filter({ frequency: 2200, type: "bandpass", Q: 1.5 });
  const arp = new Tone.Synth({
    volume: -18,
    oscillator: { type: "sawtooth" },
    envelope: { attack: 0.001, decay: 0.18, sustain: 0.0, release: 0.25 },
  });
  arp.connect(arpFilter);
  arpFilter.connect(arpDelay);
  const arpPart = new Tone.Part(
    (time, note) => {
      arp.triggerAttackRelease(note, "16n", time);
      codeExec.arp = { t: Date.now(), note };
    },
    [
      // Bar 0: Cm7  up→ C-Eb-G-Bb, down→ G-Eb-C-Eb
      ["0:0:0","C3"],["0:0:2","Eb3"],["0:1:0","G3"],["0:1:2","Bb3"],
      ["0:2:0","G3"],["0:2:2","Eb3"],["0:3:0","C3"],["0:3:2","Eb3"],
      // Bar 1: Gm7  up→ G-Bb-D-F, down→ D-Bb-G-Bb
      ["1:0:0","G3"],["1:0:2","Bb3"],["1:1:0","D4"],["1:1:2","F4"],
      ["1:2:0","D4"],["1:2:2","Bb3"],["1:3:0","G3"],["1:3:2","Bb3"],
      // Bar 2: Abmaj7  up→ Ab-C-Eb-G, down→ Eb-C-Ab-C
      ["2:0:0","Ab3"],["2:0:2","C4"],["2:1:0","Eb4"],["2:1:2","G4"],
      ["2:2:0","Eb4"],["2:2:2","C4"],["2:3:0","Ab3"],["2:3:2","C4"],
      // Bar 3: Fm7  up→ F-Ab-C-Eb, down→ C-Ab-F-Ab
      ["3:0:0","F3"],["3:0:2","Ab3"],["3:1:0","C4"],["3:1:2","Eb4"],
      ["3:2:0","C4"],["3:2:2","Ab3"],["3:3:0","F3"],["3:3:2","Ab3"],
    ],
  ).start(0);
  arpPart.loop = true; arpPart.loopEnd = "4:0";

  // ── Pad (fatsawtooth + big reverb — spatial wash) ─────────────────────────────
  const padReverb = new Tone.Reverb({ decay: 7, wet: 0.65 }).toDestination();
  const padFilter = new Tone.Filter({ frequency: 1800, type: "lowpass", Q: 0.8 });
  const pad = new Tone.PolySynth(Tone.Synth, {
    volume: -22,
    oscillator: { type: "fatsawtooth", count: 3, spread: 25 } as Tone.ToneOscillatorOptions,
    envelope: { attack: 0.9, decay: 1.2, sustain: 0.7, release: 3.5 },
  });
  pad.connect(padFilter);
  padFilter.connect(padReverb);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const padPart = new Tone.Part<any>((time: number, notes: any) => {
    pad.triggerAttackRelease(notes, "1n", time);
    codeExec.pad = { t: Date.now(), chord: Array.isArray(notes) ? notes.join(" ") : notes };
  }, [
    ["0:0:0", ["C2","G3","Bb3","Eb4"]],  // Cm9
    ["1:0:0", ["G2","D3","F3","Bb3"]],   // Gm7
    ["2:0:0", ["Ab2","Eb3","G3","C4"]],  // Abmaj7
    ["3:0:0", ["F2","C3","Eb3","Ab3"]],  // Fm7
  ]).start(0);
  padPart.loop = true; padPart.loopEnd = "4:0";

  // ── Melody (fatsawtooth lead) — fBm-generated, unique each page load ─────────
  //
  //  16-bar form: 4 sections × 4 bars, chord grid Cm7 | Gm7 | Abmaj7 | Fm7.
  //  Pitch and rhythm come from generateMelody() in generate.ts.
  //  Section profiles (register, density) are fixed; exact notes vary per session.
  //
  const melodyFilter = new Tone.Filter({ frequency: 3000, type: "lowpass", Q: 2 }).connect(reverb);
  const melody = new Tone.Synth({
    volume: 0,
    oscillator: { type: "fatsawtooth", count: 7, spread: 40 },
    envelope: { attack: 0.05, decay: 0.6, sustain: 0.53, release: 2.5 },
  }).connect(melodyFilter);
  const melodyPart = new Tone.Part(
    (time, note) => {
      melody.triggerAttackRelease(note, "8n", time);
      codeExec.melody = { t: Date.now(), note };
    },
    generateMelody(),
  ).start(0);

  // ── Transport loop & FFT ──────────────────────────────────────────────────────
  // 16-bar transport: melody plays a unique phrase each pass.
  // All other Parts have their own 4-bar loop, so they repeat 4× per cycle.
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
    openHiHat, closedHiHat,
    tom,
    bass, bassFilter, bassEnvelope,
    rhodes, rhodesChorus, rhodesFilter,
    arp, arpFilter,
    pad, padFilter,
    melody, melodyFilter,
    fft,
  };

  const disposables = [
    reverb, delay, lowPass,
    kick, kickEnvelope, kickSnapEnv, kickPart,
    snare, snareFilter, snarePart,
    openHiHat, openHiHatPart,
    closedHiHat, closedHatLoop,
    tom, tomPart,
    bass, bassFilter, bassEnvelope, bassPart,
    rhodes, rhodesChorus, rhodesFilter, rhodesReverb, rhodesPart,
    arp, arpFilter, arpDelay, arpPart,
    pad, padFilter, padReverb, padPart,
    melody, melodyFilter, melodyPart,
    fft,
  ];

  return { nodes, disposables, bpm };
}
