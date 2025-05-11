import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { readPackageJson } from '../utils/package.js';
import { logger } from '../utils/logger.js';
import { escapeHtml } from '../middleware/security.js';
import { generateAuthParam, extractQueryParams } from '../utils/auth.js';
import { createValidator, validators } from '../middleware/validator.js';
import { createSuccessResponse, handleApiRequest } from '../utils/response.js';
import { createSanitizer, sanitizers } from '../middleware/sanitizer.js';
import { validateOrigin } from '../utils/api-permissions.js';
import {
  getMusicUrl,
  getMusicCover,
  getMusicLyric,
  searchMusic,
  getMusicUrlBySource,
  DEFAULT_SOURCES
} from '../services/music.js';

// 创建API路由实例
const api = new Hono();

/**
 * 获取服务信息
 */
api.get('/info', async (c) => {
  return handleApiRequest(c, async () => {
    const requestId = c.get('requestId') || 'unknown';
    const packageJson = await readPackageJson();

    logger.info(`获取服务信息`, { requestId });

    return {
      version: packageJson.version,
      enable_flac: process.env.ENABLE_FLAC === 'true',
      api_version: packageJson.version,
      node_version: process.version,
      // 不返回敏感信息，如完整路径、环境变量等
    };
  });
});

/**
 * 测试音源匹配功能
 */
api.get('/test', async (c) => {
  return handleApiRequest(c, async () => {
    // 使用固定ID测试音源匹配
    const testId = 1962165898;
    const testSources = ["kuwo", "pyncmd"];

    // 获取请求ID用于日志跟踪
    const requestId = c.get('requestId') || 'unknown';

    logger.info(`执行音源匹配测试`, {
      requestId,
      testId,
      sources: testSources.join(',')
    });

    const data = await getMusicUrl(testId, testSources);

    logger.info(`测试匹配成功`, {
      requestId,
      source: data.source
    });

    return data;
  });
});

/**
 * 匹配音乐资源
 */
api.get('/match',
  createValidator({
    id: { validator: validators.id, required: true },
    server: { validator: validators.sources(DEFAULT_SOURCES), required: false },
    type: { validator: validators.type(['url', 'pic', 'lrc']), required: false }
  }),
  createSanitizer({
    id: sanitizers.id,
    server: sanitizers.server,
    type: sanitizers.type
  }),
  async (c) => {
    return handleApiRequest(c, async () => {
      const id = c.req.query('id') as string;
      const serverParam = c.req.query('server');
      const type = c.req.query('type') || 'url'; // 默认为获取音乐URL
      const requestId = c.get('requestId') || 'unknown';

      // 解析音源参数
      const sources = serverParam
        ? serverParam.split(',').map(s => s.trim())
        : DEFAULT_SOURCES;

      logger.info(`开始匹配音乐`, {
        requestId,
        id: escapeHtml(id),
        sources: sources.join(','),
        type
      });

      // 根据type参数处理不同的请求
      if (type === 'url') {
        // 执行匹配获取音乐URL
        const data = await getMusicUrl(id, sources);

        logger.info(`匹配音乐URL成功`, {
          requestId,
          id: escapeHtml(id),
          source: data.source
        });

        return data;
      } else if (type === 'pic') {
        // 获取封面图片
        logger.info(`获取音乐封面图片`, {
          requestId,
          id
        });

        const picUrl = await getMusicCover(id);

        logger.info(`音乐封面图片获取成功`, {
          requestId,
          id: escapeHtml(id)
        });

        return {
          id,
          pic: picUrl
        };
      } else if (type === 'lrc') {
        // 获取歌词
        logger.info(`获取音乐歌词`, {
          requestId,
          id
        });

        const lrcContent = await getMusicLyric(id);

        logger.info(`音乐歌词获取成功`, {
          requestId,
          id: escapeHtml(id)
        });

        return {
          id,
          lrc: lrcContent
        };
      }

      return c.json({
        code: 400,
        message: '无效的请求类型',
        requestId: c.get('requestId') || 'unknown'
      }, 400, {
        'Content-Type': 'application/json; charset=utf-8'
      });
    });
  }
);

/**
 * 网易云音乐获取
 */
