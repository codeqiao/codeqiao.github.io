const PATH_PATTERN = /^\/(?:\d{4}\/\d{2}\/\d{2}\/[a-z0-9-]+|(?:games|tools|skills)\/[a-z0-9-]+)\/$/;
const VISITOR_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validPath(path) {
  return typeof path === 'string' && path.length <= 160 && PATH_PATTERN.test(path);
}

function validCommentPath(path) {
  return typeof path === 'string' && path.length <= 160 && /^\/(?:[\p{L}\p{N}_-]+\/)*$/u.test(path);
}

async function clientHash(ip, secret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(new Date().toISOString().slice(0, 10) + ':' + ip));
  return Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function readSmallBody(request, limit = 1024) {
  const reader = request.body?.getReader();
  if (!reader) return '';
  const decoder = new TextDecoder();
  let text = '';
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) { await reader.cancel(); return null; }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

function response(data, status, origin) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
    'X-Content-Type-Options': 'nosniff'
  };
  return new Response(status === 204 ? null : JSON.stringify(data), { status, headers });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    if (origin !== env.ALLOWED_ORIGIN) return response({ error: 'forbidden' }, 403, env.ALLOWED_ORIGIN);
    if (request.method === 'OPTIONS') return response(null, 204, origin);
    const url = new URL(request.url);
    try {
      if (url.pathname === '/recent-comments' && request.method === 'GET') {
        const before = url.searchParams.get('before');
        if (before !== null && (!/^\d+$/.test(before) || !Number.isSafeInteger(Number(before)) || Number(before) < 1)) return response({ error: 'invalid_request' }, 400, origin);
        const rows = await env.DB.prepare('SELECT id, path, nickname, body, created_at FROM comments WHERE id < ? ORDER BY id DESC LIMIT 51').bind(before ? Number(before) : Number.MAX_SAFE_INTEGER).all();
        return response({ comments: rows.results.slice(0, 50), hasMore: rows.results.length > 50 }, 200, origin);
      }
      if (url.pathname === '/comment-counts' && request.method === 'GET') {
        const paths = [...new Set(url.searchParams.getAll('path'))];
        if (!paths.length || paths.length > 50 || !paths.every(validCommentPath)) return response({ error: 'invalid_paths' }, 400, origin);
        const placeholders = paths.map(() => '?').join(', ');
        const rows = await env.DB.prepare('SELECT path, COUNT(*) AS count FROM comments WHERE path IN (' + placeholders + ') GROUP BY path').bind(...paths).all();
        return response({ counts: Object.fromEntries(rows.results.map(row => [row.path, row.count])) }, 200, origin);
      }
      if (url.pathname === '/comments' && request.method === 'GET') {
        const path = url.searchParams.get('path');
        const before = url.searchParams.get('before');
        if (!validCommentPath(path) || (before !== null && (!/^\d+$/.test(before) || !Number.isSafeInteger(Number(before)) || Number(before) < 1))) return response({ error: 'invalid_request' }, 400, origin);
        const rows = await env.DB.prepare('SELECT id, nickname, body, created_at FROM comments WHERE path = ? AND id < ? ORDER BY id DESC LIMIT 21').bind(path, before ? Number(before) : Number.MAX_SAFE_INTEGER).all();
        return response({ comments: rows.results.slice(0, 20), hasMore: rows.results.length > 20 }, 200, origin);
      }
      if (url.pathname === '/comments' && request.method === 'POST') {
        if (!env.COMMENT_SECRET || !request.headers.get('CF-Connecting-IP')) return response({ error: 'temporarily_unavailable' }, 503, origin);
        if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) return response({ error: 'invalid_content_type' }, 415, origin);
        const text = await readSmallBody(request, 8192);
        if (text === null) return response({ error: 'too_large' }, 413, origin);
        let body;
        try { body = JSON.parse(text); } catch { return response({ error: 'invalid_json' }, 400, origin); }
        const name = typeof body?.nickname === 'string' ? body.nickname.trim() : '';
        const content = typeof body?.body === 'string' ? body.body.trim() : '';
        if (!validCommentPath(body?.path) || name.length < 1 || name.length > 24 || content.length < 1 || content.length > 1000 || /[\x00-\x1f\x7f]/.test(name) || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(content)) return response({ error: 'invalid_request' }, 400, origin);
        const hash = await clientHash(request.headers.get('CF-Connecting-IP'), env.COMMENT_SECRET);
        const result = await env.DB.prepare("INSERT INTO comments (path, nickname, body, client_hash) SELECT ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM comments WHERE client_hash = ? AND created_at > datetime('now', '-30 seconds'))").bind(body.path, name, content, hash, hash).run();
        if (!result.meta.changes) return response({ error: 'rate_limited' }, 429, origin);
        return response({ ok: true }, 201, origin);
      }
      if (url.pathname === '/views' && request.method === 'POST') {
        await env.DB.prepare("INSERT INTO daily_views (day, views) VALUES (date('now', '+8 hours'), 1) ON CONFLICT(day) DO UPDATE SET views = views + 1").run();
        return response({ recorded: true }, 200, origin);
      }
      if (url.pathname === '/stats' && request.method === 'GET') {
        const views = await env.DB.prepare('SELECT COALESCE(SUM(views), 0) AS value FROM daily_views').first();
        const days = await env.DB.prepare('SELECT day, views FROM daily_views ORDER BY day DESC LIMIT 30').all();
        const totals = await env.DB.prepare('SELECT path, likes FROM like_totals ORDER BY likes DESC, path LIMIT 10').all();
        const total = await env.DB.prepare('SELECT COUNT(*) AS count FROM likes').first();
        return response({ pageviews: views?.value || 0, likes: total.count, days: days.results, pages: totals.results }, 200, origin);
      }
      if (url.pathname === '/like-counts' && request.method === 'GET') {
        const paths = [...new Set(url.searchParams.getAll('path'))];
        if (!paths.length || paths.length > 50 || !paths.every(validPath)) return response({ error: 'invalid_paths' }, 400, origin);
        const placeholders = paths.map(() => '?').join(', ');
        const rows = await env.DB.prepare('SELECT path, likes FROM like_totals WHERE path IN (' + placeholders + ')').bind(...paths).all();
        return response({ counts: Object.fromEntries(rows.results.map(row => [row.path, row.likes])) }, 200, origin);
      }
      if (url.pathname !== '/likes') return response({ error: 'not_found' }, 404, origin);
      if (request.method === 'GET') {
        const path = url.searchParams.get('path');
        if (!validPath(path)) return response({ error: 'invalid_path' }, 400, origin);
        const result = await env.DB.prepare('SELECT COUNT(*) AS count FROM likes WHERE path = ?').bind(path).first();
        return response({ count: result.count }, 200, origin);
      }
      if (request.method === 'POST') {
        if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) return response({ error: 'invalid_content_type' }, 415, origin);
        const bodyText = await readSmallBody(request);
        if (bodyText === null) return response({ error: 'too_large' }, 413, origin);
        let body;
        try { body = JSON.parse(bodyText); } catch { return response({ error: 'invalid_json' }, 400, origin); }
        if (!body || !validPath(body.path) || typeof body.visitor !== 'string' || !VISITOR_PATTERN.test(body.visitor)) return response({ error: 'invalid_request' }, 400, origin);
        const inserted = await env.DB.prepare('INSERT OR IGNORE INTO likes (path, visitor) VALUES (?, ?)').bind(body.path, body.visitor).run();
        const result = await env.DB.prepare('SELECT COUNT(*) AS count FROM likes WHERE path = ?').bind(body.path).first();
        return response({ count: result.count, added: inserted.meta.changes > 0 }, 200, origin);
      }
      return response({ error: 'method_not_allowed' }, 405, origin);
    } catch {
      return response({ error: 'temporarily_unavailable' }, 503, origin);
    }
  }
};
