import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { readerDocument } from '../src/lib/reader.ts';
import { mapMessage } from '../src/lib/gmail.ts';
const {document,Node,Element}=parseHTML('<html><body></body></html>');
Object.assign(globalThis,{document,Node,Element});
const item={...mapMessage({id:'test'}),html:'<style>body{font-size:4px}</style><table onclick="alert(1)"><tr><td class="h1">A clear headline</td></tr><tr><td><p>Readable writing.</p><script>alert(1)</script><img src="https://tracker.example/pixel" width="1" height="1"><a href="javascript:alert(1)">Bad</a><a href="https://example.com/article">Good</a><iframe src="https://example.com"></iframe></td></tr></table>'};
test('reading view removes script, handlers, layout tables and unsafe links',()=>{const html=readerDocument(item,false,false,19); assert.ok(!html.includes('<script'));assert.ok(!html.includes('onclick'));assert.ok(!html.includes('javascript:'));assert.ok(!html.includes('<table'));assert.ok(html.includes('<h2>A clear headline</h2>'));assert.ok(html.includes('https://example.com/article'));});
test('remote images are blocked by default and tracking pixels stay excluded when enabled',()=>{assert.ok(!readerDocument(item,false,false,19).includes('<img'));assert.ok(!readerDocument(item,false,true,19).includes('<img'));});
test('email layout retains tables but remains scriptless',()=>{const html=readerDocument(item,true,false,19);assert.ok(html.includes('<table'));assert.ok(html.includes("script-src 'none'"));assert.ok(!html.includes('<script'));assert.ok(!html.includes('onclick'));});
test('plain text is escaped and reader font is bounded',()=>{const html=readerDocument({...item,html:'',text:'<script>hello</script>'},false,false,100);assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes('font-size:24px'));});

function readingBody(html:string, original=false){const rendered=readerDocument({...item,subject:'An edition',html},original,false,19);return parseHTML(rendered).document.body;}
test('newsletter table menus and separators disappear while editorial links remain',()=>{
 const html='<table><tr><td><a href="https://example.com/signup">Signup</a></td><td>|</td><td><a href="https://example.com/work">Work With Us</a></td><td>|</td><td><a href="https://example.com/follow">Follow on X</a></td></tr></table><p>Try the new tool: <a href="https://example.com/tool">Sign up</a> for access.</p><p><a href="https://example.com/story">READ MORE</a></p>';
 const body=readingBody(html);assert.ok(!body.textContent.includes('Signup'));assert.ok(!body.textContent.includes('Follow on X'));assert.ok(!body.textContent.includes('|'));assert.equal(body.querySelector('a[href="https://example.com/tool"]')?.textContent,'Sign up');assert.ok(body.querySelector('a[href="https://example.com/story"]'));
 assert.ok(readingBody(html,true).textContent.includes('Follow on X'));
});
test('footer boilerplate is removed without truncating the final story or substantive mission text',()=>{
 const body=readingBody('<h2>Final story</h2><p>Our mission is to test better models.</p><p>Keep these last details.</p><table><tr><td>At Example, our mission is to inform. Our Privacy Policy explains our terms.</td></tr></table><table><tr><td>How was today\'s email? <a href="https://example.com/rate">Awesome</a></td></tr></table><table><tr><td><a href="https://example.com/unsubscribe">unsubscribe_me(): return True</a> Company address</td></tr></table>');
 assert.ok(body.textContent.includes('Keep these last details.'));assert.ok(body.textContent.includes('Our mission is to test better models.'));assert.ok(!body.textContent.includes('Privacy Policy'));assert.ok(!body.textContent.includes('How was'));assert.ok(!body.textContent.includes('unsubscribe'));assert.ok(!body.textContent.includes('Company address'));
});
test('a linked contents table becomes an accessible collapsed section',()=>{
 const body=readingBody('<table><tr><td class="h1">Summary</td></tr><tr><td><a href="https://example.com/1">First story</a><a href="https://example.com/2">Second story</a><a href="https://example.com/3">Third story</a></td></tr></table><h2>First story</h2><p>Full writing.</p>');
 const contents=body.querySelector('details');assert.equal(contents?.querySelector('summary')?.textContent,'In this edition');assert.ok(!contents?.hasAttribute('open'));assert.equal(contents?.querySelectorAll('a').length,3);assert.ok(body.textContent.includes('Full writing.'));
});
test('subject scrolls inside the document, is escaped, and repeated headlines are omitted',()=>{
 const rendered=readerDocument({...item,subject:'News <one>',html:'<title>Brand metadata</title><h1>News &lt;one&gt;</h1><p><strong>One</strong> <em>two</em> three.</p>'},false,false,19);const body=parseHTML(rendered).document.body;
 assert.equal(body.querySelector('.reader-title')?.textContent,'News <one>');assert.equal(body.querySelectorAll('h1').length,1);assert.ok(!body.textContent.includes('Brand metadata'));assert.ok(body.textContent.includes('One two three.'));
});
test('linked newsletter headlines remain navigable when their heading styles are cleaned',()=>{
 const html='<h2>Signals</h2><a class="h1" href="https://example.com/story?ref=newsletter&amp;edition=1" onclick="alert(1)">A useful <strong>research story</strong></a><p>Presented by a publisher.</p><a class="h1" href="https://example.com/next">Another story</a>';
 const body=readingBody(html);
 const links=Array.from(body.querySelectorAll('a[href]'));
 assert.equal(links.length,2);
 assert.equal(links[0].textContent,'A useful research story');
 assert.equal(links[0].getAttribute('href'),'https://example.com/story?ref=newsletter&edition=1');
 assert.equal(links[0].parentElement?.tagName,'H2');
 assert.equal(links[0].getAttribute('target'),'_blank');
 assert.equal(links[0].getAttribute('rel'),'noopener noreferrer');
 assert.ok(!links[0].hasAttribute('onclick'));
 assert.ok(body.textContent.includes('Presented by a publisher.'));
 assert.equal(readingBody(html,true).querySelectorAll('a[href]').length,2);
});
test('a linked heading cannot bypass unsafe URL filtering',()=>{
 const body=readingBody('<a class="h1" href="javascript:alert(1)">Unsafe story</a><a class="h1" href="data:text/html,hello">Another unsafe story</a>');
 assert.equal(body.querySelectorAll('a[href]').length,0);
 assert.ok(body.textContent.includes('Unsafe story'));
 assert.ok(body.textContent.includes('Another unsafe story'));
});
