/**
 * CodePanel — live code execution visualizer.
 *
 * Displays the actual source code of the music engine.
 * As each instrument fires, its code block glows with a colored highlight
 * and the panel smoothly scrolls to bring it into view.
 *
 * All animation is driven by requestAnimationFrame + direct DOM mutation
 * to avoid React re-renders on every audio callback.
 */
import { useEffect, useRef } from "react";
import * as Tone from "tone";

// ── Instrument → highlight color (matched to the p5 visualization) ───────────
const COLOR: Record<string, string> = {
  kick:   "#00cfff",  // ice blue   → shockwave rings
  snare:  "#ffcc00",  // yellow     → radial beams
  hihat:  "#44ffee",  // cyan       → particle spray
  tom:    "#00ddcc",  // teal       → hexagons
  bass:   "#ff4488",  // pink       → noise blob
  rhodes: "#00ff88",  // green
  arp:    "#ffaa00",  // amber
  pad:    "#8888ff",  // lavender
  melody: "#cc44ff",  // purple     → orbit ring
};

const FADE_MS   = 650;   // highlight decay time
const SCROLL_MS = 200;   // minimum ms between auto-scrolls

// ── Monospace style shared across all code lines ─────────────────────────────
const mono: React.CSSProperties = {
  fontFamily: "'Fira Code', 'Cascadia Code', 'Courier New', monospace",
  fontSize:   "11.5px",
  lineHeight: "19px",
  whiteSpace: "pre",
};

// ── Static code block definitions ─────────────────────────────────────────────
// Each block maps to one instrument. `dynamic` blocks show a live note/chord annotation.
const BLOCKS: {
  id:       string;
  color:    string;
  header:   string;
  lines:    string[];
  dynamic?: true;         // append a live "// → note" annotation
}[] = [
  {
    id: "kick", color: COLOR.kick,
    header: "// ── Kick ─────────────────────────────────────────",
    lines: [
      "kickEnvelope.triggerAttack(time)",
      "kickSnapEnv.triggerAttack(time)  // C1+4oct punch",
      "// pattern: E(?,16,?) euclidean 16th grid",
    ],
  },
  {
    id: "snare", color: COLOR.snare,
    header: "// ── Snare ────────────────────────────────────────",
    lines: [
      "snare.triggerAttack(time)",
      `// backbeat: ["0:1","0:3","1:1","1:3",...]`,
    ],
  },
  {
    id: "hihat", color: COLOR.hihat,
    header: "// ── Hi-Hat ───────────────────────────────────────",
    lines: [
      "openHiHat.triggerAttack(time)   // E(?,16,?)",
      "closedHiHat.triggerAttack(time) // 16n velocity-rand",
    ],
  },
  {
    id: "tom", color: COLOR.tom,
    header: "// ── Tom ─────────────────────────────────────────",
    lines: [
      "tom.triggerAttack(note, time)",
      `// [3:3:0]→"G1"  [3:3:2]→"C1"`,
    ],
  },
  {
    id: "bass", color: COLOR.bass,
    header: "// ── Bass  (Cm7 | Gm7 | Abmaj7 | Fm7) ────────────",
    lines: [
      "bass.frequency.setValueAtTime(note, time)",
      "bassEnvelope.triggerAttack(time)  // decay: 0.66s",
    ],
    dynamic: true,
  },
  {
    id: "rhodes", color: COLOR.rhodes,
    header: "// ── Rhodes (triangle + chorus + reverb) ──────────",
    lines: [
      `rhodes.triggerAttackRelease(chord, "4n", time)`,
    ],
    dynamic: true,
  },
  {
    id: "arp", color: COLOR.arp,
    header: "// ── Arp (sawtooth + bandpass + feedback delay) ───",
    lines: [
      `arp.triggerAttackRelease(note, "16n", time)`,
    ],
    dynamic: true,
  },
  {
    id: "pad", color: COLOR.pad,
    header: "// ── Pad (fatsawtooth×3 + reverb decay:7s) ────────",
    lines: [
      `pad.triggerAttackRelease(chord, "1n", time)`,
    ],
    dynamic: true,
  },
  {
    id: "melody", color: COLOR.melody,
    header: "// ── Melody — fBm walk, C natural minor ───────────",
    lines: [
      "// A(0-3): center=G4,  Δ=±2, density=2–3 notes",
      "// B(4-7): center=Bb4, Δ=±3, density=3–4 notes",
      "// C(8-11):center=Eb5, Δ=±2, density=3–4 notes",
      "// D(12-15):center=F4, Δ=±2, density=2–3 notes",
      `melody.triggerAttackRelease(note, "8n", time)`,
    ],
    dynamic: true,
  },
];

