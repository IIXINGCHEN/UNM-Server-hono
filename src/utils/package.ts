import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packagePath = path.resolve(__dirname, '../../package.json');

export interface PackageJson {
  name: string;
  version: string;
  description: string;
  [key: string]: any;
}

export const readPackageJson = async (): Promise<PackageJson> => {
  try {
    const data = await fs.readFile(packagePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('读取package.json失败:', error);
    return {
      name: 'unm-server',
      version: '1.0.9',
      description: '网易云解灰-API服务'
    };
  }
};
