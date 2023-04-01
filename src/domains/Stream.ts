import { Hono } from 'hono';
import { Bindings } from '../Bindings';
import { Routes } from '../routes';
import { exportWAV } from './Wav';

export class AudioStream {
  state: DurableObjectState;
  app = new Hono();
  session?: WebSocket = undefined;
  chunks = new Array<Float32Array>();
  id?: string = undefined;
  chunksOfChunks = new Array<Array<Float32Array>>();

  sampleRate = 48000;

  transcribed = new Array<string>();
  agenda = '';
  apiKey = '';

  constructor(state: DurableObjectState, env: Bindings) {
    this.state = state;
    this.apiKey = env.OPENAI_API_KEY;

    this.app.get(Routes.Paths.StreamSession, async c => {
      if (c.req.headers.get('Upgrade') !== 'websocket') {
        throw new Error('Upgrade: websocket header not exists');
      }
      const [client, server] = Object.values(new WebSocketPair());
      this.session = server;
      server.accept();

      server.addEventListener('message', event => {
        const uint8Array = new Uint8Array(event.data as ArrayBuffer);
        const length = uint8Array.length / 4;
        const float32Array = new Float32Array(length);
        let offset = 0;
        for (let i = 0; i < length; i++) {
          float32Array[i] = new Float32Array(uint8Array.buffer, offset, 1)[0];
          offset += 4;
        }
        this.chunks.push(float32Array);
        const estimatedSeconds = (float32Array.length * this.chunks.length) / this.sampleRate;
        if (estimatedSeconds > 15) {
          server.send(JSON.stringify({ transcribeStarted: true }));
          const latestChunk = this.chunks;
          this.chunksOfChunks.push(latestChunk);
          this.chunks = [];
          state.waitUntil(
            this.transcribeChunk(latestChunk).then(text => {
              server.send(JSON.stringify({ transcribed: text }));
              this.transcribed.push(text);
            }),
          );
        }
      });

      server.addEventListener('close', () => {
        console.log('close');
      });

      return new Response(null, { status: 101, webSocket: client });
    });

    this.app.get(Routes.Paths.StreamResult, async c => {
      const res = await this.summarizeTranscription();
      return c.json({ result: res });
    });

    this.app.post(Routes.Paths.Stream, async c => {
      const body = await c.req.json();
      this.id = body.id;
      this.sampleRate = body.sampleRate;
      this.agenda = body.agenda ?? '';
      return c.json({ id: this.id });
    });
  }

  async fetch(request: Request) {
    return this.app.fetch(request);
  }

  async transcribeChunk(chunk: Array<Float32Array>) {
    const body = new FormData();
    body.append('model', 'whisper-1');
    const dummyFile = new File([exportWAV(chunk)], 'sample.wav');
    body.append('file', dummyFile);
    body.append('language', 'ja');
    body.append('prompt', this.transcribed.join('\n'));
    const res = await fetch(`https://api.openai.com/v1/audio/transcriptions`, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
      body,
      method: 'POST',
    }).then(r => r.json());
    return (res as any).text;
  }

  async summarizeTranscription() {
    const prompt = `文字起こしされた会話データを日本語で要約するタスクを行います。
${this.agenda ? `${this.agenda}という議題の会話です。` : ''}
文字起こしは15秒ごとに行われ、/記号によって結合されています。

それでは開始します。

文字起こしされた文章：
${this.transcribed.join('/')}

日本語で要約した文章：`;
    const res = await fetch(`https://api.openai.com/v1/completions`, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: 'text-davinci-003', prompt, max_tokens: 1200 }),
      method: 'POST',
    }).then(r => r.json());
    return (res as any).choices?.[0]?.text;
  }
}
