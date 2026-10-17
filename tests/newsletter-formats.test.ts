import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { readerDocument } from '../src/lib/reader.ts';
import { mapMessage } from '../src/lib/gmail.ts';

const { document, Node, Element } = parseHTML('<html><body></body></html>');
Object.assign(globalThis, { document, Node, Element });
const edition = { ...mapMessage({ id: 'format-check' }), subject: 'A sample edition' };
const render = (html: string, original = false) => parseHTML(readerDocument({ ...edition, html }, original, false, 19)).document.body;

// Fictional structures, not copies of subscriber emails or guarantees about particular platforms.
test('a long-form publication keeps semantic sections, lists, quotes and editorial links', () => {
  const body = render('<article><header><h1>A sample edition</h1></header><p>A quiet opening.</p><section><h2>Culture and ideas</h2><blockquote>A quotation to consider.</blockquote><ul><li>First idea</li><li>Second idea</li></ul><p>Our mission is to keep learning.</p><p>Continue with <a href="https://example.com/essay">the full essay</a>.</p></section><footer><a href="https://example.com/unsubscribe">Unsubscribe</a></footer></article>');
  assert.equal(body.querySelectorAll('h1').length, 1);
  assert.equal(body.querySelector('h2')?.textContent, 'Culture and ideas');
  assert.equal(body.querySelectorAll('li').length, 2);
  assert.equal(body.querySelector('blockquote')?.textContent, 'A quotation to consider.');
  assert.ok(body.textContent.includes('Our mission is to keep learning.'));
  assert.ok(body.querySelector('a[href="https://example.com/essay"]'));
  assert.ok(!body.textContent.includes('Unsubscribe'));
});

test('a nested table digest retains every story, link, code sample and the final paragraph', () => {
  const body = render('<table role="presentation"><tr><td><table><tr><td><h2>Markets</h2><p>First story and its detail.</p><a href="https://example.com/markets">Full report</a></td></tr></table></td></tr><tr><td><h2>Engineering</h2><p>Try this command.</p><pre><code>npm run example</code></pre><a href="https://example.com/code">Source code</a><p>The final paragraph belongs to the story.</p></td></tr><tr><td><a href="https://example.com/preferences">Manage preferences</a></td></tr></table>');
  assert.equal(body.querySelectorAll('h2').length, 2);
  assert.equal(body.querySelectorAll('a[href]').length, 2);
  assert.equal(body.querySelector('pre code')?.textContent, 'npm run example');
  assert.ok(body.textContent.includes('The final paragraph belongs to the story.'));
  assert.ok(!body.textContent.includes('Manage preferences'));
  assert.equal(body.querySelectorAll('table').length, 0);
});

test('email layout remains a fallback for designs and data tables that reading view simplifies', () => {
  const html = '<style>.price{color:#345}</style><table><thead><tr><th>Fund</th><th>Price</th></tr></thead><tbody><tr><td>Example</td><td class="price">42</td></tr></tbody></table>';
  const reading = render(html);
  assert.ok(reading.textContent.includes('Fund')); assert.ok(reading.textContent.includes('42'));
  const original = render(html, true);
  assert.equal(original.querySelectorAll('table').length, 1);
  assert.equal(original.querySelectorAll('th').length, 2);
  assert.equal(original.querySelector('.price')?.textContent, '42');
});

test('plain-text newsletters preserve paragraphs and escape literal markup', () => {
  const body = parseHTML(readerDocument({ ...edition, html: '', text: 'Hello, reader.\n\nSecond paragraph with <literal> text.' }, false, false, 19)).document.body;
  assert.equal(body.querySelectorAll('p').length, 2);
  assert.ok(body.textContent.includes('Second paragraph with <literal> text.'));
  assert.equal(body.querySelectorAll('literal').length, 0);
});
