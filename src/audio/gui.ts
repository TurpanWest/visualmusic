import GUI from "lil-gui";
import * as Tone from "tone";
import type { AudioNodes } from "./instruments";

export function setupGUI(
  nodes: AudioNodes,
  toneObjectsRef: { current: Record<string, unknown> },
  initialBpm: number,
): GUI {
  const gui = new GUI({ title: "Controls" });

  const {
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
  } = nodes;

  // ── Global & FX ────────────────────────────────────────────────────────────
  const globalParams = { bpm: initialBpm, reverbDecay: 4.5, reverbWet: 0.38, delayFeedback: 0.4, delayWet: 0.4, masterLowPass: 9000 };
  const globalFolder = gui.addFolder("Global & FX");
  globalFolder.add(globalParams, "bpm",           60,    180   ).name("BPM")            .onChange((v: number) => Tone.getTransport().bpm.value = v);
  globalFolder.add(globalParams, "reverbDecay",   0.1,   10    ).name("Reverb Decay")   .onChange((v: number) => reverb.decay = v);
  globalFolder.add(globalParams, "reverbWet",     0,     1     ).name("Reverb Wet")     .onChange((v: number) => reverb.wet.value = v);
  globalFolder.add(globalParams, "delayFeedback", 0,     1     ).name("Delay Feedback") .onChange((v: number) => delay.feedback.value = v);
  globalFolder.add(globalParams, "delayWet",      0,     1     ).name("Delay Wet")      .onChange((v: number) => delay.wet.value = v);
  globalFolder.add(globalParams, "masterLowPass", 100,   20000 ).name("Master LowPass") .onChange((v: number) => lowPass.frequency.value = v);

  // ── Drums ───────────────────────────────────────────────────────────────────
  const drumsFolder = gui.addFolder("Drums Group");

  const kickParams = { enabled: true, volume: 0, decay: 0.22, punchDecay: 0.08, punchOctaves: 4 };
  const kickFolder = drumsFolder.addFolder("Kick");
  kickFolder.add(kickParams, "enabled"     ).onChange((v: boolean) => { kick.mute = !v; toneObjectsRef.current.kickEnabled = v; });
  kickFolder.add(kickParams, "volume",      -40, 0   ).onChange((v: number) => kick.volume.value = v);
  kickFolder.add(kickParams, "decay",       0.01, 1  ).onChange((v: number) => kickEnvelope.decay = v);
  kickFolder.add(kickParams, "punchDecay",  0.01, 0.5).onChange((v: number) => kickSnapEnv.decay = v);
  kickFolder.add(kickParams, "punchOctaves",0,   10  ).onChange((v: number) => kickSnapEnv.octaves = v);

  const snareParams = { enabled: true, volume: -6, decay: 0.18, filterFreq: 2200 };
  const snareFolder = drumsFolder.addFolder("Snare");
  snareFolder.add(snareParams, "enabled"   ).onChange((v: boolean) => { snare.volume.value = v ? snareParams.volume : -Infinity; toneObjectsRef.current.snareEnabled = v; });
  snareFolder.add(snareParams, "volume",    -40, 0    ).onChange((v: number) => snare.volume.value = v);
  snareFolder.add(snareParams, "decay",     0.01, 1   ).onChange((v: number) => snare.envelope.decay = v);
  snareFolder.add(snareParams, "filterFreq",100, 10000).onChange((v: number) => snareFilter.frequency.value = v);

  const hihatParams = { enabled: true, volume: -16, decay: 0.09 };
  const hihatFolder = drumsFolder.addFolder("Hi-Hat");
  hihatFolder.add(hihatParams, "enabled").onChange((v: boolean) => {
    openHiHat.volume.value = v ? hihatParams.volume : -Infinity;
    toneObjectsRef.current.hihatEnabled = v;
  });
  hihatFolder.add(hihatParams, "volume", -40, 0   ).onChange((v: number) => openHiHat.volume.value = v);
  hihatFolder.add(hihatParams, "decay",  0.01, 0.5).onChange((v: number) => openHiHat.envelope.decay = v);

  const tomParams = { enabled: true, volume: -6, decay: 0.4, pitchDecay: 0.05 };
  const tomFolder = drumsFolder.addFolder("Tom");
  tomFolder.add(tomParams, "enabled"   ).onChange((v: boolean) => { tom.volume.value = v ? tomParams.volume : -Infinity; toneObjectsRef.current.tomEnabled = v; });
  tomFolder.add(tomParams, "volume",    -40, 0   ).onChange((v: number) => tom.volume.value = v);
  tomFolder.add(tomParams, "decay",     0.01, 2  ).onChange((v: number) => tom.envelope.decay = v);
  tomFolder.add(tomParams, "pitchDecay",0.001, 0.5).onChange((v: number) => tom.pitchDecay = v);

  // ── Melody Group ─────────────────────────────────────────────────────────────
  const melodyGroupFolder = gui.addFolder("Melody Group");

  const bassParams = { enabled: true, volume: -4, filterFreq: 900, filterQ: 2.5, decay: 0.55 };
  const bassFolder = melodyGroupFolder.addFolder("Bass");
  bassFolder.add(bassParams, "enabled"   ).onChange((v: boolean) => { bass.mute = !v; toneObjectsRef.current.bassEnabled = v; });
  bassFolder.add(bassParams, "volume",    -40, 0   ).onChange((v: number) => bass.volume.value = v);
  bassFolder.add(bassParams, "filterFreq",80,  4000).onChange((v: number) => bassFilter.frequency.value = v);
  bassFolder.add(bassParams, "filterQ",   0,   20  ).onChange((v: number) => bassFilter.Q.value = v);
  bassFolder.add(bassParams, "decay",     0.01, 1  ).onChange((v: number) => bassEnvelope.decay = v);

  const rhodesParams = { enabled: true, volume: -16, chorusDepth: 0.45, filterFreq: 3000 };
  const rhodesFolder = melodyGroupFolder.addFolder("Rhodes (Sparse Comping)");
  rhodesFolder.add(rhodesParams, "enabled"    ).onChange((v: boolean) => { rhodes.set({ volume: v ? rhodesParams.volume : -Infinity }); toneObjectsRef.current.rhodesEnabled = v; });
  rhodesFolder.add(rhodesParams, "volume",     -40, 0   ).onChange((v: number) => rhodes.set({ volume: v }));
  rhodesFolder.add(rhodesParams, "chorusDepth",0,   1   ).name("Chorus Depth").onChange((v: number) => (rhodesChorus.depth as unknown as Tone.Signal<"normalRange">).value = v);
  rhodesFolder.add(rhodesParams, "filterFreq", 500, 8000).name("Tone")        .onChange((v: number) => rhodesFilter.frequency.value = v);

  const padParams = { enabled: true, volume: -24, filterFreq: 1600 };
  const padFolder = melodyGroupFolder.addFolder("Pad (Atmosphere)");
  padFolder.add(padParams, "enabled"   ).onChange((v: boolean) => { pad.set({ volume: v ? padParams.volume : -Infinity }); toneObjectsRef.current.padEnabled = v; });
  padFolder.add(padParams, "volume",    -40, 0   ).onChange((v: number) => pad.set({ volume: v }));
  padFolder.add(padParams, "filterFreq",200, 6000).name("Tone").onChange((v: number) => padFilter.frequency.value = v);

  // ── Lead Synth — Preset 1 (always available) ──────────────────────────────────
  const m1Params = { enabled: true, volume: -2, spread: 35, count: 5, filterFreq: 3200, filterQ: 1.8, attack: 0.04, decay: 0.55, sustain: 0.55, release: 2.2 };
  const m1Folder = melodyGroupFolder.addFolder("Lead 01 — FatSaw×5");
  m1Folder.add(m1Params, "enabled").onChange((v: boolean) => {
    melody1.volume.value = v ? m1Params.volume : -Infinity;
    toneObjectsRef.current.melodyEnabled = v;
  });
  m1Folder.add(m1Params, "volume",    -40,  0    ).onChange((v: number) => melody1.volume.value = v);
  m1Folder.add(m1Params, "spread",    0,    100  ).onChange((v: number) => (melody1.oscillator as unknown as Tone.FatOscillator).spread = v);
  m1Folder.add(m1Params, "count",     1,    9, 1 ).onChange((v: number) => (melody1.oscillator as unknown as Tone.FatOscillator).count  = v);
  m1Folder.add(m1Params, "filterFreq",100,  10000).onChange((v: number) => melody1Filter.frequency.value = v);
  m1Folder.add(m1Params, "filterQ",   0,    20   ).onChange((v: number) => melody1Filter.Q.value = v);
  m1Folder.add(m1Params, "attack",    0,    2    ).onChange((v: number) => melody1.envelope.attack  = v);
  m1Folder.add(m1Params, "decay",     0,    2    ).onChange((v: number) => melody1.envelope.decay   = v);
  m1Folder.add(m1Params, "sustain",   0,    1    ).onChange((v: number) => melody1.envelope.sustain = v);
  m1Folder.add(m1Params, "release",   0,    5    ).onChange((v: number) => melody1.envelope.release = v);

  // ── Lead Synth — Preset 2 (always available) ──────────────────────────────────
  const m2Params = { enabled: true, volume: -3, spread: 30, count: 3, filterFreq: 4500, filterQ: 1.2, attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.4 };
  const m2Folder = melodyGroupFolder.addFolder("Lead 02 — PolySynth");
  m2Folder.add(m2Params, "enabled").onChange((v: boolean) => {
    melody2.volume.value = v ? m2Params.volume : -Infinity;
    toneObjectsRef.current.melodyEnabled = v;
  });
  m2Folder.add(m2Params, "volume",    -40,  0    ).onChange((v: number) => melody2.volume.value = v);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  m2Folder.add(m2Params, "spread",    0,    100  ).onChange((v: number) => (melody2 as any).set({ oscillator: { spread: v } }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  m2Folder.add(m2Params, "count",     1,    9, 1 ).onChange((v: number) => (melody2 as any).set({ oscillator: { count: v } }));
  m2Folder.add(m2Params, "filterFreq",100,  10000).onChange((v: number) => melody2Filter.frequency.value = v);
  m2Folder.add(m2Params, "filterQ",   0,    20   ).onChange((v: number) => melody2Filter.Q.value = v);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  m2Folder.add(m2Params, "attack",    0,    2    ).onChange((v: number) => (melody2 as any).set({ envelope: { attack:  v } }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  m2Folder.add(m2Params, "decay",     0,    2    ).onChange((v: number) => (melody2 as any).set({ envelope: { decay:   v } }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  m2Folder.add(m2Params, "sustain",   0,    1    ).onChange((v: number) => (melody2 as any).set({ envelope: { sustain: v } }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  m2Folder.add(m2Params, "release",   0,    5    ).onChange((v: number) => (melody2 as any).set({ envelope: { release: v } }));

  return gui;
}
