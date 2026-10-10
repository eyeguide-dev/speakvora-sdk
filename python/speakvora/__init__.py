"""Speakvora Python SDK 0.3.0: text to speech, speech to text, phrase library, offline packs, voice agents and live streaming.
Standard library only (live streaming needs the optional `websockets` package). Keep your API key on a server.

    from speakvora import Speakvora
    sv = Speakvora(os.environ["SPEAKVORA_KEY"])
    clip = sv.speak("Your order has shipped.", voice="af_heart")       # {"url": ..., "format": ..., "lane": ...}
    sv.prepare(["Your table is ready.", "Your order is on the way."])  # make known lines instant
    text = sv.listen(open("q.wav", "rb").read(), format="wav")["text"]  # speech to text
    reply = sv.agent("ag_123", agent_key).turn(session="call-1", text="What time do you close?")
"""
import base64, hashlib, hmac, json, time, urllib.error, urllib.parse, urllib.request

__version__ = "0.3.0"
DEFAULT_BASE = "https://speakvora.com/api"


class SpeakvoraError(Exception):
    def __init__(self, status, body):
        body = body if isinstance(body, dict) else {}
        super().__init__(body.get("message") or body.get("error") or f"http_{status}")
        self.status, self.code, self.fix, self.body = status, body.get("error"), body.get("fix"), body


def _b64(data):
    return data if isinstance(data, str) else base64.b64encode(bytes(data)).decode()


class Agent:
    def __init__(self, sv, agent_id, key):
        self._sv, self._p, self._k = sv, f"/v1/agents/{urllib.parse.quote(agent_id, safe='')}", key

    def turn(self, session=None, text=None, audio=None, start=False, interrupted=None):
        body = {"session": session, **({"text": text} if text else {}), **({"audio_b64": _b64(audio)} if audio else {}), **({"start": True} if start else {}), **({"interrupted": interrupted} if interrupted else {})}
        return self._sv._req(self._p + "/turn", body, key=self._k)

    def call(self, to):
        """The agent phones this number (testing; five a day)."""
        return self._sv._req(self._p + "/call", {"to": to}, key=self._k)

    def inbound(self):
        """Web addresses to put on your own Twilio number so people can call and text the agent: {"voice_url", "sms_url", "how"}."""
        return self._sv._req(self._p + "/inbound", {}, key=self._k)

    def sessions(self):
        return self._sv._req(self._p + "/sessions", {}, key=self._k)             # mints a 10-minute browser token

    def interrupt(self, session, generation, played):
        return self._sv._req(self._p + "/interrupt", {"session": session, "generation": generation, "played": played}, key=self._k)


class Speakvora:
    def __init__(self, key, base=DEFAULT_BASE, timeout=60):
        if not key:
            raise ValueError("Speakvora: API key required")
        self.key, self.base, self.timeout = key, base.rstrip("/"), timeout

    def _req(self, path, data=None, key=None):
        req = urllib.request.Request(self.base + path, data=json.dumps(data).encode() if data is not None else None, method="POST" if data is not None else "GET",
                                     headers={"content-type": "application/json", "x-api-key": key or self.key, "user-agent": f"speakvora-python/{__version__}"})
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as r:
                return json.loads(r.read() or b"{}")
        except urllib.error.HTTPError as e:
            try:
                body = json.loads(e.read() or b"{}")
            except ValueError:
                body = {}
            raise SpeakvoraError(e.code, body)

    # speech
    def speak(self, text, voice="af_heart", lang="en", style=None, fast=False, marks=False):
        """marks=True also returns speech marks (exact sentence times, estimated word times) for live-generated text. voice: a catalog id (af_heart...) or your own voice (cv_...). style (own voices, English): happy|excited|sorry|calm|serious."""
        return self._req("/v1/speak", {"text": text, "voice": voice, "lang": lang, **({"style": style} if style else {}), **({"fast": True} if fast else {}), **({"marks": True} if marks else {})})

    def prepare(self, texts, voice="af_heart", lang="en"):
        """Get up to 200 lines ready ahead of time so speak() returns them quickly. Not billed."""
        return self._req("/v1/prepare", {"texts": list(texts), "voice": voice, "lang": lang})

    def save(self, text, path, **kw):
        clip = self.speak(text, **kw)
        with urllib.request.urlopen(clip["url"], timeout=self.timeout) as r, open(path, "wb") as f:
            f.write(r.read())
        return clip

    # speech to text
    def listen(self, audio, format="wav", language=None):
        """audio: bytes or a base64 string; 1 KB to 4.5 MB per call."""
        return self._req("/v1/listen", {"audio_base64": _b64(audio), "format": format, **({"language": language} if language else {})})

    # library
    def voices(self): return self._req("/v1/voices")
    def languages(self): return self._req("/v1/languages")
    def search(self, q, lang="en", limit=10): return self._req(f"/v1/search?q={urllib.parse.quote(q)}&lang={lang}&limit={limit}")
    def library_stats(self): return self._req("/library/stats")

    # offline packs
    def packs(self): return self._req("/v1/packs")
    def pack_download(self, pack_id):
        """After the pack is bought on your account: {"url": ...} to a zip, valid 5 minutes. Raises SpeakvoraError(402, code pack_not_purchased) otherwise."""
        return self._req(f"/v1/packs/{urllib.parse.quote(pack_id, safe='')}/download")

    # agents
    def agent(self, agent_id, agent_key=None):
        return Agent(self, agent_id, agent_key or self.key)

    # live streaming (optional dependency: pip install websockets)
    async def stream_speak(self, ws_url, text, voice="af_heart", lang="en"):
        """Async generator: yields {"type":"audio","url":...} for each sentence as it is ready, then stops at "done"."""
        import websockets
        async with websockets.connect(ws_url) as ws:
            await ws.send(json.dumps({"type": "auth", "key": self.key})); first = json.loads(await ws.recv())
            if first.get("type") != "ready":
                raise SpeakvoraError(401, first)
            await ws.send(json.dumps({"type": "speak", "id": "1", "text": text, "voice": voice, "lang": lang}))
            while True:
                m = json.loads(await ws.recv())
                if m["type"] == "error":
                    raise SpeakvoraError(400, m)
                yield m
                if m["type"] == "done":
                    return


def verify_webhook(secret, raw_body, headers, tolerance=300):
    h = {k.lower(): v for k, v in headers.items()}
    ts, sig = h.get("x-speakvora-timestamp"), h.get("x-speakvora-signature")
    if not ts or not sig or abs(time.time() - int(ts)) > tolerance:
        return False
    body = raw_body if isinstance(raw_body, bytes) else raw_body.encode()
    return hmac.compare_digest(hmac.new(secret.encode(), ts.encode() + b"." + body, hashlib.sha256).hexdigest(), sig)
