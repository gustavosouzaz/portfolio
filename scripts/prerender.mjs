// Gera a cópia estática da página (em português, tema claro) e grava no index.html, entre
// <!-- prerender:start --> e <!-- prerender:end -->. Rode sempre depois de editar o index.html:
//
//   npm run prerender
//
// Por quê: o texto do site é montado no navegador pelo support.js + React. Sem esta cópia, o HTML
// só tem {{ marcadores }}: buscadores, leitores de currículo (ATS) e "Ver código-fonte" não veem o
// conteúdo, e a página fica em branco se o React (unpkg.com) não carregar.
//
// Usa o Google Chrome instalado (ou o caminho em CHROME_PATH) pelo DevTools Protocol, sem dependências.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hasBlock, pageHash, replaceBlock } from './prerender-lib.mjs';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PAGE = join(ROOT, 'index.html');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.pdf': 'application/pdf',
};

// Minimal static server for the project folder (so this doesn't depend on `npm run dev` running).
function serve() {
  const server = createServer(async (req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = normalize(join(ROOT, path === '/' ? 'index.html' : path));
    if (!file.startsWith(ROOT + sep)) return res.writeHead(403).end();
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream' }).end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r(server)));
}

function findChrome() {
  const local = process.env.LOCALAPPDATA;
  const found = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    local && join(local, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  ].find((p) => p && existsSync(p));
  if (!found) throw new Error('Chrome não encontrado. Defina CHROME_PATH com o caminho do executável.');
  return found;
}

async function launchChrome() {
  const profile = mkdtempSync(join(tmpdir(), 'prerender-'));
  const proc = spawn(findChrome(), [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--hide-scrollbars',
    '--lang=pt-BR', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank',
  ], { stdio: 'ignore' });
  // Chrome picks a free port and writes it to DevToolsActivePort.
  const portFile = join(profile, 'DevToolsActivePort');
  let port = '';
  for (let i = 0; i < 150 && !port; i++) {
    if (existsSync(portFile)) port = readFileSync(portFile, 'utf8').split('\n')[0].trim();
    if (!port) await sleep(100);
  }
  if (!port) throw new Error('O Chrome não abriu a porta de depuração.');
  const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const page = list.find((t) => t.type === 'page');
  const close = async () => {
    proc.kill();
    await sleep(500);
    rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  };
  return { wsUrl: page.webSocketDebuggerUrl, close };
}

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let seq = 0;
  const pending = new Map();
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (!msg.id || !pending.has(msg.id)) return;
    const { resolve: ok, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(msg.error.message)) : ok(msg.result);
  };
  const send = (method, params = {}) => new Promise((ok, reject) => {
    const id = ++seq;
    pending.set(id, { resolve: ok, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('Erro na página: ' + (r.exceptionDetails.exception?.description ?? r.exceptionDetails.text));
    return r.result.value;
  };
  return new Promise((ok, reject) => { ws.onopen = () => ok({ send, evaluate, close: () => ws.close() }); ws.onerror = reject; });
}

async function render(url) {
  const chrome = await launchChrome();
  try {
    const page = await connect(chrome.wsUrl);
    await page.send('Page.enable');
    await page.send('Runtime.enable');
    // Reduced motion makes the page render every section already revealed (no entrance animation state).
    await page.send('Emulation.setEmulatedMedia', { features: [
      { name: 'prefers-reduced-motion', value: 'reduce' }, { name: 'prefers-color-scheme', value: 'light' },
    ] });
    await page.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
    await page.send('Page.addScriptToEvaluateOnNewDocument', { source: "try { localStorage.setItem('gs-lang', 'pt'); } catch (e) {}" });
    await page.send('Page.navigate', { url });
    const ready = `(() => {
      const root = document.getElementById('dc-root');
      return !!(root && root.querySelector('#contato') && root.querySelector('#cert-rail button') && document.fonts.status === 'loaded');
    })()`;
    let ok = false;
    for (let i = 0; i < 150 && !ok; i++) {
      ok = await page.evaluate(ready).catch(() => false);
      if (!ok) await sleep(200);
    }
    if (!ok) throw new Error('A página não terminou de renderizar em 30 s.');
    await sleep(1000); // late updates (fonts.ready -> nav measurements)
    const html = await page.evaluate(`document.getElementById('dc-root').innerHTML`);
    page.close();
    return html;
  } finally {
    await chrome.close();
  }
}

const server = await serve();
try {
  const { port } = server.address();
  // data-rv marks elements the reveal animation already handled; data-dc-tpl only serves the Claude Design editor.
  const snapshot = (await render(`http://127.0.0.1:${port}/`)).replace(/ data-rv="1"| data-dc-tpl="[^"]*"/g, '');
  if (snapshot.includes('{{')) throw new Error('A cópia ainda tem {{ marcadores }}: alguma parte não renderizou.');
  for (const expected of ['Gustavo de Souza', 'id="sobre"', 'id="experiencia"', 'id="certificados"', 'id="contato"']) {
    if (!snapshot.includes(expected)) throw new Error(`A cópia não tem ${expected}.`);
  }

  const block = `<!-- prerender:start -->\n<div id="dc-prerender">${snapshot}</div>\n<!-- prerender:end -->`;
  const original = readFileSync(PAGE, 'utf8');
  let out = hasBlock(original) ? replaceBlock(original, block) : original.replace('<body>', () => `<body>\n${block}`);
  if (!hasBlock(out)) throw new Error('Não achei onde inserir a cópia (falta <body> no index.html).');
  out = out.replace('<!-- prerender:start -->', `<!-- prerender:start sha256=${pageHash(out)} -->`);
  writeFileSync(PAGE, out);
  console.log(`prerender: cópia estática atualizada no index.html (${Math.round(snapshot.length / 1024)} KB de HTML).`);
} finally {
  server.close();
}
