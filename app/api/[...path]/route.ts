import { env } from 'cloudflare:workers';
import { handleGoogleSession, type SessionEnvironment } from '../../../server/google-session';
export const dynamic = 'force-dynamic';
export const GET = (request: Request) => handleGoogleSession(request, env as SessionEnvironment);
export const POST = (request: Request) => handleGoogleSession(request, env as SessionEnvironment);
