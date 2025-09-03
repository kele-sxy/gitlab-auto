# GitLab自动代码审查 - 详细配置指南

## 1. 获取GitLab Private Token

### 步骤：
1. 登录GitLab → 点击右上角头像 → `Edit profile`
2. 左侧菜单选择 `Access Tokens`
3. 填写Token信息：
   - **Name**: `Auto Code Review`
   - **Expiration date**: 选择合适的过期时间
   - **Scopes**: 勾选以下权限
     - ✅ `api` - 访问API
     - ✅ `read_user` - 读取用户信息
     - ✅ `read_repository` - 读取仓库
4. 点击 `Create personal access token`
5. **重要**: 复制生成的token，这是唯一一次显示

## 2. 配置Webhook Secret

### 什么是Webhook Secret？
Webhook Secret是一个自定义的密钥字符串，用于验证来自GitLab的请求是否合法，防止恶意请求。

### 如何设置：
1. **在GitLab项目中**：
   - 进入项目 → `Settings` → `Webhooks`
   - URL: `http://your-server:3000/webhook/gitlab`
   - Secret token: 输入一个强密码，例如：`MySecretKey2024!@#`
   - 勾选 `Merge request events`

2. **在项目.env文件中**：
   ```env
   GITLAB_WEBHOOK_SECRET=MySecretKey2024!@#
   ```

### Secret生成建议：
```bash
# 使用openssl生成随机密钥
openssl rand -hex 32

# 或使用Node.js生成
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 3. 完整配置示例

```env
# GitLab配置
GITLAB_URL=https://gitlab.company.com
GITLAB_TOKEN=glpat-xxxxxxxxxxxxxxxxxxxx
GITLAB_WEBHOOK_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6

# 服务配置
PORT=3000
NODE_ENV=production

# 审查配置
REVIEW_ENABLED=true
AUTO_APPROVE_THRESHOLD=85
MIN_REVIEWERS=1
```

## 4. 测试配置

启动服务后，可以通过以下方式测试：

1. **健康检查**：
   ```bash
   curl http://localhost:3000/health
   ```

2. **创建测试MR**：
   在GitLab中创建一个merge request，查看是否收到自动审查评论

3. **查看日志**：
   ```bash
   tail -f logs/combined.log
   ```

## 5. 常见问题

### Q: Token权限不足怎么办？
A: 确保Token具有以下权限，且用户在项目中至少是Developer角色：
- api
- read_user  
- read_repository

### Q: Webhook不触发怎么办？
A: 检查以下几点：
- 服务器防火墙是否开放3000端口
- GitLab能否访问到你的服务器
- Secret token是否匹配
- 是否勾选了正确的事件类型

### Q: 如何调试Webhook？
A: 在GitLab的Webhook设置页面，可以查看最近的请求记录和响应状态。