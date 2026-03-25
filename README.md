# 少昊导航台

这是一个部署在 GitHub Pages 上的 Vite 静态导航站，定位为自己长期使用的效率工具。

## 当前能力

- 基于 `src/data/sites.js` 的数据驱动渲染
- 搜索、分类筛选、标签筛选
- 收藏和最近访问，本地存储在浏览器中
- 明暗主题切换，刷新后保持
- GitHub Actions 自动构建并发布到 GitHub Pages

## 本地开发

```bash
npm install
npm run dev
```

## 构建发布

```bash
npm run build
```

构建产物会输出到 `dist/`，推送到 `main` 后会由 GitHub Actions 自动发布。

## 数据维护

站点数据统一维护在 [`src/data/sites.js`](./src/data/sites.js)。

每个站点条目至少包含这些字段：

- `id`
- `name`
- `url`
- `category`
- `tags`
- `icon`
- `description`

