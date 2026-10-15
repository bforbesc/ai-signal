import type { Newsletter } from './gmail';
const forbidden = new Set(['SCRIPT', 'STYLE', 'LINK', 'META', 'BASE', 'IFRAME', 'OBJECT', 'EMBED', 'FORM', 'INPUT', 'BUTTON', 'TEXTAREA', 'SELECT', 'SVG', 'MATH', 'NOSCRIPT', 'TEMPLATE']);
const allowed = new Set(['P', 'DIV', 'BR', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI', 'A', 'STRONG', 'B', 'EM', 'I', 'U', 'CODE', 'PRE', 'BLOCKQUOTE', 'HR', 'IMG', 'SUP', 'SUB']);
export function decodeEntities(text: string): string {
  const template = document.createElement('template');
  template.innerHTML = text;
  return template.content.textContent ?? '';
}
function safeURL(value: string): string | null {
  try { const url = new URL(value); return ['https:', 'http:', 'mailto:'].includes(url.protocol) ? url.href : null; }
  catch { return null; }
}
// Parse in an inert template; rebuild a small semantic allowlist. Never mount email HTML in the app origin.
export function readerDocument(item: Newsletter, original: boolean, images: boolean, fontSize: number): string {
  const source = document.createElement('template'); source.innerHTML = item.html;
  const output = document.createElement('div');
  function copy(node: Node, parent: Node) {
    if (node.nodeType === Node.TEXT_NODE) { parent.appendChild(document.createTextNode(node.textContent ?? '')); return; }
    if (!(node instanceof Element)) return;
    if (original && node.tagName === 'STYLE') { const styleElement = document.createElement('style'); styleElement.textContent = node.textContent; parent.appendChild(styleElement); return; }
    if (forbidden.has(node.tagName)) return;
    const style = node.getAttribute('style') ?? '';
    if (node.hasAttribute('hidden') || /display\s*:\s*none|visibility\s*:\s*hidden|mso-hide\s*:\s*all/i.test(style)) return;
    let name = node.tagName.toLowerCase();
    if (!original && node.classList.contains('h1')) name = 'h2';
    if (['table', 'tbody', 'thead', 'tfoot', 'tr', 'td', 'th', 'center', 'section', 'article'].includes(name) && !original) name = 'div';
    const canKeep = allowed.has(name.toUpperCase()) || (original && ['table', 'tbody', 'thead', 'tfoot', 'tr', 'td', 'th', 'center'].includes(name));
    if (!canKeep) { node.childNodes.forEach(child => copy(child, parent)); return; }
    if (name === 'img') {
      if (!images) return;
      const src = node.getAttribute('src') ?? '';
      if (!/^https:\/\//i.test(src) && !/^data:image\/(png|jpeg|gif|webp);base64,/i.test(src)) return;
      if (Number(node.getAttribute('width')) === 1 || Number(node.getAttribute('height')) === 1) return;
    }
    const el = document.createElement(name);
    if (original) {
      for (const key of ['style', 'class', 'width', 'height', 'align', 'valign', 'cellpadding', 'cellspacing', 'role']) {
        const value = node.getAttribute(key); if (value) el.setAttribute(key, value);
      }
    }
    if (name === 'img') { el.setAttribute('src', node.getAttribute('src')!); el.setAttribute('alt', node.getAttribute('alt') ?? 'Newsletter image'); el.setAttribute('loading', 'lazy'); el.setAttribute('referrerpolicy', 'no-referrer'); }
    if (name === 'a') {
      const href = safeURL(node.getAttribute('href') ?? '');
      if (href) { el.setAttribute('href', href); el.setAttribute('target', '_blank'); el.setAttribute('rel', 'noopener noreferrer'); }
    }
    node.childNodes.forEach(child => copy(child, el));
    parent.appendChild(el);
  }
  if (item.html) source.content.childNodes.forEach(node => copy(node, output));
  else {
    for (const text of (item.text || item.snippet).split(/\n\s*\n/)) {
      const p = document.createElement('p'); p.textContent = text; output.appendChild(p);
    }
  }
  const font = Math.min(24, Math.max(16, fontSize));
  const css = original ? `body{margin:0;padding:16px;background:#fff;color:#252622;font-family:Arial,sans-serif}table{max-width:100%!important}img{max-width:100%;height:auto}` : `
  *{box-sizing:border-box}html{color-scheme:light}body{margin:0;padding:0 28px 64px;background:#f7f4ec;color:#2b2b26;font-family:Georgia,'Times New Roman',serif;font-size:${font}px;line-height:1.72;overflow-wrap:anywhere;-webkit-text-size-adjust:100%}
  body>div{max-width:610px;margin:0 auto}p{margin:0 0 1.3em}h1,h2,h3,h4,h5,h6{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:1.2em;line-height:1.4;margin:1.8em 0 .7em;letter-spacing:-.02em}h1{font-size:1.5em}a{color:#27614c;text-underline-offset:3px}ul,ol{padding-left:1.4em}li{margin:.5em 0}img{max-width:100%;height:auto;border-radius:10px;margin:1em auto;display:block}pre{white-space:pre-wrap;font-size:.85em}blockquote{margin:1.2em 0;border-left:2px solid #a4b7a1;padding-left:1em}hr{border:0;border-top:1px solid #deded4;margin:2em 0}div{max-width:100%}div:empty{display:none}
  `;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'none'; img-src ${images ? 'https: data:' : "'none'"}; style-src 'unsafe-inline'; font-src 'none'; form-action 'none'; base-uri 'none'; frame-src 'none'"><meta name="referrer" content="no-referrer"><style>${css}</style></head><body>${output.outerHTML}</body></html>`;
}
export function previewText(item: Newsletter): string {
  return decodeEntities(item.snippet).replace(/\s+/g, ' ').trim();
}
