import p5 from "p5";
import * as Tone from "tone";
import type { Star, Particle } from "../types";
import { CHORD_HUES } from "../types";

export function createSketch(toneObjectsRef: { current: Record<string, unknown> }) {
  return (p: p5) => {
    let phase = 0;
    const shockwaves: { size: number; opacity: number; hue: number }[] = [];
    const stars: Star[] = [];
    const particles: Particle[] = [];
    let lastHihatTick = 0;

    p.setup = () => {
      p.createCanvas(p.windowWidth, p.windowHeight);
      p.colorMode(p.HSB, 360, 100, 100, 100);
      p.rectMode(p.CENTER);
      for (let i = 0; i < 200; i++) {
        stars.push({
          x: p.random(-p.width / 2, p.width / 2),
          y: p.random(-p.height / 2, p.height / 2),
          size: p.random(0.5, 2.5),
          brightness: p.random(40, 90),
          twinkleSpeed: p.random(0.01, 0.05),
        });
      }
    };

    p.windowResized = () => p.resizeCanvas(p.windowWidth, p.windowHeight);

    p.draw = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const to = toneObjectsRef.current as any;
      const { kickEnvelope, kickEnabled, bassEnvelope, bassEnabled, snare, snareEnabled, tom, tomEnabled, melody, melodyEnabled, fft } = to;

      p.background(230, 30, 6, 40);
      p.blendMode(p.ADD);
      p.translate(p.width / 2, p.height / 2);
      phase += 1;

      // ── Chord color halo (synced to transport bar) ──────────────────────────
      const pos = Tone.getTransport().position as string;
      const currentBar = parseInt(pos.split(":")[0]) % 4;
      const chordHue = CHORD_HUES[currentBar] ?? 240;
      p.noFill();
      p.stroke(chordHue, 50, 25, 12);
      p.strokeWeight(30);
      p.ellipse(0, 0, p.height * 0.92, p.height * 0.92);

      // ── Nebula blobs ────────────────────────────────────────────────────────
      p.noStroke();
      p.fill(220, 40, 12, 18);
      p.ellipse(-p.width * 0.2, -p.height * 0.15, p.width * 0.6, p.height * 0.4);
      p.fill(260, 30, 10, 14);
      p.ellipse( p.width * 0.15,  p.height * 0.10, p.width * 0.5, p.height * 0.35);

      // ── Stars (bass-breathing + sine twinkle) ───────────────────────────────
      const bassBreath = bassEnvelope ? bassEnvelope.value * 18 : 0;
      for (const star of stars) {
        const twinkle = p.map(Math.sin(phase * star.twinkleSpeed + star.x * 0.01), -1, 1, star.brightness * 0.4, star.brightness);
        p.noStroke();
        p.fill(220, 10, Math.min(twinkle + bassBreath, 100), 80);
        p.ellipse(star.x, star.y, star.size, star.size);
      }

      // ── Kick shockwaves (ice-blue dual rings) ───────────────────────────────
      if (kickEnvelope && kickEnabled && kickEnvelope.value > 0.1 && p.frameCount % 5 === 0) {
        shockwaves.push({ size: 50, opacity: 80, hue: 200 });
      }
      p.noFill();
      for (let i = shockwaves.length - 1; i >= 0; i--) {
        const wave = shockwaves[i];
        wave.size += 15;
        wave.opacity -= 2;
        if (wave.opacity <= 0) {
          shockwaves.splice(i, 1);
        } else {
          p.strokeWeight(5);
          p.stroke(wave.hue, 60, 55, wave.opacity * 0.35);
          p.ellipse(0, 0, wave.size * 1.06, wave.size * 1.06);
          p.strokeWeight(1.5);
          p.stroke(wave.hue, 40, 100, wave.opacity * 0.7);
          p.ellipse(0, 0, wave.size, wave.size);
        }
      }

      // ── Bass core (dual-layer noise blob) ───────────────────────────────────
      if (bassEnvelope && bassEnabled) {
        const bassVal = bassEnvelope.value;
        const baseRadius = p.height * 0.15 + bassVal * 150;
        const buildShape = () => {
          p.beginShape();
          for (let a = 0; a < p.TWO_PI; a += 0.1) {
            const xoff = Math.cos(a) + phase * 0.02;
            const yoff = Math.sin(a) + phase * 0.02;
            const r = baseRadius + p.map(p.noise(xoff, yoff, phase * 0.05), 0, 1, -30, 30) * (1 + bassVal * 3);
            p.vertex(r * Math.cos(a), r * Math.sin(a));
          }
          p.endShape(p.CLOSE);
        };
        p.noFill();
        p.stroke(350, 55, 45, 28); p.strokeWeight(14); buildShape();
        p.stroke(350, 75, 100, 65); p.strokeWeight(2);  buildShape();
      }

      // ── FFT ring spectrum ────────────────────────────────────────────────────
      if (fft) {
        const fftValues = fft.getValue() as Float32Array;
        const specRadius = p.height * 0.30;
        for (let i = 0; i < 128; i++) {
          const angle = p.map(i, 0, 128, 0, p.TWO_PI) - p.HALF_PI;
          const db = fftValues[i] as number;
          const normalized = p.map(Math.max(db, -100), -100, 0, 0, 1);
          const lineLen = normalized * 60;
          if (lineLen < 0.5) continue;
          const hue = p.map(i, 0, 128, 0, 260);
          p.strokeWeight(1.5);
          p.stroke(hue, 85, 100, normalized * 75 + 8);
          p.line(
            Math.cos(angle) * specRadius,           Math.sin(angle) * specRadius,
            Math.cos(angle) * (specRadius + lineLen), Math.sin(angle) * (specRadius + lineLen),
          );
        }
      }

      // ── Melody orbit (dual neon ring) ────────────────────────────────────────
      if (melody && melodyEnabled && melody.envelope) {
        const melodyVal = melody.envelope.value;
        const orbitRadius = p.height * 0.35;
        const buildOrbit = () => {
          p.beginShape();
          for (let a = 0; a <= p.TWO_PI; a += 0.05) {
            const noiseVal = (p.noise(a * 5, phase * 0.05) - 0.5) * melodyVal * 300;
            const r = orbitRadius + noiseVal;
            p.vertex(r * Math.cos(a), r * Math.sin(a));
          }
          p.endShape(p.CLOSE);
        };
        p.noFill();
        p.stroke(280, 60, 45, 28); p.strokeWeight(9);   buildOrbit();
        p.stroke(280, 90, 100, 60); p.strokeWeight(1.5); buildOrbit();
      }

      // ── Snare burst (4 radial beams, orbiting) ───────────────────────────────
      if (snare && snareEnabled && snare.envelope.value > 0.01) {
        p.push();
        p.rotate(phase * 0.05);
        p.translate(p.height * 0.25, 0);
        p.rotate(phase * 0.1);
        const radius = snare.envelope.value * 200;
        for (let b = 0; b < 4; b++) {
          const angle = (b / 4) * p.TWO_PI;
          const ex = Math.cos(angle) * radius;
          const ey = Math.sin(angle) * radius;
          p.stroke(50, 80, 55, 38);  p.strokeWeight(7);   p.line(0, 0, ex, ey);
          p.stroke(50, 100, 100, 80); p.strokeWeight(1.5); p.line(0, 0, ex, ey);
          p.noStroke(); p.fill(50, 80, 100, 65); p.ellipse(ex, ey, 6, 6);
        }
        p.pop();
      }

      // ── Tom (concentric hexagons, orbiting) ──────────────────────────────────
      if (tom && tomEnabled && tom.envelope.value > 0.01) {
        p.push();
        p.rotate(-phase * 0.02);
        p.translate(p.height * 0.45, 0);
        p.noFill();
        const baseSize = tom.envelope.value * 250;
        for (let k = 0; k < 3; k++) {
          const currentSize = baseSize * (1 - k * 0.3);
          if (currentSize > 0) {
            p.stroke(180, 85, 85, 55 - k * 14);
            p.strokeWeight(4 - k);
            p.beginShape();
            for (let i = 0; i < 6; i++) {
              p.vertex(Math.cos((Math.PI / 3) * i) * currentSize, Math.sin((Math.PI / 3) * i) * currentSize);
            }
            p.endShape(p.CLOSE);
          }
        }
        p.pop();
      }

      // ── Hi-hat particle spray ────────────────────────────────────────────────
      const currentTick = (toneObjectsRef.current.hihatTick as number) || 0;
      if (currentTick !== lastHihatTick) {
        lastHihatTick = currentTick;
        for (let i = 0; i < 10; i++) {
          const angle = p.random(p.TWO_PI);
          const speed = p.random(2, 6);
          particles.push({ x: 0, y: 0, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 1.0, hue: p.random(170, 210) });
        }
      }
      for (let i = particles.length - 1; i >= 0; i--) {
        const pt = particles[i];
        pt.x += pt.vx; pt.y += pt.vy;
        pt.vx *= 0.95;  pt.vy *= 0.95;
        pt.life -= 0.025;
        if (pt.life <= 0) {
          particles.splice(i, 1);
        } else {
          p.noStroke();
          p.fill(pt.hue, 80, 100, pt.life * 80);
          p.ellipse(pt.x, pt.y, 3, 3);
        }
      }

      p.blendMode(p.BLEND);
    };
  };
}
