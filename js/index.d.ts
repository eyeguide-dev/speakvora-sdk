export class SpeakvoraError extends Error { status: number; code?: string; fix?: string; body?: any }
export interface Clip { marks?: { type: string; precision: { sentences: string; words: string }; duration_ms: number; sentences: { text: string; start_ms: number; end_ms: number; words: { word: string; start_ms: number; end_ms: number }[] }[] }; marks_note?: string; url: string; lang: string; voice: string; characters: number; format: string; live?: boolean; lane?: "gpu" | "lambda"; style?: string; style_applied?: boolean }
export type Audio = ArrayBuffer | Uint8Array | string;
export class Speakvora {
  constructor(key: string, opts?: { base?: string; timeoutMs?: number });
  speak(text: string, opts?: { voice?: string; lang?: string; style?: "happy" | "excited" | "sorry" | "calm" | "serious"; fast?: boolean; marks?: boolean }): Promise<Clip>;
  prepare(texts: string[], opts?: { voice?: string; lang?: string }): Promise<{ ready: number; queued: number; rejected: any[] }>;
  audio(text: string, opts?: object): Promise<{ clip: Clip; data: any }>;
  play(text: string, opts?: object): Promise<Clip>;
  listen(audio: Audio, opts?: { format?: "wav" | "mp3" | "m4a" | "ogg" | "flac" | "webm"; language?: string }): Promise<{ text: string; seconds: number; language: string }>;
  voices(): Promise<any>; languages(): Promise<any>; search(q: string, opts?: { lang?: string; limit?: number }): Promise<any>; libraryStats(): Promise<any>;
  packs(): Promise<{ packs: any[] }>; packDownload(id: string): Promise<{ url: string; expires_in_seconds: number }>;
  agent(id: string, agentKey?: string): { call(o: { to: string }): Promise<any>; inbound(): Promise<{ voice_url: string; sms_url: string; how: string }>; turn(o?: any): Promise<any>; sessions(): Promise<{ token: string }>; interrupt(o: { session: string; generation: string; played: number }): Promise<any> };
  stream(url: string): Promise<{ on(type: string, f: (e: any) => void): void; speak(text: string, o?: object): void; listenStart(o?: object): void; audio(pcm16: Audio): void; listenEnd(): void; agentTurn(agent: string, text: string, session?: string): void; close(): void }>;
  static verifyWebhook(secret: string, rawBody: string, headers: Record<string, string>, toleranceSeconds?: number): boolean;
}
