(() => {
  const endpoint = window.siteEngagement?.likesEndpoint;
  if (!endpoint) return;
  const preview = ['localhost', '127.0.0.1'].includes(location.hostname) && new URLSearchParams(location.search).get('preview_comments') === '1';
  const previewKey = 'qidian-comments-preview';
  async function request(url, options = {}) {
    if (!preview) return fetch(url, options);
    const items = JSON.parse(localStorage.getItem(previewKey) || '[]');
    const target = new URL(url);
    if (target.pathname === '/comments' && options.method === 'POST') {
      const input = JSON.parse(options.body);
      items.push({ ...input, id: Date.now(), created_at: new Date().toISOString().slice(0, 19).replace('T', ' ') });
      localStorage.setItem(previewKey, JSON.stringify(items));
      return new Response(JSON.stringify({ ok: true }), { status: 201 });
    }
    if (target.pathname === '/comment-counts') {
      const counts = {};
      for (const item of items) counts[item.path] = (counts[item.path] || 0) + 1;
      return new Response(JSON.stringify({ counts }));
    }
    const before = Number(target.searchParams.get('before') || Number.MAX_SAFE_INTEGER);
    const filtered = items.filter(item => item.path === target.searchParams.get('path') && item.id < before).reverse();
    return new Response(JSON.stringify({ comments: filtered.slice(0, 20), hasMore: filtered.length > 20 }));
  }
  const pathOf = value => decodeURI(new URL(value, location.href).pathname).replace(/index\.html$/, '').replace(/\/?$/, '/');
  const contentPattern = /^\/(?:\d{4}\/\d{2}\/\d{2}\/[a-z0-9-]+|(?:games|tools|skills)\/[a-z0-9-]+)\/$/;
  const pagePattern = /^\/(?:[\p{L}\p{N}_-]+\/)*$/u;
  const path = pathOf(location.href);
  const route = path => new URL(path, endpoint);
  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  async function showCounts() {
    const groups = new Map();
    for (const card of document.querySelectorAll('.post-list.post a.post-card, .item-list a.item-row')) {
      const url = new URL(card.href, location.href);
      const itemPath = pathOf(url.href);
      if (url.origin !== location.origin || !contentPattern.test(itemPath)) continue;
      if (!groups.has(itemPath)) groups.set(itemPath, []);
      groups.get(itemPath).push(card);
    }
    const paths = [...groups.keys()];
    for (let i = 0; i < paths.length; i += 50) {
      const url = route('/comment-counts');
      paths.slice(i, i + 50).forEach(itemPath => url.searchParams.append('path', itemPath));
      try {
        const res = await request(url);
        if (!res.ok) continue;
        const { counts } = await res.json();
        for (const itemPath of paths.slice(i, i + 50)) {
          const count = counts[itemPath] || 0;
          if (!Number.isSafeInteger(count) || count < 0) continue;
          for (const card of groups.get(itemPath)) {
            const container = card.querySelector('.meta') || card.querySelector('.item-content');
            if (!container) continue;
            const label = element('span', 'comment-count', '评论 ' + count);
            label.setAttribute('aria-label', count + ' 条评论');
            container.append(label);
          }
        }
      } catch { /* Do not show misleading counts when the service is unavailable. */ }
    }
  }
  showCounts();

  if (!pagePattern.test(path)) return;
  const article = document.querySelector('.l_main article.md-text.content');
  const anchor = article || document.querySelector('.l_main .post-list.post') || document.querySelector('.l_main footer');
  if (!anchor) return;
  const section = element('section', 'comments-section');
  section.id = 'comments';
  const heading = element('h2', 'comments-title', '参与讨论');
  const intro = element('p', 'comments-intro', preview ? '本地预览：评论仅保存在当前浏览器。' : '提出建议、分享想法或报告问题，一起完善这里。评论公开，请勿填写隐私信息。');
  const form = element('form', 'comments-form');
  const nickLabel = element('label', '', '昵称');
  const nick = element('input', 'comments-nickname');
  nick.name = 'nickname'; nick.maxLength = 24; nick.required = true; nick.autocomplete = 'nickname';
  nickLabel.append(nick);
  const bodyLabel = element('label', '', '评论');
  const body = element('textarea', 'comments-body');
  body.name = 'body'; body.maxLength = 1000; body.required = true; body.rows = 4;
  body.placeholder = '写下你的想法或建议…';
  bodyLabel.append(body);
  const submit = element('button', 'comments-submit', '发表评论'); submit.type = 'submit';
  const status = element('p', 'comments-status'); status.setAttribute('role', 'status');
  form.append(nickLabel, bodyLabel, submit, status);
  const list = element('div', 'comments-list');
  const more = element('button', 'comments-more', '加载更多'); more.type = 'button'; more.hidden = true;
  section.append(heading, intro, form, list, more);
  if (article) article.append(section); else if (anchor.matches('footer')) anchor.before(section); else anchor.after(section);
  if (location.hash === '#comments') section.scrollIntoView();
  let cursor = null;
  let busy = false;
  async function load(reset = false) {
    if (busy) return;
    busy = true; more.disabled = true;
    try {
      const url = route('/comments'); url.searchParams.set('path', path);
      if (!reset && cursor) url.searchParams.set('before', cursor);
      const res = await request(url, { cache: 'no-store' });
      if (!res.ok) throw new Error('request failed');
      const data = await res.json();
      if (reset) { list.replaceChildren(); cursor = null; }
      if (!data.comments.length && !cursor) list.append(element('p', 'comments-empty', '还没有评论，欢迎留下第一条建议。'));
      for (const item of data.comments) {
        const row = element('article', 'comment-item');
        const head = element('div', 'comment-head');
        const name = element('strong', '', item.nickname);
        const time = element('time', '', item.created_at.slice(0, 16).replace('T', ' ') + ' UTC');
        head.append(name, time);
        row.append(head, element('p', 'comment-body', item.body));
        list.append(row); cursor = String(item.id);
      }
      more.hidden = !data.hasMore;
    } catch { status.textContent = '评论暂时无法加载，请稍后再试。'; }
    finally { busy = false; more.disabled = false; }
  }
  more.addEventListener('click', () => load());
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const nickname = nick.value.trim(); const text = body.value.trim();
    if (!nickname || !text) { status.textContent = '请填写昵称和评论。'; return; }
    submit.disabled = true; status.textContent = '正在发送…';
    try {
      const res = await request(route('/comments'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path, nickname, body: text }) });
      if (res.status === 429) { status.textContent = '发送太快了，请稍等片刻再试。'; return; }
      if (!res.ok) throw new Error('request failed');
      body.value = ''; status.textContent = '评论已发布。';
      await load(true);
    } catch { status.textContent = '发送失败，请稍后再试。'; }
    finally { submit.disabled = false; }
  });
  load(true);
})();
