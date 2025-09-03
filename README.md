# GitLab 自动代码审查工具

一个支持私有化部署GitLab的自动merge request代码审查工具，使用Node.js开发。

## 功能特性

- 🤖 **自动代码审查**: 自动分析merge request的代码变更
- 🔍 **多维度检测**: 代码质量、安全漏洞、最佳实践检查
- 💬 **智能评论**: 生成详细的审查报告和行内评论
- ⚡ **实时处理**: 通过GitLab Webhook实时响应代码变更
- 🏗️ **私有部署**: 支持私有化GitLab实例
- 📊 **评分系统**: 基于问题严重程度的智能评分
- 🎯 **自动批准**: 达到评分阈值的MR可自动批准

## 安装部署

### 环境要求

- Node.js 16.0+
- 私有GitLab实例 (13.0+)
- 网络连接到GitLab服务器

### 快速开始

1. **克隆项目**
```bash
git clone <repository-url>
cd gitlab-auto-code-review
```

2. **安装依赖**
```bash
npm install
```

3. **配置环境变量**
```bash
cp .env.example .env
# 编辑.env文件，填入你的配置
```

4. **启动服务**
```bash
# 开发模式
npm run dev

# 生产模式
npm start
```

## 配置说明

### 环境变量配置

在`.env`文件中配置以下参数：

```env
# GitLab配置
GITLAB_URL=https://your-gitlab-instance.com
GITLAB_TOKEN=your_private_token
GITLAB_WEBHOOK_SECRET=your_webhook_secret

# 服务配置
PORT=3000
NODE_ENV=development

# 审查配置
REVIEW_ENABLED=true
AUTO_APPROVE_THRESHOLD=90
MIN_REVIEWERS=1
```

### GitLab配置步骤

1. **获取Private Token**
   - 登录GitLab → Settings → Access Tokens
   - 创建Personal Access Token，勾选`api`、`read_user`、`read_repository`权限

2. **配置Project Webhook**
   - 进入项目 → Settings → Webhooks
   - URL: `http://your-server:3000/webhook/gitlab`
   - Secret Token: 与环境变量中的`GITLAB_WEBHOOK_SECRET`保持一致
   - 勾选 `Merge request events` 事件

3. **配置用户权限**
   - 确保Token对应的用户具有项目的Developer及以上权限
   - 如需自动批准功能，需要Maintainer权限

## 代码审查规则

### 安全检查
- `console.log`、`debugger` 等调试代码
- `eval()`、`innerHTML` 等危险函数
- 空的catch块

### 代码质量
- 代码行长度检查 (120字符限制)
- 文件大小检查 (1000行限制)
- 变量命名规范
- TODO/FIXME 注释提醒

### 最佳实践
- 函数复杂度检查
- 严格模式检查 (JavaScript)
- 代码重复度分析

## API接口

### Webhook端点

**POST** `/webhook/gitlab`

接收GitLab的Webhook事件，自动处理Merge Request。

### 健康检查

**GET** `/health`

返回服务状态信息。

```json
{
  "status": "ok",
  "timestamp": "2024-01-20T10:30:00.000Z",
  "service": "GitLab Auto Code Review"
}
```

## 项目结构

```
src/
├── app.js                 # 应用入口
├── config/
│   └── gitlab.js          # GitLab配置
├── controllers/
│   └── webhookController.js   # Webhook控制器
├── services/
│   ├── gitlabApi.js       # GitLab API服务
│   ├── codeAnalyzer.js    # 代码分析服务
│   └── reviewService.js   # 审查服务
└── utils/
    ├── logger.js          # 日志工具
    └── validator.js       # 验证工具
```

## 使用示例

### 审查报告示例

当有新的Merge Request时，系统会自动生成如下格式的审查报告：

```markdown
## 🤖 自动代码审查报告

### 🟢 总体评分: 85/100

**📊 统计信息:**
- 📁 分析文件: 3
- ➕ 新增代码: 127 行
- ➖ 删除代码: 23 行
- 🚨 严重问题: 1
- ⚠️ 警告: 2
- 💡 建议: 3

### 🚨 发现的问题

**严重问题 (1):**
1. **dangerous_pattern** - 检测到危险代码模式: console\.log
   📄 文件: `src/utils/helper.js`
   📍 行号: 15
   💻 代码: `console.log('Debug info:', data);`

### 💡 优化建议

1. **naming** - 变量名过短: "d"，建议使用更有意义的名称
   📄 文件: `src/components/Button.js`

### 📋 审查总结

⚠️ **代码质量良好，但有改进空间。** 建议处理上述问题后合并。
```

## 扩展开发

### 自定义检查规则

在 `src/config/gitlab.js` 中修改 `codeRules` 配置：

```javascript
codeRules: {
  // 添加新的危险模式
  dangerousPatterns: [
    /console\.log/g,
    /alert\(/g,  // 新增规则
    // ... 其他规则
  ],
  
  // 自定义文件扩展名支持
  allowedExtensions: ['.js', '.ts', '.vue', '.py']
}
```

### 集成外部工具

可以在 `codeAnalyzer.js` 中集成其他静态分析工具：

```javascript
// 集成ESLint
const eslint = require('eslint');
const cli = new eslint.ESLint();

async analyzeWithESLint(code, filePath) {
  const results = await cli.lintText(code, { filePath });
  // 处理ESLint结果
}
```

## 故障排除

### 常见问题

1. **Webhook不响应**
   - 检查网络连接和防火墙设置
   - 确认Webhook URL可访问
   - 验证Secret Token配置

2. **Token权限不足**
   - 确认Token具有足够权限
   - 检查用户在项目中的角色

3. **分析结果不准确**
   - 调整代码规则配置
   - 查看日志文件定位问题

### 日志查看

日志文件位于 `logs/` 目录：
- `combined.log` - 所有日志
- `error.log` - 错误日志
- `exceptions.log` - 异常日志

## 许可证

MIT License

## 贡献

欢迎提交Issue和Pull Request来改进这个项目！