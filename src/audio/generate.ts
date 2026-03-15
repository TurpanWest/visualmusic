/**
 * Fixed retro-futurist composition — identical output on every page load.
 *
 * Musical style: Retro-Futurism / Synthwave / City Pop
 * Key: C natural minor  —  i–v–VI–iv  (Cm7 | Gm7 | Abmaj7 | Fm7)
 * BPM: 112
 *
 * All patterns and melodies are hand-crafted and deterministic.
 * No random algorithms — every session sounds the same.
 */

// ── Pattern helpers ────────────────────────────────────────────────────────────

/** Convert a 16-step boolean pattern → Tone.js time strings, replicated over `bars` bars. */
function patternToBars(pattern: boolean[], bars: number): string[] {
  const times: string[] = [];
  for (let bar = 0; bar < bars; bar++) {
    pattern.forEach((hit, s) => {
      if (hit) times.push(`${bar}:${Math.floor(s / 4)}:${s % 4}`);
    });
  }
  return times;
}

// ── Fixed drum patterns ────────────────────────────────────────────────────────

/**
 * Kick drum: four-on-the-floor (beats 1–2–3–4).
 * Steady, driving foundation for the retro-futurist groove.
 */
export function generateKickTimes(): string[] {
  const pattern = [
    true, false, false, false,
    true, false, false, false,
    true, false, false, false,
    true, false, false, false,
  ];
  return patternToBars(pattern, 4);
}

/**
 * Hi-hat: 8th-note grid (on + off every beat).
 * Smooth, driving pulse — no randomness, no variable density.
 */
export function generateHihatTimes(): string[] {
  const pattern = [
    true, false, true, false,
    true, false, true, false,
    true, false, true, false,
    true, false, true, false,
  ];
  return patternToBars(pattern, 4);
}

// ── Fixed 16-bar lead melody ───────────────────────────────────────────────────
//
// C natural minor scale: C4 D4 Eb4 F4 G4 Ab4 Bb4 C5 D5 Eb5 F5 G5
// Chord tones: Cm7(C,Eb,G,Bb) | Gm7(G,Bb,D,F) | Abmaj7(Ab,C,Eb,G) | Fm7(F,Ab,C,Eb)
//
// Four-section 16-bar form:
//   A (bars  0–3):  Intro — spacious, establishing the motif
//   B (bars  4–7):  Groove — syncopated, ascending energy
//   C (bars  8–11): Climax — high register, emotional peak
//   D (bars 12–15): Resolution — descending, peaceful close

export function generateMelody(): [string, string][] {
  return [
    // ── Section A: Intro ─────────────────────────────────────────────────────
    // Bar 0: Cm7
    ["0:0:0", "G4"],  ["0:1:0", "Bb4"], ["0:2:2", "G4"],  ["0:3:0", "Eb4"],
    // Bar 1: Gm7
    ["1:0:0", "D4"],  ["1:1:2", "G4"],  ["1:2:0", "Bb4"], ["1:3:0", "D5"],
    // Bar 2: Abmaj7
    ["2:0:0", "Eb5"], ["2:1:0", "C5"],  ["2:2:0", "G4"],  ["2:3:2", "Eb4"],
    // Bar 3: Fm7
    ["3:0:0", "F4"],  ["3:1:2", "Ab4"], ["3:2:0", "C5"],  ["3:3:0", "G4"],

    // ── Section B: Groove ────────────────────────────────────────────────────
    // Bar 4: Cm7
    ["4:0:0", "G4"],  ["4:0:2", "Bb4"], ["4:1:2", "Eb5"], ["4:2:0", "C5"],  ["4:2:2", "G4"],  ["4:3:2", "Bb4"],
    // Bar 5: Gm7
    ["5:0:0", "G4"],  ["5:0:2", "Bb4"], ["5:1:2", "D5"],  ["5:2:2", "Bb4"], ["5:3:0", "G4"],
    // Bar 6: Abmaj7
    ["6:0:0", "Ab4"], ["6:0:2", "C5"],  ["6:1:2", "Eb5"], ["6:2:0", "G5"],  ["6:3:0", "Eb5"], ["6:3:2", "C5"],
    // Bar 7: Fm7
    ["7:0:0", "F4"],  ["7:0:2", "Ab4"], ["7:1:0", "C5"],  ["7:2:2", "Ab4"], ["7:3:0", "F4"],  ["7:3:2", "C5"],

    // ── Section C: Climax ────────────────────────────────────────────────────
    // Bar 8: Cm7
    ["8:0:0", "G5"],  ["8:0:2", "Eb5"], ["8:1:0", "C5"],  ["8:1:2", "Eb5"], ["8:2:0", "G5"],  ["8:3:0", "Bb4"],
    // Bar 9: Gm7
    ["9:0:0", "D5"],  ["9:0:2", "F5"],  ["9:1:0", "D5"],  ["9:2:0", "Bb4"], ["9:2:2", "D5"],  ["9:3:0", "F5"],
    // Bar 10: Abmaj7
    ["10:0:0", "G5"], ["10:0:2", "Eb5"],["10:1:2", "C5"], ["10:2:0", "Ab4"],["10:2:2", "C5"], ["10:3:2", "Eb5"],
    // Bar 11: Fm7
    ["11:0:0", "F5"], ["11:0:2", "C5"], ["11:1:0", "Ab4"],["11:1:2", "C5"], ["11:2:0", "Eb5"],["11:3:0", "C5"],

    // ── Section D: Resolution ────────────────────────────────────────────────
    // Bar 12: Cm7
    ["12:0:0","Eb5"], ["12:1:0","Bb4"], ["12:2:0","G4"],  ["12:3:0","Eb4"],
    // Bar 13: Gm7
    ["13:0:0","D5"],  ["13:1:0","Bb4"], ["13:2:0","G4"],  ["13:3:0","D4"],
    // Bar 14: Abmaj7
    ["14:0:0","C5"],  ["14:1:0","G4"],  ["14:2:0","Eb4"], ["14:3:2","C4"],
    // Bar 15: Fm7
    ["15:0:0","F4"],  ["15:1:0","C4"],  ["15:2:0","Eb4"], ["15:3:0","G4"],
  ];
}

/** Fixed BPM: 112 — synthwave / city pop sweet spot. */
export function getRandomBpm(): number {
  return 112;
}
