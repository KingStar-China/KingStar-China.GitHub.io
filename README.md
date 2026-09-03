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

## Supabase 云端同步

项目支持可选的 Supabase 同步。未配置时仍然使用浏览器本地存储；配置后可以在首页“个人工作台”的“云端同步”卡片里登录，同步收藏、最近访问、快速便签和待办。

### 1. 创建 Supabase 项目

在 Supabase 新建项目后，到 SQL Editor 执行：

```sql
-- 文件位置：supabase/nav_user_state.sql
```

也可以直接复制 [`supabase/nav_user_state.sql`](./supabase/nav_user_state.sql) 的全部内容执行。

如果还需要网站访问统计，继续执行：

```sql
-- 文件位置：supabase/site_visit_events.sql
```

也可以直接复制 [`supabase/site_visit_events.sql`](./supabase/site_visit_events.sql) 的全部内容执行。前端会匿名写入 pageview 事件，不向公开访客开放统计明细读取。可以在 Supabase SQL Editor 用下面的聚合查看每日访问量：

```sql
select
  date_trunc('day', occurred_at) as day,
  count(*) as views,
  count(distinct visitor_id) as visitors
from public.site_visit_events
group by day
order by day desc;
```

### 2. 配置前端环境变量

复制示例环境变量：

```powershell
Copy-Item .env.example .env.local
```

把 `.env.local` 改成自己的 Supabase 信息：

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

这两个值在 Supabase 项目的 `Project Settings -> API` 里可以找到。只填写 `anon public` key，不要把 `service_role` key 放进前端项目。

### 3. 本地验证

```bash
npm run dev
```

打开首页底部“个人工作台”的“云端同步”卡片，先注册或登录。Supabase 如果开启邮箱确认，需要先完成邮件确认后再登录。

### 4. GitHub Pages 线上配置

如果要让线上站点也开启同步，在 GitHub 仓库的 `Settings -> Secrets and variables -> Actions -> Variables` 添加：

```bash
VITE_SUPABASE_URL=https://zfvwrnuenurxauvvfsuw.supabase.co
VITE_SUPABASE_ANON_KEY=你的 anon public key
```

添加后重新运行 GitHub Pages 部署 workflow。

## 构建发布

```bash
npm run build
```

构建产物会输出到 `dist/`，推送到 `main` 后会由 GitHub Actions 自动发布。

## 数据维护

默认站点维护在 [`src/data/sites.js`](./src/data/sites.js)，公网后台添加的公共站点存放在 Supabase。博客正文维护在 [`src/content/posts/`](./src/content/posts/) 的 Markdown 文件中；`src/data/posts.generated.js` 是构建产物，不要直接编辑。

## 公网博客管理

登录 [超级后台](https://845864204.xyz/admin/) 后，切换到“博客”，即可新建、编辑、预览和删除文章。保存会提交对应的 Markdown 文件到本仓库 `main` 分支，并触发原有的 GitHub Pages 部署；页面分别显示保存结果和发布状态。

- 博客仍在 GitHub，不存放在 Supabase 数据库。Supabase Edge Function `admin-blog` 仅负责验证登录用户的 `admin_users.user_id` 权限、校验内容和代理指定仓库的操作。
- 编辑使用文件 SHA 检查版本。遇到冲突或网络失败时保留编辑框内容，不强制覆盖仓库。删除文章不会自动删除图片，避免误删共享图片。
- 正文使用 Markdown，预览在禁用脚本的隔离 iframe 中显示。现有 `public/post-image/` 图片继续可用；新图片可引用 HTTPS 图片地址。
- 本地编辑前先运行 `git pull --ff-only`，同步公网后台提交的文章，再使用本地管理器或直接编辑 Markdown。

### 部署博客接口

`supabase/config.toml` 为 `admin-blog` 启用 JWT 验证。服务端还会向 Supabase Auth 验证用户，再通过用户自己的权限查询管理员标记；普通用户不能调用博客接口。

在 Supabase 项目的 Edge Function Secrets 中设置 `BLOG_GITHUB_TOKEN` 和 `BLOG_SUPABASE_PUBLISHABLE_KEY`。GitHub 凭据需能访问本仓库，至少具有 Contents 读写与 Actions 读取权限；建议使用仅授权此仓库的 fine-grained token。不要把 GitHub token 放进 `VITE_` 环境变量、前端文件或 Git 仓库。

```powershell
npx --yes supabase@2.116.0 functions deploy admin-blog --project-ref zfvwrnuenurxauvvfsuw --use-api
```

接口锁定本仓库、`main` 分支及 `src/content/posts/*.md`。修改域名或仓库时，需要同步调整 `supabase/functions/admin-blog/handler.js` 中的配置并重新部署。

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

启动后在浏览器打开：`http://127.0.0.1:3214`

这个页面只在本机运行，用来编辑：

- `src/data/sites.js`
- `src/content/posts/*.md`

可以在本地管理器里完成这些操作：

- 新建、编辑、删除网站和博客文章
- 导出当前分类 JSON
- 导出整站备份 JSON
- 导入 JSON 备份恢复网站或博客
- 导入浏览器书签 HTML 到网站列表（自动跳过重复链接）
- 网站体检：检查重复链接、批量检测死链 / 异常链接

导入后不会自动写回文件，仍然需要点击“保存当前分类”。
