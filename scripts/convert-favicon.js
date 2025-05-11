/**
 * 将 PNG 格式的 favicon 转换为 ICO 格式
 *
 * 使用方法：
 * 1. 安装依赖：pnpm add -D sharp
 * 2. 运行脚本：node scripts/convert-favicon.js
 */

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 路径配置
const pngPath = path.join(__dirname, '../public/favicon.png');
const icoPath = path.join(__dirname, '../public/favicon.ico');

// 确保目录存在
const dir = path.dirname(icoPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

// 转换函数
async function convertPngToIco() {
  try {
    console.log('开始转换 favicon.png 到 favicon.ico...');

    // 读取 PNG 文件
    const pngBuffer = fs.readFileSync(pngPath);

    // 使用 sharp 转换为 ICO 格式
    // ICO 格式通常包含多个尺寸的图像，这里我们生成 16x16, 32x32, 48x48 三种尺寸
    const sizes = [16, 32, 48];
    const buffers = await Promise.all(
      sizes.map(size =>
        sharp(pngBuffer)
          .resize(size, size)
          .toFormat('png')
          .toBuffer()
      )
    );

    // 创建 ICO 文件头
    const header = Buffer.alloc(6);
    header.writeUInt16LE(0, 0); // 保留字段，必须为0
    header.writeUInt16LE(1, 2); // 图像类型，1表示ICO
    header.writeUInt16LE(sizes.length, 4); // 图像数量

    // 创建 ICO 目录条目
    let offset = 6 + (16 * sizes.length); // 头部 + 所有目录条目的大小
    const entries = [];

    for (let i = 0; i < sizes.length; i++) {
      const size = sizes[i];
      const buffer = buffers[i];

      const entry = Buffer.alloc(16);
      entry.writeUInt8(size, 0); // 宽度
      entry.writeUInt8(size, 1); // 高度
      entry.writeUInt8(0, 2); // 调色板数量，0表示无调色板
      entry.writeUInt8(0, 3); // 保留字段，必须为0
      entry.writeUInt16LE(1, 4); // 颜色平面数，必须为1
      entry.writeUInt16LE(32, 6); // 每像素位数
      entry.writeUInt32LE(buffer.length, 8); // 图像数据大小
      entry.writeUInt32LE(offset, 12); // 图像数据偏移量

      entries.push(entry);
      offset += buffer.length;
    }

    // 合并所有数据
    const ico = Buffer.concat([
      header,
      ...entries,
      ...buffers
    ]);

    // 写入 ICO 文件
    fs.writeFileSync(icoPath, ico);

    console.log(`转换完成！ICO 文件已保存到: ${icoPath}`);
  } catch (error) {
    console.error('转换过程中出错:', error);
  }
}

// 执行转换
convertPngToIco();
