/* Speakvora JavaScript SDK 0.3.0: text to speech, speech to text, phrase library, offline packs, voice agents and live streaming.
   One file, no dependencies. Node 18+ and modern browsers. Keep your API key on a server: never put it in a public web page
   (use an agent session token for browsers).

     const { Speakvora } = require("speakvora");
     const sv = new Speakvora(process.env.SPEAKVORA_KEY);
     const clip = await sv.speak("Your order has shipped.", { voice: "af_heart" });        // { url, format, characters, live, lane }
     await sv.prepare(["Your table is ready.", "Your order is on the way."]);               // make lines instant ahead of time
     const { text } = await sv.listen(audioBuffer, { format: "wav", language: "en" });      // speech to text
     const reply = await sv.agent("ag_123", agentKey).turn({ session: "call-1", text: "What time do you close?" });
*/
"use strict";
const DEFAULT_BASE = "https://speakvora.com/api";

class SpeakvoraError extends Error {
  constructor(status, body) {
    super((body && (body.message || body.error)) || "speakvora_http_" + status);
    this.name = "SpeakvoraError"; this.status = status; this.code = body && body.error; this.fix = body && body.fix; this.body = body;
  }
}

function b64(data) {
  if (typeof data === "string") return data;                                   // already base64
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(data)) return data.toString("base64");
  const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;   // Uint8Array
  let s = ""; for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return typeof btoa !== "undefined" ? btoa(s) : Buffer.from(s, "binary").toString("base64");
}

