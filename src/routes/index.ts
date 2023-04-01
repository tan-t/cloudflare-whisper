const BasePath = '/';
export const Routes = {
  Paths: {
    Stream: `${BasePath}stream`,
    StreamSession: `${BasePath}streams/:id/websocket`,
    StreamResult: `${BasePath}streams/:id/result`
  },
  BasePath
} as const;
