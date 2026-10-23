import {
  graphemes,
  graphemeLength,
  splitWords,
  joinWords,
  normalizeForMatch,
  SENTENCE_END,
} from "./khmer.js";

export const DEFAULTS = {
  maxCharsPerLine: 42,
  maxLines: 2,
  maxDuration: 7,
  minDuration: 0.6,
  pauseThreshold: 0.7,
};

export function sanitizeSettings(input = {}) {
  const num = (v, d, lo, hi) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
  };
  return {
    maxCharsPerLine: Math.round(num(input.maxCharsPerLine, DEFAULTS.maxCharsPerLine, 10, 120)),
    maxLines: Math.round(num(input.maxLines, DEFAULTS.maxLines, 1, 3)),
    maxDuration: num(input.maxDuration, DEFAULTS.maxDuration, 1, 20),
    minDuration: num(input.minDuration, DEFAULTS.minDuration, 0.2, 3),
    pauseThreshold: num(input.pauseThreshold, DEFAULTS.pauseThreshold, 0.1, 3),
  };
}

// Sort, clamp to [0, duration], remove broken entries, remove overlaps.
export function cleanWords(words, duration = Number.MAX_SAFE_INTEGER) {
  const out = [];
  let dropped = 0;
  for (const w of words || []) {
    const text = String(w?.text ?? "").trim();
    let start = Number(w?.start);
    let end = Number(w?.end);
    if (!text || !Number.isFinite(start) || !Number.isFinite(end)) {
      dropped++;
      continue;
    }
    start = Math.max(0, Math.min(start, duration));
    end = Math.max(start, Math.min(end, duration));
    out.push({ text, start, end });
  }
  out.sort((a, b) => a.start - b.start || a.end - b.end);
  for (let i = 1; i < out.length; i++) {
    if (out[i].start < out[i - 1].end) out[i - 1].end = Math.max(out[i - 1].start, out[i].start);
  }
  return { words: out, dropped };
}

// Break lines at word boundaries according to maxCharsPerLine.
export function wrapLines(wordTexts, maxChars, maxLines) {
  const total = graphemeLength(joinWords(wordTexts));
  if (total <= maxChars || maxLines < 2) return joinWords(wordTexts);
  const lines = [];
  let cur = [];
  const target = Math.min(maxChars, Math.ceil(total / Math.min(maxLines, Math.ceil(total / maxChars) || 1)));
  for (const w of wordTexts) {
    const next = joinWords([...cur, w]);
    if (cur.length && graphemeLength(next) > target && lines.length < maxLines - 1) {
      lines.push(joinWords(cur));
      cur = [w];
    } else cur.push(w);
  }
  if (cur.length) lines.push(joinWords(cur));
  return lines.join("\n");
}

// Sentence-level subtitles built from REAL word timestamps.
export function buildCues(words, settings, source = "gemini-word-timestamps") {
  const s = sanitizeSettings(settings);
  const maxChars = s.maxCharsPerLine * s.maxLines;
  const groups = [];
  let cur = [];
  const flush = () => {
    if (cur.length) groups.push(cur);
    cur = [];
  };

  for (const w of words) {
    if (cur.length) {
      const gap = w.start - cur[cur.length - 1].end;
      const textIfAdded = joinWords([...cur.map((x) => x.text), w.text]);
      const durIfAdded = w.end - cur[0].start;
      if (gap > s.pauseThreshold || graphemeLength(textIfAdded) > maxChars || durIfAdded > s.maxDuration) flush();
    }
    cur.push(w);
    if (SENTENCE_END.test(w.text)) flush();
  }
  flush();

  const merged = [];
  for (const g of groups) {
    const prev = merged[merged.length - 1];
    const dur = g[g.length - 1].end - g[0].start;
    if (prev && dur < s.minDuration) {
      const combined = [...prev, ...g];
      const gap = g[0].start - prev[prev.length - 1].end;
      const okChars = graphemeLength(joinWords(combined.map((x) => x.text))) <= maxChars;
      const okDur = combined[combined.length - 1].end - combined[0].start <= s.maxDuration;
      if (gap <= s.pauseThreshold && okChars && okDur) {
        merged[merged.length - 1] = combined;
        continue;
      }
    }
    merged.push(g);
  }

  return merged.map((g) => ({
    start: g[0].start,
    end: g[g.length - 1].end,
    text: wrapLines(g.map((x) => x.text), s.maxCharsPerLine, s.maxLines),
    words: g.map((x) => ({ text: x.text, start: x.start, end: x.end })),
    source,
  }));
}

// Segment-level fallback: each segment becomes one cue (no word timing).
export function cuesFromSegments(segments, settings) {
  const s = sanitizeSettings(settings);
  const sorted = [...segments].sort((a, b) => a.start - b.start);
  const cues = sorted.map((seg) => ({
    start: seg.start,
    end: Math.max(seg.end, seg.start + 0.2),
    text: wrapLines(splitWords(seg.text), s.maxCharsPerLine, s.maxLines),
    words: [],
    source: "gemini-segment",
  }));
  for (let i = 1; i < cues.length; i++) {
    if (cues[i].start < cues[i - 1].end) cues[i - 1].end = Math.max(cues[i - 1].start + 0.1, cues[i].start);
  }
  return cues;
}

