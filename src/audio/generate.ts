/**
 * Algorithmic music generation — unique output on every page load.
 *
 * Techniques used:
 *   Value Noise + fBm  — smooth, organic variation for melody pitch/rhythm
 *   Bjorklund / Euclidean algorithm — maximally-even drum rhythms
 *
 * The random permutation table (PERM) is the "seed":
 * it is shuffled once at module-load time, so every page visit
 * produces a different but internally-consistent result.
 */

// ── Value Noise + fBm ─────────────────────────────────────────────────────────
// Shuffle once per page load — this is the global random seed.
const PERM = Array.from({ length: 256 }, (_, i) => i);
for (let i = 255; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [PERM[i], PERM[j]] = [PERM[j], PERM[i]];
}

const smoothstep = (t: number) => t * t * (3 - 2 * t);

function vnoise(x: number): number {
  const i = Math.floor(x) & 255;
  const f = x - Math.floor(x);
  const a = PERM[i] / 255;
  const b = PERM[(i + 1) & 255] / 255;
  return a + (b - a) * smoothstep(f);
}

/**
 * Fractional Brownian Motion — sums value noise at increasing frequencies.
 * Produces smooth, correlated random values in [0, 1].
 * Same x → same result within a session; different PERM → different result each load.
 */
export function fbm(x: number, octaves = 4): number {
  let v = 0, amp = 0.5, freq = 1, norm = 0;
  for (let o = 0; o < octaves; o++) {
    v += vnoise(x * freq) * amp;
    norm += amp; amp *= 0.5; freq *= 2;
  }
  return v / norm;
}

// ── Euclidean Rhythm (Bjorklund Algorithm) ───────────────────────────────────
// Recursively interleaves groups of 1s and 0s until maximally even.
// E(3,8) = [1,0,0,1,0,0,1,0]  (tresillo)
// E(5,16)= [1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,0]  (clave-like kick)
// E(4,16)= [1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0]  (four-on-the-floor)
function bjorklund(g: boolean[][], hits: number, rem: number): boolean[] {
  if (rem <= 1) return g.flat();
  const n = Math.min(hits, rem);
  const next: boolean[][] = [];
  for (let i = 0; i < n; i++) next.push([...g[i], ...g[g.length - 1 - i]]);
  next.push(...g.slice(n, g.length - n));
  return bjorklund(next, n, Math.abs(hits - rem));
}

/**
 * Generate a Euclidean/Bjorklund rhythm pattern.
 * @param hits   Number of onsets
 * @param steps  Total steps (grid resolution)
 * @param offset Rotation in steps (shifts the pattern forward)
 * @returns      Boolean array of length `steps`
 */
export function euclidean(hits: number, steps: number, offset = 0): boolean[] {
  if (hits <= 0) return new Array(steps).fill(false);
  if (hits >= steps) return new Array(steps).fill(true);
  const g: boolean[][] = Array.from({ length: steps }, (_, i) => [i < hits]);
  const raw = bjorklund(g, hits, steps - hits);
  return [...raw.slice(offset), ...raw.slice(0, offset)];
}

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

// ── Rhythm Generators ─────────────────────────────────────────────────────────

/**
 * Kick drum: Euclidean pattern on 16th-note grid.
 * hits 4–7 × offset 0–3 gives 16 distinct groove feels per session.
 *   E(4,16) = four-on-the-floor      E(5,16) = Afro-Cuban clave
 *   E(6,16) = busier groove          E(7,16) = very syncopated
 */
export function generateKickTimes(): string[] {
  const hits   = 4 + Math.floor(Math.random() * 4); // 4–7
  const offset = Math.floor(Math.random() * 4);      // 0–3
  return patternToBars(euclidean(hits, 16, offset), 4);
}

/**
 * Open hi-hat: sparser Euclidean pattern, offset to land on off-beats.
 * hits 2–4 creates anywhere from a half-time feel to a quarter-note pulse.
 */
export function generateHihatTimes(): string[] {
  const hits   = 2 + Math.floor(Math.random() * 3); // 2–4
  const offset = 1 + Math.floor(Math.random() * 3); // 1–3 (avoid beat 1)
  return patternToBars(euclidean(hits, 16, offset), 4);
}

// ── Melody Generation (fBm-guided scale walk) ─────────────────────────────────

// C natural minor over two octaves: C4 → G5 (12 available scale degrees)
const SCALE: readonly [string, number][] = [
  ["C", 4], ["D", 4], ["Eb", 4], ["F", 4], ["G", 4], ["Ab", 4], ["Bb", 4],
  ["C", 5], ["D", 5], ["Eb", 5], ["F", 5], ["G", 5],
];

