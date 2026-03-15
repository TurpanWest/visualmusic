/**
 * PresetSelector — cyberpunk-styled arrangement preset switcher.
 *
 * Displays one button per preset. Active preset is lit;
 * inactive presets show as outlines. Styled to match the play button.
 */

interface Preset {
  id: number;
  label: string;
  desc: string;
}

const PRESETS: Preset[] = [
  { id: 1, label: "ARR·01", desc: "FatSaw×5" },
  { id: 2, label: "ARR·02", desc: "PolySynth" },
];

// Accent colors per preset
const ACCENT = ["#00ffcc", "#ff9900"] as const;

interface Props {
  current: number;
  onSelect: (id: number) => void;
}

const mono: React.CSSProperties = {
  fontFamily: "'Orbitron', monospace",
  letterSpacing: "0.16em",
};

export default function PresetSelector({ current, onSelect }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <div style={{ ...mono, fontSize: "8px", color: "#334455", paddingLeft: "4px", letterSpacing: "0.28em" }}>
        ARRANGEMENT
      </div>
      <div style={{ display: "flex", gap: "8px" }}>
        {PRESETS.map((p, i) => {
          const active  = p.id === current;
          const color   = ACCENT[i];
          return (
            <button
              key={p.id}
              onClick={() => onSelect(p.id)}
              style={{
                ...mono,
                fontSize: "11px",
                fontWeight: 700,
                padding: "8px 14px",
                background: active ? `${color}18` : "transparent",
                color: active ? color : `${color}66`,
                border: `1.5px solid ${active ? color : `${color}44`}`,
                boxShadow: active
                  ? `0 0 8px ${color}99, inset 0 0 8px ${color}14`
                  : "none",
                clipPath: "polygon(6px 0%, calc(100% - 6px) 0%, 100% 6px, 100% calc(100% - 6px), calc(100% - 6px) 100%, 6px 100%, 0% calc(100% - 6px), 0% 6px)",
                cursor: "pointer",
                transition: "all 0.18s ease",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "2px",
                minWidth: "72px",
              }}
            >
              <span>{p.label}</span>
              <span style={{ fontSize: "8px", fontWeight: 400, letterSpacing: "0.1em", opacity: 0.7 }}>
                {p.desc}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
