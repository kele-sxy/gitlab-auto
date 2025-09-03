const axios = require('axios');
const config = require('../config/gitlab');
const logger = require('../utils/logger');

class GitLabApiService {
  constructor() {
    this.client = axios.create({
      baseURL: `${config.url}/api/${config.apiVersion}`,
      headers: {
        'Private-Token': config.token,
        'Content-Type': 'application/json'
      },
      timeout: config.timeout
    });

    // 请求拦截器
    this.client.interceptors.request.use(
      (request) => {
        logger.debug(`GitLab API请求: ${request.method.toUpperCase()} ${request.url}`);
        return request;
      },
      (error) => {
        logger.error('GitLab API请求错误:', error);
        return Promise.reject(error);
      }
    );

    // 响应拦截器
    this.client.interceptors.response.use(
      (response) => {
        logger.debug(`GitLab API响应: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        logger.error('GitLab API响应错误:', error.response?.data || error.message);
        return Promise.reject(error);
      }
    );
  }

  // 获取项目信息
  async getProject(projectId) {
    try {
      const response = await this.client.get(`/projects/${projectId}`);
      return response.data;
    } catch (error) {
      logger.error(`获取项目信息失败: ${projectId}`, error);
      throw error;
    }
  }

  // 获取Merge Request详情
  async getMergeRequest(projectId, mergeRequestId) {
    try {
      const response = await this.client.get(`/projects/${projectId}/merge_requests/${mergeRequestId}`);
      return response.data;
    } catch (error) {
      logger.error(`获取Merge Request失败: ${projectId}/${mergeRequestId}`, error);
      throw error;
    }
  }

  // 获取Merge Request的变更文件
  async getMergeRequestChanges(projectId, mergeRequestId) {
    try {
      const response = await this.client.get(`/projects/${projectId}/merge_requests/${mergeRequestId}/changes`);
      return response.data.changes || [];
    } catch (error) {
      logger.error(`获取Merge Request变更失败: ${projectId}/${mergeRequestId}`, error);
      throw error;
    }
  }

  // 获取文件内容
  async getFileContent(projectId, filePath, ref = 'main') {
    try {
      const encodedPath = encodeURIComponent(filePath);
      const response = await this.client.get(`/projects/${projectId}/repository/files/${encodedPath}`, {
        params: { ref }
      });
      
      // GitLab返回base64编码的内容
      const content = Buffer.from(response.data.content, 'base64').toString('utf8');
      return content;
    } catch (error) {
      logger.error(`获取文件内容失败: ${projectId}/${filePath}`, error);
      throw error;
    }
  }

  // 创建Merge Request评论
  async createMergeRequestNote(projectId, mergeRequestId, body) {
    try {
      const response = await this.client.post(
        `/projects/${projectId}/merge_requests/${mergeRequestId}/notes`,
        { body }
      );
      return response.data;
    } catch (error) {
      logger.error(`创建MR评论失败: ${projectId}/${mergeRequestId}`, error);
      throw error;
    }
  }

  // 创建代码行评论
  async createMergeRequestDiscussion(projectId, mergeRequestId, discussion) {
    try {
      const response = await this.client.post(
        `/projects/${projectId}/merge_requests/${mergeRequestId}/discussions`,
        discussion
      );
      return response.data;
    } catch (error) {
      logger.error(`创建代码讨论失败: ${projectId}/${mergeRequestId}`, error);
      throw error;
    }
  }

  // 批准Merge Request
  async approveMergeRequest(projectId, mergeRequestId) {
    try {
      const response = await this.client.post(
        `/projects/${projectId}/merge_requests/${mergeRequestId}/approve`
      );
      return response.data;
    } catch (error) {
      logger.error(`批准MR失败: ${projectId}/${mergeRequestId}`, error);
      throw error;
    }
  }

  // 取消批准Merge Request
  async unapproveMergeRequest(projectId, mergeRequestId) {
    try {
      const response = await this.client.post(
        `/projects/${projectId}/merge_requests/${mergeRequestId}/unapprove`
      );
      return response.data;
    } catch (error) {
      logger.error(`取消批准MR失败: ${projectId}/${mergeRequestId}`, error);
      throw error;
    }
  }
}

module.exports = new GitLabApiService();