const gitlabApi = require('./gitlabApi');
const codeAnalyzer = require('./codeAnalyzer');
const config = require('../config/gitlab');
const logger = require('../utils/logger');

class ReviewService {
  // 处理Merge Request
  async processMergeRequest(projectId, mergeRequestId) {
    try {
      logger.info(`开始处理Merge Request: ${projectId}/${mergeRequestId}`);
      
      // 获取MR详情
      const mergeRequest = await gitlabApi.getMergeRequest(projectId, mergeRequestId);
      logger.info(`MR详情: ${mergeRequest.title} by ${mergeRequest.author.name}`);
      
      // 获取变更文件
      const changes = await gitlabApi.getMergeRequestChanges(projectId, mergeRequestId);
      logger.info(`检测到 ${changes.length} 个变更文件`);
      
      // 分析代码
      const analysisResult = codeAnalyzer.analyzeChanges(changes);
      
      // 生成审查报告
      const reviewReport = this.generateReviewReport(analysisResult, mergeRequest);
      
      // 发布评论
      await this.postReviewComment(projectId, mergeRequestId, reviewReport);
      
      // 根据分数决定是否自动批准
      if (config.review.enabled && analysisResult.score >= config.review.autoApproveThreshold) {
        await gitlabApi.approveMergeRequest(projectId, mergeRequestId);
        logger.info(`自动批准MR: 分数 ${analysisResult.score} >= ${config.review.autoApproveThreshold}`);
      }
      
      // 为严重问题创建行内评论
      await this.createInlineComments(projectId, mergeRequestId, analysisResult.issues, changes);
      
      logger.info(`Merge Request处理完成: ${projectId}/${mergeRequestId}`);
      
    } catch (error) {
      logger.error(`处理Merge Request失败: ${projectId}/${mergeRequestId}`, error);
      throw error;
    }
  }

  // 生成审查报告
  generateReviewReport(analysisResult, mergeRequest) {
    const { score, maxScore, summary, issues, suggestions } = analysisResult;
    
    let report = `## 🤖 自动代码审查报告\n\n`;
    
    // 分数和总览
    const scoreEmoji = score >= 90 ? '🟢' : score >= 70 ? '🟡' : '🔴';
    report += `### ${scoreEmoji} 总体评分: ${score}/${maxScore}\n\n`;
    
    report += `**📊 统计信息:**\n`;
    report += `- 📁 分析文件: ${summary.filesAnalyzed}\n`;
    report += `- ➕ 新增代码: ${summary.linesAdded} 行\n`;
    report += `- ➖ 删除代码: ${summary.linesRemoved} 行\n`;
    report += `- 🚨 严重问题: ${summary.criticalIssues}\n`;
    report += `- ⚠️ 警告: ${summary.warnings}\n`;
    report += `- 💡 建议: ${summary.suggestions}\n\n`;
    
    // 问题详情
    if (issues.length > 0) {
      report += `### 🚨 发现的问题\n\n`;
      
      const criticalIssues = issues.filter(issue => issue.severity === 'critical');
      const warnings = issues.filter(issue => issue.severity === 'warning');
      
      if (criticalIssues.length > 0) {
        report += `**严重问题 (${criticalIssues.length}):**\n`;
        criticalIssues.forEach((issue, index) => {
          report += `${index + 1}. **${issue.type}** - ${issue.message}\n`;
          if (issue.file) report += `   📄 文件: \`${issue.file}\`\n`;
          if (issue.line) report += `   📍 行号: ${issue.line}\n`;
          if (issue.code) report += `   💻 代码: \`${issue.code}\`\n`;
          report += '\n';
        });
      }
      
      if (warnings.length > 0) {
        report += `**警告 (${warnings.length}):**\n`;
        warnings.forEach((warning, index) => {
          report += `${index + 1}. **${warning.type}** - ${warning.message}\n`;
          if (warning.file) report += `   📄 文件: \`${warning.file}\`\n`;
          if (warning.line) report += `   📍 行号: ${warning.line}\n`;
          report += '\n';
        });
      }
    }
    
    // 建议
    if (suggestions.length > 0) {
      report += `### 💡 优化建议\n\n`;
      suggestions.slice(0, 5).forEach((suggestion, index) => { // 只显示前5个建议
        report += `${index + 1}. **${suggestion.type}** - ${suggestion.message}\n`;
        if (suggestion.file) report += `   📄 文件: \`${suggestion.file}\`\n`;
        report += '\n';
      });
      
      if (suggestions.length > 5) {
        report += `*还有 ${suggestions.length - 5} 个建议...*\n\n`;
      }
    }
    
    // 总结建议
    report += `### 📋 审查总结\n\n`;
    
    if (score >= 90) {
      report += `✅ **代码质量优秀！** 可以考虑合并。\n\n`;
    } else if (score >= 70) {
      report += `⚠️ **代码质量良好，但有改进空间。** 建议处理上述问题后合并。\n\n`;
    } else {
      report += `❌ **代码质量需要改进。** 强烈建议先处理严重问题和警告。\n\n`;
    }
    
    report += `---\n*🤖 此报告由自动代码审查系统生成 | ${new Date().toLocaleString('zh-CN')}*`;
    
    return report;
  }

  // 发布审查评论
  async postReviewComment(projectId, mergeRequestId, report) {
    try {
      await gitlabApi.createMergeRequestNote(projectId, mergeRequestId, report);
      logger.info('审查报告已发布');
    } catch (error) {
      logger.error('发布审查报告失败:', error);
      throw error;
    }
  }

  // 创建行内评论
  async createInlineComments(projectId, mergeRequestId, issues, changes) {
    const criticalIssues = issues.filter(issue => 
      issue.severity === 'critical' && issue.file && issue.line
    );
    
    // 限制行内评论数量，避免过多评论
    const maxInlineComments = 5;
    const selectedIssues = criticalIssues.slice(0, maxInlineComments);
    
    for (const issue of selectedIssues) {
      try {
        // 找到对应的change
        const change = changes.find(c => c.new_path === issue.file);
        if (!change) continue;
        
        const discussion = {
          body: `🚨 **${issue.type}**: ${issue.message}`,
          position: {
            base_sha: change.diff_refs?.base_sha,
            start_sha: change.diff_refs?.start_sha,
            head_sha: change.diff_refs?.head_sha,
            old_path: change.old_path,
            new_path: change.new_path,
            position_type: 'text',
            new_line: issue.line
          }
        };
        
        await gitlabApi.createMergeRequestDiscussion(projectId, mergeRequestId, discussion);
        logger.info(`创建行内评论: ${issue.file}:${issue.line}`);
        
      } catch (error) {
        logger.warn(`创建行内评论失败: ${issue.file}:${issue.line}`, error.message);
      }
    }
  }
}

module.exports = new ReviewService();