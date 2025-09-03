const express = require('express');
const dotenv = require('dotenv');
const logger = require('./utils/logger');
const webhookController = require('./controllers/webhookController');

// 加载环境变量
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 日志中间件
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} - ${req.ip}`);
  next();
});

// 健康检查端点
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'GitLab Auto Code Review'
  });
});

// Webhook端点
app.post('/webhook/gitlab', webhookController.handleGitLabWebhook);

// 错误处理中间件
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

// 404处理
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// 启动服务器
app.listen(PORT, () => {
  logger.info(`GitLab Auto Code Review服务已启动，端口: ${PORT}`);
  logger.info(`GitLab URL: ${process.env.GITLAB_URL}`);
  logger.info(`Webhook端点: http://localhost:${PORT}/webhook/gitlab`);
});

// 优雅关闭
process.on('SIGTERM', () => {
  logger.info('收到SIGTERM信号，正在关闭服务器...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('收到SIGINT信号，正在关闭服务器...');
  process.exit(0);
});