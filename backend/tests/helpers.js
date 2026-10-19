// Minimal fake req/res to call controllers without Express.
export function fakeRes() {
  const res = { statusCode: 200, headers: {}, body: undefined };
  res.status = (c) => { res.statusCode = c; return res; };
  res.set = (k, v) => { if (typeof k === "object") for (const [a, b] of Object.entries(k)) res.headers[a.toLowerCase()] = b; else res.headers[k.toLowerCase()] = v; return res; };
  res.json = (b) => { res.body = b; return res; };
  res.send = (b) => { res.body = b; return res; };
  return res;
}
export function fakeReq(o = {}) {
  const headers = Object.fromEntries(Object.entries(o.headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
  return { body: {}, query: {}, headers, get: (k) => headers[k.toLowerCase()], ...o };
}
export async function call(handler, req = {}, timeoutMs = 8000) {
  const res = fakeRes();
  let err;
  let done = false;
  handler(fakeReq(req), res, (e) => { err = e; done = true; });
  const t0 = Date.now();
  while (!done && res.body === undefined && Date.now() - t0 < timeoutMs) await new Promise((r) => setTimeout(r, 5));
  return { res, err };
}
// WAV builder: 16 kHz mono 16-bit with a tone and/or silence segments
export function makeWav(segments, rate = 16000) {
  const parts = segments.map(({ sec, tone }) => {
    const n = Math.round(sec * rate);
    const b = Buffer.alloc(n * 2);
    for (let i = 0; i < n; i++) b.writeInt16LE(tone ? Math.round(Math.sin((2 * Math.PI * tone * i) / rate) * 12000) : 0, i * 2);
    return b;
  });
  const data = Buffer.concat(parts);
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + data.length, 4); h.write("WAVE", 8); h.write("fmt ", 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}
