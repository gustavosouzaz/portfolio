// Roda no build do Vercel (`npm run build`): barra o deploy se o index.html mudou e a cópia estática
// (gerada por `npm run prerender`) não foi atualizada junto. Sem Chrome, só compara o hash.
import { readFileSync } from 'node:fs';
import { pageHash, storedHash } from './prerender-lib.mjs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const stored = storedHash(html);
if (!stored || stored !== pageHash(html)) {
  console.error(stored
    ? 'A cópia estática do index.html está desatualizada.'
    : 'O index.html não tem a cópia estática (marcadores prerender).');
  console.error('Rode "npm run prerender" e faça commit do index.html.');
  process.exit(1);
}
console.log('prerender: cópia estática em dia.');
