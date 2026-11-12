// Build do Vercel (`npm run build`):
// 1. barra o deploy se o index.html mudou e a cópia estática (`npm run prerender`) não foi atualizada;
// 2. copia o site para public/, que é a pasta que o Vercel publica. Só entra o que está em SITE:
//    ferramentas de desenvolvimento (scripts, package.json, bs-config.js...) ficam de fora, e nada que
//    esteja no .gitignore entra (ex.: o diploma, que só existe no computador).
import { cpSync, readFileSync, rmSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pageHash, storedHash } from './prerender-lib.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'public');
const SITE = ['index.html', 'support.js', 'favicon.ico', 'apple-touch-icon.png', 'img', 'docs'];

// Plain paths from .gitignore (this project has no wildcard rules), matched as path prefixes.
const ignored = readFileSync(join(ROOT, '.gitignore'), 'utf8').split(/\r?\n/)
  .map((l) => l.trim().replace(/\/$/, '')).filter((l) => l && !l.startsWith('#'));
const isIgnored = (src) => {
  const rel = relative(ROOT, src).split(sep).join('/');
  return ignored.some((p) => rel === p || rel.startsWith(p + '/'));
};

const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
const stored = storedHash(html);
if (!stored || stored !== pageHash(html)) {
  console.error(stored
    ? 'A cópia estática do index.html está desatualizada.'
    : 'O index.html não tem a cópia estática (marcadores prerender).');
  console.error('Rode "npm run prerender" e faça commit do index.html.');
  process.exit(1);
}

rmSync(OUT, { recursive: true, force: true });
for (const entry of SITE) cpSync(join(ROOT, entry), join(OUT, entry), { recursive: true, filter: (src) => !isIgnored(src) });
console.log(`build: cópia estática em dia; site copiado para public/ (${SITE.join(', ')}).`);
