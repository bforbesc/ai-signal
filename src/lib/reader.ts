import type { Newsletter } from './gmail';
const forbidden = new Set(['SCRIPT', 'STYLE', 'TITLE', 'LINK', 'META', 'BASE', 'IFRAME', 'OBJECT', 'EMBED', 'FORM', 'INPUT', 'BUTTON', 'TEXTAREA', 'SELECT', 'SVG', 'MATH', 'NOSCRIPT', 'TEMPLATE']);
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
function compactText(value: string): string { return value.replace(/\s+/g, ' ').trim(); }
function linkLabel(node: Element): string {
  return compactText(node.textContent ?? '') || compactText(Array.from(node.querySelectorAll('img')).map(image => image.getAttribute('alt') ?? '').join(' '));
}
// Match standalone newsletter controls, never words inside editorial paragraphs.
function isNewsletterControl(node: Element): boolean {
  const label = linkLabel(node).replace(/[→↗↑↓›»|•]+/g, '').trim();
  return /^(?:sign\s*up|subscribe(?:\s+now)?|work\s+with\s+us|(?:become\s+a\s+|our\s+)?partner(?:\s+with\s+us)?|advertise(?:\s+with\s+us)?|archive|view\s+(?:in\s+(?:your\s+)?browser|online)|read\s+(?:in\s+(?:your\s+)?browser|online)|forward(?:\s+(?:this\s+)?(?:email|newsletter|to\s+a\s+friend))?|share(?:\s+(?:this\s+)?(?:email|newsletter))?|follow(?:\s+(?:us|me))?(?:\s+on)?\s+(?:x|twitter|linkedin|instagram|facebook|threads|youtube)|x|twitter|linkedin|instagram|facebook|unsubscribe(?:_me\(\):\s*return\s+true)?|manage\s+(?:email\s+)?(?:preferences|subscription)|update\s+(?:email\s+)?preferences)$/i.test(label);
}
function isBoilerplateBlock(node: Element): boolean {
  if (!['TABLE', 'TD', 'DIV', 'P'].includes(node.tagName)) return false;
  const text = compactText(node.textContent ?? '');
  if (/^(?:[\d,.]+\s+(?:likes|shares|views)|in partnership with\s*[·|]?|read time:\s*[\d\s\w]+)$/i.test(text)) return true;
  // Small administrative/footer blocks, not an enclosing table containing stories.
  const hasStories = !!node.querySelector('h1,h2,h3,.h1,article');
  if (!hasStories && text.length < 3000 && /^(?:at\s+.{1,60}?,?\s+our mission is|our mission is)/i.test(text) && /privacy policy|unsubscribe|employers and advertisers/i.test(text)) return true;
  if (!hasStories && text.length < 1500 && /^(?:you(?:'re| are) receiving (?:this|these)|you received this email|how was (?:today'?s|this) (?:email|newsletter)|looking to promote your|today'?s author\b|unsubscribe(?:\b|_me\(\)))/i.test(text)) return true;
  if (!node.querySelector('a')) return false;
  const remaining = node.cloneNode(true) as Element;
  let controls = 0;
  remaining.querySelectorAll('a').forEach(link => { if (isNewsletterControl(link)) { link.remove(); controls++; } });
  return controls > 0 && !compactText(remaining.textContent ?? '').replace(/[|•·/\\—–\-:→↗›»]/g, '').trim();
}
function standaloneControl(node: Element): boolean {
  if (node.tagName !== 'A' || !isNewsletterControl(node)) return false;
  const context = node.parentElement?.closest('p,li,td,th,div,h1,h2,h3,h4,h5,h6') ?? node;
  const remaining = context.cloneNode(true) as Element;
  remaining.querySelectorAll('a').forEach(link => { if (isNewsletterControl(link)) link.remove(); });
  if (remaining.tagName === 'A') return true;
  return !compactText(remaining.textContent ?? '').replace(/[|•·/\\—–\-:→↗›»]/g, '').trim();
}
// Parse in an inert template; rebuild a small semantic allowlist. Never mount email HTML in the app origin.
export function readerDocument(item: Newsletter, original: boolean, images: boolean, fontSize: number): string {
  const source = document.createElement('template'); source.innerHTML = item.html;
  const output = document.createElement('div');
  function copy(node: Node, parent: Node) {
    if (node.nodeType === Node.TEXT_NODE) { const text = node.textContent ?? ''; if (!original && /^\s*[|·•]+\s*$/.test(text)) return; parent.appendChild(document.createTextNode(text)); return; }
    if (!(node instanceof Element)) return;
    if (original && node.tagName === 'STYLE') { const styleElement = document.createElement('style'); styleElement.textContent = node.textContent; parent.appendChild(styleElement); return; }
    if (forbidden.has(node.tagName)) return;
    const style = node.getAttribute('style') ?? '';
    if (node.hasAttribute('hidden') || /display\s*:\s*none|visibility\s*:\s*hidden|mso-hide\s*:\s*all/i.test(style)) return;
    if (!original && (node.tagName === 'FOOTER' || node.tagName === 'NAV' || node.getAttribute('role') === 'navigation' || isBoilerplateBlock(node) || standaloneControl(node))) return;
    if (!original && node.tagName === 'TD' && /^\d{1,2}$/.test(compactText(node.textContent ?? '')) && node.parentElement?.querySelector('.h1,h1,h2,h3')) return;
    if (!original && (/^H[1-6]$/.test(node.tagName) || node.classList.contains('h1')) && compactText(node.textContent ?? '').toLowerCase() === compactText(item.subject).toLowerCase()) return;
    // A newsletter's long linked contents list is useful, but need not precede every story.
    if (!original && node.tagName === 'TABLE' && compactText(node.querySelector('h1,h2,h3,.h1')?.textContent ?? '').toLowerCase() === 'summary' && (node.textContent?.length ?? 0) < 4000 && node.querySelectorAll('a').length >= 3) {
      const details = document.createElement('details'); details.className = 'reader-contents';
      const summary = document.createElement('summary'); summary.textContent = 'In this edition'; details.appendChild(summary);
      const content = document.createElement('ul');
      node.querySelectorAll('a').forEach(link => {
        if (!safeURL(link.getAttribute('href') ?? '') || !linkLabel(link) || isNewsletterControl(link)) return;
        const entry = document.createElement('li'); copy(link, entry);
        const anchor = entry.querySelector('a'); if (anchor) anchor.textContent = linkLabel(link).replace(/^[▸▹►]\s*/, '');
        content.appendChild(entry);
      });
      details.appendChild(content); parent.appendChild(details); return;
    }
    let name = node.tagName.toLowerCase();
    const linkedHeading = !original && name === 'a' && node.classList.contains('h1');
    if (!original && node.classList.contains('h1') && !linkedHeading) name = 'h2';
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
      if (!original && /^(?:read more|read the research|run the assessment)$/i.test(linkLabel(node))) el.className = 'reader-action';
    }
    node.childNodes.forEach(child => copy(child, el));
    if (!original && !compactText(el.textContent ?? '') && !el.querySelector('img,hr') && !['br', 'hr', 'img'].includes(name)) return;
    if (linkedHeading) {
      const heading = document.createElement('h2');
      heading.appendChild(el); parent.appendChild(heading);
    } else parent.appendChild(el);
  }
  if (item.html) source.content.childNodes.forEach(node => copy(node, output));
  else {
    for (const text of (item.text || item.snippet).split(/\n\s*\n/)) {
      const p = document.createElement('p'); p.textContent = text; output.appendChild(p);
    }
  }
  const article = document.createElement('article');
  const title = document.createElement('h1'); title.className = 'reader-title'; title.textContent = item.subject;
  article.appendChild(title); article.appendChild(output);
  const font = Math.min(24, Math.max(16, fontSize));
  const css = original ? `body{margin:0;padding:16px;background:#fff;color:#252622;font-family:Arial,sans-serif}table{max-width:100%!important}img{max-width:100%;height:auto}.reader-title{font:400 22px/1.35 Georgia,serif;margin:0 0 24px;overflow-wrap:anywhere}` : `
  *{box-sizing:border-box}html{color-scheme:light}body{margin:0;padding:18px 24px 48px;background:#f7f4ec;color:#2b2b26;font-family:Georgia,'Times New Roman',serif;font-size:${font}px;line-height:1.65;overflow-wrap:break-word;-webkit-text-size-adjust:100%}
  body>article{max-width:610px;margin:0 auto}p{margin:0 0 1.1em}h1,h2,h3,h4,h5,h6{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:1.1em;line-height:1.4;margin:1.6em 0 .65em;letter-spacing:-.02em}h1{font-size:1.2em}.reader-title{font:400 22px/1.35 Georgia,'Times New Roman',serif;letter-spacing:-.25px;margin:0 0 26px}a{color:#27614c;text-underline-offset:3px}ul,ol{padding-left:1.2em}li{margin:.5em 0}img{max-width:100%;height:auto;border-radius:6px;margin:1em auto;display:block}pre{white-space:pre-wrap;font-size:.85em}blockquote{margin:1.2em 0;border-left:2px solid #a4b7a1;padding-left:1em}hr{border:0;border-top:1px solid #deded4;margin:1.6em 0}div{max-width:100%}div:empty{display:none}.reader-contents{margin:24px 0;border-top:1px solid #deded4;border-bottom:1px solid #deded4;padding:12px 0;font-size:.85em}.reader-contents summary{font:500 13px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#59664f;cursor:pointer;min-height:24px}.reader-contents ul{list-style:none;padding:0;margin:12px 0}.reader-contents li{margin:.85em 0}.reader-contents a{display:inline;margin:0}@media(min-width:700px){body{padding:24px 28px 64px}.reader-title{font-size:26px}}
  `;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'none'; img-src ${images ? 'https: data:' : "'none'"}; style-src 'unsafe-inline'; font-src 'none'; form-action 'none'; base-uri 'none'; frame-src 'none'"><meta name="referrer" content="no-referrer"><style>${css}${original ? '' : '.reader-action{display:inline-block;font:500 13px/1.5 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;min-height:44px;padding:12px 0;margin:4px 0 18px;letter-spacing:.4px}'}</style></head><body>${article.outerHTML}</body></html>`;
}
export function previewText(item: Newsletter): string {
  return decodeEntities(item.snippet).replace(/\s+/g, ' ').trim();
}
