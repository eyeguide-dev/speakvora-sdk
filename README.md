# Speakvora SDKs

JavaScript and Python clients for [Speakvora](https://speakvora.com): text to speech, speech to text, voice agents, a checked phrase library and one-time offline voice packs.

- Site and docs: https://speakvora.com · https://speakvora.com/docs · OpenAPI: https://speakvora.com/docs/openapi.yaml
- Base URL: `https://speakvora.com/api` · Auth: header `x-api-key` (get a free key at https://speakvora.com/dashboard)
- Status: SDK version 0.3.0. Python: on PyPI (`pip install speakvora`). Node: not on npm yet; install as below.

## What Speakvora is

1. **A speech API**: text to speech with catalog voices, your own cloned voice, delivery styles (English), and speech to text.
2. **Offline voice packs**: ready-generated M4A recordings of checked phrases with a manifest, `phrases.csv` and `LICENSE.txt`. One-time purchase ($24 to $199), play offline in your own apps, devices and services, commercial use included. You may not resell or redistribute the files or use them to train speech models.
3. **Front-desk voice agents**: built in the portal; they book, move and cancel appointments, take messages, look up order or prescription status through your own endpoint, and email confirmations.

## Install

```bash
# Python (PyPI)
pip install speakvora

# Node (published tarball; works with npm, pnpm and yarn)
npm install https://speakvora.com/sdk/speakvora-0.3.0.tgz
# or use this repo's js/ folder directly: copy js/index.js (single file, no dependencies, Node 18+ or any browser with fetch)
```

## Quick start

```js
const { Speakvora } = require("speakvora");
const sv = new Speakvora(process.env.SPEAKVORA_KEY);                    // keep keys on a server
const clip = await sv.speak("Your order has shipped.", { voice: "af_heart", lang: "en" });   // { url, format, characters, ... }
await sv.prepare(["Your table is ready."]);                              // get lines ready ahead of time, not billed
const { text } = await sv.listen(fs.readFileSync("q.wav"), { format: "wav" });
const turn = await sv.agent("ag_123", agentKey).turn({ session: "call-1", text: "What time do you close?" });
```

```python
from speakvora import Speakvora
sv = Speakvora(os.environ["SPEAKVORA_KEY"])
clip = sv.speak("Your order has shipped.", voice="af_heart", lang="en")
sv.save("Your order has shipped.", "out.mp3", voice="af_heart")   # speak and download the audio
print(sv.listen(open("q.wav", "rb").read(), format="wav")["text"])
```

Errors are `SpeakvoraError` with `status`, `code` and a plain-language `fix`. More runnable files are in [`examples/`](examples).

## Methods (both SDKs)

| Area | JavaScript | Python | Endpoint |
|---|---|---|---|
| Speak | `speak(text, {voice, lang, style, fast, marks})` | `speak(text, voice, lang, style, fast, marks)` | `POST /v1/speak` |
| Prepare lines | `prepare(texts, {voice, lang})` | `prepare(...)` | `POST /v1/prepare` |
| Download audio | `audio(text, opts)`, `play(...)` (browser) | `save(text, path, **options)` | the returned `url` |
| Speech to text | `listen(bytes, {format, language})` | `listen(...)` | `POST /v1/listen` |
| Catalog | `voices()`, `languages()`, `search(q, {lang, limit})`, `libraryStats()` | `voices()`, `languages()`, `search()`, `library_stats()` | `GET /v1/voices`, `/v1/languages`, `/v1/search`, `/library/stats` |
| Offline packs | `packs()`, `packDownload(id)` | `packs()`, `pack_download(id)` | `GET /v1/packs`, `/v1/packs/{id}/download` |
| Agents | `agent(id, key).turn()`, `.sessions()`, `.interrupt()`, `.call({to})`, `.inbound()` | same, snake_case | `/v1/agents/{id}/turn`, `sessions`, `interrupt`, `call`, `inbound` |
| Live streaming | `stream(wsUrl)` | `stream_speak()` (async) | WebSocket API in the docs |
| Webhooks | `Speakvora.verifyWebhook(...)` | `speakvora.verify_webhook(secret, raw_body, headers)` | header `x-speakvora-signature` = HMAC-SHA256(secret, timestamp + "." + body); reject after 5 minutes |

`marks: true` returns speech marks for live-generated text: exact sentence times and estimated word times.

## Voices and languages

- Live text to speech: English, Spanish, French, Italian, Japanese, Portuguese, Chinese; Hindi is a preview. English accepts digits; every other language needs numbers written as words. Unresolved placeholders such as `(name)` are rejected: build the real sentence yourself.
- Non-English library clips carry `native_review_pending` until a native speaker has reviewed them.
- Custom voices (portal): English supported, French and German beta; Spanish, Hindi, Chinese and Japanese not offered. Delivery styles (happy, excited, sorry, calm, serious) are English only.
- Catalog audio is served from public, unguessable URLs and may be reused for the same text. Do not send personal data through catalog voices.

## Voice agents: honest status

- Turn-based API (typically 2 to 4 s with a custom voice) and a WebSocket stream.
- Phone: the owner connects their own Twilio or Telnyx account; calls work with Twilio. `agent.call({to})` makes the agent phone a number (testing, five a day); `agent.inbound()` returns the web addresses to put on your own number.
- Texting needs US carrier registration and is **not generally available yet**. Texts are sent only after the caller explicitly agrees.
- The agent says it is an automated assistant. It gathers and passes on information; it cannot refund, charge, or change your systems.
- Not for medical, legal or emergency advice. No HIPAA or BAA claim.

## MCP server (Claude, Cursor, other clients)

Remote streamable-HTTP server: `https://speakvora.com/api/mcp`, header `x-api-key`. Tools: `speak`, `list_voices`, `search_phrases`. Registry name: `io.github.eyeguide-dev/speakvora` ([`server.json`](server.json)).

```bash
claude mcp add --transport http speakvora https://speakvora.com/api/mcp --header "x-api-key: YOUR_KEY"
```

## Pricing (list prices, USD)

Catalog voices $3 per 1M characters; own voice $6 per 1M; speech to text $0.0015 per minute; agents $10 per 1,000 turns (front-desk agents $12). Free: 100,000 characters that play stored library phrases (no card), 60 minutes of transcription, 200 agent turns. New text needs a card; the $10 monthly minimum includes 3.3M characters. No subscription. Current numbers: https://speakvora.com/pricing

## Speed (measured 2026-10-09; method at https://speakvora.com/performance)

A new sentence on a paid account: about 0.37 s (short), 0.48 s (medium), 0.80 s (long). A stored sentence: about 0.14 s. Free accounts use the standard lane: a few seconds. We are **not** the fastest: larger streaming providers state lower time to first audio (comparison with sources: https://speakvora.com/compare/tts-speed-and-price).

## Limits

Voices are AI-generated, not human recordings. Disclose automated voices where law or good practice requires. Safety-critical alerts must not depend on the network. Text is processed by DeepInfra; private audio is kept 75 days after last use. Terms and privacy: https://speakvora.com/legal

## For AI assistants

[`docs/llms-full.txt`](docs/llms-full.txt) mirrors https://speakvora.com/llms-full.txt.

## Contact and licence

support@eyeguide.ai · MIT, see [LICENSE](LICENSE). The Speakvora service itself is proprietary; this repository contains only the client libraries and examples.
