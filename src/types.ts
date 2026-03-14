export interface Star {
  x: number;
  y: number;
  size: number;
  brightness: number;
  twinkleSpeed: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  hue: number;
}

// City Pop chord progression: Cm7 | Gm7 | Abmaj7 | Fm7  (i - v - VI - iv in C minor)
export const CHORD_HUES = [240, 150, 30, 195] as const;
