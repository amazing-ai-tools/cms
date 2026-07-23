import { createGenerationServer } from './generationServer.js';

const port = Number(process.env.PORT || 8787);
const host = process.env.HOST || '127.0.0.1';
const server = createGenerationServer();

server.listen(port, host, () => {
  console.log(`CMS AI generation API listening on http://${host}:${port}`);
});
