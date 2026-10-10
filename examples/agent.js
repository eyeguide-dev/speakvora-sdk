// A published voice agent (build one in the portal: Agent builder, then "Generate API").
const { Speakvora } = require("../js");
(async () => {
  const sv = new Speakvora(process.env.SPEAKVORA_KEY);
  const agent = sv.agent(process.env.AGENT_ID, process.env.AGENT_KEY);
  const turn = await agent.turn({ session: "demo-1", text: "What time do you close?" });
  console.log(turn.reply);
  for (const s of turn.sentences) console.log(s.index, s.source, s.audio_url);   // play audio_url in order
})();
