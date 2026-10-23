import { AppError } from "../../lib/AppError.js";

// Builds the text that goes INTO the QR code for each supported type.
// Formats follow the common scanner conventions (WIFI:, mailto:, tel:, SMSTO:, vCard 3.0).

const esc = (s) => String(s ?? "").replace(/([\;,:"])/g, "\\$1");
const vEsc = (s) => String(s ?? "").replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/([;,])/g, "\\$1");
const str = (v, max = 500) => String(v ?? "").trim().slice(0, max);

export const QR_TYPES = ["text", "url", "wifi", "email", "phone", "sms", "vcard"];

export function normalizeUrl(input) {
  let v = str(input, 2000);
  if (!v) throw new AppError(400, "INVALID_QR_DATA", "Please enter a URL.");
  if (!/^[a-z][a-z0-9+.-]*:/i.test(v)) v = `https://${v}`;
  let u;
  try {
    u = new URL(v);
  } catch {
    throw new AppError(400, "INVALID_QR_DATA", "That URL is not valid.");
  }
  if (!/^(https?|ftp):$/.test(u.protocol)) {
    throw new AppError(400, "INVALID_QR_DATA", "Only http(s) links are allowed.");
  }
  return u.toString();
}

export function buildPayload(type, data = {}) {
  switch (type) {
    case "text": {
      const t = String(data.text ?? "").trim();
      if (!t) throw new AppError(400, "INVALID_QR_DATA", "Please enter some text.");
      if (t.length > 1500) throw new AppError(400, "INVALID_QR_DATA", "Text is too long for a QR code (max 1500 characters).");
      return t;
    }
    case "url":
      return normalizeUrl(data.url);
    case "wifi": {
      const ssid = str(data.ssid, 64);
      if (!ssid) throw new AppError(400, "INVALID_QR_DATA", "Please enter the Wi-Fi name (SSID).");
      const enc = ["WPA", "WEP", "nopass"].includes(data.encryption) ? data.encryption : "WPA";
      const pass = enc === "nopass" ? "" : str(data.password, 63);
      if (enc !== "nopass" && !pass) throw new AppError(400, "INVALID_QR_DATA", "Please enter the Wi-Fi password.");
      return `WIFI:T:${enc};S:${esc(ssid)};P:${esc(pass)};H:${data.hidden ? "true" : "false"};;`;
    }
    case "email": {
      const to = str(data.to, 200);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) throw new AppError(400, "INVALID_QR_DATA", "Please enter a valid email address.");
      const q = [];
      if (str(data.subject)) q.push(`subject=${encodeURIComponent(str(data.subject))}`);
      if (str(data.body, 1000)) q.push(`body=${encodeURIComponent(str(data.body, 1000))}`);
      return `mailto:${to}${q.length ? `?${q.join("&")}` : ""}`;
    }
    case "phone": {
      const p = str(data.phone, 30).replace(/[^\d+]/g, "");
      if (p.replace(/\D/g, "").length < 5) throw new AppError(400, "INVALID_QR_DATA", "Please enter a valid phone number.");
      return `tel:${p}`;
    }
    case "sms": {
      const p = str(data.phone, 30).replace(/[^\d+]/g, "");
      if (p.replace(/\D/g, "").length < 5) throw new AppError(400, "INVALID_QR_DATA", "Please enter a valid phone number.");
      return `SMSTO:${p}:${str(data.message, 500)}`;
    }
    case "vcard": {
      const name = str(data.name, 100);
      if (!name) throw new AppError(400, "INVALID_QR_DATA", "Please enter a contact name.");
      const lines = ["BEGIN:VCARD", "VERSION:3.0", `FN:${vEsc(name)}`, `N:${vEsc(name)};;;;`];
      if (str(data.org, 100)) lines.push(`ORG:${vEsc(str(data.org, 100))}`);
      if (str(data.title, 100)) lines.push(`TITLE:${vEsc(str(data.title, 100))}`);
      if (str(data.phone, 30)) lines.push(`TEL:${str(data.phone, 30).replace(/[^\d+]/g, "")}`);
      if (str(data.email, 200)) lines.push(`EMAIL:${vEsc(str(data.email, 200))}`);
      if (str(data.website, 300)) lines.push(`URL:${vEsc(str(data.website, 300))}`);
      lines.push("END:VCARD");
      return lines.join("\n");
    }
    default:
      throw new AppError(400, "INVALID_QR_TYPE", `Unknown QR type. Use one of: ${QR_TYPES.join(", ")}.`);
  }
}
