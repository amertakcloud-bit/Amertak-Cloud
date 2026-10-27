import { useEffect, useState } from "react";

// Skeleton loading blocks: same shape as the real content (no layout jump), soft shimmer (CSS only,
// switched off for prefers-reduced-motion). Compose them, or use <SkeletonPage kind="…">.
export function Skeleton({ w, h = 14, r, circle = false, className = "", style }) {
  return <span className={`sk ${className}`} aria-hidden="true" style={{ width: w, height: h, borderRadius: circle ? "50%" : r, ...(circle ? { width: w ?? h } : null), ...style }} />;
}

export function SkeletonText({ lines = 3, last = 60 }) {
  return (
    <div className="sk-text" aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => <Skeleton key={i} h={12} w={i === lines - 1 && lines > 1 ? `${last}%` : "100%"} />)}
    </div>
  );
}

export function SkeletonStats({ n = 4 }) {
  return (
    <div className="ud-stats sk-stats" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="tk-card ud-stat"><Skeleton circle h={40} /><div className="sk-col"><Skeleton h={20} w={64} /><Skeleton h={11} w={96} /></div></div>
      ))}
    </div>
  );
}

export function SkeletonChart({ bars = 30, height = 170 }) {
  return (
    <div className="sk-chart" style={{ height }} aria-hidden="true">
      {Array.from({ length: bars }, (_, i) => <Skeleton key={i} className="sk-bar" h={`${28 + ((i * 37) % 62)}%`} />)}
    </div>
  );
}

export function SkeletonRows({ rows = 5, cols = 4, className = "" }) {
  return (
    <div className={`sk-rows ${className}`} aria-hidden="true">
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="sk-row" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
          {Array.from({ length: cols }, (_, c) => <Skeleton key={c} h={13} w={c === 0 ? "80%" : `${50 + ((r * 13 + c * 17) % 40)}%`} />)}
        </div>
      ))}
    </div>
  );
}

export function SkeletonCard({ lines = 3 }) {
  return (
    <div className="tk-card sk-card" aria-hidden="true">
      <Skeleton h={18} w="45%" />
      <SkeletonText lines={lines} />
    </div>
  );
}

// Whole-page placeholder (used while the session / route data is loading)
export function SkeletonPage({ kind = "page", label = "Loading" }) {
  return (
    <div className="page sk-page" role="status" aria-busy="true" aria-label={label}>
      <Skeleton h={26} w="min(260px, 60%)" />
      <Skeleton h={13} w="min(380px, 80%)" />
      {kind === "dashboard" || kind === "admin" ? <SkeletonStats /> : null}
      {kind === "admin" ? <div className="tk-card sk-card"><SkeletonRows rows={6} cols={5} /></div> : <SkeletonCard lines={4} />}
      {kind === "dashboard" ? <div className="tk-card sk-card"><SkeletonChart /></div> : null}
      <span className="sk-sr">{label}…</span>
    </div>
  );
}

// true only after `ms` of loading → quick loads never flash a skeleton
export function useDelayed(on, ms = 120) {
  const [v, setV] = useState(false);
  useEffect(() => {
    if (!on) { setV(false); return undefined; }
    const id = setTimeout(() => setV(true), ms);
    return () => clearTimeout(id);
  }, [on, ms]);
  return v;
}
