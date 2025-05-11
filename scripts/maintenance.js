/**
 * UNM-Server-hono 维护脚本
 * 
 * 用于定期运行测试、监控和依赖检查
 * 使用方法: node scripts/maintenance.js [options]
 * 
 * 选项:
 *   --test       运行API测试
 *   --monitor    运行监控（默认运行10分钟）
 *   --deps       运行依赖检查
 *   --all        运行所有检查
 *   --time=N     监控运行时间（分钟）
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';

// 将exec转换为Promise
const execAsync = promisify(exec);

// 解析命令行参数
const args = process.argv.slice(2);
const options = {
  test: args.includes('--test') || args.includes('--all'),
  monitor: args.includes('--monitor') || args.includes('--all'),
  deps: args.includes('--deps') || args.includes('--all'),
  time: 10, // 默认监控时间（分钟）
};

// 解析监控时间
const timeArg = args.find(arg => arg.startsWith('--time='));
if (timeArg) {
  const time = parseInt(timeArg.split('=')[1], 10);
  if (!isNaN(time) && time > 0) {
    options.time = time;
  }
}

// 如果没有指定任何选项，显示帮助信息
if (args.length === 0) {
  console.log(chalk.blue('UNM-Server-hono 维护脚本'));
  console.log('');
  console.log('使用方法: node scripts/maintenance.js [options]');
  console.log('');
  console.log('选项:');
  console.log('  --test       运行API测试');
  console.log('  --monitor    运行监控（默认运行10分钟）');
  console.log('  --deps       运行依赖检查');
  console.log('  --all        运行所有检查');
  console.log('  --time=N     监控运行时间（分钟）');
  console.log('');
  console.log('示例:');
  console.log('  node scripts/maintenance.js --all');
  console.log('  node scripts/maintenance.js --test --deps');
  console.log('  node scripts/maintenance.js --monitor --time=30');
  process.exit(0);
}

/**
 * 运行命令
 * @param {string} command 命令
 * @param {string} name 命令名称
 * @returns {Promise<void>}
 */
async function runCommand(command, name) {
  console.log(chalk.blue(`=== 运行${name} ===`));
  
  try {
    const { stdout, stderr } = await execAsync(command);
    
    if (stdout) {
      console.log(stdout);
    }
    
    if (stderr) {
      console.error(chalk.yellow(stderr));
    }
    
    console.log(chalk.green(`${name}完成`));
    console.log('');
  } catch (error) {
    console.error(chalk.red(`${name}失败: ${error.message}`));
    
    if (error.stdout) {
      console.log(error.stdout);
    }
    
    if (error.stderr) {
      console.error(chalk.yellow(error.stderr));
    }
    
    console.log('');
    return false;
  }
  
  return true;
}

/**
 * 运行监控
 * @param {number} minutes 监控时间（分钟）
 * @returns {Promise<void>}
 */
async function runMonitor(minutes) {
  console.log(chalk.blue(`=== 运行监控（${minutes}分钟） ===`));
  
  return new Promise((resolve) => {
    // 启动监控进程
    const child = exec('pnpm monitor');
    
    // 输出监控进程的输出
    child.stdout.on('data', (data) => {
      process.stdout.write(data);
    });
    
    child.stderr.on('data', (data) => {
      process.stderr.write(chalk.yellow(data));
    });
    
    // 设置超时
    const timeout = setTimeout(() => {
      console.log(chalk.blue(`\n监控已运行${minutes}分钟，正在停止...`));
      child.kill();
    }, minutes * 60 * 1000);
    
    // 监听进程退出
    child.on('exit', (code) => {
      clearTimeout(timeout);
      
      if (code === 0 || code === null) {
        console.log(chalk.green('监控完成'));
      } else {
        console.error(chalk.red(`监控失败，退出码: ${code}`));
      }
      
      console.log('');
      resolve(code === 0 || code === null);
    });
    
    // 监听SIGINT信号（Ctrl+C）
    process.on('SIGINT', () => {
      clearTimeout(timeout);
      child.kill();
      console.log(chalk.yellow('\n监控已手动停止'));
      resolve(false);
    });
  });
}

/**
 * 主函数
 */
async function main() {
  console.log(chalk.blue('=== UNM-Server-hono 维护脚本 ==='));
  console.log(chalk.gray(`运行时间: ${new Date().toLocaleString()}`));
  console.log('');
  
  let success = true;
  
  // 运行API测试
  if (options.test) {
    const testSuccess = await runCommand('pnpm test', 'API测试');
    success = success && testSuccess;
  }
  
  // 运行依赖检查
  if (options.deps) {
    const depsSuccess = await runCommand('pnpm check-deps', '依赖检查');
    success = success && depsSuccess;
  }
  
  // 运行监控
  if (options.monitor) {
    const monitorSuccess = await runMonitor(options.time);
    success = success && monitorSuccess;
  }
  
  // 输出总结
  console.log(chalk.blue('=== 维护脚本完成 ==='));
  console.log(chalk.gray(`完成时间: ${new Date().toLocaleString()}`));
  console.log(chalk.gray(`总体状态: ${success ? chalk.green('成功') : chalk.red('失败')}`));
  
  // 如果有任何步骤失败，以非零状态码退出
  if (!success) {
    process.exit(1);
  }
}

// 执行主函数
main().catch((error) => {
  console.error(chalk.red(`维护脚本执行错误: ${error.message}`));
  process.exit(1);
});
