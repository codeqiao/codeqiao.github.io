// Enhance the post index and add the companion on each page.
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
  if (list && document.querySelector('.navbar nav a:first-child.active')) {
    const intro = document.createElement('section');
    intro.className = 'personal-intro';
    intro.innerHTML = `<div class="intro-copy"><h1>写下来，<br>让想法慢慢生长</h1><p class="intro-description">这里记录学习中的发现、生活里的思考，<br>也分享一些实用的 Skills 和有趣的小工具。</p></div>`;
    list.before(intro);
    const label = document.createElement('div');
    label.className = 'journal-label';
    label.innerHTML = '<h2>最近的记录</h2>';
    list.before(label);
  }

  const pet = document.createElement('button');
  pet.type = 'button';
  pet.className = 'site-pet';
  pet.dataset.mood = 'calm';
  pet.setAttribute('aria-label', '给小猫送爱心');
  pet.innerHTML = `<svg viewBox="0 0 100 96" aria-hidden="true" focusable="false"><g class="pet-tail"><path d="M68 78 C88 89 91 70 82 66" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></g><g class="pet-body"><path d="M29 80 C27 67 32 58 42 55 L59 55 C69 59 73 69 70 80 Z" fill="#fff" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M39 79h8m10 0h7" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><g class="pet-head"><path d="M29 47 L27 21 Q27 17 31 19 L42 26 Q50 23 58 26 L69 19 Q73 17 73 21 L71 47 Q70 61 50 62 Q30 61 29 47Z" fill="#fff" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M33 26l4 3m30-3-4 3" fill="none" stroke="#aaa" stroke-width="2" stroke-linecap="round"/><g class="pet-eyes"><ellipse cx="40" cy="43" rx="2.5" ry="3.5"/><ellipse cx="60" cy="43" rx="2.5" ry="3.5"/></g><path class="pet-smile" d="M46 48 Q50 52 54 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><ellipse class="pet-surprise" cx="50" cy="50" rx="2.8" ry="3.4" fill="none" stroke="currentColor" stroke-width="2"/><path class="pet-happy" d="M36 43q4-4 8 0m12 0q4-4 8 0" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></g></g></svg><span class="site-pet-caption" aria-live="polite">你好</span>`;
  const moods = [
    { name: 'calm', text: '你好' },
    { name: 'happy', text: '很高兴见到你' },
    { name: 'surprised', text: '喵？' }
  ];
  let moodIndex = 0;
  let pet3d;
  pet.addEventListener('click', () => {
    moodIndex = (moodIndex + 1) % moods.length;
    pet.dataset.mood = moods[moodIndex].name;
    pet3d?.setMood(moods[moodIndex].name);
    pet.querySelector('.site-pet-caption').textContent = moods[moodIndex].text;
    pet.querySelector('.pet-heart')?.remove();
    const heart = document.createElement('span');
    heart.className = 'pet-heart';
    heart.setAttribute('aria-hidden', 'true');
    heart.textContent = '♥';
    pet.append(heart);
    setTimeout(() => heart.remove(), 1200);
  });
  document.body.append(pet);
  // Load the 3D renderer on each page; the inline illustration is a fallback.
  const moduleUrl = new URL('generated/pet-3d.js?v=cat-v3', blogLink.href).href;
  import(moduleUrl).then(module => module.mountPet(pet)).then(instance => {
    pet3d = instance;
    if (moodIndex) pet3d.setMood(moods[moodIndex].name);
    window.addEventListener('pagehide', event => { if (!event.persisted) pet3d.dispose(); });
  }).catch(() => { /* Keep the lightweight fallback if WebGL is unavailable. */ });
});


