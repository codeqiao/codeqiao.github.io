document.addEventListener('DOMContentLoaded', () => {
  const guessForm = document.querySelector('#guess-form');
  if (guessForm) {
    let answer = Math.floor(Math.random() * 100) + 1;
    let attempts = 0;
    const input = document.querySelector('#guess');
    const result = document.querySelector('#guess-result');
    guessForm.addEventListener('submit', event => {
      event.preventDefault();
      const value = Number(input.value);
      if (!Number.isInteger(value) || value < 1 || value > 100) {
        result.textContent = '请输入 1 到 100 之间的整数。';
        return;
      }
      attempts += 1;
      result.textContent = value === answer ? `猜对了！你一共用了 ${attempts} 次。` : `第 ${attempts} 次：${value < answer ? '再大一点' : '再小一点'}。`;
    });
    document.querySelector('#guess-reset').addEventListener('click', () => {
      answer = Math.floor(Math.random() * 100) + 1;
      attempts = 0;
      guessForm.reset();
      result.textContent = '新的一局开始了。';
      input.focus();
    });
  }

  const counter = document.querySelector('#counter');
  if (counter) {
    counter.addEventListener('input', () => {
      document.querySelector('#chars').textContent = [...counter.value].length;
      document.querySelector('#nonspace').textContent = [...counter.value.replace(/\s/gu, '')].length;
    });
  }

  const display = document.querySelector('#timer');
  if (!display) return;
  const duration = 25 * 60;
  const toggle = document.querySelector('#timer-toggle');
  const status = document.querySelector('#timer-status');
  let remaining = duration;
  let deadline = 0;
  let interval = null;
  const render = () => { display.textContent = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`; };
  const stop = () => { clearInterval(interval); interval = null; toggle.textContent = '开始专注'; };
  const tick = () => {
    remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    render();
    if (remaining === 0) { stop(); status.textContent = '专注时间结束，休息一下吧。'; }
  };
  toggle.addEventListener('click', () => {
    if (interval !== null) { tick(); stop(); return; }
    if (remaining === 0) remaining = duration;
    deadline = Date.now() + remaining * 1000;
    toggle.textContent = '暂停';
    interval = setInterval(tick, 250);
  });
  document.querySelector('#timer-reset').addEventListener('click', () => {
    stop(); remaining = duration; render(); status.textContent = '计时器已重置。';
  });
});
