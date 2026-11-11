---
title: 猜数字
description: 试试用几次猜中 1 到 100 之间的数字。
order: 1
date: 2026-11-11 10:00:00
menu_id: games
---

<div class="collection-page detail-page">
<p class="collection-intro">我想了一个 1 到 100 之间的整数。每次猜测后，我会告诉你答案更大还是更小。</p>
<div class="collection-heading"><h2>猜猜看</h2></div>
<div class="detail-content"><p class="game-label">输入一个数字</p><form id="guess-form" class="guess-form"><label class="sr-only" for="guess">输入 1 到 100 的整数</label><input id="guess" type="number" min="1" max="100" step="1" placeholder="1 — 100" required><button type="submit" class="site-button">猜一猜 <span aria-hidden="true">↗</span></button></form><p id="guess-result" class="game-feedback" role="status">准备好了就开始吧。</p><button id="guess-reset" class="site-link-button" type="button">重新开始 ↻</button><a class="back-to-list" href="../">← 返回游戏列表</a></div>
</div>
