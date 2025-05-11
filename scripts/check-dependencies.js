/**
 * UNM-Server-hono 依赖更新检查脚本
 *
 * 用于检查依赖是否需要更新，确保安全性和稳定性
 * 使用方法: node scripts/check-dependencies.js
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
// 注意：以下导入和变量声明暂时注释掉，但保留以便将来可能的扩展
// import { fileURLToPath } from 'url';
// 获取当前文件的目录
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// 将exec转换为Promise
const execAsync = promisify(exec);

// 配置
const config = {
  packageJsonPath: path.resolve(process.cwd(), 'package.json'),
  outputPath: path.resolve(process.cwd(), 'dependency-report.md'),
  checkVulnerabilities: true,
  checkOutdated: true,
};

/**
 * 读取package.json
 * @returns {Promise<object>} package.json内容
 */
async function readPackageJson() {
  try {
    const content = await fs.readFile(config.packageJsonPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(chalk.red(`读取package.json失败: ${error.message}`));
    throw error;
  }
}

/**
 * 检查过时的依赖
 * @returns {Promise<object>} 过时的依赖信息
 */
async function checkOutdatedDependencies() {
  try {
    console.log(chalk.blue('正在检查过时的依赖...'));
    const { stdout } = await execAsync('pnpm outdated --json');

    if (!stdout.trim()) {
      return {};
    }

    return JSON.parse(stdout);
  } catch (error) {
    // 如果没有过时的依赖，pnpm outdated会返回非零状态码
    if (error.stdout) {
      try {
        return JSON.parse(error.stdout);
      } catch (parseError) {
        console.log(chalk.green('没有过时的依赖'));
        return {};
      }
    }

    console.error(chalk.red(`检查过时的依赖失败: ${error.message}`));
    return {};
  }
}

/**
 * 检查安全漏洞
 * @returns {Promise<object>} 安全漏洞信息
 */
async function checkVulnerabilities() {
  try {
    console.log(chalk.blue('正在检查安全漏洞...'));

    // 首先尝试使用当前注册表
    try {
      const { stdout } = await execAsync('pnpm audit --json');

      if (!stdout.trim()) {
        return { vulnerabilities: {} };
      }

      return JSON.parse(stdout);
    } catch (registryError) {
      // 检查是否是注册表端点不存在的错误
      if (registryError.message && registryError.message.includes('audit endpoint') && registryError.message.includes('doesn\'t exist')) {
        console.log(chalk.yellow('当前 npm 注册表不支持审计功能，尝试使用官方注册表...'));

        // 尝试使用官方注册表
        try {
          const { stdout } = await execAsync('pnpm audit --registry=https://registry.npmjs.org --json');

          if (!stdout.trim()) {
            return { vulnerabilities: {} };
          }

          return JSON.parse(stdout);
        } catch (officialRegistryError) {
          // 如果有安全漏洞，pnpm audit会返回非零状态码
          if (officialRegistryError.stdout) {
            try {
              return JSON.parse(officialRegistryError.stdout);
            } catch (parseError) {
              console.error(chalk.red(`解析安全漏洞信息失败: ${parseError.message}`));
              return { vulnerabilities: {} };
            }
          }

          console.log(chalk.yellow('使用官方注册表审计也失败，提供备选建议...'));
          console.log(chalk.yellow('建议手动运行: npm audit --registry=https://registry.npmjs.org'));
          return { vulnerabilities: {} };
        }
      }

      // 如果有安全漏洞，pnpm audit会返回非零状态码
      if (registryError.stdout) {
        try {
          return JSON.parse(registryError.stdout);
        } catch (parseError) {
          console.error(chalk.red(`解析安全漏洞信息失败: ${parseError.message}`));
          return { vulnerabilities: {} };
        }
      }

      console.error(chalk.red(`检查安全漏洞失败: ${registryError.message}`));
      return { vulnerabilities: {} };
    }
  } catch (error) {
    console.error(chalk.red(`检查安全漏洞失败: ${error.message}`));
    return { vulnerabilities: {} };
  }
}

/**
 * 生成依赖报告
 * @param {object} packageJson package.json内容
 * @param {object} outdated 过时的依赖信息
 * @param {object} audit 安全漏洞信息
 * @returns {string} 依赖报告
 */
function generateReport(packageJson, outdated, audit) {
  const now = new Date();
  let report = `# UNM-Server-hono 依赖报告\n\n`;
  report += `生成时间: ${now.toLocaleString()}\n\n`;

  // 项目信息
  report += `## 项目信息\n\n`;
  report += `- 名称: ${packageJson.name}\n`;
  report += `- 版本: ${packageJson.version}\n`;
  report += `- 描述: ${packageJson.description || '无'}\n\n`;

  // 依赖统计
  const dependencies = Object.keys(packageJson.dependencies || {}).length;
  const devDependencies = Object.keys(packageJson.devDependencies || {}).length;
  report += `## 依赖统计\n\n`;
  report += `- 生产依赖: ${dependencies}\n`;
  report += `- 开发依赖: ${devDependencies}\n`;
  report += `- 总计: ${dependencies + devDependencies}\n\n`;

  // 过时的依赖
  const outdatedDeps = Object.entries(outdated);
  report += `## 过时的依赖 (${outdatedDeps.length})\n\n`;

  if (outdatedDeps.length === 0) {
    report += `没有过时的依赖，太棒了！\n\n`;
  } else {
    report += `| 依赖 | 当前版本 | 最新版本 | 类型 | 建议 |\n`;
    report += `| --- | --- | --- | --- | --- |\n`;

    outdatedDeps.forEach(([name, info]) => {
      const current = info.current;
      const latest = info.latest;
      const type = info.type || '未知';

      // 根据版本差异提供建议
      let recommendation = '';
      if (info.latest.startsWith(info.current.split('.')[0])) {
        // 主版本号相同，建议更新
        recommendation = '✅ 建议更新';
      } else {
        // 主版本号不同，可能有破坏性变更
        recommendation = '⚠️ 谨慎更新，可能有破坏性变更';
      }

      report += `| ${name} | ${current} | ${latest} | ${type} | ${recommendation} |\n`;
    });

    report += `\n`;
  }

  // 安全漏洞
  const vulnerabilities = Object.values(audit.vulnerabilities || {});
  report += `## 安全漏洞 (${vulnerabilities.length})\n\n`;

  if (vulnerabilities.length === 0) {
    report += `没有安全漏洞，太棒了！\n\n`;
  } else {
    report += `| 依赖 | 严重程度 | 漏洞描述 | 建议 |\n`;
    report += `| --- | --- | --- | --- |\n`;

    vulnerabilities.forEach((vuln) => {
      const name = vuln.name;
      const severity = vuln.severity;
      const description = vuln.title || '无描述';

      // 根据严重程度提供建议
      let recommendation = '';
      if (severity === 'critical' || severity === 'high') {
        recommendation = '🚨 立即更新';
      } else if (severity === 'moderate') {
        recommendation = '⚠️ 尽快更新';
      } else {
        recommendation = '📝 计划更新';
      }

      report += `| ${name} | ${severity} | ${description} | ${recommendation} |\n`;
    });

    report += `\n`;
  }

  // 更新建议
  report += `## 更新建议\n\n`;

  if (outdatedDeps.length === 0 && vulnerabilities.length === 0) {
    report += `所有依赖都是最新的，没有已知的安全漏洞。继续保持！\n\n`;
  } else {
    // 高优先级更新
    const highPriorityUpdates = [
      ...vulnerabilities.filter(v => v.severity === 'critical' || v.severity === 'high').map(v => v.name),
      ...outdatedDeps.filter(([_, info]) => info.type === 'dependencies').map(([name]) => name)
    ];

    if (highPriorityUpdates.length > 0) {
      report += `### 高优先级更新\n\n`;
      report += `以下依赖应该尽快更新：\n\n`;
      highPriorityUpdates.forEach(name => {
        report += `- ${name}\n`;
      });
      report += `\n`;

      report += `更新命令：\n\n`;
      report += `\`\`\`bash\npnpm update ${highPriorityUpdates.join(' ')}\n\`\`\`\n\n`;
    }

    // 常规更新
    const regularUpdates = outdatedDeps
      .filter(([name]) => !highPriorityUpdates.includes(name))
      .map(([name]) => name);

    if (regularUpdates.length > 0) {
      report += `### 常规更新\n\n`;
      report += `以下依赖可以在方便时更新：\n\n`;
      regularUpdates.forEach(name => {
        report += `- ${name}\n`;
      });
      report += `\n`;

      report += `更新命令：\n\n`;
      report += `\`\`\`bash\npnpm update ${regularUpdates.join(' ')}\n\`\`\`\n\n`;
    }
  }

  // 定期更新建议
  report += `## 定期更新计划\n\n`;
  report += `为确保项目的安全性和稳定性，建议按照以下计划定期更新依赖：\n\n`;
  report += `- **每周**：运行 \`pnpm audit\` 检查安全漏洞\n`;
  report += `- **每两周**：更新补丁版本 (\`pnpm update --patch\`)\n`;
  report += `- **每月**：更新次要版本 (\`pnpm update --minor\`)\n`;
  report += `- **每季度**：评估主要版本更新\n\n`;

  report += `可以通过以下命令生成新的依赖报告：\n\n`;
  report += `\`\`\`bash\nnode scripts/check-dependencies.js\n\`\`\`\n`;

  return report;
}

/**
 * 保存报告到文件
 * @param {string} report 报告内容
 * @returns {Promise<void>}
 */
async function saveReport(report) {
  try {
    await fs.writeFile(config.outputPath, report, 'utf-8');
    console.log(chalk.green(`依赖报告已保存到 ${config.outputPath}`));
  } catch (error) {
    console.error(chalk.red(`保存依赖报告失败: ${error.message}`));
    throw error;
  }
}

/**
 * 主函数
 */
async function main() {
  try {
    console.log(chalk.blue('=== UNM-Server-hono 依赖检查 ==='));

    // 读取package.json
    const packageJson = await readPackageJson();

    // 检查过时的依赖
    const outdated = config.checkOutdated ? await checkOutdatedDependencies() : {};

    // 检查安全漏洞
    const audit = config.checkVulnerabilities ? await checkVulnerabilities() : { vulnerabilities: {} };

    // 生成报告
    const report = generateReport(packageJson, outdated, audit);

    // 保存报告
    await saveReport(report);

    // 输出摘要
    const outdatedCount = Object.keys(outdated).length;
    const vulnerabilitiesCount = Object.keys(audit.vulnerabilities || {}).length;

    console.log(chalk.blue('\n=== 依赖检查摘要 ==='));
    console.log(`过时的依赖: ${outdatedCount === 0 ? chalk.green(outdatedCount) : chalk.yellow(outdatedCount)}`);
    console.log(`安全漏洞: ${vulnerabilitiesCount === 0 ? chalk.green(vulnerabilitiesCount) : chalk.red(vulnerabilitiesCount)}`);
    console.log(chalk.blue('\n详细信息请查看依赖报告。'));
  } catch (error) {
    console.error(chalk.red(`依赖检查失败: ${error.message}`));
    process.exit(1);
  }
}

// 执行主函数
main();
