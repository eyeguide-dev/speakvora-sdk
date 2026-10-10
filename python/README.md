# speakvora (Python)

```python
from speakvora import Speakvora
sv = Speakvora(os.environ["SPEAKVORA_KEY"])            # get a key at https://speakvora.com/dashboard
clip = sv.speak("Your order has shipped.", voice="af_heart")      # {"url": ..., "format": ...}
sv.prepare(["Your table is ready."])                    # make known lines instant
text = sv.listen(open("q.wav", "rb").read(), format="wav")["text"]
turn = sv.agent("ag_123", agent_key).turn(session="call-1", text="What time do you close?")
```

Errors are `SpeakvoraError` with `status`, `code` and a plain-language `fix`. Live streaming: `pip install "speakvora[stream]"`.
Full reference: https://speakvora.com/docs
