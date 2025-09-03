const config = {
  url: process.env.GITLAB_URL || 'https://gitlab.com',
  token: process.env.GITLAB_TOKEN,
  webhookSecret: process.env.GITLAB_WEBHOOK_SECRET,
  
  // API配置
  apiVersion: 'v4',
  timeout: 30000,
  
  // 审查配置
  review: {
    enabled: process.env.REVIEW_ENABLED === 'true',
    autoApproveThreshold: parseInt(process.env.AUTO_APPROVE_THRESHOLD) || 90,
    minReviewers: parseInt(process.env.MIN_REVIEWERS) || 1
  },

  // 代码分析规则
  codeRules: {
    maxFileSize: 1000, // 行数
    maxMethodLength: 50, // 方法最大行数
    maxComplexity: 10, // 循环复杂度
    
    // 文件类型检查
    allowedExtensions: ['.js', '.ts', '.jsx', '.tsx', '.vue', '.py', '.java', '.go', '.php'],
    
    // 危险模式检查
    dangerousPatterns: [
      /console\.log/g,
      /debugger/g,
      /eval\(/g,
      /document\.write/g,
      /innerHTML\s*=/g
    ],
    
    // 必需的代码模式
    requiredPatterns: {
      '.js': [
        /^['"]use strict['"];?/m // 严格模式
      ]
    }
  }
};

module.exports = config;