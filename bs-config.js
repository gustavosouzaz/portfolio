/**
 * Servidor local de desenvolvimento (Browser-Sync).
 *
 *   npm run dev  →  http://localhost:3000
 *
 * A raiz "/" serve o portfólio (index.html, igual no Vercel/GitHub Pages). A
 * versão antiga continua acessível em /Portfolio%20Gustavo.dc.html. Ao salvar
 * qualquer HTML, JS, imagem ou PDF, o navegador recarrega sozinho.
 *
 * Precisa de servidor HTTP (não dá para abrir o .html direto do disco): a página
 * usa fetch() para checar o currículo e o runtime (support.js) relê o próprio
 * HTML; ambos falham em file://.
 */
module.exports = {
  server: {
    baseDir: './',
    // .image-slots.state.json guarda as imagens dos image-slots (v1); por padrão
    // arquivos que começam com ponto dão 404.
    serveStaticOptions: { dotfiles: 'allow' },
  },
  files: ['*.html', '*.js', '.image-slots.state.json', 'img/**/*', 'docs/**/*'],
  port: 3000,
  open: 'local',
  notify: false, // sem o aviso "Connected to BrowserSync" no canto da página
  ui: false, // sem o painel de controle extra na porta 3001
  ghostMode: false, // não espelha cliques/rolagem entre abas e dispositivos
};
