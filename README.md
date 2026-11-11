# 留白

这是一个基于 Hexo 与 Stellar 的个人网站，包含博客、笔记、Skills、小游戏和实用工具。网站源文件与维护规则均保存在本仓库；面向 AI Agent 的详细约定见 [AGENTS.md](AGENTS.md)。

## 日常更新

- 文章和笔记：在 `source/_posts/` 添加或修改 Markdown。笔记使用 `categories: 笔记`。已有示例可作为格式参考。
- Skills、小游戏和工具：分别在 `source/skills/`、`source/games/`、`source/tools/` 下新增一个小写英文目录，目录中放 `index.md`。构建时根据详情页的元信息自动生成对应列表，无需修改栏目首页。交互代码可放在 `source/interactive.js` 或按功能拆分。
- 网站名称、描述、URL：修改 `_config.yml`；主题配置与导航：修改 `_config.stellar.yml`；外观与首页交互：修改 `source/custom.css` 和 `source/custom.js`。
- 首页 3D 小猫：模型文件与许可信息在 `source/assets/`，动画代码在 `client/pet-3d.js`；构建时生成按需加载的浏览器文件，不支持 WebGL 时会显示简洁的备用图形。

使用 Node.js 24 和 pnpm 11，在项目根目录执行：

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm build
pnpm serve
```

预览地址由命令输出；按 Ctrl+C 停止。构建结果在 `public/`，不直接修改或提交生成目录。

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

## 部署和后续迭代

推送到 `main` 后，GitHub Actions 构建并发布到 GitHub Pages。GitHub 仓库的 Settings → Pages → Build and deployment → Source 应选择 **GitHub Actions**。部署状态见 Actions；上线后检查实际页面、导航和交互。

后续可以直接把需求告诉 AI，例如“增加一篇笔记”“加入这个 Skill”或“修改合并准入规则”。Agent 应遵循 [AGENTS.md](AGENTS.md)，根据变更运行测试、构建和必要的页面验证，并根据实际反馈改进流程。未来明确的测试、审查、合并等准入要求应追加到该文件，并尽可能实现自动检查；不会自行放宽已确定的要求。

仓库和站点公开，提交前不要放入密码、令牌或不希望公开的私人信息。首次发布前，当前文章和个人介绍均为示例，建议逐步替换。

