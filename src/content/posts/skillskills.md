---
title: "劝一句：龙虾越火，越应该研究Skill，千万别跑偏！附送乔帮主精选Skills（微信）"
summary: "原创 向阳乔木 AI不插电 _2026年3月6日 22:39_ _北京_ 17人 最近龙虾（OpenClaw）火得不像样。 先不说早先因为龙虾卖爆的 Mac mini。 也不必说国内各个云主机厂商纷纷跟进热点，全都支持一键部署安装龙虾。 国..."
publishedAt: "2026-04-17"
tags:
---

原创 向阳乔木 AI不插电

 _2026年3月6日 22:39_ _北京_ 17人

最近龙虾（OpenClaw）火得不像样。

先不说早先因为龙虾卖爆的 Mac mini。

也不必说国内各个云主机厂商纷纷跟进热点，全都支持一键部署安装龙虾。

国内各大模型厂商都推出 Coding Plan，为了让大家接入龙虾用。

最近甚至出现上门付费安装，现已经卷到免费安装阶段。

比如今天腾讯安排 20 个技术人员免费给大家安装龙虾，场面异常火爆。

![图片](/post-image/skill-skills-0e4f7050ebb8d798.jpg)

我的直观感受：**最近所有邀约活动，全和龙虾相关，绝了！**

不是想泼冷水啊。

我认为，龙虾越热，普通人更应该沉下心打磨 Skill。

否则龙虾装了也没太大用处。

下面推荐几个自己和网友们写的 Skill，未来可以被龙虾调用，抛砖引玉。

## 常用 Skill 有哪些？

发现多数人都会搞一套自己的信息抓取采集 Skill。

道理很简单，AI 再聪明，得先喂得进东西才行。

下面按「抓取采集」「内容创作」「效率工具」三条线介绍。

## 一、抓取采集 Skill

### 1. Agent Reach —— 给 AI 装上眼睛

> 仓库：https://github.com/Panniantong/Agent-Reach

一句话概括：**零 API 成本**，让 AI Agent 能访问整个互联网。

网页抓取、YouTube 字幕提取、Twitter/X 搜索、GitHub 访问、Reddit 解析、B 站、小红书、抖音、微信公众号、RSS 订阅、语义搜索……能想到的信息源基本全覆盖了。

**亮点**：

- • 全部使用免费开源后端，不需要单独申请各家 API Key
    
- • 本地凭证存储，cookie/token 不外传
    
- • 支持中文平台（小红书、抖音、微信）
    
- • 内置诊断工具 `agent-reach doctor`，一键排查环境问题
    

**安装方式**：让 AI Agent 说

`         1      "帮我安装 Agent Reach: https://raw.githubusercontent.com/Panniantong/agent-reach/main/docs/install.md"          `

需要 Python、yt-dlp、gh CLI 等基础环境，中文平台（比如小红书）需 Docker 运行 MCP 服务。

### 2. Defuddle —— 网页正文提取神器

![图片](/post-image/skill-skills-97790968a50f6f55.png)

> https://github.com/joeseesun/defuddle-skill

一句话概括：从网页中**提取干净的文章内容**，去除广告、侧边栏等杂乱元素。

Obsidian CEO下厂写的命令行工具，我把它封装成了Skill。

你跟 AI 说「帮我提取这个链接的文章内容」，它自动调用 Defuddle，返回干干净净的 Markdown 正文 + 标题、作者、发布日期、字数等元数据。

**安装**：

`         1      npx skills add joeseesun/defuddle-skill          `

### 3. YouTube 搜索下载，视频转写第一步

![图片](/post-image/skill-skills-2aa8bc3ab9c50abd.png)

> Github：https://github.com/joeseesun/yt-search-download

一句话概括：**YouTube 全站搜索 + 视频下载 + 字幕提取**，一站搞定。

支持按日期/播放量/相关性排序搜索，频道浏览及频道内搜索。

多画质视频下载（最高 4K），MP3 音频提取，字幕获取（SRT 带时间戳 + TXT 纯文本）。

英文标题还会自动翻译成中文。

**典型用法**：

- • 搜索某个主题的最新视频
    
- • 下载视频并提取字幕，用于后续内容创作（写长文、写推文等）
    
- • 只提取音频做播客素材
    

**安装**：

`         1      npx skills add joeseesun/yt-search-download          `

**前置条件**：先免费申请 YouTube API Key + yt-dlp（`brew install yt-dlp`）。

注意，要经常更新yt-dlp，使用纯净度高的IP。

### 4. Anything to NotebookLM —— 万物皆可用NotebookLM处理

![图片](/post-image/skill-skills-3c132fa26f5a5341.png)

> https://github.com/joeseesun/anything-to-notebooklm

一句话概括：把**任何内容**（微信文章、YouTube 视频、PDF、EPUB 等 15+ 格式）扔进 Google NotebookLM，自动生成播客、PPT、思维导图、测验等。

整合了多个开源项目，比如好友tenglin的NotebookLM-py、微软的Markitdown等。

这个 Skill 打通了从「内容获取」到「NotebookLM 输出」的完整链路。

