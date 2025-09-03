const crypto = require('crypto');
const config = require('../config/gitlab');
const reviewService = require('../services/reviewService');
const logger = require('../utils/logger');
const validator = require('../utils/validator');

class WebhookController {
  // 处理GitLab Webhook
  async handleGitLabWebhook(req, res) {
    try {
      // 验证webhook签名
      if (!this.verifyWebhookSignature(req)) {
        logger.warn('Webhook签名验证失败', { 
          headers: req.headers,
          ip: req.ip 
        });
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const payload = req.body;
      const eventType = req.headers['x-gitlab-event'];

      logger.info(`收到GitLab Webhook事件: ${eventType}`, {
        projectId: payload.project?.id,
        objectKind: payload.object_kind
      });

      // 验证payload结构
      if (!this.validatePayload(payload)) {
        logger.error('Webhook payload格式无效');
        return res.status(400).json({ error: 'Invalid payload' });
      }

      // 处理不同类型的事件
      await this.processWebhookEvent(eventType, payload);

      res.json({ status: 'success', message: 'Webhook processed successfully' });

    } catch (error) {
      logger.error('处理Webhook失败:', error);
      res.status(500).json({ 
        error: 'Internal Server Error', 
        message: error.message 
      });
    }
  }

  // 验证webhook签名
  verifyWebhookSignature(req) {
    if (!config.webhookSecret) {
      logger.warn('未配置Webhook密钥，跳过签名验证');
      return true; // 如果未配置密钥，跳过验证
    }

    const signature = req.headers['x-gitlab-token'];
    if (!signature) {
      return false;
    }

    // GitLab使用简单的token验证，不是HMAC
    return signature === config.webhookSecret;
  }

  // 验证payload结构
  validatePayload(payload) {
    return validator.validateWebhookPayload(payload);
  }

  // 处理不同类型的webhook事件
  async processWebhookEvent(eventType, payload) {
    switch (eventType) {
      case 'Merge Request Hook':
        await this.handleMergeRequestEvent(payload);
        break;
        
      case 'Push Hook':
        await this.handlePushEvent(payload);
        break;
        
      case 'Pipeline Hook':
        await this.handlePipelineEvent(payload);
        break;
        
      default:
        logger.info(`未处理的事件类型: ${eventType}`);
        break;
    }
  }

  // 处理Merge Request事件
  async handleMergeRequestEvent(payload) {
    const { object_attributes, project } = payload;
    const action = object_attributes.action;
    
    logger.info(`Merge Request事件: ${action}`, {
      projectId: project.id,
      mergeRequestId: object_attributes.iid,
      title: object_attributes.title,
      author: object_attributes.author_id
    });

    // 只处理新创建或更新的MR
    if (!['open', 'reopen', 'update'].includes(action)) {
      logger.info(`跳过MR事件: ${action}`);
      return;
    }

    // 检查是否是草稿MR
    if (object_attributes.work_in_progress || object_attributes.draft) {
      logger.info('跳过草稿MR的自动审查');
      return;
    }

    // 检查审查功能是否启用
    if (!config.review.enabled) {
      logger.info('代码审查功能已禁用');
      return;
    }

    try {
      // 延迟处理，给GitLab时间处理diff
      setTimeout(async () => {
        await reviewService.processMergeRequest(
          project.id,
          object_attributes.iid
        );
      }, 5000); // 延迟5秒

    } catch (error) {
      logger.error('处理MR事件失败:', error);
      throw error;
    }
  }

  // 处理Push事件
  async handlePushEvent(payload) {
    const { project, commits, ref } = payload;
    
    logger.info('Push事件', {
      projectId: project.id,
      ref,
      commitsCount: commits?.length || 0
    });

    // 可以在这里添加push事件的处理逻辑
    // 例如：检查commit消息格式、触发静态分析等
  }

  // 处理Pipeline事件
  async handlePipelineEvent(payload) {
    const { object_attributes, project, merge_request } = payload;
    
    logger.info('Pipeline事件', {
      projectId: project.id,
      pipelineId: object_attributes.id,
      status: object_attributes.status,
      mergeRequestId: merge_request?.iid
    });

    // 可以在这里添加pipeline事件的处理逻辑
    // 例如：pipeline失败时发送通知、成功时触发部署等
  }
}

module.exports = new WebhookController();