(() => {
  const config = window.siteEngagement || {};
  const isLive = location.hostname === 'codeqiao.github.io';
  if (isLive && config.analyticsToken) {
    const beacon = document.createElement('script');
    beacon.type = 'module';
    beacon.src = 'https://static.cloudflareinsights.com/beacon.min.js';
    beacon.setAttribute('data-cf-beacon', JSON.stringify({ token: config.analyticsToken }));
    document.head.append(beacon);
  }

  const localPreview = ['localhost', '127.0.0.1'].includes(location.hostname)
    && new URLSearchParams(location.search).get('preview_likes') === '1';
  const previewPrefix = 'liubai-like-preview:';
  const previewPaths = () => Object.keys(localStorage).filter(key => key.startsWith(previewPrefix) && key !== previewPrefix + 'visitor' && localStorage.getItem(key) === '1').map(key => key.slice(previewPrefix.length));
  const api = route => new URL(route, config.likesEndpoint);
  if (!localPreview && config.likesEndpoint && isLive) fetch(api('/views'), { method: 'POST', keepalive: true }).catch(() => {});

  async function showListCounts() {
    if (!localPreview && !config.likesEndpoint) return;
    const grouped = new Map();
    for (const card of document.querySelectorAll('.post-list.post a.post-card')) {
      const url = new URL(card.href, location.href);
      const path = decodeURI(url.pathname).replace(/index\.html$/, '').replace(/\/?$/, '/');
      if (url.origin !== location.origin || !/^\/\d{4}\/\d{2}\/\d{2}\/[a-z0-9-]+\/$/.test(path)) continue;
      if (!grouped.has(path)) grouped.set(path, []);
      grouped.get(path).push(card);
    }
    const paths = [...grouped.keys()];
    if (!paths.length) return;
    try {
      const counts = {};
      if (localPreview) previewPaths().forEach(path => { counts[path] = 1; });
      else for (let i = 0; i < paths.length; i += 50) {
        const url = api('/like-counts');
        paths.slice(i, i + 50).forEach(path => url.searchParams.append('path', path));
        const result = await fetch(url);
        if (!result.ok) throw new Error('request failed');
        Object.assign(counts, (await result.json()).counts);
      }
      for (const [path, cards] of grouped) {
        const count = counts[path] || 0;
        if (!Number.isSafeInteger(count) || count < 0) continue;
        for (const card of cards) {
          const meta = card.querySelector('.meta');
          if (!meta) continue;
          const label = document.createElement('span');
          label.className = 'list-like-count';
          label.textContent = '♡ ' + count;
          label.setAttribute('aria-label', count + ' 次点赞');
          meta.append(label);
        }
      }
    } catch { /* Hide counts on failure rather than showing false zeros. */ }
  }

  async function showStats() {
    const target = document.querySelector('[data-site-stats]');
    if (!target) return;
    const message = target.querySelector('[data-stats-message]');
    try {
      let data;
      if (localPreview) {
        const paths = previewPaths();
        const sample = [3, 7, 5, 9, 6, 12, 8, 15, 11, 16, 13, 20];
        const today = new Date(Date.now() + 8 * 60 * 60 * 1000);
        today.setUTCHours(0, 0, 0, 0);
        const days = sample.map((views, index) => ({ day: new Date(today.getTime() - (sample.length - 1 - index) * 86400000).toISOString().slice(0, 10), views }));
        data = { pageviews: null, likes: paths.length, days, pages: paths.slice(0, 10).map(path => ({ path, likes: 1 })) };
        message.textContent = '本地预览：折线图为示例数据；点赞来自当前浏览器。';
      } else if (!config.likesEndpoint) {
        message.textContent = '统计服务尚未启用。';
        return;
      } else {
        const result = await fetch(api('/stats'), { cache: 'no-store' });
        if (!result.ok) throw new Error('request failed');
        data = await result.json();
        message.textContent = '浏览量从统计功能启用后开始累计，重复访问也会计入。';
      }
      const chart = target.querySelector('[data-daily-views]');
      if (data.days.length) {
        const byDate = new Map(data.days.map(day => [day.day, day.views]));
        const endDate = new Date(Date.now() + 8 * 60 * 60 * 1000);
        endDate.setUTCHours(0, 0, 0, 0);
        const days = Array.from({ length: 30 }, (_, index) => {
          const date = new Date(endDate.getTime() - (29 - index) * 86400000).toISOString().slice(0, 10);
          return { date, views: byDate.get(date) || 0 };
        });
        const max = Math.max(1, ...days.map(day => day.views));
        const ceiling = Math.ceil(max / 4) * 4;
        const renderChart = () => {
        const width = Math.max(220, Math.floor(chart.clientWidth));
        const left = Math.max(42, String(ceiling).length * 7 + 12);
        const right = width - 20;
        const x = index => left + (right - left) * index / 29;
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 ' + width + ' 250');
        svg.setAttribute('role', 'img');
        svg.setAttribute('aria-label', '最近 30 天每日页面浏览量折线图');
        const add = (name, attrs, text) => {
          const element = document.createElementNS('http://www.w3.org/2000/svg', name);
          Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, value));
          if (text !== undefined) element.textContent = text;
          svg.append(element);
          return element;
        };
        for (let i = 0; i <= 4; i++) {
          const y = 20 + i * 47;
          add('line', { x1: left, y1: y, x2: right, y2: y, class: 'chart-grid' });
          add('text', { x: left - 8, y: y + 4, 'text-anchor': 'end', class: 'chart-axis' }, String(ceiling * (4 - i) / 4));
        }
        const points = days.map((day, i) => x(i) + ',' + (208 - day.views / ceiling * 188)).join(' ');
        add('polyline', { points, class: 'chart-line' });
        days.forEach((day, i) => {
          const dot = add('circle', { cx: x(i), cy: 208 - day.views / ceiling * 188, r: 3, class: 'chart-dot' });
          const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
          title.textContent = day.date + '：' + day.views + ' 次浏览';
          dot.append(title);
          if ((width < 450 ? [0, 14, 29] : [0, 7, 14, 21, 29]).includes(i)) add('text', { x: x(i), y: 234, 'text-anchor': 'middle', class: 'chart-axis' }, day.date.slice(5));
        });
        chart.replaceChildren(svg);
        };
        renderChart();
        if ('ResizeObserver' in window) new ResizeObserver(renderChart).observe(chart);
      }
      let titles = {};
      try { const res = await fetch('/stats/titles.json'); if (res.ok) titles = await res.json(); } catch { /* Show paths if the index cannot be loaded. */ }
      const ranking = target.querySelector('[data-liked-pages]');
      if (data.pages.length) ranking.replaceChildren();
      const maxLikes = Math.max(1, ...data.pages.map(page => page.likes));
      for (const page of data.pages) {
        const item = document.createElement('div');
        item.className = 'ranking-item';
        const header = document.createElement('div');
        header.className = 'ranking-header';
        const link = document.createElement('a');
        link.href = page.path;
        link.textContent = titles[page.path] || page.path;
        const count = document.createElement('span');
        count.textContent = page.likes.toLocaleString();
        header.append(link, count);
        const track = document.createElement('div');
        track.className = 'ranking-track';
        const bar = document.createElement('div');
        bar.className = 'ranking-bar';
        bar.style.width = (page.likes / maxLikes * 100) + '%';
        track.append(bar);
        item.append(header, track);
        ranking.append(item);
      }
    } catch { message.textContent = '暂时无法读取统计数据，请稍后再试。'; }
  }
  showListCounts();
  showStats();

  const path = decodeURI(location.pathname).replace(/index\.html$/, '').replace(/\/?$/, '/');
  const eligible = /^\/(?:\d{4}\/\d{2}\/\d{2}\/[a-z0-9-]+|(?:games|tools|skills)\/[a-z0-9-]+)\/$/.test(path);
  if (!eligible || (!localPreview && !config.likesEndpoint)) return;
  const content = document.querySelector('.l_main article.md-text.content');
  if (!content) return;

  const section = document.createElement('section');
  section.className = 'like-section';
  const label = document.createElement('span');
  label.className = 'like-label';
  label.textContent = localPreview ? '喜欢这篇内容？（本地预览）' : '喜欢这篇内容？';
  const button = document.createElement('button');
  button.className = 'like-button';
  button.type = 'button';
  button.disabled = true;
  const icon = document.createElement('span');
  icon.className = 'like-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = '♡';
  const text = document.createElement('span');
  text.textContent = '加载中';
  button.append(icon, text);
  const status = document.createElement('span');
  status.className = 'like-status';
  status.setAttribute('role', 'status');
  section.append(label, button, status);
  content.append(section);

  const storagePrefix = localPreview ? 'liubai-like-preview:' : 'liubai-like:';
  const likedKey = `${storagePrefix}${path}`;
  let liked;
  let visitor;
  try {
    liked = localStorage.getItem(likedKey) === '1';
    visitor = localStorage.getItem(`${storagePrefix}visitor`);
    if (!visitor) {
      visitor = crypto.randomUUID();
      localStorage.setItem(`${storagePrefix}visitor`, visitor);
    }
  } catch {
    text.textContent = '暂不可用';
    status.textContent = '点赞需要浏览器允许本地存储。';
    return;
  }

  const show = count => {
    icon.textContent = liked ? '♥' : '♡';
    text.textContent = `${liked ? '已赞' : '赞'} ${count}`;
    button.disabled = liked;
    button.setAttribute('aria-pressed', String(liked));
  };
  const setError = message => { text.textContent = '暂不可用'; button.disabled = true; status.textContent = message; };
  const endpoint = config.likesEndpoint ? new URL('/likes', config.likesEndpoint) : null;

  async function initialize() {
    try {
      if (localPreview) { show(liked ? 1 : 0); return; }
      endpoint.searchParams.set('path', path);
      const result = await fetch(endpoint, { cache: 'no-store' });
      if (!result.ok) throw new Error('request failed');
      const body = await result.json();
      if (!Number.isSafeInteger(body.count) || body.count < 0) throw new Error('invalid response');
      show(body.count);
    } catch { setError('暂时无法读取点赞数，请稍后再试。'); }
  }

  button.addEventListener('click', async () => {
    if (liked || button.disabled) return;
    button.disabled = true;
    try {
      let count = 1;
      if (!localPreview) {
        const result = await fetch(new URL('/likes', config.likesEndpoint), {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path, visitor })
        });
        if (!result.ok) throw new Error('request failed');
        const body = await result.json();
        if (!Number.isSafeInteger(body.count) || body.count < 0) throw new Error('invalid response');
        count = body.count;
      }
      liked = true;
      try { localStorage.setItem(likedKey, '1'); } catch { /* The server still recorded the vote. */ }
      show(count);
      status.textContent = localPreview ? '预览点赞仅保存在本机。' : '感谢你的喜欢。';
    } catch {
      button.disabled = false;
      status.textContent = '点赞没有成功，请稍后再试。';
    }
  });
  initialize();
})();
