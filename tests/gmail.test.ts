import test from 'node:test';
import assert from 'node:assert/strict';
import { LABEL_NAME, bodyPart, decodeBody, fetchPage, findLabel, GmailError, gmailRequest, mapMessage, mergeMessages } from '../src/lib/gmail.ts';
const b64 = (value: string) => Buffer.from(value).toString('base64url');
const message = (id = 'one', date = '100') => ({ id, internalDate: date, labelIds: ['Label_exact'], snippet: 'A preview', payload: { mimeType: 'multipart/alternative', headers: [{ name: 'fRoM', value: '"AI Weekly" <news@example.com>' }, { name: 'Subject', value: 'A good read' }], parts: [{ mimeType: 'text/plain', filename: 'ignore.txt', body: { data: b64('attachment') } }, { mimeType: 'text/plain', body: { data: b64('Olá 🧠') } }, { mimeType: 'text/html', body: { data: b64('<p>Full newsletter</p>') } }] } });
async function mocked(responder: (url: URL, init?: RequestInit) => unknown, run: () => Promise<void>) {
  const old = globalThis.fetch;
  globalThis.fetch = async (input, init) => new Response(JSON.stringify(responder(new URL(String(input)), init)), { status: 200 });
  try { await run(); } finally { globalThis.fetch = old; }
}
test('base64url preserves Unicode with omitted padding', () => assert.equal(decodeBody(b64('Olá 🧠 / +')), 'Olá 🧠 / +'));
test('nested MIME excludes named text attachments', () => assert.equal(bodyPart({ mimeType: 'multipart/mixed', parts: [message().payload] }, 'text/plain'), 'Olá 🧠'));
test('mapping extracts headers, rich body and date', () => { const item = mapMessage(message()); assert.equal(item.sender, 'AI Weekly'); assert.equal(item.address, 'news@example.com'); assert.equal(item.html, '<p>Full newsletter</p>'); assert.equal(item.date, 100); });
test('missing headers and body have safe fallbacks', () => { const item = mapMessage({ id: 'empty' }); assert.equal(item.subject, 'Untitled newsletter'); assert.equal(item.text, ''); });
test('merge deduplicates by ID and sorts newest first', () => { const items = mergeMessages([mapMessage(message('old','1'))], [mapMessage(message('new','9')), mapMessage(message('old','2'))]); assert.deepEqual(items.map(i=>i.id), ['new','old']); assert.equal(items[1].date,2); });
test('label discovery matches the leading underscore exactly', async () => { assert.equal(LABEL_NAME, '_AI_SIGNAL'); await mocked(() => ({labels:[{id:'wrong',name:'AI_SIGNAL'},{id:'right',name:'_AI_SIGNAL'}]}), async () => assert.equal(await findLabel('token'),'right')); });
test('missing label stops without querying the inbox', async () => { let calls=0; await mocked(()=>{calls++;return {labels:[]};}, async()=>assert.rejects(findLabel('token'), /Create the _AI_SIGNAL label/)); assert.equal(calls,1); });
test('pagination sends exact label and cursor; filters stale membership', async () => {
  await mocked((url,init)=>{
    assert.equal(new Headers(init?.headers).get('Authorization'),'Bearer token'); assert.equal(init?.method,undefined);
    if(url.pathname.endsWith('/messages')) { assert.equal(url.searchParams.get('labelIds'),'Label_exact'); assert.equal(url.searchParams.get('pageToken'),'next'); return {messages:[{id:'one'},{id:'moved'}],nextPageToken:'last'}; }
    return url.pathname.endsWith('/moved') ? {...message('moved'),labelIds:[]} : message();
  }, async()=>{const page=await fetchPage('token','Label_exact','next');assert.equal(page.items.length,1);assert.equal(page.nextPageToken,'last');});
});
test('attachment-backed text is fetched without ordinary attachments', async()=> {
  await mocked(url=>{
    if(url.pathname.endsWith('/messages'))return {messages:[{id:'one'}]};
    if(url.pathname.endsWith('/attachments/body'))return {data:b64('<p>Large edition</p>')};
    return {...message(),payload:{mimeType:'text/html',body:{attachmentId:'body'}}};
  },async()=>assert.equal((await fetchPage('token','Label_exact')).items[0].html,'<p>Large edition</p>'));
});
test('401 creates an explicit reconnect error', async()=> {
  const old=globalThis.fetch;globalThis.fetch=async()=>new Response('',{status:401});
  try {await assert.rejects(gmailRequest('labels','expired'),(error:unknown)=>error instanceof GmailError && error.status===401);}finally{globalThis.fetch=old;}
});
test('failed body fetch rejects page so the cursor cannot silently advance',async()=>{
  const old=globalThis.fetch; globalThis.fetch=async input=>String(input).includes('?') && new URL(String(input)).pathname.endsWith('/messages') ? new Response('{"messages":[{"id":"one"}]}') : new Response('',{status:500});
  try{await assert.rejects(fetchPage('token','Label_exact'),/500/);}finally{globalThis.fetch=old;}
});
test('List-ID groups sender aliases under the same newsletter',async()=>{
  const { messageSource }=await import('../src/lib/gmail.ts');
  const one=message();one.payload.headers.push({name:'List-Id',value:'Weekly AI <weekly.example.com>'});
  const two=message();two.payload.headers[0].value='A different sender <other@example.com>';two.payload.headers.push({name:'List-ID',value:'Weekly AI <weekly.example.com>'});
  assert.equal(messageSource(one).id,messageSource(two).id);
});
test('different List-IDs remain distinct even when their sender address matches',async()=>{
  const { messageSource }=await import('../src/lib/gmail.ts');
  const one=message();one.payload.headers.push({name:'List-Id',value:'one.example.com'});
  const two=message();two.payload.headers.push({name:'List-Id',value:'two.example.com'});
  assert.notEqual(messageSource(one).id,messageSource(two).id);
});
test('newsletter filtering keeps the label constraint and rechecks source membership',async()=>{
  const {messageSource}=await import('../src/lib/gmail.ts');
  const one=message();one.payload.headers.push({name:'List-Id',value:'one.example.com'});
  const other=message('other');other.payload.headers.push({name:'List-Id',value:'other.example.com'});
  await mocked(url=>{
    if(url.pathname.endsWith('/messages')){assert.equal(url.searchParams.get('labelIds'),'Label_exact');assert.equal(url.searchParams.get('q'),'list:"one.example.com"');return {messages:[{id:'one'},{id:'other'}]};}
    return url.pathname.endsWith('/other') ? other : one;
  },async()=>assert.deepEqual((await fetchPage('token','Label_exact',undefined,undefined,messageSource(one))).items.map(i=>i.id),['one']));
});
test('source discovery uses headers only and follows label pagination',async()=>{
  const {discoverSources}=await import('../src/lib/gmail.ts');let latest: {id:string}[]=[];let lists=0;
  await mocked(url=>{
    if(url.pathname.endsWith('/messages')){lists++;assert.equal(url.searchParams.get('labelIds'),'Label_exact');return lists===1 ? {messages:[{id:'one'}],nextPageToken:'older'} : {messages:[{id:'two'}]};}
    assert.equal(url.searchParams.get('format'),'metadata');assert.deepEqual(url.searchParams.getAll('metadataHeaders'),['From','List-Id']);
    const item=message();item.payload.headers.push({name:'List-Id',value:url.pathname.endsWith('/one')?'one.example.com':'two.example.com'});return item;
  },async()=>{await discoverSources('token','Label_exact',sources=>{latest=sources;});assert.equal(latest.length,2);assert.equal(lists,2);});
});