api.get('/ncmget',
  createValidator({
    id: { validator: validators.id, required: true },
    br: { validator: validators.br(['128', '192', '320', '740', '999']), required: false },
    type: { validator: validators.type(['url', 'pic', 'lrc']), required: false }
  }),
  createSanitizer({
    id: sanitizers.id,
    br: sanitizers.br,
    type: sanitizers.type
  }),
  async (c) => {
    return handleApiRequest(c, async () => {
      const id = c.req.query('id') as string;
      const br = c.req.query('br') || '320';
      const type = c.req.query('type') || 'url'; // 默认为获取音乐URL
      const requestId = c.get('requestId') || 'unknown';

      logger.info(`获取网易云音乐`, {
        requestId,
        id: escapeHtml(id),
        br,
        type
      });

      // 根据type参数处理不同的请求
      if (type === 'url') {
        // 获取音乐URL
        logger.info(`使用match函数获取音乐URL`, {
          requestId,
          id,
          sources: DEFAULT_SOURCES.join(',')
        });

        const matchResult = await getMusicUrl(id, DEFAULT_SOURCES);

        logger.info(`网易云音乐URL获取成功`, {
          requestId,
          id: escapeHtml(id),
          br,
          source: matchResult.source || '未知'
        });

        return {
          id,
          br,
          url: matchResult.url,
          source: matchResult.source || '未知',
          ...(matchResult.size && { size: matchResult.size }),
          ...(matchResult.br && { bitrate: matchResult.br }),
          ...(matchResult.songName && { name: matchResult.songName }),
          ...(matchResult.proxyUrl && { proxyUrl: matchResult.proxyUrl })
        };
      } else if (type === 'pic') {
        // 获取封面图片
        logger.info(`获取音乐封面图片`, {
          requestId,
          id
        });

        const picUrl = await getMusicCover(id);

        logger.info(`音乐封面图片获取成功`, {
          requestId,
          id: escapeHtml(id)
        });

        return {
          id,
          pic: picUrl
        };
      } else if (type === 'lrc') {
        // 获取歌词
        logger.info(`获取音乐歌词`, {
          requestId,
          id
        });

        const lrcContent = await getMusicLyric(id);

        logger.info(`音乐歌词获取成功`, {
          requestId,
          id: escapeHtml(id)
        });

        return {
          id,
          lrc: lrcContent
        };
      }

      return c.json({
        code: 400,
        message: '无效的请求类型',
        requestId: c.get('requestId') || 'unknown'
      }, 400, {
        'Content-Type': 'application/json; charset=utf-8'
      });
    });
  }
);

/**
 * 获取前端所需的API密钥和配置
 * 注意：此API仅供前端页面使用，不应暴露给外部
 *
 * 安全增强：
 * 1. 使用客户端API密钥而非服务器API密钥
 * 2. 实现更严格的来源验证
 * 3. 添加请求频率限制
 * 4. 添加防重放保护
 */
api.get('/config', async (c) => {
  return handleApiRequest(c, async () => {
    const requestId = c.get('requestId') || 'unknown';

    // 获取请求的来源信息
    const origin = c.req.header('Origin') || '';
    const referer = c.req.header('Referer') || '';
    const host = c.req.header('Host') || '';
    const ip = c.req.header('X-Forwarded-For') || '';
    const userAgent = c.req.header('User-Agent') || '';

    logger.info(`获取前端配置`, {
      requestId,
      origin,
      host,
      ip: typeof ip === 'string' ? ip.split(',')[0].trim() : 'unknown'
    });

    // 使用增强的来源验证
    const originValidation = validateOrigin(c);
    if (!originValidation.valid) {
      logger.warn(`非法请求前端配置: ${originValidation.reason}`, {
        requestId,
        origin,
        referer,
        host,
        ip,
        userAgent
      });
      return c.json({
        code: 403,
        message: '禁止访问',
        requestId
      }, 403, {
        'Content-Type': 'application/json; charset=utf-8'
      });
    }

    // 获取客户端API密钥
    const clientApiKey = process.env.CLIENT_API_KEY;

    // 如果未配置客户端API密钥，尝试使用服务器API密钥（向后兼容）
    if (!clientApiKey || clientApiKey.trim() === '') {
      const serverApiKey = process.env.API_KEY;

      // 如果两者都未配置，则返回错误
      if (!serverApiKey || serverApiKey.trim() === '') {
        logger.error('未配置客户端API密钥', new Error('CLIENT_API_KEY not configured'), { requestId });
        return c.json({
          code: 500,
          message: '服务器配置错误',
          requestId
        }, 500, {
          'Content-Type': 'application/json; charset=utf-8'
        });
      }

      // 记录警告，但继续使用服务器API密钥
      logger.warn('未配置客户端API密钥，使用服务器API密钥代替（不推荐）', { requestId });
    }

    // 获取版本号
    const packageJson = await readPackageJson();

    // 返回前端所需的配置
    return {
      // 优先使用客户端API密钥，如果未配置则回退到服务器API密钥
      apiKey: clientApiKey || process.env.API_KEY,
      version: packageJson.version,
      enableFlac: process.env.ENABLE_FLAC === 'true',
      // 不返回敏感信息，如AUTH_SECRET和服务器API密钥
    };
  });
});

