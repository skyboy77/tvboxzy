# TMDB Cloudflare Worker Proxy

一个基于 Cloudflare Worker 的 TMDB API 与图片代理服务。

支持：

* TMDB API 代理
* TMDB 图片代理
* 隐藏 API Key
* Cloudflare Edge Cache
* KV 二级缓存
* 多 API Key 轮换
* 自定义域名

---

# 文件说明

项目包含两个版本：

| 文件       | 说明  | 适合场景                        |
| -------- | --- | --------------------------- |
| index.js | 轻量版 | 个人使用、小规模部署                  |
| tmdb.js  | 生产版 | ATV-Player、影视TV、TvBox 等公开服务 |

---

## index.js（轻量版）

特点：

* 单文件
* 无 KV 依赖
* API 代理
* 图片代理
* Edge Cache
* API Key 隐藏

适合：

* 自用
* 测试
* 小规模用户

部署时直接复制到 Cloudflare Worker 即可。

---

## tmdb.js（生产版）

特点：

* API 代理
* 图片代理
* API Key 隐藏
* Cloudflare Edge Cache
* KV 二级缓存
* 多 API Key 自动轮换
* IP 限流
* CORS
* 热门接口缓存

适合：

* ATV-Player
* TvBox
* 影视TV
* 公共 API 服务

推荐使用 Wrangler 部署。

---

# 获取 TMDB API Key

注册：

https://www.themoviedb.org/

创建 API Key：

https://www.themoviedb.org/settings/api

---

# 部署方式

## 方案一：Dashboard（推荐新手）

### 创建 Worker

Cloudflare Dashboard

Workers & Pages

Create Worker

---

### 使用轻量版

复制：

```text
index.js
```

内容到 Worker。

---

### 添加环境变量

Settings

Variables

新增：

```text
TMDB_KEYS
```

值：

```text
your_tmdb_api_key
```

部署即可。

---

## 方案二：Wrangler（推荐生产环境）

### 安装

```bash
npm install -g wrangler
```

---

### 登录

```bash
wrangler login
```

---

### 创建 KV

```bash
wrangler kv namespace create TMDB_CACHE
```

记录返回的 Namespace ID。

---

### wrangler.toml

```toml
name = "tmdb-proxy"
main = "tmdb.js"
compatibility_date = "2026-06-06"

[[kv_namespaces]]
binding = "TMDB_CACHE"
id = "YOUR_KV_NAMESPACE_ID"
```

---

### 配置 API Key

```bash
wrangler secret put TMDB_KEYS
```

输入：

```text
key1,key2,key3
```

支持多个 Key。

---

### 本地运行

```bash
wrangler dev
```

---

### 部署

```bash
wrangler deploy
```

---

# API 示例

请求：

```text
https://tmdb.example.com/3/movie/550
```

实际访问：

```text
https://api.themoviedb.org/3/movie/550
```

并自动附加 API Key。

---

# 图片示例

请求：

```text
https://tmdb.example.com/t/p/w500/abc.jpg
```

实际访问：

```text
https://image.tmdb.org/t/p/w500/abc.jpg
```

---

# ATV-Player 配置

```text
TMDB API URL:
https://tmdb.example.com

TMDB Image URL:
https://tmdb.example.com
```

---

# 缓存策略

轻量版：

| 类型  | 缓存  |
| --- | --- |
| API | 1小时 |
| 图片  | 30天 |

生产版：

| 类型         | 缓存   |
| ---------- | ---- |
| Edge Cache | 1小时  |
| KV Cache   | 24小时 |
| 图片         | 30天  |

---

# 推荐选择

个人使用：

```text
index.js
```

公开服务：

```text
tmdb.js
```

如果预计用户超过 1000 人，推荐直接使用生产版。