你可以说「把这篇微信文章变成播客」，它自动完成抓取 → 转换 → 上传 → 生成。

**支持的输入格式**：微信公众号、YouTube、PDF、EPUB、网页、Office 文档、图片、音频……

**支持的输出格式**：播客、PPT、思维导图、测验、报告、视频、信息图

**安装**：克隆仓库后运行安装脚本——

`         1  2  3      git clone https://github.com/joeseesun/anything-to-notebooklm.git   cd anything-to-notebooklm   ./install.sh          `

## 二、内容创作 Skill

### 5. 宝玉老师的 Skill 合集 —— 内容创作全家桶

> 仓库：https://github.com/jimliu/baoyu-skills

宝玉老师（@dotey）的 Skills 合集堪称「一个人的内容工厂」。

涵盖了从图文创作到社交媒体发布的完整链路：

**视觉内容生成**：

- • 小红书信息图：多种风格 × 多种布局定制
    
- • 通用信息图生成器：20 种布局 + 17 种视觉风格
    
- • 封面图工具：5 维度设计系统（类型、配色、渲染、纹理、排版）
    
- • 幻灯片创建器：14+ 风格预设
    
- • 漫画生成、文章插图
    

**社交媒体发布**：

- • X (Twitter) 发布
    
- • 微信公众号发布
    
- • 小红书自动发布
    

**内容处理工具**：

- • Markdown 格式化与转换
    
- • 图片压缩（WebP/PNG）
    
- • DeepL 翻译
    
- • URL 转 Markdown
    

**安装**：

`         1      npx skills add jimliu/baoyu-skills          `

这套合集特别适合做自媒体的朋友，一个 Skill 包解决从内容生产到分发的全部需求。

### 6. Markdown 一键发 X 长文

> 仓库：https://github.com/joeseesun/qiaomu-x-article-publisher

一句话概括：写好 Markdown，**一键发布为 X (Twitter) Articles 草稿**。

支持完整 Markdown 格式（标题、加粗/斜体、列表、引用、代码块、链接、图片），自动处理图片上传，7 天免重复认证。

**安装**：

`         1  2  3      git clone https://github.com/joeseesun/qiaomu-x-article-publisher.git ~/.claude/skills/qiaomu-x-article-publisher   pip install Pillow pyobjc-framework-Cocoa patchright   python auth_manager.py setup          `

### 7. Knowledge Site Creator —— 一句话生成学习网站

> 仓库：https://github.com/joeseesun/knowledge-site-creator

一句话概括：告诉 AI 你想学什么，**自动生成一个完整的学习网站并部署上线**。

比如你说「帮我创建一个学习进化心理学的网站」。

AI 自动完成主题分析 → 内容创作 → 页面设计 → Vercel 部署，全程不需要你写一行代码。

**学习模式**：闪卡、渐进学习、测验、索引、进度追踪

**技术特点**：

- • PWA 支持，离线也能用
    
- • SEO 优化，自带 Meta 标签和站点地图
    
- • 零前端依赖，原生 HTML/CSS/JS
    
- • 极简黄色主题，干净清爽
    

**安装**：

`         1      npx skills add joeseesun/knowledge-site-creator          `

## 三、效率工具 Skill

### 8. Spotify 音乐播放器 —— 用自然语言听歌

![图片](/post-image/skill-skills-dfd48ce04a447aa7.png)

> https://github.com/joeseesun/qiaomu-music-player-spotify

一句话概括：**用自然语言控制 Spotify**，内置 5947 种音乐风格数据库。

跟 AI 说「放点适合写代码的音乐」或「来首 Bohemian Rhapsody」，它自动搜索匹配并播放。

支持搜索、播放、暂停、跳曲、音量调节、队列管理，还能根据场景/情绪推荐。

**亮点**：

- • 5,947 种音乐风格，分层组织
    
- • 30+ 风格快捷播放
    
- • 自然语言描述映射到具体风格
    
- • 零外部依赖，纯 Python 标准库
    
- • 自动 OAuth token 刷新
    

**安装**：

`         1      npx skills add joeseesun/qiaomu-music-player-spotify          `

需要 Spotify Premium 账号（淘宝150一年，还可以）

具体用法和配置见：

https://github.com/joeseesun/qiaomu-music-player-spotify

### 9. Design Advisor —— 乔布斯式设计顾问

用自己的一个Prompt生成的UI设计Skill。

没想到效果经常有意外惊喜。

> https://github.com/joeseesun/qiaomu-design-advisor

一句话概括：融合**乔布斯产品直觉 + Rams 功能纯粹主义**的 UI/UX 设计顾问。

不是那种「这里颜色改一下」的敷衍建议。

它会深入挖掘表面需求背后的真实用户需要，审视每个细节（间距、色温、动画时序）。

为每个问题提供三个层级的解决方案（渐进改进、结构重设计、理想方案），并透明展示权衡。

**触发词**："重新设计"、"redesign"、"review UI"、"优化交互体验"

**安装**：

`         1      npx skills add joeseesun/qiaomu-design-advisor          `

## 四、Skill 管理与发现

### 写好 Skill，怎么发布？

