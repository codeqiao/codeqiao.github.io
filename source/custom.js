// Enhance the theme's post index while leaving generated article pages intact.
document.addEventListener('DOMContentLoaded', () => {
  const menuLinks = [...document.querySelectorAll('.menu .ui-collection__item')];
  const currentPath = decodeURI(window.location.pathname).replace(/index\.html$/, '');
  const blogLink = menuLinks.find(link => link.getAttribute('title') === '博客');
  const matchedLink = menuLinks.find(link => {
    if (link === blogLink) return false;
    const path = decodeURI(new URL(link.href).pathname).replace(/index\.html$/, '');
    return currentPath === path || currentPath.startsWith(path.endsWith('/') ? path : `${path}/`);
  }) || blogLink;
  for (const link of menuLinks) {
    const active = link === matchedLink;
    link.classList.toggle('is-active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }

  const list = document.querySelector('.l_body.index .post-list.post');
  if (!list || !document.querySelector('.navbar nav a:first-child.active')) return;

  const intro = document.createElement('section');
  intro.className = 'personal-intro';
  intro.innerHTML = `<div class="intro-copy"><h1>写下来，<br>让想法慢慢生长</h1><p class="intro-description">这里记录学习中的发现、生活里的思考，<br>也分享一些实用的 Skills 和有趣的小工具。</p></div>`;
  list.before(intro);
  const label = document.createElement('div');
  label.className = 'journal-label';
  label.innerHTML = '<h2>最近的记录</h2>';
  list.before(label);
});


