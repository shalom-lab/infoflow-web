# infoflow-web

Vite + React + TypeScript 的 InfoFlow Prompt 卡片站。从私有仓 `shalom-lab/InfoFlow` 拉取 `data/data_all_prompts.json`，以卡片网格展示效果图、标题/标签与完整提示词。

密钥只放在浏览器 `localStorage`，不会写入代码、不会提交。

## GitHub Pages

- **Live URL**: https://shalom-lab.github.io/infoflow-web/
- Vite `base` 设为 `/infoflow-web/`（项目站点路径）
- 通过 GitHub Actions（`.github/workflows/deploy-pages.yml`）在 push 到 `main` 时部署
- 仓库：**Settings → Pages → Build and deployment → Source: GitHub Actions**

## 快速开始

```bash
cd infoflow-web
npm install
npm run dev
```

生产构建：

```bash
npm run build
npm run preview
```

## BYOK 设置（localStorage）

应用简称 / slug：`infoflow`。密钥与仓库用**扁平、带连字符**的两个键，**不是** JSON blob：

| Key | Value |
| --- | --- |
| `gh-infoflow-repo` | 单个字符串 `owner/repo`（建议 `shalom-lab/InfoFlow`；不要拆成两个 key） |
| `gh-infoflow-token` | GitHub PAT（BYOK） |

**可 Settings 填写，也可事先写入 localStorage；启动会自动读。**

1. 打开 **/settings**（或首页「设置」）
2. 填写仓库 `owner/repo`（单个输入框），粘贴 GitHub PAT（密码框）
3. **测试连接**（可选）→ **保存**（`setItem`）
4. **清除** 会确认后 `removeItem` 两个键；已保存 token 仅遮罩显示末 4 位

启动时静默读取上述两个键到 React state，不弹窗打断：

- 已设置：Settings 显示「已保存」；首页用 Contents API 拉取完整提示词，并用带 Authorization 的 raw Contents 请求显示私有效果图
- 未设置：显示引导横幅与演示 fixture（`public/fixtures/prompts.sample.json`），不要空白死页

切仓库时在 API 调用处再按 `/` 拆分 `owner` / `name`。不要把 PAT 写进仓库、`.env` 或 Actions 给浏览器用。

### PAT 权限（Scopes）

| Token 类型 | 需要的权限 |
| --- | --- |
| Fine-grained | Repository → **Contents: Read-only**（或更高）；选中 InfoFlow 私有仓 |
| Classic | 勾选 **`repo`**（私有仓） |

## 功能

- **响应式卡片网格**：大图为主（`object-fit: contain`）、右上角张数角标、`wechat_title`、keywords 胶囊、大按钮「查看详情」
- **详情 Modal**：宽屏左右布局（左图可切换 / 右 prompt 原文可滚动 + 复制提示词）；窄屏上下堆叠
- **搜索**：标题 / 关键词 / 提示词正文；顶部热门关键词筛选
- **无图占位**：约定路径 `infoflow-data/Images/Prompt/{prompt_id}-N.png`（从 0 起），404 时优雅占位；IntersectionObserver 懒加载，避免对 396 条串行打爆 API
- **私有图**：浏览器直连 `api.github.com` Contents raw（`Accept: application/vnd.github.raw` + Bearer token），转 blob URL 显示；**不用**裸 `raw.githubusercontent.com`
- **中文 UI**

数据文件（非 BYOK 键，应用内默认）：分支 `master`、路径 `data/data_all_prompts.json`。

## 本地缓存（IndexedDB）

- 库名：`infoflow-web`
- 对象仓：`prompts`（按 `owner/repo` 存列表 + `sha` / `etag` / `updatedAt`）、`images`（效果图 Blob，键 `repo|path`）
- 启动：有缓存先展示 → 后台重新拉取 Contents；用文件 sha 对比，有变化才更新 UI 与 IDB（并保存 etag 元数据）
- Settings：**清除缓存**；首页 / Settings 链接触发 **强制刷新**
- PAT 仍只在 `localStorage`，不进 IndexedDB

## 已知限制

- 约 139/396 条有 `{prompt_id}-N.png` 约定命名效果图；更早条目图片 ID 可能与 `prompt_id` 不一致，当前不额外拉取每条 md（避免 API 打爆），这些卡会显示占位
- GitHub API 有速率限制；大量卡片同时滚入视口时图片会排队拉取
- 演示 fixture 不含真实私有图片

## App slug

应用标识 / slug：`infoflow`（localStorage 键前缀 `gh-infoflow-*`）。