class Speakvora {
  constructor(key, opts = {}) {
    if (!key) throw new Error("Speakvora: API key required");
    this.key = key; this.base = (opts.base || DEFAULT_BASE).replace(/\/$/, ""); this.timeoutMs = opts.timeoutMs || 60000;
  }
  async _req(path, { method = "GET", body, key } = {}) {
    const ctl = typeof AbortController !== "undefined" ? new AbortController() : null; const timer = ctl && setTimeout(() => ctl.abort(), this.timeoutMs);
    try {
      const r = await fetch(this.base + path, { method, signal: ctl && ctl.signal, headers: { "content-type": "application/json", "x-api-key": key || this.key }, body: body === undefined ? undefined : JSON.stringify(body) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new SpeakvoraError(r.status, data);
      return data;
    } finally { if (timer) clearTimeout(timer); }
  }
  // ---- speech
  /** Speak text. marks: true also returns speech marks (exact sentence times, estimated word times) for live-generated text. voice: a catalog voice id (af_heart...) or your own voice id (cv_...). style (own voices, English): happy|excited|sorry|calm|serious. */
  speak(text, { voice = "af_heart", lang = "en", style, fast, marks } = {}) { return this._req("/v1/speak", { method: "POST", body: { text, voice, lang, ...(marks ? { marks: true } : {}), ...(style ? { style } : {}), ...(fast ? { fast: true } : {}) } }); }
  /** Get up to 200 lines ready ahead of time so speak() returns them quickly. Not billed. */
  prepare(texts, { voice = "af_heart", lang = "en" } = {}) { return this._req("/v1/prepare", { method: "POST", body: { texts, voice, lang } }); }
  /** Speak and download the audio bytes (Node: Buffer, browser: ArrayBuffer). */
  async audio(text, opts) { const c = await this.speak(text, opts); const r = await fetch(c.url); const buf = await r.arrayBuffer(); return { clip: c, data: typeof Buffer !== "undefined" ? Buffer.from(buf) : buf }; }
  /** Browsers only: speak and play. */
  async play(text, opts) { const c = await this.speak(text, opts); const a = new Audio(c.url); await a.play(); return c; }
  // ---- speech to text
  /** audio: Buffer | Uint8Array | ArrayBuffer | base64 string. format: wav|mp3|m4a|ogg|flac|webm, 1 KB to 4.5 MB per call. */
  listen(audio, { format = "wav", language } = {}) { return this._req("/v1/listen", { method: "POST", body: { audio_base64: b64(audio), format, ...(language ? { language } : {}) } }); }
  // ---- library
  voices() { return this._req("/v1/voices"); }
  languages() { return this._req("/v1/languages"); }
  search(q, { lang = "en", limit = 10 } = {}) { return this._req(`/v1/search?q=${encodeURIComponent(q)}&lang=${lang}&limit=${limit}`); }
  libraryStats() { return this._req("/library/stats"); }
  // ---- offline packs
  packs() { return this._req("/v1/packs"); }
  /** After the pack is bought on your account: { url } to a zip, valid 5 minutes. Rejects with status 402 (code pack_not_purchased) otherwise. */
  packDownload(id) { return this._req(`/v1/packs/${encodeURIComponent(id)}/download`); }
  // ---- agents
  /** Work with a published voice agent. Use the agent's own key (or a session token) as agentKey. */
  agent(id, agentKey) {
    const k = agentKey || this.key, self = this, p = `/v1/agents/${encodeURIComponent(id)}`;
    return {
      turn: ({ session, text, audio, format, start, interrupted } = {}) => self._req(p + "/turn", { method: "POST", key: k, body: { session, ...(text ? { text } : {}), ...(audio ? { audio_b64: b64(audio) } : {}), ...(start ? { start: true } : {}), ...(interrupted ? { interrupted } : {}) } }),
      sessions: () => self._req(p + "/sessions", { method: "POST", key: k, body: {} }),                  // mint a 10-minute browser token
      call: ({ to }) => self._req(p + "/call", { method: "POST", key: k, body: { to } }),               // the agent phones this number (testing; five a day)
      inbound: () => self._req(p + "/inbound", { method: "POST", key: k, body: {} }),                   // web addresses to put on your own Twilio number so people can call and text the agent
      interrupt: ({ session, generation, played }) => self._req(p + "/interrupt", { method: "POST", key: k, body: { session, generation, played } }),
    };
  }
  // ---- live streaming over WebSocket
  /** const s = await sv.stream(wsUrl); s.on("final", e => ...); s.speak("Hello"); s.listenStart({language:"en"}); s.audio(pcm16Chunk); s.listenEnd(); */
  async stream(url) {
    const WS = typeof WebSocket !== "undefined" ? WebSocket : require("ws"); const ws = new WS(url); const handlers = {}; let seq = 0;
    const emit = (t, e) => (handlers[t] || []).forEach((f) => f(e)); const send = (o) => ws.send(JSON.stringify(o));
    ws.onmessage = (m) => { const d = JSON.parse(typeof m.data === "string" ? m.data : m.data.toString()); emit(d.type, d); emit("*", d); };
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error("websocket failed to open")); });
    const ready = new Promise((res, rej) => { handlers.ready = [res]; handlers.error = [...(handlers.error || []), (e) => rej(new SpeakvoraError(401, e))]; });
    send({ type: "auth", key: this.key }); await ready;
    return {
      on: (t, f) => { (handlers[t] = handlers[t] || []).push(f); },
      speak: (text, { voice = "af_heart", lang = "en", id = String(Date.now()) } = {}) => send({ type: "speak", id, text, voice, lang }),
      listenStart: ({ language, rate = 16000, interim = false, endpointMs, vadThreshold } = {}) => { seq = 0; send({ type: "listen.start", language, rate, interim, ...(endpointMs ? { endpoint_ms: endpointMs } : {}), ...(vadThreshold ? { vad_threshold: vadThreshold } : {}) }); },
      audio: (pcm16) => send({ type: "audio", seq: seq++, data: b64(pcm16) }),
      listenEnd: () => send({ type: "listen.end" }),
      agentTurn: (agent, text, session) => send({ type: "agent.turn", agent, text, session }),
      close: () => ws.close(),
    };
  }
  // ---- webhooks
  static verifyWebhook(secret, rawBody, headers, toleranceSeconds = 300) {
    const crypto = require("crypto"); const ts = headers["x-speakvora-timestamp"], sig = headers["x-speakvora-signature"];
    if (!ts || !sig || Math.abs(Date.now() / 1000 - Number(ts)) > toleranceSeconds) return false;
    const expected = crypto.createHmac("sha256", secret).update(ts + "." + rawBody).digest("hex");
    return expected.length === sig.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
  }
}
if (typeof module !== "undefined" && module.exports) module.exports = { Speakvora, SpeakvoraError }; else if (typeof window !== "undefined") { window.Speakvora = Speakvora; window.SpeakvoraError = SpeakvoraError; }