/**
 * 其他音源音乐获取
 */
api.get('/otherget',
  createValidator({
    id: { validator: validators.id, required: false },
    name: { validator: validators.name, required: false },
    source: { validator: validators.type(['kuwo', 'kugou', 'migu', 'qq', 'bilibili']), required: false },
    br: { validator: validators.br(['128', '192', '320', '740', '999']), required: false },
    type: { validator: validators.type(['url', 'pic', 'lrc']), required: false }
  }),
  createSanitizer({
    id: sanitizers.id,
    name: sanitizers.name,
    source: sanitizers.source,
    br: sanitizers.br,
    type: sanitizers.type
  }),
  async (c) => {
    return handleApiRequest(c, async () => {
      // 获取参数
      const idParam = c.req.query('id');
      const nameParam = c.req.query('name');
      const source = c.req.query('source') || 'kuwo';
      const br = c.req.query('br') || '320';
      const type = c.req.query('type') || 'url'; // 默认为获取音乐URL
      const requestId = c.get('requestId') || 'unknown';

      // 检查是否提供了id或name参数
      if (!idParam && !nameParam) {
        return c.json({
          code: 400,
          message: '缺少必要参数id或name',
          requestId
        }, 400, {
          'Content-Type': 'application/json; charset=utf-8'
        });
      }

      // 如果提供了name参数但没有id参数，先搜索获取id
      let id: string;
      let songName: string | undefined;

      if (!idParam && nameParam) {
        logger.info(`通过名称搜索音乐`, {
          requestId,
          name: escapeHtml(nameParam),
          source
        });

        try {
          const searchResult = await searchMusic(nameParam, source);
          if (searchResult && searchResult.url_id) {
            id = searchResult.url_id;
            songName = searchResult.name || nameParam;
            logger.info(`搜索音乐成功，获取到ID`, {
              requestId,
              name: escapeHtml(nameParam),
              id,
              songName: songName ? escapeHtml(songName) : undefined
            });
          } else {
            return c.json({
              code: 404,
              message: '未找到匹配的音乐',
              requestId
            }, 404, {
              'Content-Type': 'application/json; charset=utf-8'
            });
          }
        } catch (error) {
          logger.error(`搜索音乐失败`, error as Error);
          return c.json({
            code: 500,
            message: '搜索音乐失败',
            requestId
          }, 500, {
            'Content-Type': 'application/json; charset=utf-8'
          });
        }
      } else if (idParam) {
        id = idParam;
      } else {
        // 这种情况不应该发生，因为前面已经检查了id和name至少有一个
        return c.json({
          code: 400,
          message: '缺少必要参数id或name',
          requestId
        }, 400, {
          'Content-Type': 'application/json; charset=utf-8'
        });
      }

      logger.info(`获取其他音源音乐`, {
        requestId,
        id: escapeHtml(id),
        source,
        br,
        type
      });

      // 根据type参数处理不同的请求
      if (type === 'url') {
        // 获取音乐URL
        logger.info(`使用音源API获取音乐URL`, {
          requestId,
          id,
          source
        });

        const musicResult = await getMusicUrlBySource(id, source, br);

        logger.info(`其他音源音乐URL获取成功`, {
          requestId,
          id: escapeHtml(id),
          source,
          br
        });

        return {
          id,
          br,
          url: musicResult.url,
          source,
          ...(musicResult.size && { size: musicResult.size }),
          ...(musicResult.br && { bitrate: musicResult.br }),
          ...(musicResult.name && { name: musicResult.name }),
          ...(songName && !musicResult.name && { name: songName })
        };
      } else if (type === 'pic') {
        // 获取封面图片
        logger.info(`获取音乐封面图片`, {
          requestId,
          id,
          source
        });

        // 尝试从音源API获取封面图片
        try {
          const musicResult = await getMusicUrlBySource(id, source, br);
          if (musicResult.pic) {
            return {
              id,
              pic: musicResult.pic
            };
          }
        } catch (error) {
          logger.warn(`从音源API获取封面图片失败，尝试使用默认方法`, {
            requestId,
            id,
            source,
            error: (error as Error).message
          });
        }

        // 使用默认方法获取封面图片
        const picUrl = await getMusicCover(id);

        logger.info(`音乐封面图片获取成功`, {
          requestId,
          id: escapeHtml(id),
          source
        });

        return {
          id,
          pic: picUrl
        };
      } else if (type === 'lrc') {
        // 获取歌词
        logger.info(`获取音乐歌词`, {
          requestId,
          id,
          source
        });

        // 尝试从音源API获取歌词
        try {
          const musicResult = await getMusicUrlBySource(id, source, br);
          if (musicResult.lrc) {
            return {
              id,
              lrc: musicResult.lrc
            };
          }
        } catch (error) {
          logger.warn(`从音源API获取歌词失败，尝试使用默认方法`, {
            requestId,
            id,
            source,
            error: (error as Error).message
          });
        }

        // 使用默认方法获取歌词
        const lrcContent = await getMusicLyric(id);

        logger.info(`音乐歌词获取成功`, {
          requestId,
          id: escapeHtml(id),
          source
        });

        return {
          id,
          lrc: lrcContent
        };
      }

      return c.json({
        code: 400,
        message: '无效的请求类型',
        requestId
      }, 400, {
        'Content-Type': 'application/json; charset=utf-8'
      });
    });
  }
);

