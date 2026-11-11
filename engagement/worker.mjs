const PATH_PATTERN = /^\/(?:\d{4}\/\d{2}\/\d{2}\/[a-z0-9-]+|(?:games|tools|skills)\/[a-z0-9-]+)\/$/;
const VISITOR_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validPath(path) {
  return typeof path === 'string' && path.length <= 160 && PATH_PATTERN.test(path);
}

async function readSmallBody(request) {
  const reader = request.body?.getReader();
  if (!reader) return '';
  const decoder = new TextDecoder();
  let text = '';
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 1024) { await reader.cancel(); return null; }
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
