import { useEffect, useRef, useState } from "react";

// Turns jumpy progress reports (2 → 15 → 60 → 100) into a live counter: 1, 2, 3 … 100.
//  • follows the real target in small steps (never jumps),
//  • while waiting for the next real report it creeps +1% per ~0.7 s (max 10% past the last report, never past 99%),
//  • when the target reaches 100 it finishes quickly.
export default function useSmoothProgress(target, active) {
  const [shown, setShown] = useState(0);
  const tgt = useRef(0);
  tgt.current = Math.max(0, Math.min(100, Number(target) || 0));

  useEffect(() => {
    if (!active) { setShown(0); return undefined; }
    const follow = setInterval(() => setShown((s) => {
      const t = tgt.current;
      if (t >= 100) return Math.min(100, s + 5);
      return s < t ? s + Math.min(t - s, Math.min(3, Math.max(1, Math.ceil((t - s) / 10)))) : s; // at most +3% per tick: never jumps
    }), 40);
    const creep = setInterval(() => setShown((s) => {
      const t = tgt.current;
      // keeps moving while a long request is in flight; slows down the further it runs ahead of the real value
      const ahead = s - t;
      return t < 100 && s >= t && s < 97 && (ahead < 6 || Math.random() < 6 / (ahead + 1)) ? s + 1 : s;
    }), 700);
    return () => { clearInterval(follow); clearInterval(creep); };
  }, [active]);

  return active ? Math.round(Math.min(100, shown)) : 0;
}
