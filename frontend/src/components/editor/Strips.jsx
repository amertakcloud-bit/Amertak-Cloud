import { useMemo } from "react";

// Compact "touch-bar" style controls: round swatches, a rainbow slider, a ruler slider and an icon segment.
export const SWATCHES = ["#ffffff", "#000000", "#facc15", "#f97316", "#ef4444", "#ec4899", "#a855f7", "#3b82f6", "#22d3ee", "#22c55e"];

const hexToHsl = (hex) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || ""); if (!m) return [0, 0, 1];
  const n = parseInt(m[1], 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2; let h = 0, s = 0;
  if (max !== min) { const d = max - min; s = l > 0.5 ? d / (2 - max - min) : d / (max + min); h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; }
  return [h, s, l];
};
const hslToHex = (h, s, l) => {
  const a = s * Math.min(l, 1 - l), f = (n) => { const k = (n + h / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  return "#" + [f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, "0")).join("");
};

export function SwatchStrip({ value, onChange, colors = SWATCHES, label = "Colour" }) {
  const cur = String(value || "").toLowerCase();
  return (
    <div className="ts-strip ts-swatches" role="radiogroup" aria-label={label}>
      {colors.map((c) => (
        <button key={c} type="button" role="radio" aria-checked={cur === c} aria-label={c} className={cur === c ? "on" : ""} style={{ background: c }} onClick={() => onChange(c)} />
      ))}
    </div>
  );
}

export function HueSlider({ value, onChange, label = "Hue" }) {
  const [h, s, l] = useMemo(() => hexToHsl(value), [value]);
  return (
    <div className="ts-strip ts-hue">
      <input type="range" min="0" max="360" step="1" value={Math.round(h)} aria-label={label}
        onChange={(e) => onChange(hslToHex(Number(e.target.value), s < 0.2 ? 0.9 : s, l < 0.2 || l > 0.9 ? 0.55 : l))} />
      <input type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#ffffff"} onChange={(e) => onChange(e.target.value)} aria-label="custom colour" />
    </div>
  );
}

// Full colour control: swatches + rainbow slider.
export function ColorStrips({ value, onChange }) {
  return <div className="ts-stack"><SwatchStrip value={value} onChange={onChange} /><HueSlider value={value} onChange={onChange} /></div>;
}

export function RulerSlider({ label, value, min, max, step = 1, onChange, fmt = (v) => v, zero }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="ts-ruler">
      <div className="ts-ruler-h"><span>{label}</span><b>{fmt(value)}</b></div>
      <div className="ts-ruler-body">
        <div className="ts-ticks" aria-hidden="true" />
        {zero != null && <i className="ts-zero" style={{ left: `${((zero - min) / (max - min)) * 100}%` }} aria-hidden="true" />}
        <i className="ts-needle" style={{ left: `${pct}%` }} aria-hidden="true" />
        <input type="range" min={min} max={max} step={step} value={value} aria-label={label} onChange={(e) => onChange(Number(e.target.value))} />
      </div>
    </div>
  );
}

export function IconSeg({ items, value, onChange, label }) {
  return (
    <div className="ts-strip ts-seg" role="radiogroup" aria-label={label}>
      {items.map(([k, icon, text]) => (
        <button key={k} type="button" role="radio" aria-checked={value === k} className={value === k ? "on" : ""} onClick={() => onChange(k)} aria-label={text || k} title={text || k}>
          {icon && <i className={icon} aria-hidden="true" />}{text && <span>{text}</span>}
        </button>
      ))}
    </div>
  );
}
