const articles = {
  hello: { title: '你好，世界。欢迎来到我的小站', body: '这是一篇示例文章。\n\n这里可以记录你的日常、想法、项目进展，或者任何想和别人分享的东西。\n\n打开项目中的 app.js，修改这段文字，就能写下属于你的第一篇文章。' },
  curious: { title: '给好奇心留一点空间', body: '这是一篇示例文章。\n\n偶尔停下来，尝试一件新鲜的小事，也许会有意想不到的收获。\n\n把这里换成你的文字，让这个小站慢慢长成你喜欢的样子。' }
};

const dialog = document.querySelector('#article-dialog');
document.querySelectorAll('[data-article]').forEach(button => button.addEventListener('click', () => {
  const article = articles[button.dataset.article];
  const content = dialog.querySelector('.article-content');
  content.replaceChildren();
  const label = document.createElement('p'); label.className = 'section-no'; label.textContent = '示例文章 / JOURNAL';
  const title = document.createElement('h2'); title.textContent = article.title;
  const body = document.createElement('p'); body.className = 'article-body'; body.textContent = article.body;
  content.append(label, title, body); dialog.showModal();
}));
dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());

let answer = Math.floor(Math.random() * 100) + 1;
let attempts = 0;
const guessResult = document.querySelector('#guess-result');
document.querySelector('#guess-form').addEventListener('submit', event => {
  event.preventDefault();
  const value = Number(document.querySelector('#guess').value);
  if (!Number.isInteger(value) || value < 1 || value > 100) { guessResult.textContent = '请输入 1 到 100 之间的整数。'; return; }
  attempts += 1;
  guessResult.textContent = value === answer ? `猜对了！你一共用了 ${attempts} 次。` : `第 ${attempts} 次：${value < answer ? '再大一点 ↑' : '再小一点 ↓'}`;
});
document.querySelector('#restart').addEventListener('click', () => { answer = Math.floor(Math.random() * 100) + 1; attempts = 0; document.querySelector('#guess-form').reset(); guessResult.textContent = '新的一局开始啦。'; });

document.querySelector('#counter').addEventListener('input', event => {
  const text = event.target.value;
  document.querySelector('#chars').textContent = [...text].length;
  document.querySelector('#words').textContent = [...text.replace(/\s/gu, '')].length;
});

const duration = 25 * 60;
let remaining = duration, deadline = 0, timerId = null;
const timer = document.querySelector('#timer'), toggle = document.querySelector('#timer-toggle');
function renderTimer() { timer.textContent = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`; }
function stopTimer() { clearInterval(timerId); timerId = null; toggle.textContent = '开始专注'; }
function tick() { remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000)); renderTimer(); if (!remaining) { stopTimer(); document.querySelector('#timer-status').textContent = '专注时间结束，休息一下吧。'; } }
toggle.addEventListener('click', () => { if (timerId) { tick(); stopTimer(); return; } if (!remaining) remaining = duration; deadline = Date.now() + remaining * 1000; toggle.textContent = '暂停'; timerId = setInterval(tick, 250); });
document.querySelector('#timer-reset').addEventListener('click', () => { stopTimer(); remaining = duration; renderTimer(); document.querySelector('#timer-status').textContent = '计时器已重置。'; });
