# 同声传译工具 - Render 云端部署说明

## 文件结构（上传到 GitHub 的内容）

```
simul_translate_free/
├── server.py              # 核心翻译逻辑
├── wsgi.py                # Render/gunicorn 入口
├── language_detector.py   # 语言检测
├── requirements.txt       # 依赖
├── render.yaml            # Render 配置
├── .gitignore             # 排除无用文件
└── web/
    ├── index.html
    ├── script.js
    ├── style.css
    ├── manifest.json
    └── service-worker.js
```

---

## 部署步骤

### 第一步：上传到 GitHub

在电脑上执行以下命令（在 simul_translate_free 目录内）：

```bash
git init
git add .
git commit -m "同声传译初始部署"
git branch -M main
git remote add origin https://github.com/你的用户名/simul-translate-free.git
git push -u origin main
```

注意：先在 GitHub 上创建一个新仓库（名字叫 simul-translate-free），不要勾选"Initialize with README"。

---

### 第二步：在 Render 上创建 Web Service

1. 访问 https://dashboard.render.com
2. 点击右上角 **New +** → **Web Service**
3. 选择 **Build and deploy from a Git repository**
4. 连接你的 GitHub 账号，选择 `simul-translate-free` 仓库
5. 填写以下配置：

| 字段 | 值 |
|------|-----|
| Name | simul-translate（随意） |
| Region | Singapore（亚洲最近） |
| Branch | main |
| Root Directory | （留空） |
| Runtime | Python 3 |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `gunicorn wsgi:app --bind 0.0.0.0:$PORT --worker-class gevent --workers 1 --threads 4 --timeout 120` |

6. Plan 选 **Free**
7. 点击 **Create Web Service**

---

### 第三步：等待部署完成

- 第一次部署约 2-3 分钟
- 部署成功后会显示绿色 **Live** 状态
- 你的服务地址类似：`https://simul-translate.onrender.com`

---

### 使用注意

**Render 免费版限制：**
- 每月 750 小时（单服务可 24 小时运行）
- 15 分钟无请求后服务会休眠（下次访问冷启动约 30-60 秒）
- 升级 Starter 套餐（$7/月）可禁用休眠

**翻译引擎：**
- 默认使用 Google 免费网页接口（无需 API Key）
- 自动降级链：Google → MyMemory → LibreTranslate

---

## 本地测试（上传前验证）

```bash
cd simul_translate_free
pip install gunicorn gevent
gunicorn wsgi:app --bind 0.0.0.0:8765 --worker-class gevent --workers 1
# 访问 http://localhost:8765
```
