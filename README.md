# 少昊导航台

这是一个部署在 GitHub Pages 上的 Vite 静态导航站，定位为自己长期使用的效率工具。

## 当前能力

- 基于 `src/data/sites.js` 和 `src/data/posts.js` 的数据驱动渲染
- 搜索、分类筛选、标签筛选
- 导航首页工作台：本地待办、快速便签、时间卡片
- 收藏和最近访问，本地存储在浏览器中
- 明暗主题切换，刷新后保持
- GitHub Actions 自动构建并发布到 GitHub Pages
- 站内博客分页、文章详情、文章搜索和标签筛选
- 基础 SEO：动态 title/description/OG、RSS、sitemap、robots.txt

## 本地开发

```bash
npm install
npm run dev
```

## 测试

```bash
npm test
```

当前回归测试覆盖：

- 站点和博客数据结构校验
- 搜索匹配和评分逻辑
- RSS、sitemap、robots.txt 生成

## 构建发布

```bash
npm run build
```

构建产物会输出到 `dist/`，推送到 `main` 后会由 GitHub Actions 自动发布。

## 数据维护

站点数据统一维护在 [`src/data/sites.js`](./src/data/sites.js)，博客文章维护在 [`src/data/posts.js`](./src/data/posts.js)。

每个站点条目至少包含这些字段：

- `id`
- `name`
- `url`
- `category`
- `tags`
- `icon`
- `description`

## 本地内容管理

启动本地管理器：

```bash
npm run admin
```

启动后在浏览器打开：`http://127.0.0.1:3210`

这个页面只在本机运行，用来编辑：

- `src/data/sites.js`
- `src/data/posts.js`

可以在本地管理器里完成这些操作：

- 新建、编辑、删除网站和博客文章
- 导出当前分类 JSON
- 导出整站备份 JSON
- 导入 JSON 备份恢复网站或博客
- 导入浏览器书签 HTML 到网站列表（自动跳过重复链接）
- 网站体检：检查重复链接、批量检测死链 / 异常链接

导入后不会自动写回文件，仍然需要点击“保存当前分类”。
