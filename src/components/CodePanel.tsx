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
  rhodes: "#00ff88",  // green      → sparse comping
  pad:    "#8888ff",  // lavender   → atmosphere
  melody: "#00ffcc",  // teal       → lead synth orbit ring
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
      "// pattern: four-on-the-floor (beats 1–2–3–4)",
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
      "openHiHat.triggerAttack(time)",
      "// 8th-note grid — steady driving pulse",
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
      "bassEnvelope.triggerAttack(time)",
      "// root–fifth walking line, 6 hits/bar",
    ],
    dynamic: true,
  },
  {
    id: "rhodes", color: COLOR.rhodes,
    header: "// ── Rhodes (sparse comping — 1 stab/bar) ─────────",
    lines: [
      `rhodes.triggerAttackRelease(chord, "4n", time)`,
      "// off-beat stab at beat 1-and each bar",
    ],
    dynamic: true,
  },
  {
    id: "pad", color: COLOR.pad,
    header: "// ── Pad (fatsawtooth×2 + reverb decay:8s) ────────",
    lines: [
      `pad.triggerAttackRelease(chord, "1n", time)`,
      "// atmospheric wash, very low volume",
    ],
    dynamic: true,
  },
  {
    id: "melody", color: COLOR.melody,
    // header is overridden in render based on preset
    header: "// ── Lead Synth (main) ────────────────────────────",
    lines: [
      "// A(0-3):  intro — spacious, establishing motif",
      "// B(4-7):  groove — syncopated, ascending",
      "// C(8-11): climax — high register, emotional peak",
      "// D(12-15):resolution — descending, peaceful close",
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
  preset: number;
}

export default function CodePanel({ toneObjectsRef, bpm, preset }: Props) {
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
          {`bpm = ${bpm}  //  preset ${preset} · C minor · fixed`}
        </div>
      </div>

      {/* ── Arrangement (static) ─────────────────────────────────────────────── */}
      <Section>
        <Comment>{"// generate.ts ─────────────────────────────────────────"}</Comment>
        <Blank />
        <Comment>{"// Fixed retro-futurist arrangement — C natural minor"}</Comment>
        <Comment>{"// Chord loop: Cm7 | Gm7 | Abmaj7 | Fm7  (i–v–VI–iv)"}</Comment>
        <Blank />
        <Comment>{"// Kick:  four-on-the-floor (beats 1–2–3–4)"}</Comment>
        <Comment>{"// Hihat: 8th-note grid (on + off every beat)"}</Comment>
        <Comment>{"// Bass:  fixed root–fifth walking line"}</Comment>
        <Blank />
        <Comment>{"// Lead melody: 16-bar hand-crafted phrase"}</Comment>
        <Code>{"//  A(0–3):   G4→Bb4  spacious intro"}</Code>
        <Code>{"//  B(4–7):   G4→G5   syncopated groove"}</Code>
        <Code>{"//  C(8–11):  G5→F5   high-register climax"}</Code>
        <Code>{"//  D(12–15): Eb5→G4  descending resolution"}</Code>
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
            <div style={{ ...mono, color: "#2a4050", marginBottom: "3px" }}>
              {id === "melody"
                ? (preset === 1
                    ? "// ── Lead Synth — FatSaw×5 (Preset 1) ────────────"
                    : "// ── Lead Synth — PolySynth (Preset 2) ───────────")
                : header}
            </div>
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
