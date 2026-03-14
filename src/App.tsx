import { useEffect, useRef, useState } from "react";
import p5 from "p5";
import * as Tone from "tone";
import type GUI from "lil-gui";
import { setupAudio } from "./audio/instruments";
import { setupGUI } from "./audio/gui";
import { createSketch } from "./sketch/sketch";
import CodePanel from "./components/CodePanel";

function App() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm]            = useState(90);
  const canvasRef    = useRef<HTMLDivElement>(null);
  const p5Instance   = useRef<p5 | null>(null);
  const guiRef       = useRef<GUI | null>(null);
  const toneObjects  = useRef<Record<string, unknown>>({});

  useEffect(() => {
    if (p5Instance.current) p5Instance.current.remove();
    if (guiRef.current)     guiRef.current.destroy();

    const { nodes, disposables, bpm: generatedBpm } = setupAudio(toneObjects);
    setBpm(generatedBpm);

    // Preserve codeExec written by setupAudio, then merge with the rest of shared state.
    // Both GUI callbacks and the p5 sketch read from toneObjects.current.
    const codeExec = toneObjects.current.codeExec;
    toneObjects.current = {
      kickEnvelope: nodes.kickEnvelope, kickEnabled: true,
      bassEnvelope: nodes.bassEnvelope, bassEnabled: true,
      snare: nodes.snare,  snareEnabled: true,
      tom:   nodes.tom,    tomEnabled:   true,
      melody: nodes.melody, melodyEnabled: true,
      rhodes: nodes.rhodes, rhodesEnabled: true,
      arp:   nodes.arp,    arpEnabled:   true,
      pad:   nodes.pad,    padEnabled:   true,
      fft:   nodes.fft,
      hihatTick: 0,
      codeExec,  // preserved from setupAudio so CodePanel can read it
    };

    guiRef.current = setupGUI(nodes, toneObjects, generatedBpm);

    if (canvasRef.current) {
      p5Instance.current = new p5(createSketch(toneObjects), canvasRef.current);
    }

    return () => {
      if (p5Instance.current) p5Instance.current.remove();
      if (guiRef.current)     guiRef.current.destroy();
      Tone.getTransport().stop();
      Tone.getTransport().cancel();
      disposables.forEach((n) => n.dispose());
    };
  }, []);

  const togglePlay = async () => {
    if (!isPlaying) {
      await Tone.start();
      Tone.getTransport().start();
      setIsPlaying(true);
    } else {
      Tone.getTransport().pause();
      setIsPlaying(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden" style={{ backgroundColor: "#000" }}>
      <div ref={canvasRef} className="absolute inset-0 z-0" />

      {/* Live code panel — z-index 5, sits between canvas and UI controls */}
      <CodePanel toneObjectsRef={toneObjects} bpm={bpm} />

      {/* Cyberpunk play button — offset right of CodePanel (390px) */}
      <div style={{ position: "absolute", top: "32px", left: "390px", zIndex: 10 }} className="flex flex-col gap-3">
        <button
          onClick={togglePlay}
          style={{
            fontFamily: "'Orbitron', monospace",
            fontSize: "13px",
            fontWeight: 700,
            letterSpacing: "0.18em",
            padding: "12px 28px",
            background: "transparent",
            color: isPlaying ? "#ff2d55" : "#00ffaa",
            border: `1.5px solid ${isPlaying ? "#ff2d55" : "#00ffaa"}`,
            boxShadow: isPlaying
              ? "0 0 10px #ff2d55, 0 0 28px #ff2d5540, inset 0 0 10px #ff2d5518"
              : "0 0 10px #00ffaa, 0 0 28px #00ffaa40, inset 0 0 10px #00ffaa18",
            clipPath: "polygon(8px 0%, calc(100% - 8px) 0%, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0% calc(100% - 8px), 0% 8px)",
            cursor: "pointer",
            transition: "all 0.2s ease",
          }}
        >
          {isPlaying ? "[ STOP ]" : "[ PLAY ]"}
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", paddingLeft: "4px" }}>
          <div
            style={{
              width: "6px", height: "6px", borderRadius: "50%",
              backgroundColor: isPlaying ? "#ff2d55" : "#00ffaa",
              boxShadow: isPlaying ? "0 0 8px #ff2d55" : "0 0 8px #00ffaa",
              animation: isPlaying ? "pulse 1s ease-in-out infinite" : "none",
            }}
          />
          <span style={{ fontFamily: "'Orbitron', monospace", fontSize: "9px", letterSpacing: "0.22em", color: isPlaying ? "#ff2d5599" : "#00ffaa99" }}>
            {isPlaying ? "TRANSMITTING" : "STANDBY"}
          </span>
        </div>
      </div>

      {/* Watermark */}
      <div style={{ position: "absolute", bottom: "20px", right: "24px", zIndex: 10, textAlign: "right", opacity: 0.15, fontFamily: "'Orbitron', monospace", color: "#ffffff", pointerEvents: "none" }}>
        <div style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "0.2em" }}>Visual Music</div>
        <div style={{ fontSize: "9px", letterSpacing: "0.3em", marginTop: "2px" }}>BPM {bpm}</div>
      </div>
    </div>
  );
}

export default App;
