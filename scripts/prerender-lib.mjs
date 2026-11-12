// Shared by prerender.mjs and check-prerender.mjs.
import { createHash } from 'node:crypto';

const BLOCK_RE = /<!-- prerender:start(?: sha256=[0-9a-f]{64})? -->[\s\S]*?<!-- prerender:end -->/;
const STORED_RE = /<!-- prerender:start sha256=([0-9a-f]{64}) -->/;

// Hash of index.html without the static copy itself. Any edit elsewhere in the page changes it,
// which is how the build notices a stale copy. Line endings are normalized because Windows
// checkouts may use CRLF while Vercel's use LF.
export function pageHash(html) {
  const normalized = html.replace(/\r\n/g, '\n').replace(BLOCK_RE, '<!-- prerender -->');
  return createHash('sha256').update(normalized).digest('hex');
}

export const hasBlock = (html) => BLOCK_RE.test(html);
export const replaceBlock = (html, block) => html.replace(BLOCK_RE, () => block);
export const storedHash = (html) => STORED_RE.exec(html)?.[1] ?? null;
