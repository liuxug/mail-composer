# 邮管家 - Mail Composer

多邮箱账户统一管理系统，支持邮件收发同步、实时推送、分类管理、富文本编辑及标签系统，大幅提升邮件管理效率。

## ✨ 功能特性

- **多邮箱账户管理**：支持 QQ 邮箱、163 邮箱、126 邮箱、Gmail 等主流邮箱
- **邮件收发同步**：通过 IMAP 协议同步邮件，SMTP 协议发送邮件
- **实时邮件推送**：WebSocket 实现新邮件实时通知
- **邮件分类管理**：收件箱、星标、已发送、草稿、归档、垃圾箱
- **富文本邮件编辑**：支持格式化文本、列表、表格、链接、图片等
- **标签管理**：自定义标签分类邮件
- **邮件搜索筛选**：支持按发件人、收件人、时间、大小等多维度筛选
- **批量邮件操作**：批量删除、标记已读、归档、添加标签
- **附件管理**：支持上传和下载邮件附件
- **用户认证系统**：注册、登录、JWT 身份验证

## 🛠️ 技术栈

### 前端

| 技术 | 版本 | 说明 |
|------|------|------|
| React | ^18.2.0 | 前端框架 |
| Vite | ^5.1.0 | 构建工具 |
| Tailwind CSS | ^3.4.1 | 样式框架 |
| Lucide React | ^0.314.0 | 图标库 |
| React Router | ^6.22.0 | 路由管理 |
| Day.js | ^1.11.10 | 日期处理 |

### 后端

| 技术 | 版本 | 说明 |
|------|------|------|
| Node.js | >= 18.0.0 | 运行环境 |
| Express | ^4.18.2 | Web 框架 |
| lowdb | ^7.0.1 | 轻量级数据库 |
| IMAPFlow | ^1.0.155 | IMAP 邮件客户端 |
| Nodemailer | ^6.9.10 | SMTP 邮件发送 |
| jsonwebtoken | ^9.0.2 | JWT 认证 |
| bcryptjs | ^2.4.3 | 密码加密 |
| WebSocket | ^8.16.0 | 实时通信 |
| Multer | ^2.2.0 | 文件上传 |

## 📦 快速开始

### 环境要求

- Node.js >= 18.0.0
- npm >= 9.0.0

### 环境配置

在后端目录下创建 `.env` 文件，参考 `.env.example`：

```bash
cd backend
cp .env.example .env
```

编辑 `.env` 文件，配置以下环境变量：

| 变量 | 说明 | 示例 |
|------|------|------|
| PORT | 服务端口 | 3000 |
| JWT_SECRET | JWT 密钥（生产环境请使用安全的密钥） | your-secret-key |
| ENCRYPTION_KEY | 32字节加密密钥 | your-32-byte-key |
| SMTP_HOST | 默认 SMTP 主机 | smtp.qq.com |
| SMTP_PORT | SMTP 端口 | 465 |
| SMTP_USER | SMTP 用户名 | your-email@qq.com |
| SMTP_PASS | SMTP 授权码 | your-app-password |

### 安装运行

```bash
# 克隆项目
git clone https://github.com/liuxug/mail-composer.git
cd mail-composer

# 安装后端依赖
cd backend
npm install

# 创建 .env 文件并配置环境变量
cp .env.example .env
# 编辑 .env 文件配置密钥等信息

# 启动后端开发服务器
npm run dev
# 后端服务运行在 http://localhost:3000

# 安装前端依赖（新开终端）
cd ../frontend
npm install

# 启动前端开发服务器
npm run dev
# 前端服务运行在 http://localhost:5173
```

### 生产构建

```bash
# 构建前端
cd frontend
npm run build

# 启动后端生产服务器
cd ../backend
npm start
```

## 📁 项目结构

```
mail-composer/
├── backend/                 # 后端代码
│   ├── config/             # 配置文件
│   ├── manager/            # 连接池管理
│   ├── routes/             # API 路由
│   ├── service/            # 业务服务
│   ├── utils/              # 工具函数
│   ├── uploads/            # 附件上传目录
│   ├── database.json       # 数据库文件
│   ├── db.js              # 数据库配置
│   ├── server.js          # 服务器入口
│   └── package.json
├── frontend/               # 前端代码
│   ├── src/
│   │   ├── components/    # React 组件
│   │   ├── context/       # React Context
│   │   ├── images/        # 图片资源
│   │   ├── utils/         # 工具函数
│   │   ├── App.jsx        # 应用入口
│   │   ├── main.jsx       # React 渲染
│   │   └── index.css      # 全局样式
│   ├── index.html         # HTML 模板
│   ├── vite.config.js     # Vite 配置
│   ├── tailwind.config.js # Tailwind 配置
│   └── package.json
├── .gitignore
├── LICENSE
├── README.md
└── 操作文档.md              # 详细操作文档
```

## 🔧 配置说明

### 邮箱配置

添加邮箱账户时需要配置以下信息：

| 邮箱类型 | SMTP 主机 | SMTP 端口 | IMAP 主机 | IMAP 端口 |
|----------|-----------|-----------|-----------|-----------|
| QQ 邮箱 | smtp.qq.com | 465 | imap.qq.com | 993 |
| 163 邮箱 | smtp.163.com | 465 | imap.163.com | 993 |
| Gmail | smtp.gmail.com | 465 | imap.gmail.com | 993 |

> **注意**：需要使用邮箱的第三方应用授权码，而非登录密码。

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📧 联系方式

如有问题或建议，请通过以下方式联系：

- GitHub Issues: [提交问题](https://github.com/liuxug/mail-composer/issues)
