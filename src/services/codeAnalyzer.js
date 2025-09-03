const config = require('../config/gitlab');
const logger = require('../utils/logger');

class CodeAnalyzer {
  constructor() {
    this.rules = config.codeRules;
  }

  // 分析代码变更
  analyzeChanges(changes) {
    const results = {
      score: 0,
      maxScore: 100,
      issues: [],
      suggestions: [],
      summary: {
        filesAnalyzed: 0,
        linesAdded: 0,
        linesRemoved: 0,
        criticalIssues: 0,
        warnings: 0,
        suggestions: 0
      }
    };

    changes.forEach(change => {
      if (this.shouldAnalyzeFile(change.new_path)) {
        const fileResult = this.analyzeFile(change);
        results.issues.push(...fileResult.issues);
        results.suggestions.push(...fileResult.suggestions);
        results.summary.filesAnalyzed++;
        results.summary.linesAdded += change.diff?.split('\n').filter(line => line.startsWith('+')).length || 0;
        results.summary.linesRemoved += change.diff?.split('\n').filter(line => line.startsWith('-')).length || 0;
      }
    });

    // 计算总分
    results.summary.criticalIssues = results.issues.filter(issue => issue.severity === 'critical').length;
    results.summary.warnings = results.issues.filter(issue => issue.severity === 'warning').length;
    results.summary.suggestions = results.suggestions.length;

    results.score = this.calculateScore(results);

    logger.info(`代码分析完成: 分数 ${results.score}/${results.maxScore}, 文件数 ${results.summary.filesAnalyzed}`);
    
    return results;
  }

  // 检查是否需要分析文件
  shouldAnalyzeFile(filePath) {
    if (!filePath) return false;
    
    const extension = this.getFileExtension(filePath);
    return this.rules.allowedExtensions.includes(extension);
  }

  // 分析单个文件
  analyzeFile(change) {
    const result = {
      issues: [],
      suggestions: []
    };

    const filePath = change.new_path;
    const diff = change.diff || '';
    const addedLines = this.getAddedLines(diff);

    // 检查文件大小
    if (addedLines.length > this.rules.maxFileSize) {
      result.issues.push({
        type: 'file_size',
        severity: 'warning',
        message: `文件过大: ${addedLines.length}行，建议拆分为更小的模块`,
        file: filePath,
        line: null
      });
    }

    // 分析添加的代码行
    addedLines.forEach((line, index) => {
      const lineNumber = this.getLineNumber(diff, index);
      
      // 检查危险模式
      this.checkDangerousPatterns(line.content, filePath, lineNumber, result);
      
      // 检查代码质量
      this.checkCodeQuality(line.content, filePath, lineNumber, result);
      
      // 检查最佳实践
      this.checkBestPractices(line.content, filePath, lineNumber, result);
    });

    // 检查必需模式
    this.checkRequiredPatterns(addedLines, filePath, result);

    return result;
  }

  // 获取添加的代码行
  getAddedLines(diff) {
    const lines = diff.split('\n');
    const addedLines = [];
    
    lines.forEach((line, index) => {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        addedLines.push({
          content: line.substring(1), // 移除+号
          originalIndex: index
        });
      }
    });
    
    return addedLines;
  }

  // 获取行号
  getLineNumber(diff, addedLineIndex) {
    // 简化的行号计算，实际应该解析diff header
    return addedLineIndex + 1;
  }

  // 检查危险模式
  checkDangerousPatterns(line, file, lineNumber, result) {
    this.rules.dangerousPatterns.forEach(pattern => {
      if (pattern.test(line)) {
        result.issues.push({
          type: 'dangerous_pattern',
          severity: 'critical',
          message: `检测到危险代码模式: ${pattern.source}`,
          file,
          line: lineNumber,
          code: line.trim()
        });
      }
    });
  }

  // 检查代码质量
  checkCodeQuality(line, file, lineNumber, result) {
    const trimmedLine = line.trim();
    
    // 检查长行
    if (line.length > 120) {
      result.issues.push({
        type: 'line_length',
        severity: 'warning',
        message: `代码行过长: ${line.length}字符，建议不超过120字符`,
        file,
        line: lineNumber
      });
    }
    
    // 检查TODO/FIXME
    if (/(?:TODO|FIXME|XXX|HACK)/i.test(trimmedLine)) {
      result.suggestions.push({
        type: 'todo',
        message: '发现TODO/FIXME注释，建议在合并前处理',
        file,
        line: lineNumber,
        code: trimmedLine
      });
    }
    
    // 检查空catch块
    if (/catch\s*\(\s*\w*\s*\)\s*\{\s*\}/.test(trimmedLine)) {
      result.issues.push({
        type: 'empty_catch',
        severity: 'warning',
        message: '空的catch块，应该至少记录错误',
        file,
        line: lineNumber
      });
    }
  }

  // 检查最佳实践
  checkBestPractices(line, file, lineNumber, result) {
    const trimmedLine = line.trim();
    
    // 检查变量命名
    const variableMatch = /(?:let|const|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g.exec(trimmedLine);
    if (variableMatch) {
      const varName = variableMatch[1];
      if (varName.length === 1 && !['i', 'j', 'k'].includes(varName)) {
        result.suggestions.push({
          type: 'naming',
          message: `变量名过短: "${varName}"，建议使用更有意义的名称`,
          file,
          line: lineNumber
        });
      }
    }
    
    // 检查函数长度（简化版）
    if (/function\s+\w+/.test(trimmedLine) || /=>\s*\{/.test(trimmedLine)) {
      // 这里应该有更复杂的逻辑来计算函数长度
      result.suggestions.push({
        type: 'function_complexity',
        message: '新增函数，请确保函数职责单一且长度适中',
        file,
        line: lineNumber
      });
    }
  }

  // 检查必需模式
  checkRequiredPatterns(addedLines, file, result) {
    const extension = this.getFileExtension(file);
    const requiredPatterns = this.rules.requiredPatterns[extension];
    
    if (requiredPatterns) {
      const fileContent = addedLines.map(line => line.content).join('\n');
      
      requiredPatterns.forEach(pattern => {
        if (!pattern.test(fileContent)) {
          result.suggestions.push({
            type: 'required_pattern',
            message: `建议添加: ${pattern.source}`,
            file,
            line: 1
          });
        }
      });
    }
  }

  // 获取文件扩展名
  getFileExtension(filePath) {
    const match = filePath.match(/\.[^.]*$/);
    return match ? match[0] : '';
  }

  // 计算总分
  calculateScore(results) {
    let score = 100;
    
    // 严重问题扣分更多
    score -= results.summary.criticalIssues * 15;
    score -= results.summary.warnings * 5;
    score -= results.summary.suggestions * 1;
    
    // 确保分数不低于0
    return Math.max(0, score);
  }
}

module.exports = new CodeAnalyzer();