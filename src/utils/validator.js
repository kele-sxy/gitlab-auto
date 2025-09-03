const Joi = require('joi');

class Validator {
  constructor() {
    // GitLab Webhook payload验证模式
    this.webhookPayloadSchema = Joi.object({
      object_kind: Joi.string().required(),
      event_type: Joi.string().optional(),
      user: Joi.object().optional(),
      project: Joi.object({
        id: Joi.number().required(),
        name: Joi.string().required(),
        description: Joi.string().allow(null, ''),
        web_url: Joi.string().uri().required(),
        avatar_url: Joi.string().uri().allow(null),
        git_ssh_url: Joi.string().required(),
        git_http_url: Joi.string().uri().required(),
        namespace: Joi.string().required(),
        visibility_level: Joi.number().required(),
        path_with_namespace: Joi.string().required(),
        default_branch: Joi.string().required()
      }).required(),
      repository: Joi.object().optional(),
      object_attributes: Joi.object().optional(),
      commits: Joi.array().optional(),
      merge_request: Joi.object().optional()
    }).unknown(true); // 允许其他字段

    // Merge Request特定验证
    this.mergeRequestSchema = Joi.object({
      object_attributes: Joi.object({
        id: Joi.number().required(),
        iid: Joi.number().required(),
        title: Joi.string().required(),
        description: Joi.string().allow(null, ''),
        state: Joi.string().required(),
        created_at: Joi.string().isoDate().required(),
        updated_at: Joi.string().isoDate().required(),
        target_branch: Joi.string().required(),
        source_branch: Joi.string().required(),
        author_id: Joi.number().required(),
        assignee_id: Joi.number().allow(null),
        source_project_id: Joi.number().required(),
        target_project_id: Joi.number().required(),
        action: Joi.string().required(),
        work_in_progress: Joi.boolean().optional(),
        draft: Joi.boolean().optional()
      }).required()
    }).unknown(true);
  }

  // 验证Webhook payload
  validateWebhookPayload(payload) {
    const { error } = this.webhookPayloadSchema.validate(payload);
    if (error) {
      console.error('Webhook payload验证失败:', error.details);
      return false;
    }

    // 如果是Merge Request事件，进行额外验证
    if (payload.object_kind === 'merge_request') {
      return this.validateMergeRequestPayload(payload);
    }

    return true;
  }

  // 验证Merge Request payload
  validateMergeRequestPayload(payload) {
    const { error } = this.mergeRequestSchema.validate(payload);
    if (error) {
      console.error('Merge Request payload验证失败:', error.details);
      return false;
    }
    return true;
  }

  // 验证GitLab配置
  validateGitLabConfig(config) {
    const schema = Joi.object({
      url: Joi.string().uri().required(),
      token: Joi.string().required(),
      webhookSecret: Joi.string().optional(),
      apiVersion: Joi.string().default('v4'),
      timeout: Joi.number().default(30000)
    });

    const { error, value } = schema.validate(config);
    if (error) {
      throw new Error(`GitLab配置验证失败: ${error.details[0].message}`);
    }
    return value;
  }

  // 验证文件路径
  validateFilePath(filePath) {
    if (!filePath || typeof filePath !== 'string') {
      return false;
    }

    // 检查路径安全性
    if (filePath.includes('..') || filePath.startsWith('/')) {
      return false;
    }

    return true;
  }

  // 验证项目ID
  validateProjectId(projectId) {
    const schema = Joi.alternatives().try(
      Joi.number().positive(),
      Joi.string().pattern(/^\d+$/)
    );

    const { error } = schema.validate(projectId);
    return !error;
  }

  // 验证Merge Request ID
  validateMergeRequestId(mergeRequestId) {
    const schema = Joi.alternatives().try(
      Joi.number().positive(),
      Joi.string().pattern(/^\d+$/)
    );

    const { error } = schema.validate(mergeRequestId);
    return !error;
  }
}

module.exports = new Validator();