// Chord-tone scale indices per chord (Cm7 | Gm7 | Abmaj7 | Fm7)
// Notes outside these indices are used as passing tones between chord tones.
const CHORD_TONES: readonly (readonly number[])[] = [
  [0, 2, 4, 6, 7],   // Cm7:    C4 Eb4 G4 Bb4 C5
  [1, 4, 6, 8, 10],  // Gm7:    D4 G4  Bb4 D5  F5
  [2, 5, 7, 9, 11],  // Abmaj7: Eb4 Ab4 C5  Eb5 G5
  [0, 3, 5, 7, 9],   // Fm7:    C4  F4  Ab4 C5  Eb5
];

// Per-section profile: register center, max step-delta, note count range
// fBm noise seed offsets are spaced apart to avoid correlation between sections.
const SECTIONS = [
  { center: 4, maxDelta: 2, minNotes: 2, maxNotes: 3, seed: 0.0   }, // A mid,  spacious intro
  { center: 6, maxDelta: 3, minNotes: 3, maxNotes: 4, seed: 50.0  }, // B high, syncopated groove
  { center: 9, maxDelta: 2, minNotes: 3, maxNotes: 4, seed: 100.0 }, // C peak, emotional climax
  { center: 3, maxDelta: 2, minNotes: 2, maxNotes: 3, seed: 150.0 }, // D low,  descending resolution
] as const;

// 8th-note rhythmic grid: [beat, subdivision] pairs within a bar
// All melody notes land on these slots (subdivision 0 or 2 = 8th-note grid)
const RHYTHM_SLOTS: readonly [number, number][] = [
  [0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2], [3, 0], [3, 2],
];

function snapToChordTone(idx: number, chordIdx: number): number {
  const ct = CHORD_TONES[chordIdx];
  return ct.reduce((best, t) => (Math.abs(t - idx) < Math.abs(best - idx) ? t : best));
}

/**
 * Generate a 16-bar City Pop lead melody using fBm noise.
 * Every page load produces a different melody due to the randomized PERM seed.
 *
 * Algorithm per note:
 *   Beat 1 of each bar → snap to nearest chord tone, nudge toward section register
 *   All other beats    → fBm-guided ±delta walk through the scale
 *
 * Result: [time, note][] pairs ready to drop into a Tone.js Part.
 */
export function generateMelody(): [string, string][] {
  const events: [string, string][] = [];
  let idx = snapToChordTone(4, 0); // start near G4 on a Cm7 tone

  for (let section = 0; section < 4; section++) {
    const { center, maxDelta, minNotes, maxNotes, seed } = SECTIONS[section];

    for (let b = 0; b < 4; b++) {
      const bar   = section * 4 + b;
      const chord = b % 4;
      const s0    = seed + b * 7.3; // unique fBm seed per bar

      // How many notes this bar (fBm → smooth density variation)
      const count = minNotes + Math.floor(fbm(s0 + 0.1) * (maxNotes - minNotes + 0.99));

      // Pick rhythmic slots: beat 1 is always first, rest chosen by noise
      const pool = RHYTHM_SLOTS.slice(1).map(s => s); // mutable copy (exclude beat-1)
      const chosen: [number, number][] = [[0, 0]];
      for (let n = 1; n < count; n++) {
        const pick = Math.floor(fbm(s0 + n * 1.9 + 0.5) * pool.length);
        chosen.push(pool.splice(pick, 1)[0]);
      }
      chosen.sort((a, z) => (a[0] * 4 + a[1]) - (z[0] * 4 + z[1]));

      for (let n = 0; n < chosen.length; n++) {
        const [beat, sub] = chosen[n];

        if (n === 0) {
          // Downbeat: anchor to chord tone, keep register near section center
          idx = snapToChordTone(idx, chord);
          if (Math.abs(idx - center) > 4) {
            idx += idx < center ? 1 : -1;
            idx = Math.max(0, Math.min(SCALE.length - 1, idx));
            idx = snapToChordTone(idx, chord);
          }
        } else {
          // Off-beat: fBm-guided walk, ±maxDelta scale steps
          const noiseVal = fbm(s0 + n * 2.3 + 11.7);
          const delta    = Math.round((noiseVal - 0.5) * maxDelta * 2);
          idx = Math.max(0, Math.min(SCALE.length - 1, idx + delta));
        }

        const [note, oct] = SCALE[idx];
        events.push([`${bar}:${beat}:${sub}`, `${note}${oct}`]);
      }
    }
  }

  return events;
}

/**
 * BPM with slight per-session variation — City Pop comfort zone.
 * Range: 84–96 BPM (avoids the exact-90 sameness).
 */
export function getRandomBpm(): number {
  return Math.round(84 + Math.random() * 12);
}
