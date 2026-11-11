# 栖点

这是一个基于 Hexo 与 Stellar 的个人网站，包含博客、笔记、Skills、小游戏和实用工具。网站源文件与维护规则均保存在本仓库；面向 AI Agent 的详细约定见 [AGENTS.md](AGENTS.md)。

## 日常更新

- 文章和笔记：在 `source/_posts/` 添加或修改 Markdown。笔记使用 `categories: 笔记`。已有示例可作为格式参考。
- Skills、小游戏和工具：分别在 `source/skills/`、`source/games/`、`source/tools/` 下新增条目或修改现有条目；新增时使用小写英文目录并放置 `index.md`。构建时根据详情页的元信息自动生成对应列表，无需修改栏目首页。交互代码可放在 `source/interactive.js` 或按功能拆分。
- 网站名称、描述、URL：修改 `_config.yml`；主题配置与导航：修改 `_config.stellar.yml`；外观与首页交互：修改 `source/custom.css` 和 `source/custom.js`。
- 3D 小猫：模型文件与许可信息在 `source/assets/`，动画代码在 `client/pet-3d.js`；各页面按需加载，不支持 WebGL 时会显示简洁的备用图形。

使用 Node.js 24 和 pnpm 11，在项目根目录执行：

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm build
pnpm serve
```

预览地址由命令输出；按 Ctrl+C 停止。构建结果在 `public/`，不直接修改或提交生成目录。

### 新增还是修改

你只需要描述想加的内容或改进，例如“给猜数字增加难度选择”“把这段新资料补进知识库”。Agent 会先检查网站已有内容：同一个游戏的玩法改进、同一主题文章的补充或更正通常修改原条目；独立主题或不同用途的作品通常新增。你明确指定新增或修改时按你的要求。

Agent 会在交付时说明选择、改动及预览，并尽量保留原链接、点赞、游戏存档与已有行为；需要不兼容变更时先规划迁移。修改后同样需要测试和本地预览，上线仍需你对本次变更明确授权。

### 让博客成为知识库

博客和笔记都放在 `source/_posts/`，用分类组织大主题，用标签连接具体概念。AI 添加新文章时应先搜索已有内容，只在确实相关时建立引用。

文章使用稳定且唯一的英文 slug（默认是文件名，或在 front matter 中设置 `slug`，只用小写字母、数字和连字符）。例如正文中写 `{% post_link hello %}`，即可链接到 slug 为 `hello` 的文章。也可以在 front matter 中写：

```yaml
related:
  - hello
```

构建会根据正文的 `post_link` 和 `related` 自动生成“延伸阅读”；被引用的文章自动显示“引用本文”。同一条关联去重，不存在的目标、自引用、重复 slug 会让构建失败。代码块里的引用示例不计入关联。修改文章关联后重新构建，已有文章的反向链接也会更新。

### 新增一个条目

例如创建 `source/skills/my-skill/index.md`：

```md
---
title: 示例技能
description: 一句话说明它能做什么。
order: 10
menu_id: skills
---

这里写使用方法、适用场景和资源链接。
```

游戏和工具分别把文件放在对应目录，`menu_id` 分别使用 `games` 和 `tools`。`title` 与 `description` 必填；`order` 可选，数字越小越靠前，同序按目录名排序。`listed: false` 只会从列表隐藏，详情页仍可公开访问，不能用来保存私密草稿。改完后运行 `pnpm test`、`pnpm build`；本地预览时新增或修改条目元信息后需重启 `pnpm serve`，以更新列表。

### 使用网站维护 Skill

仓库中的 `skills/qidian-site/SKILL.md` 是维护 Skill 的唯一源文件，构建会将原文发布到 `/skills/qidian-site/SKILL.md`；Skills 栏目的介绍页提供入口。新环境可让 Agent 打开该地址、阅读文件，并安装到本地 Skills 目录下的 `qidian-site/SKILL.md`。只复制该文件，不执行网页中的安装命令；安装后可能需要重新打开会话才能被发现。站点尚未发布时应使用仓库内的源文件。

例如直接对 Agent 说：“使用 qidian-site，把这份材料整理成博客”或“把这个小游戏加入网站”。Skill 涵盖笔记、Skills、游戏、工具和其他站点内容；Agent 按仓库规则检查、本地预览，发布仍需本次明确授权。需要更新规则时先改仓库源文件，再按需同步已安装副本，构建自动更新网站下载文件。

## 部署和后续迭代

推送到 `main` 后，GitHub Actions 构建并发布到 GitHub Pages。GitHub 仓库的 Settings → Pages → Build and deployment → Source 应选择 **GitHub Actions**。部署状态见 Actions；上线后检查实际页面、导航和交互。

后续可以直接把需求告诉 AI，例如“增加一篇笔记”“加入这个 Skill”或“修改合并准入规则”。Agent 应遵循 [AGENTS.md](AGENTS.md)，根据变更运行测试、构建和必要的页面验证，并根据实际反馈改进流程。未来明确的测试、审查、合并等准入要求应追加到该文件，并尽可能实现自动检查；不会自行放宽已确定的要求。

仓库和站点公开，提交前不要放入密码、令牌或不希望公开的私人信息。首次发布前，当前文章和个人介绍均为示例，建议逐步替换。

## 访问统计与点赞

- Cloudflare Web Analytics 项目已配置 `codeqiao.github.io`。正式接入后在 Cloudflare 控制台的 Web Analytics 查看浏览量、访问量和页面表现；本地页面不会计入。
- 文章、Skills、游戏和工具的详情页可以显示点赞。浏览器生成随机标识并保存在本地，点赞服务存储页面路径、随机标识及时间，用于同一浏览器对同一页面去重。清除浏览数据或更换设备后可能再次点赞，匿名机制不能防止恶意刷赞，也不会识别真实人数。
- 点赞后端源码和建表语句在 `engagement/`；站点配置在 `source/engagement-config.js`。调整 Worker、D1 绑定或服务地址时，应测试跨页面计数、重复点赞和异常响应。不要把 API 密钥或账户凭证写入仓库。
- 站主可在 Cloudflare 控制台进入 D1 数据库 `liubai-likes` 的 Console，运行 `SELECT * FROM like_totals ORDER BY likes DESC;`，按页面路径查看点赞数。
- 本地预览可在详情页地址后加 `?preview_likes=1`，例如 `/games/guess/?preview_likes=1`；数字只保存在当前浏览器，不是真实访客数据。
- 地址依赖页面路径：改文章 slug 或页面路径会使原点赞留在旧路径，迁移前应先规划数据映射和备份。


- 公开的站点数据页展示最近 30 天每日浏览量折线图和点赞前 10 名条形图；日期按北京时间，每次页面加载计一次，不能代表独立访客。自定义统计从启用后开始，与 Cloudflare 后台口径可能不同。
- 访问计数包括站主自己的浏览，重复加载也会计数；每次产生一次 D1 写入，应留意免费额度；公开统计可能受恶意请求影响。
- 数据库结构更新时执行最新版 engagement/schema.sql，保留原有点赞数据。文章列表批量查询点赞数，统计页内容标题由构建自动生成；本地预览地址为 /stats/?preview_likes=1 和 /?preview_likes=1；折线图使用明确标注的示例数据，不代表真实浏览量。