/**
 * 生成鉴权参数
 */
api.get('/auth', async (c) => {
  return handleApiRequest(c, async () => {
    const requestId = c.get('requestId') || 'unknown';
    const path = c.req.query('path');

    // 验证path参数
    if (!path) {
      return c.json({
        code: 400,
        message: '缺少必要参数path',
        requestId
      }, 400, {
        'Content-Type': 'application/json; charset=utf-8'
      });
    }

    // 获取鉴权密钥
    const authSecret = process.env.AUTH_SECRET;
    if (!authSecret) {
      return c.json({
        code: 500,
        message: '服务器未配置鉴权密钥',
        requestId
      }, 500, {
        'Content-Type': 'application/json; charset=utf-8'
      });
    }

    // 从URL中提取查询参数
    // 获取实际的服务器URL作为基础URL
    const protocol = process.env.ENABLE_HTTPS === 'true' ? 'https' : 'http';
    const host = c.req.header('Host') || 'localhost';
    const baseUrl = `${protocol}://${host}`;

    // 使用实际的服务器URL作为基础URL
    const url = new URL(path, baseUrl);
    const queryParams = extractQueryParams(url.toString());

    // 生成鉴权参数
    const authParam = generateAuthParam(url.pathname, queryParams, authSecret);

    logger.info(`生成鉴权参数`, {
      requestId,
      path: escapeHtml(path)
    });

    return {
      auth: authParam,
      path: url.pathname,
      expires: 300 // 有效期（秒）
    };
  });
});

/**
 * 搜索音乐
 */
api.get('/search',
  createValidator({
    name: { validator: validators.name, required: true },
    source: { validator: validators.type(['kuwo', 'kugou', 'migu', 'qq', 'bilibili']), required: false }
  }),
  createSanitizer({
    name: sanitizers.name,
    source: sanitizers.source
  }),
  async (c) => {
    return handleApiRequest(c, async () => {
      const name = c.req.query('name') as string;
      const source = c.req.query('source') || 'kuwo';
      const requestId = c.get('requestId') || 'unknown';

      logger.info(`搜索音乐`, {
        requestId,
        name: escapeHtml(name),
        source
      });

      const searchResult = await searchMusic(name, source);

      logger.info(`搜索音乐成功`, {
        requestId,
        name: escapeHtml(name),
        source,
        resultCount: searchResult ? 1 : 0
      });

      return searchResult;
    });
  }
);

export { api };
