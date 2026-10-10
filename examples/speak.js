// node examples/speak.js   (needs SPEAKVORA_KEY; get a free key at https://speakvora.com/dashboard)
const { Speakvora } = require("../js");
const fs = require("fs");
(async () => {
  const sv = new Speakvora(process.env.SPEAKVORA_KEY);
  const { clip, data } = await sv.audio("Your order has shipped.", { voice: "af_heart", lang: "en" });
  fs.writeFileSync("out." + (clip.format || "mp3"), Buffer.from(data));
  console.log("saved", clip.characters, "characters");
})();