最好的方式是用 Git 管理起来，甚至发布到 GitHub 共享（也可放私有库）。

写了个 Skill 帮不熟悉的朋友做这件事——**Skill Publisher**：

> 仓库：https://github.com/joeseesun/skill-publisher

它会自动完成：验证 SKILL.md 元数据  → 创建 GitHub 仓库 → 推送代码 → 验证可通过 `npx skills add` 安装。

`         1      npx skills add joeseesun/skill-publisher          `

需要 GitHub CLI (`gh`) 已安装并认证。

### 去哪找更多 Skill？

推荐三个渠道：

**1. Skills.sh —— Vercel 官方技能目录**

![图片](/post-image/skill-skills-e831bd9a6ba3d6bc.png)

> https://skills.sh/

Vercel 打造的开源 Skills 目录，收录超过 **86,000+ 个 Skills**。

支持 20+ 平台（Claude Code、GitHub Copilot、Cursor、Cline、Gemini 等），可按热度、趋势筛选。

**2. Find Skills —— 用 Skill 找 Skill**

> https://skills.sh/vercel-labs/skills/find-skills

装上这个 Skill 后，直接在终端搜索和安装其他 Skill。

**可以称之为：“元Skill”**

`         1      npx skills add vercel-labs/skills/find-skills          `

然后就可以用 `npx skills find react performance` 这样的命令搜索了。

**3. SkillsMP —— 最大的 Skill 集市**

![图片](/post-image/skill-skills-2a04acc1df0a0d42.png)

> https://skillsmp.com/zh

社区驱动的 Skills 聚合平台，收录 **38w+** 个 Skills，支持中文界面。

从 GitHub 公开仓库自动抓取和同步，有基本的质量过滤（最低 2 stars 门槛）。

## 写在最后

Skill 是龙虾的灵魂。

没有 Skill 的龙虾，就像一台没装 App 的手机。

**龙虾越热，越该沉下心打磨自己的 Skill。**

与其追热点装龙虾，不如先想清楚：你让 AI 帮你干什么？

这个问题想清楚了，Skill 自然就知道怎么写了。

![](/post-image/skill-skills-66cbc1fda13e8f4b.png)

**AI不插电**

像摇滚乐的不插电演出，去掉华丽包装，只留下最纯粹的音乐。用摇滚精神审视AI世界，不盲从不跟风。

52篇原创内容

公众号

![](/post-image/skill-skills-d6d536314d51814b.png)

**向阳乔木推荐看**

每日阅读记录，创业、心理、学习等方面。

172篇原创内容

公众号

  

![](/post-image/skill-skills-e8977582459e72a0.jpg)

向阳乔木

 解锁成就：Token 赞助者 🏆 

喜欢作者

想法碰撞 · 目录

上一篇2025年LLM最全总结！Django创始人亲述：这一年，AI 改变了编程下一篇Al拿走脑力之后，人还剩下什么？孟岩访谈李继刚播客总结

阅读 2472

​

**留言 9**

写留言

- ![](/post-image/skill-skills-70a8221cfe70ee0c.svg)
    
    王健（IoT）
    
    江苏昨天
    
    赞
    
    不完全同意，🦞也使用skill，🦞用好skills效果更好，不矛盾
    
    ![](/post-image/skill-skills-70a8221cfe70ee0c.svg)
    
    AI不插电
    
    作者昨天
    
    赞2
    
    没有否定龙虾，发挥龙虾最大价值要靠skill
    
- ![](/post-image/skill-skills-70a8221cfe70ee0c.svg)
    
    一路同行
    
    河南21小时前
    
    赞1
    
    知道干什么比怎么去干更重要
    
- ![](/post-image/skill-skills-70a8221cfe70ee0c.svg)
    
    甲木未来派
    
    北京昨天
    
    赞1
    
    很多人没有用过Claude code，没有用过Skills，🦞给了个出口
    
    作者赞过
    
- ![](/post-image/skill-skills-70a8221cfe70ee0c.svg)
    
    柳一刀Reed
    
    陕西昨天
    
    赞
    
    乔帮主，搜索小红书的 Skill 不起作用的![[破涕为笑]](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=)，还有没有其他靠谱的，能稳定的搜索小红书内容的skill？
    
- ![](/post-image/skill-skills-70a8221cfe70ee0c.svg)
    
    jsw
    
    广西昨天
    
    赞
    
    搜索工具用什么好
    
- ![](/post-image/skill-skills-70a8221cfe70ee0c.svg)
    
    42号星际游民
    
    辽宁昨天
    
    赞
    
    以前只有土钢琴不会音乐的人都觉得弹琴很难，有人推出了一个可以演奏的钢琴，大家都买回来以后发现自己还是不会弹钢琴。
    
- ![](/post-image/skill-skills-70a8221cfe70ee0c.svg)
    
    quan
    
    广东昨天
    
    赞
    
    求这篇文章的龙虾成分 哈哈
    
- ![](/post-image/skill-skills-70a8221cfe70ee0c.svg)
    
    继达
    
    浙江昨天
    
    赞
    
    神了！！！
    

已无更多数据