/* ---------------- Text → audio alignment ---------------- */

function buildCharTimeline(words) {
  const chars = [];
  for (const w of words) {
    const g = graphemes(normalizeForMatch(w.text));
    const n = g.length;
    if (!n) continue;
    const dur = Math.max(0, w.end - w.start);
    g.forEach((ch, k) => chars.push({ ch, t0: w.start + (dur * k) / n, t1: w.start + (dur * (k + 1)) / n }));
  }
  return chars;
}

// Semi-global alignment of an edited line T against a window of recognized text R.
function alignLine(T, R, from) {
  const n = T.length;
  const to = Math.min(R.length, from + n * 3 + 200);
  const W = to - from;
  if (!n || W <= 0) return null;
  const cols = W + 1;
  const dp = new Int32Array((n + 1) * cols);
  const dir = new Uint8Array((n + 1) * cols); // 1=diag 2=up (T char unmatched) 3=left (R char skipped)
  for (let i = 1; i <= n; i++) {
    dp[i * cols] = i;
    dir[i * cols] = 2;
    for (let j = 1; j <= W; j++) {
      const diag = dp[(i - 1) * cols + j - 1] + (T[i - 1] === R[from + j - 1] ? 0 : 1);
      const up = dp[(i - 1) * cols + j] + 1;
      const left = dp[i * cols + j - 1] + 1;
      let best = diag;
      let d = 1;
      if (up < best) {
        best = up;
        d = 2;
      }
      if (left < best) {
        best = left;
        d = 3;
      }
      dp[i * cols + j] = best;
      dir[i * cols + j] = d;
    }
  }
  let bestJ = 0;
  let bestCost = Infinity;
  for (let j = 0; j <= W; j++) {
    const c = dp[n * cols + j];
    if (c < bestCost) {
      bestCost = c;
      bestJ = j;
    }
  }
  const map = new Array(n).fill(-1);
  let i = n;
  let j = bestJ;
  let matches = 0;
  while (i > 0 && j >= 0) {
    const d = dir[i * cols + j];
    if (j === 0 && d !== 2) break;
    if (d === 1) {
      if (T[i - 1] === R[from + j - 1]) {
        map[i - 1] = from + j - 1;
        matches++;
      }
      i--;
      j--;
    } else if (d === 2) i--;
    else j--;
  }
  return { map, endIndex: from + bestJ, matches, confidence: matches / n };
}

// Gives edited text real timestamps taken from the recognized word timeline.
// lines: [{text, start?, end?}]   words: [{text,start,end}]
export function alignTextToWords(lines, words) {
  const timeline = buildCharTimeline(words);
  const R = timeline.map((c) => c.ch);
  const warnings = [];
  let cursor = 0;

  const cues = lines.map((line, idx) => {
    const text = String(line.text ?? "").trim();
    const T = graphemes(normalizeForMatch(text));
    const fallback = () => ({ ...line, text, confidence: 0, source: "unaligned", words: [] });
    if (!T.length) return fallback();

    const res = alignLine(T, R, cursor);
    if (!res || res.confidence < 0.4) {
      warnings.push(
        `Subtitle #${idx + 1}: could not match the text to the audio (confidence ${(res ? res.confidence : 0).toFixed(2)}); the original timing was kept.`
      );
      return fallback();
    }

    const tt = res.map.map((r) => (r >= 0 ? { t0: timeline[r].t0, t1: timeline[r].t1 } : null));
    for (let i = 0; i < tt.length; i++) {
      if (tt[i]) continue;
      let a = i - 1;
      while (a >= 0 && !tt[a]) a--;
      let b = i + 1;
      while (b < tt.length && !tt[b]) b++;
      const left = a >= 0 ? tt[a].t1 : tt[b].t0;
      const right = b < tt.length ? tt[b].t0 : tt[a].t1;
      const gapN = (b < tt.length ? b : tt.length) - (a >= 0 ? a + 1 : 0);
      const pos = i - (a >= 0 ? a + 1 : 0);
      const step = (right - left) / Math.max(1, gapN);
      tt[i] = { t0: left + step * pos, t1: left + step * (pos + 1) };
    }
    cursor = Math.max(cursor, res.endIndex);

    const outWords = [];
    let p = 0;
    let pendingPunct = "";
    for (const tok of splitWords(text)) {
      const nl = graphemeLength(normalizeForMatch(tok));
      if (nl === 0) {
        if (outWords.length) outWords[outWords.length - 1].text += tok;
        else pendingPunct += tok;
        continue;
      }
      const a = tt[p];
      const b = tt[Math.min(tt.length - 1, p + nl - 1)];
      outWords.push({ text: pendingPunct + tok, start: a.t0, end: b.t1 });
      pendingPunct = "";
      p += nl;
    }

    return {
      text,
      start: tt[0].t0,
      end: tt[tt.length - 1].t1,
      words: outWords,
      confidence: Number(res.confidence.toFixed(3)),
      source: "audio-alignment",
    };
  });
  return { cues, warnings };
}
