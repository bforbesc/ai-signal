import { SERVER_SESSION } from './session.ts';
export const LABEL_NAME = '_AI_SIGNAL';
const API = 'https://gmail.googleapis.com/gmail/v1/users/me/';
export interface GmailPart {
  mimeType?: string; filename?: string;
  headers?: { name: string; value: string }[];
  body?: { data?: string; attachmentId?: string };
  parts?: GmailPart[];
}
export interface GmailMessage {
  id: string; internalDate?: string; snippet?: string; labelIds?: string[]; payload?: GmailPart;
}
export interface NewsletterSource { id: string; name: string; address: string; listId: string }
export interface Newsletter {
  source: NewsletterSource;
  id: string; sender: string; address: string; subject: string;
  date: number; snippet: string; html: string; text: string; readMinutes: number; isRead: boolean;
}
export class GmailError extends Error {
  constructor(message: string, public status = 0) { super(message); this.name = 'GmailError'; }
}
export function decodeBody(value: string): string {
  const raw = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(raw, c => c.charCodeAt(0)));
}
export function bodyPart(part: GmailPart | undefined, mime: string): string {
  if (!part || part.filename) return '';
  if (part.mimeType === mime && part.body?.data) return decodeBody(part.body.data);
  for (const child of part.parts ?? []) { const result = bodyPart(child, mime); if (result) return result; }
  return '';
}
export function messageSource(message: GmailMessage): NewsletterSource {
  const headers = message.payload?.headers ?? [];
  const from = headers.find(h => h.name.toLowerCase() === 'from')?.value ?? '';
  const name = from.replace(/<[^>]*>/g, '').trim().replace(/^"|"$/g, '') || 'Newsletter';
  const address = (from.match(/<([^>]+)>/)?.[1] ?? from).trim().toLowerCase();
  const list = headers.find(h => h.name.toLowerCase() === 'list-id')?.value ?? '';
  const listId = (list.match(/<([^>]+)>/)?.[1] ?? list).trim().toLowerCase();
  return { id: listId ? `list:${listId}` : `from:${address || name.toLowerCase()}`, name, address, listId };
}
export function mapMessage(message: GmailMessage): Newsletter {
  const header = (name: string) => message.payload?.headers?.find(h => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';
  const from = header('from');
  const text = bodyPart(message.payload, 'text/plain');
  const html = bodyPart(message.payload, 'text/html');
  return {
    id: message.id, source: messageSource(message), sender: from.replace(/<[^>]*>/g, '').trim().replace(/^"|"$/g, '') || 'Newsletter',
    address: from.match(/<([^>]+)>/)?.[1] ?? from,
    subject: header('subject') || 'Untitled newsletter', date: Number(message.internalDate) || 0,
    snippet: message.snippet ?? '', html, text,
    isRead: !message.labelIds?.includes('UNREAD'),
    readMinutes: Math.max(1, Math.ceil((text || html.replace(/<[^>]+>/g, ' ')).split(/\s+/).length / 220)),
  };
}
export function mergeMessages(previous: Newsletter[], next: Newsletter[]): Newsletter[] {
  return [...new Map([...previous, ...next].map(item => [item.id, item])).values()].sort((a, b) => b.date - a.date);
}
export async function gmailRequest<T>(path: string, token: string, signal?: AbortSignal, params: Record<string, string | string[]> = {}): Promise<T> {
  const managed = token === SERVER_SESSION;
  const url = new URL(managed ? `/api/gmail/${path}` : API + path, managed ? window.location.origin : undefined);
  Object.entries(params).forEach(([key, value]) => { for (const item of Array.isArray(value) ? value : [value]) url.searchParams.append(key, item); });
  const response = await fetch(url, { headers: managed ? {} : { Authorization: `Bearer ${token}` }, credentials: managed ? 'same-origin' : 'omit', signal, cache: 'no-store' });
  if (!response.ok) {
    const messages: Record<number, string> = {
      401: 'Your Google session has expired. Reconnect to refresh your feed.',
      403: 'Gmail access was refused. Check that Gmail API is enabled and Gmail access was allowed.',
      429: 'Gmail is busy. Please wait a moment and refresh.',
    };
    throw new GmailError(messages[response.status] ?? `Gmail returned an error (${response.status}). Please try again.`, response.status);
  }
  return response.json() as Promise<T>;
}
export async function findLabel(token: string, signal?: AbortSignal): Promise<string> {
  const result = await gmailRequest<{ labels?: { id: string; name: string }[] }>('labels', token, signal);
  const label = result.labels?.find(item => item.name === LABEL_NAME);
  if (!label) throw new GmailError(`Create the ${LABEL_NAME} label in Gmail and add your newsletters, then refresh.`);
  return label.id;
}
async function hydrate(part: GmailPart, messageId: string, token: string, signal?: AbortSignal): Promise<GmailPart> {
  if (part.filename) return part;
  const copy = { ...part };
  if ((part.mimeType === 'text/html' || part.mimeType === 'text/plain') && !part.body?.data && part.body?.attachmentId) {
    copy.body = await gmailRequest(`messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(part.body.attachmentId)}`, token, signal);
  }
  if (part.parts) {
    copy.parts = [];
    for (const child of part.parts) copy.parts.push(await hydrate(child, messageId, token, signal));
  }
  return copy;
}
export async function fetchPage(token: string, labelId: string, pageToken?: string, signal?: AbortSignal, source?: NewsletterSource | null, cached: Newsletter[] = []): Promise<{ items: Newsletter[]; nextPageToken?: string }> {
  const params: Record<string, string> = { labelIds: labelId, maxResults: '30' };
  const cachedById = new Map(cached.map(item => [item.id, item]));
  if (pageToken) params.pageToken = pageToken;
  const quote = (value: string) => value.replace(/[\\"]/g, '');
  if (source?.listId) params.q = `list:"${quote(source.listId)}"`;
  else if (source?.address) params.q = `from:"${quote(source.address)}"`;
  const page = await gmailRequest<{ messages?: { id: string }[]; nextPageToken?: string }>('messages', token, signal, params);
  const items: Newsletter[] = [];
  // Bounded batches. Any failure preserves the cursor so Retry cannot skip an email.
  for (let i = 0; i < (page.messages?.length ?? 0); i += 3) {
    const batch = await Promise.all(page.messages!.slice(i, i + 3).map(async ref => {
      const existing = cachedById.get(ref.id);
      const message = await gmailRequest<GmailMessage>(`messages/${encodeURIComponent(ref.id)}`, token, signal, { format: existing ? 'minimal' : 'full' });
      if (!message.labelIds?.includes(labelId) || (source && (existing?.source ?? messageSource(message)).id !== source.id)) return null;
      if (existing) return { ...existing, isRead: !message.labelIds.includes('UNREAD') };
      if (message.payload) message.payload = await hydrate(message.payload, ref.id, token, signal);
      return mapMessage(message);
    }));
    for (const item of batch) if (item) items.push(item);
  }
  return { items: mergeMessages([], items), nextPageToken: page.nextPageToken };
}

export async function setMessageRead(token: string, id: string, read: boolean, labelId: string): Promise<boolean> {
  const managed = token === SERVER_SESSION;
  if (!managed) {
    const message = await gmailRequest<GmailMessage>(`messages/${encodeURIComponent(id)}`, token, undefined, { format: 'minimal' });
    if (!message.labelIds?.includes(labelId)) throw new GmailError('This message is outside _AI_SIGNAL.', 404);
  }
  const response = await fetch(managed ? `/api/gmail/messages/${encodeURIComponent(id)}/read-status` : `${API}messages/${encodeURIComponent(id)}/modify`, {
    method: 'POST', credentials: managed ? 'same-origin' : 'omit', cache: 'no-store',
    headers: { 'Content-Type': 'application/json', ...(managed ? {} : { Authorization: `Bearer ${token}` }) },
    body: JSON.stringify(managed ? { read } : read ? { removeLabelIds: ['UNREAD'] } : { addLabelIds: ['UNREAD'] }),
  });
  if (!response.ok) throw new GmailError(response.status === 428 || response.status === 403 ? 'Reconnect Gmail to enable read/unread sync.' : 'Gmail could not save this read status. Please try again.', response.status);
  const value = await response.json() as GmailMessage;
  if (value.id !== id || !Array.isArray(value.labelIds)) throw new GmailError('Gmail did not confirm this read status. Please refresh.');
  return !value.labelIds.includes('UNREAD');
}

// Discover publications using headers only; full email bodies are still fetched a page at a time.
export async function discoverSources(token: string, labelId: string, onUpdate: (sources: NewsletterSource[]) => void, signal?: AbortSignal): Promise<void> {
  const sources = new Map<string, NewsletterSource>();
  let cursor: string | undefined;
  do {
    const params: Record<string, string> = { labelIds: labelId, maxResults: '100' };
    if (cursor) params.pageToken = cursor;
    const page = await gmailRequest<{ messages?: { id: string }[]; nextPageToken?: string }>('messages', token, signal, params);
    for (let i = 0; i < (page.messages?.length ?? 0); i += 3) {
      const batch = await Promise.all(page.messages!.slice(i, i + 3).map(ref => gmailRequest<GmailMessage>(`messages/${encodeURIComponent(ref.id)}`, token, signal, { format: 'metadata', metadataHeaders: ['From', 'List-Id'], fields: 'id,labelIds,payload(headers)' })));
      for (const message of batch) if (message.labelIds?.includes(labelId)) { const source = messageSource(message); sources.set(source.id, source); }
      if (signal?.aborted) return;
      onUpdate([...sources.values()].sort((a,b) => a.name.localeCompare(b.name)));
      // Keep source discovery below Gmail's per-user request quotas for large labels.
      await new Promise<void>((resolve, reject) => {
        const onAbort = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); };
        const timer = setTimeout(() => { signal?.removeEventListener('abort', onAbort); resolve(); }, 250);
        if (signal?.aborted) onAbort(); else signal?.addEventListener('abort', onAbort, { once: true });
      });
    }
    cursor = page.nextPageToken;
  } while (cursor && !signal?.aborted);
}
