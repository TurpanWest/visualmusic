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
    openHiHat, closedHiHat,
    tom,
    bass, bassFilter, bassEnvelope,
    rhodes, rhodesChorus, rhodesFilter,
    arp, arpFilter,
    pad, padFilter,
    melody, melodyFilter,
  } = nodes;

  // ── Global & FX ────────────────────────────────────────────────────────────
  const globalParams = { bpm: initialBpm, reverbDecay: 4, reverbWet: 0.4, delayFeedback: 0.5, delayWet: 0.5, masterLowPass: 8000 };
  const globalFolder = gui.addFolder("Global & FX");
  globalFolder.add(globalParams, "bpm",           60,    180   ).name("BPM")            .onChange((v: number) => Tone.getTransport().bpm.value = v);
  globalFolder.add(globalParams, "reverbDecay",   0.1,   10    ).name("Reverb Decay")   .onChange((v: number) => reverb.decay = v);
  globalFolder.add(globalParams, "reverbWet",     0,     1     ).name("Reverb Wet")     .onChange((v: number) => reverb.wet.value = v);
  globalFolder.add(globalParams, "delayFeedback", 0,     1     ).name("Delay Feedback") .onChange((v: number) => delay.feedback.value = v);
  globalFolder.add(globalParams, "delayWet",      0,     1     ).name("Delay Wet")      .onChange((v: number) => delay.wet.value = v);
  globalFolder.add(globalParams, "masterLowPass", 100,   20000 ).name("Master LowPass") .onChange((v: number) => lowPass.frequency.value = v);

  // ── Drums ───────────────────────────────────────────────────────────────────
  const drumsFolder = gui.addFolder("Drums Group");

  const kickParams = { enabled: true, volume: 0, decay: 0.2, punchDecay: 0.1, punchOctaves: 4 };
  const kickFolder = drumsFolder.addFolder("Kick");
  kickFolder.add(kickParams, "enabled"     ).onChange((v: boolean) => { kick.mute = !v; toneObjectsRef.current.kickEnabled = v; });
  kickFolder.add(kickParams, "volume",      -40, 0   ).onChange((v: number) => kick.volume.value = v);
  kickFolder.add(kickParams, "decay",       0.01, 1  ).onChange((v: number) => kickEnvelope.decay = v);
  kickFolder.add(kickParams, "punchDecay",  0.01, 0.5).onChange((v: number) => kickSnapEnv.decay = v);
  kickFolder.add(kickParams, "punchOctaves",0,   10  ).onChange((v: number) => kickSnapEnv.octaves = v);

  const snareParams = { enabled: true, volume: -5, decay: 0.2, filterFreq: 2000 };
  const snareFolder = drumsFolder.addFolder("Snare");
  snareFolder.add(snareParams, "enabled"   ).onChange((v: boolean) => { snare.volume.value = v ? snareParams.volume : -Infinity; toneObjectsRef.current.snareEnabled = v; });
  snareFolder.add(snareParams, "volume",    -40, 0    ).onChange((v: number) => snare.volume.value = v);
  snareFolder.add(snareParams, "decay",     0.01, 1   ).onChange((v: number) => snare.envelope.decay = v);
  snareFolder.add(snareParams, "filterFreq",100, 10000).onChange((v: number) => snareFilter.frequency.value = v);

  const hihatParams = { openEnabled: true, openVolume: -15, openDecay: 0.3, closedEnabled: true, closedVolume: -18, closedDecay: 0.05 };
  const hihatFolder = drumsFolder.addFolder("Hihats");
  hihatFolder.add(hihatParams, "openEnabled"  ).onChange((v: boolean) => openHiHat.volume.value = v ? hihatParams.openVolume : -Infinity);
  hihatFolder.add(hihatParams, "openVolume",   -40, 0  ).onChange((v: number) => openHiHat.volume.value = v);
  hihatFolder.add(hihatParams, "openDecay",    0.01, 1 ).onChange((v: number) => openHiHat.envelope.decay = v);
  hihatFolder.add(hihatParams, "closedEnabled").onChange((v: boolean) => closedHiHat.volume.value = v ? hihatParams.closedVolume : -Infinity);
  hihatFolder.add(hihatParams, "closedVolume", -40, 0  ).onChange((v: number) => closedHiHat.volume.value = v);
  hihatFolder.add(hihatParams, "closedDecay",  0.01, 0.5).onChange((v: number) => closedHiHat.envelope.decay = v);

  const tomParams = { enabled: true, volume: -5, decay: 0.4, pitchDecay: 0.05 };
  const tomFolder = drumsFolder.addFolder("Tom");
  tomFolder.add(tomParams, "enabled"   ).onChange((v: boolean) => { tom.volume.value = v ? tomParams.volume : -Infinity; toneObjectsRef.current.tomEnabled = v; });
  tomFolder.add(tomParams, "volume",    -40, 0   ).onChange((v: number) => tom.volume.value = v);
  tomFolder.add(tomParams, "decay",     0.01, 2  ).onChange((v: number) => tom.envelope.decay = v);
  tomFolder.add(tomParams, "pitchDecay",0.001, 0.5).onChange((v: number) => tom.pitchDecay = v);

  // ── Melody Group ─────────────────────────────────────────────────────────────
  const melodyGroupFolder = gui.addFolder("Melody Group");

  const bassParams = { enabled: true, volume: -5, filterFreq: 800, filterQ: 3, decay: 0.66 };
  const bassFolder = melodyGroupFolder.addFolder("Bass");
  bassFolder.add(bassParams, "enabled"   ).onChange((v: boolean) => { bass.mute = !v; toneObjectsRef.current.bassEnabled = v; });
  bassFolder.add(bassParams, "volume",    -40, 0   ).onChange((v: number) => bass.volume.value = v);
  bassFolder.add(bassParams, "filterFreq",80,  4000).onChange((v: number) => bassFilter.frequency.value = v);
  bassFolder.add(bassParams, "filterQ",   0,   20  ).onChange((v: number) => bassFilter.Q.value = v);
  bassFolder.add(bassParams, "decay",     0.01, 1  ).onChange((v: number) => bassEnvelope.decay = v);

  const rhodesParams = { enabled: true, volume: -14, chorusDepth: 0.5, filterFreq: 3200 };
  const rhodesFolder = melodyGroupFolder.addFolder("Rhodes (Electric Piano)");
  rhodesFolder.add(rhodesParams, "enabled"    ).onChange((v: boolean) => { rhodes.set({ volume: v ? rhodesParams.volume : -Infinity }); toneObjectsRef.current.rhodesEnabled = v; });
  rhodesFolder.add(rhodesParams, "volume",     -40, 0   ).onChange((v: number) => rhodes.set({ volume: v }));
  rhodesFolder.add(rhodesParams, "chorusDepth",0,   1   ).name("Chorus Depth").onChange((v: number) => (rhodesChorus.depth as Tone.Signal<"normalRange">).value = v);
  rhodesFolder.add(rhodesParams, "filterFreq", 500, 8000).name("Tone")        .onChange((v: number) => rhodesFilter.frequency.value = v);

  const arpParams = { enabled: true, volume: -18, filterFreq: 2200, filterQ: 1.5 };
  const arpFolder = melodyGroupFolder.addFolder("Synth Arp");
  arpFolder.add(arpParams, "enabled"   ).onChange((v: boolean) => { arp.volume.value = v ? arpParams.volume : -Infinity; toneObjectsRef.current.arpEnabled = v; });
  arpFolder.add(arpParams, "volume",    -40, 0   ).onChange((v: number) => arp.volume.value = v);
  arpFolder.add(arpParams, "filterFreq",200, 8000).name("Filter Freq").onChange((v: number) => arpFilter.frequency.value = v);
  arpFolder.add(arpParams, "filterQ",   0.1, 10  ).name("Filter Q")  .onChange((v: number) => arpFilter.Q.value = v);

  const padParams = { enabled: true, volume: -22, filterFreq: 1800 };
  const padFolder = melodyGroupFolder.addFolder("Pad");
  padFolder.add(padParams, "enabled"   ).onChange((v: boolean) => { pad.set({ volume: v ? padParams.volume : -Infinity }); toneObjectsRef.current.padEnabled = v; });
  padFolder.add(padParams, "volume",    -40, 0   ).onChange((v: number) => pad.set({ volume: v }));
  padFolder.add(padParams, "filterFreq",200, 6000).name("Tone").onChange((v: number) => padFilter.frequency.value = v);

  const melodyParams = { enabled: true, volume: 0, spread: 40, count: 7, filterFreq: 3000, filterQ: 2, attack: 0.05, decay: 0.6, sustain: 0.53, release: 2.5 };
  const melodyFolder = melodyGroupFolder.addFolder("Melody (FatOscillator)");
  melodyFolder.add(melodyParams, "enabled"   ).onChange((v: boolean) => { melody.volume.value = v ? melodyParams.volume : -Infinity; toneObjectsRef.current.melodyEnabled = v; });
  melodyFolder.add(melodyParams, "volume",    -40,  0    ).onChange((v: number) => melody.volume.value = v);
  melodyFolder.add(melodyParams, "spread",    0,    100  ).onChange((v: number) => (melody.oscillator as unknown as Tone.FatOscillator).spread = v);
  melodyFolder.add(melodyParams, "count",     1,    9, 1 ).onChange((v: number) => (melody.oscillator as unknown as Tone.FatOscillator).count = v);
  melodyFolder.add(melodyParams, "filterFreq",100,  10000).onChange((v: number) => melodyFilter.frequency.value = v);
  melodyFolder.add(melodyParams, "filterQ",   0,    20   ).onChange((v: number) => melodyFilter.Q.value = v);
  melodyFolder.add(melodyParams, "attack",    0,    2    ).onChange((v: number) => melody.envelope.attack = v);
  melodyFolder.add(melodyParams, "decay",     0,    2    ).onChange((v: number) => melody.envelope.decay = v);
  melodyFolder.add(melodyParams, "sustain",   0,    1    ).onChange((v: number) => melody.envelope.sustain = v);
  melodyFolder.add(melodyParams, "release",   0,    5    ).onChange((v: number) => melody.envelope.release = v);

  return gui;
}
