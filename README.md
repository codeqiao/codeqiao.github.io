# 留白

这是一个基于 Hexo 与 Stellar 的个人网站，包含博客、笔记、Skills、小游戏和实用工具。网站源文件与维护规则均保存在本仓库；面向 AI Agent 的详细约定见 [AGENTS.md](AGENTS.md)。

## 日常更新

- 文章和笔记：在 `source/_posts/` 添加或修改 Markdown。笔记使用 `categories: 笔记`。已有示例可作为格式参考。
- Skills：在 `source/skills/` 新建详情页，并在 `source/skills/index.md` 中添加列表链接。
- 小游戏和工具：在 `source/games/`、`source/tools/` 中维护列表与独立详情页，交互代码在 `source/interactive.js`。
- 网站名称、描述、URL：修改 `_config.yml`；主题配置与导航：修改 `_config.stellar.yml`；外观与首页交互：修改 `source/custom.css` 和 `source/custom.js`。

使用 Node.js 24 和 pnpm 11，在项目根目录执行：

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm serve
```

预览地址由命令输出；按 Ctrl+C 停止。构建结果在 `public/`，不直接修改或提交生成目录。

## 部署和后续迭代

推送到 `main` 后，GitHub Actions 构建并发布到 GitHub Pages。GitHub 仓库的 Settings → Pages → Build and deployment → Source 应选择 **GitHub Actions**。部署状态见 Actions；上线后检查实际页面、导航和交互。

后续可以直接把需求告诉 AI，例如“增加一篇笔记”“调整文章列表”或“修改合并准入规则”。Agent 应遵循 [AGENTS.md](AGENTS.md)，并根据变更运行构建和必要的页面验证。未来明确的测试、审查、合并等准入要求应追加到该文件，不默认虚构阈值或审批流程。

仓库和站点公开，提交前不要放入密码、令牌或不希望公开的私人信息。首次发布前，当前文章和个人介绍均为示例，建议逐步替换。