// ── codeExec type (matches what instruments.ts writes) ───────────────────────
type ExecEntry = number | { t: number; note?: string; chord?: string };
type CodeExec  = Record<string, ExecEntry>;

interface Props {
  toneObjectsRef: React.MutableRefObject<Record<string, unknown>>;
  bpm: number;
}

export default function CodePanel({ toneObjectsRef, bpm }: Props) {
  // Refs to each instrument block DOM element
  const blockEls   = useRef<Record<string, HTMLDivElement | null>>({});
  // Refs to each dynamic annotation span
  const annotEls   = useRef<Record<string, HTMLSpanElement | null>>({});
  // Ref to the transport position display
  const posEl      = useRef<HTMLSpanElement | null>(null);
  // Ref to the scrollable container
  const panelEl    = useRef<HTMLDivElement | null>(null);

  const rafRef     = useRef(0);
  const prevTs     = useRef<Record<string, number>>({});
  const lastScroll = useRef({ inst: "", t: 0 });

  useEffect(() => {
    const frame = () => {
      const now  = Date.now();
      const exec = (toneObjectsRef.current?.codeExec ?? {}) as CodeExec;

      // ── Transport position display ──────────────────────────────────────────
      if (posEl.current) {
        try {
          const raw   = Tone.getTransport().position as string;
          const parts = raw.split(":");
          const bar   = (parseInt(parts[0]) % 16) + 1;
          const beat  = parseInt(parts[1]) + 1;
          posEl.current.textContent = `${String(bar).padStart(2, "0")}:${String(beat).padStart(2, "0")}`;
        } catch {
          /* transport not started yet */
        }
      }

      // ── Per-instrument highlight + annotation update ────────────────────────
      for (const { id, color, dynamic } of BLOCKS) {
        const el = blockEls.current[id];
        if (!el) continue;

        const raw  = exec[id];
        const ts   = typeof raw === "number" ? raw : (raw as { t: number })?.t ?? 0;
        const age  = now - ts;
        const p    = Math.max(0, 1 - age / FADE_MS);  // intensity 0→1

        // Background tint + left border
        if (p > 0) {
          const bgAlpha = Math.round(p * 28).toString(16).padStart(2, "0");
          el.style.backgroundColor = `${color}${bgAlpha}`;
          el.style.borderLeftColor  = color;
          el.style.borderLeftWidth  = "3px";
        } else {
          el.style.backgroundColor = "transparent";
          el.style.borderLeftColor  = "#1e2a33";
          el.style.borderLeftWidth  = "1px";
        }

        // Live note/chord annotation (only for dynamic blocks)
        if (dynamic) {
          const annot = annotEls.current[id];
          if (annot && raw && typeof raw === "object") {
            const meta = (raw as { note?: string; chord?: string }).note
                      ?? (raw as { note?: string; chord?: string }).chord ?? "";
            if (meta) annot.textContent = `  // → ${meta}`;
            annot.style.opacity = p > 0 ? String(Math.max(0.4, p)) : "0.25";
          }
        }

        // ── Auto-scroll: snap to newly triggered instrument ─────────────────
        if (ts > 0 && ts !== prevTs.current[id]) {
          prevTs.current[id] = ts;
          if (
            lastScroll.current.inst !== id &&
            now - lastScroll.current.t > SCROLL_MS
          ) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            lastScroll.current = { inst: id, t: now };
          }
        }
      }

      rafRef.current = requestAnimationFrame(frame);
    };

    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, [toneObjectsRef]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      ref={panelEl}
      className="code-panel"
      style={{
        position:  "fixed",
        top: 0, left: 0,
        width:     "370px",
        height:    "100vh",
        overflowY: "scroll",
        overflowX: "hidden",
        background: "rgba(3, 7, 12, 0.86)",
        backdropFilter: "blur(6px)",
        zIndex:    5,
        boxSizing: "border-box",
        borderRight: "1px solid #ffffff08",
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ padding: "18px 18px 14px", borderBottom: "1px solid #0d1a22" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
          <span style={{ ...mono, color: "#00ffaa", fontSize: "9px", letterSpacing: "0.28em" }}>
            VISUAL MUSIC / LIVE CODE
          </span>
          {/* Transport position */}
          <span style={{ ...mono, color: "#334455", fontSize: "11px" }}>
            BAR{" "}
            <span ref={posEl} style={{ color: "#4488aa" }}>--:--</span>
          </span>
        </div>
        <div style={{ ...mono, color: "#2a3d4d", fontSize: "11px" }}>
          {`bpm = ${bpm}  //  i–v–VI–iv in C minor`}
        </div>
      </div>

      {/* ── Algorithms (static) ──────────────────────────────────────────────── */}
      <Section>
        <Comment>{"// generate.ts ─────────────────────────────────────────"}</Comment>
        <Blank />
        <Comment>{"// Value Noise — permutation table shuffled at load time"}</Comment>
        <Code>{"const PERM = shuffle([0..255])  // ← session seed"}</Code>
        <Blank />
        <Code>{"fbm(x, octaves = 4) {"}</Code>
        <Code>{"  return Σ[i] vnoise(x · 2ⁱ) · 0.5ⁱ"}</Code>
        <Code>{"}"}</Code>
        <Blank />
        <Comment>{"// Bjorklund — spread N hits evenly across M steps"}</Comment>
        <Code>{"euclidean(hits, steps, offset) {"}</Code>
        <Code>{"  bjorklund(groups, hits, rem)"}</Code>
        <Code>{"  .rotate(offset)"}</Code>
        <Code>{"}"}</Code>
        <Blank />
        <Comment>{"// E(4,16) → four-on-the-floor"}</Comment>
        <Comment>{"// E(5,16) → clave  E(7,16) → very syncopated"}</Comment>
      </Section>

      {/* ── Instrument blocks ──────────────────────────────────────────────── */}
      <div style={{ padding: "8px 0" }}>
        {BLOCKS.map(({ id, color, header, lines, dynamic }) => (
          <div
            key={id}
            ref={el => { blockEls.current[id] = el; }}
            style={{
              padding:         "9px 18px",
              borderLeft:      "1px solid #1e2a33",
              borderBottom:    "1px solid #0a1520",
              transition:      "background-color 50ms linear, border-left-color 50ms linear",
              backgroundColor: "transparent",
            }}
          >
            <div style={{ ...mono, color: "#2a4050", marginBottom: "3px" }}>{header}</div>
            {lines.map((line, i) => (
              <div key={i} style={{ ...mono, color: "#7a9bac" }}>{line}</div>
            ))}
            {dynamic && (
              <span
                ref={el => { annotEls.current[id] = el; }}
                style={{ ...mono, color: color, opacity: 0.25, transition: "opacity 80ms" }}
              />
            )}
          </div>
        ))}
      </div>

      {/* ── Transport config (static) ─────────────────────────────────────── */}
      <Section>
        <Comment>{"// instruments.ts ──────────────────────────────────────"}</Comment>
        <Blank />
        <Code>{`Transport.bpm     = ${bpm}`}</Code>
        <Code>{"Transport.loop    = true"}</Code>
        <Code>{"Transport.loopEnd = \"16:0\"   // 16-bar form"}</Code>
        <Blank />
        <Comment>{"// drum Parts:   loop = true, loopEnd = \"4:0\""}</Comment>
        <Comment>{"// chord Parts:  loop = true, loopEnd = \"4:0\""}</Comment>
        <Comment>{"// melody Part:  no loop (unique 16-bar sequence)"}</Comment>
      </Section>

      {/* bottom padding so last item can scroll to center */}
      <div style={{ height: "50vh" }} />
    </div>
  );
}

// ── Small helper components ───────────────────────────────────────────────────
function Section({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: "12px 18px", borderBottom: "1px solid #0a1520" }}>
      {children}
    </div>
  );
}
function Comment({ children }: { children: React.ReactNode }) {
  return <div style={{ ...mono, color: "#2a4050" }}>{children}</div>;
}
function Code({ children }: { children: React.ReactNode }) {
  return <div style={{ ...mono, color: "#7a9bac" }}>{children}</div>;
}
function Blank() {
  return <div style={{ height: "5px" }} />;
}
