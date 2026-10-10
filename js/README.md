# speakvora (JavaScript)

```js
const { Speakvora } = require("speakvora");
const sv = new Speakvora(process.env.SPEAKVORA_KEY);          // get a key at https://speakvora.com/dashboard
const clip = await sv.speak("Your order has shipped.", { voice: "af_heart" });   // { url, format, ... }
await sv.prepare(["Your table is ready."]);                    // make known lines instant
const { text } = await sv.listen(fs.readFileSync("q.wav"), { format: "wav" });   // speech to text
const turn = await sv.agent("ag_123", agentKey).turn({ session: "call-1", text: "What time do you close?" });
```

Errors are `SpeakvoraError` with `status`, `code` and a plain-language `fix`. Keep keys on a server; for browsers mint a 10-minute agent token with `agent(id).sessions()`.
Full reference: https://speakvora.com/docs
