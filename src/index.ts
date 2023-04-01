import { Hono } from 'hono';
import { serveStatic } from 'hono/cloudflare-workers';
import { Bindings } from './Bindings';
import { Routes } from './routes';
export { AudioStream } from './domains/Stream';

type Env = {
  Bindings: Bindings;
  OPENAI_API_KEY: string;
};

export const app = new Hono<Env>();
app.get('/static/*', serveStatic({ root: './' }));

app.post(Routes.Paths.Stream, async c => {
  const newId = String(Date.now());
  const id = c.env.AUDIO_STREAM.idFromName(newId);
  const stream = c.env.AUDIO_STREAM.get(id);
  const newReqBody = { ...(await c.req.json()), id: newId };
  return stream.fetch(new Request(c.req.url, new Request(c.req.raw, { body: JSON.stringify(newReqBody) })));
});

app.get(Routes.Paths.StreamSession, async c => {
  const id = c.env.AUDIO_STREAM.idFromName(c.req.param('id'));
  const stream = c.env.AUDIO_STREAM.get(id);
  return stream.fetch(c.req.raw);
});

app.get(Routes.Paths.StreamResult, async c => {
  const id = c.env.AUDIO_STREAM.idFromName(c.req.param('id'));
  const stream = c.env.AUDIO_STREAM.get(id);
  return stream.fetch(c.req.raw);
});

app.get('/', async c => {
  const id = c.env.AUDIO_STREAM.idFromName('A');
  const stream = c.env.AUDIO_STREAM.get(id);
  return stream.fetch(c.req.raw);
});

export default app;
