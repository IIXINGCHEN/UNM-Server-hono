# UNM-Server-hono API 播放指南

## 目录

- [概述](#概述)
- [前置准备](#前置准备)
- [API 接口调用流程](#api-接口调用流程)
- [完整解灰播放实现](#完整解灰播放实现)
  - [获取歌单歌曲](#获取歌单歌曲)
  - [解灰单曲播放](#解灰单曲播放)
  - [批量解灰播放](#批量解灰播放)
- [代码示例](#代码示例)
  - [Vue 组件实现](#vue-组件实现)
  - [JavaScript 原生实现](#javascript-原生实现)
- [常见问题与解决方案](#常见问题与解决方案)
- [性能优化建议](#性能优化建议)

## 概述

本文档详细说明如何在生产环境中调用 UNM-Server-hono API 接口，实现指定歌单中歌曲的完整解灰播放。解灰播放是指将网易云音乐中无法播放（灰色）的歌曲，通过替换音源的方式使其可以正常播放。

## 前置准备

在开始之前，请确保您已经：

1. 部署了 UNM-Server-hono 服务，并确保其在生产环境中正常运行
2. 配置了必要的环境变量（API_KEY, CLIENT_API_KEY, AUTH_SECRET 等）
3. 了解目标歌单的 ID 和歌曲 ID

### 必要的环境变量

```
# 服务器API密钥，用于高权限操作，不应暴露给前端
API_KEY=your_server_api_key

# 客户端API密钥，用于前端访问低权限API
CLIENT_API_KEY=your_client_api_key

# API鉴权密钥，用于生成和验证鉴权参数
AUTH_SECRET=your_auth_secret

# 允许的域名，多个域名用逗号分隔
ALLOWED_DOMAIN=your-domain.com

# 音乐API地址
MUSIC_API_URL=https://music-api.gdstudio.xyz/api.php
```

## API 接口调用流程

在生产环境中调用 API 接口的基本流程如下：

1. 获取 API 密钥（通过 `/api/config` 接口）
2. 获取鉴权参数（通过 `/api/auth` 接口）
3. 调用实际 API 接口（如 `/api/match`, `/api/ncmget` 等）

### 获取 API 密钥

```javascript
async function getApiKey(apiBaseUrl = 'https://your-api-domain.com') {
  try {
    const response = await fetch(`${apiBaseUrl}/api/config`);
    if (!response.ok) {
      throw new Error(`获取API密钥失败: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();

    // 从响应中提取API密钥（支持两种响应格式）
    const apiKey = data.apiKey || (data.data?.apiKey);

    if (!apiKey) {
      throw new Error('API密钥不存在');
    }

    return apiKey;
  } catch (error) {
    console.error('获取API密钥错误:', error);
    throw error;
  }
}
```

### 获取鉴权参数

```javascript
async function getAuthParam(apiKey, path, apiBaseUrl = 'https://your-api-domain.com') {
  try {
    // 使用实际的服务器URL作为基础URL
    const response = await fetch(`${apiBaseUrl}/api/auth?path=${encodeURIComponent(path)}`, {
      headers: {
        'X-API-Key': apiKey,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      // 尝试解析错误响应
      try {
        const errorData = await response.json();
        throw new Error(`获取鉴权参数失败: ${errorData.message || `${response.status} ${response.statusText}`}`);
      } catch (parseError) {
        throw new Error(`获取鉴权参数失败: ${response.status} ${response.statusText}`);
      }
    }

    const data = await response.json();

    // 从响应中提取鉴权参数
    const authParam = data.auth || (data.data?.auth);

    if (!authParam) {
      throw new Error('鉴权参数不存在');
    }

    return authParam;
  } catch (error) {
    console.error('获取鉴权参数错误:', error);
    throw error;
  }
}
```

### 调用 API 接口

```javascript
async function callApi(apiKey, path, authParam, apiBaseUrl = 'https://your-api-domain.com') {
  try {
    const separator = path.includes('?') ? '&' : '?';
    const url = `${apiBaseUrl}${path}${separator}auth=${encodeURIComponent(authParam)}`;

    const response = await fetch(url, {
      headers: {
        'X-API-Key': apiKey,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      // 尝试解析错误响应
      try {
        const errorData = await response.json();
        throw new Error(`API请求失败: ${errorData.message || `${response.status} ${response.statusText}`}`);
      } catch (parseError) {
        throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
      }
    }

    return await response.json();
  } catch (error) {
    console.error('API请求错误:', error);
    throw error;
  }
}
```

## 完整解灰播放实现

### 获取歌单歌曲

要播放指定歌单中的歌曲，首先需要获取歌单信息。由于 UNM-Server-hono 不直接提供获取歌单的 API，我们需要通过网易云音乐的 API 获取歌单信息，然后使用 UNM-Server-hono 的 API 解灰播放。

以下是获取歌单信息的示例代码：

```javascript
async function getPlaylistSongs(playlistId) {
  // 这里使用第三方 API 获取歌单信息
  // 注意：您需要替换为实际可用的 API 地址
  const response = await fetch(`https://netease-cloud-music-api.example.com/playlist/detail?id=${playlistId}`);
  const data = await response.json();

  if (!data.playlist || !data.playlist.tracks) {
    throw new Error('获取歌单信息失败');
  }

  // 提取歌曲信息
  return data.playlist.tracks.map(track => ({
    id: track.id,
    name: track.name,
    artist: track.ar.map(a => a.name).join('/'),
    album: track.al.name,
    duration: track.dt,
    picUrl: track.al.picUrl
  }));
}
```

### 解灰单曲播放

以下是解灰播放单曲的完整实现：

```javascript
async function playSongWithUngreying(songId, apiBaseUrl = 'https://your-api-domain.com') {
  try {
    // 1. 获取 API 密钥
    const apiKey = await getApiKey(apiBaseUrl);
    console.log('API密钥获取成功');

    // 2. 获取音乐 URL
    const musicUrlPath = `/api/match?type=url&id=${songId}`;

    // 获取鉴权参数
    const musicUrlAuth = await getAuthParam(apiKey, musicUrlPath, apiBaseUrl);
    console.log('音乐URL鉴权参数获取成功');

    // 调用音乐URL API
    const musicUrlResponse = await fetch(`${apiBaseUrl}${musicUrlPath}&auth=${encodeURIComponent(musicUrlAuth)}`, {
      headers: { 'X-API-Key': apiKey }
    });

    if (!musicUrlResponse.ok) {
      throw new Error(`获取音乐URL失败: ${musicUrlResponse.status} ${musicUrlResponse.statusText}`);
    }

    const musicUrlData = await musicUrlResponse.json();

    // 从响应中提取数据（支持两种响应格式）
    const musicData = musicUrlData.data || musicUrlData;

    if (!musicData.url) {
      throw new Error('未找到可用音源');
    }

    console.log('音乐URL获取成功:', musicData.url);

    // 3. 获取封面图片
    let picData = null;
    try {
      const picPath = `/api/match?type=pic&id=${songId}`;
      const picAuth = await getAuthParam(apiKey, picPath, apiBaseUrl);

      const picResponse = await fetch(`${apiBaseUrl}${picPath}&auth=${encodeURIComponent(picAuth)}`, {
        headers: { 'X-API-Key': apiKey }
      });

      if (picResponse.ok) {
        const picResponseData = await picResponse.json();
        picData = picResponseData.data || picResponseData;
        console.log('封面图片获取成功');
      }
    } catch (picError) {
      console.warn('获取封面图片失败:', picError);
      // 继续执行，不影响主流程
    }

    // 4. 获取歌词
    let lrcData = null;
    try {
      const lrcPath = `/api/match?type=lrc&id=${songId}`;
      const lrcAuth = await getAuthParam(apiKey, lrcPath, apiBaseUrl);

      const lrcResponse = await fetch(`${apiBaseUrl}${lrcPath}&auth=${encodeURIComponent(lrcAuth)}`, {
        headers: { 'X-API-Key': apiKey }
      });

      if (lrcResponse.ok) {
        const lrcResponseData = await lrcResponse.json();
        lrcData = lrcResponseData.data || lrcResponseData;
        console.log('歌词获取成功');
      }
    } catch (lrcError) {
      console.warn('获取歌词失败:', lrcError);
      // 继续执行，不影响主流程
    }

    // 5. 返回完整的歌曲信息
    return {
      id: songId,
      url: musicData.url,
      source: musicData.source || '未知',
      pic: picData?.pic || null,
      lrc: lrcData?.lrc || null,
      name: musicData.songName || musicData.name || '未知歌曲',
      artist: musicData.artist || musicData.singer || '',
      album: musicData.album || ''
    };
  } catch (error) {
    console.error('解灰播放失败:', error);
    throw error;
  }
}
```

### 批量解灰播放

对于歌单中的多首歌曲，可以实现批量解灰，但需要注意控制并发请求数量，避免触发速率限制：

```javascript
/**
 * 批量解灰歌单中的歌曲
 * @param {Array} songs 歌曲列表
 * @param {string} apiBaseUrl API基础URL
 * @param {number} concurrency 并发请求数量，默认为3
 * @returns {Promise<Array>} 解灰后的歌曲列表
 */
async function batchUngreySongs(songs, apiBaseUrl = 'https://your-api-domain.com', concurrency = 3) {
  try {
    // 获取API密钥（所有请求共用一个密钥）
    const apiKey = await getApiKey(apiBaseUrl);
    console.log(`API密钥获取成功，开始批量解灰 ${songs.length} 首歌曲，并发数: ${concurrency}`);

    // 创建结果数组
    const results = [...songs];

    // 使用队列控制并发
    const queue = new TaskQueue(concurrency);

    // 添加所有任务到队列
    for (let i = 0; i < songs.length; i++) {
      const song = songs[i];
      queue.push(async () => {
        try {
          console.log(`开始解灰歌曲: ${song.name} (ID: ${song.id})`);

          // 获取音乐URL
          const musicUrlPath = `/api/match?type=url&id=${song.id}`;
          const musicUrlAuth = await getAuthParam(apiKey, musicUrlPath, apiBaseUrl);

          const musicUrlResponse = await fetch(`${apiBaseUrl}${musicUrlPath}&auth=${encodeURIComponent(musicUrlAuth)}`, {
            headers: { 'X-API-Key': apiKey }
          });

          if (!musicUrlResponse.ok) {
            throw new Error(`获取音乐URL失败: ${musicUrlResponse.status} ${musicUrlResponse.statusText}`);
          }

          const musicUrlData = await musicUrlResponse.json();
          const musicData = musicUrlData.data || musicUrlData;

          if (!musicData.url) {
            throw new Error('未找到可用音源');
          }

          // 更新结果
          results[i] = {
            ...song,
            url: musicData.url,
            source: musicData.source || '未知',
            name: musicData.songName || musicData.name || song.name,
            artist: musicData.artist || musicData.singer || song.artist || '',
            ungreyed: true
          };

          console.log(`歌曲 ${song.name} 解灰成功，音源: ${results[i].source}`);
        } catch (error) {
          console.warn(`歌曲 ${song.name} (ID: ${song.id}) 解灰失败:`, error);
          // 标记为解灰失败
          results[i] = {
            ...song,
            ungreyFailed: true,
            error: error.message
          };
        }
      });
    }

    // 执行队列
    await queue.run();
    console.log('批量解灰完成');

    return results;
  } catch (error) {
    console.error('批量解灰失败:', error);
    throw error;
  }
}

/**
 * 简单的任务队列实现，用于控制并发
 */
class TaskQueue {
  constructor(concurrency) {
    this.concurrency = concurrency;
    this.running = 0;
    this.queue = [];
    this.results = [];
  }

  push(task) {
    this.queue.push(task);
  }

  async run() {
    return new Promise((resolve) => {
      const executeNext = async () => {
        if (this.running >= this.concurrency || this.queue.length === 0) {
          if (this.running === 0 && this.queue.length === 0) {
            resolve(this.results);
          }
          return;
        }

        this.running++;
        const task = this.queue.shift();

        try {
          const result = await task();
          this.results.push(result);
        } catch (error) {
          console.error('任务执行错误:', error);
        } finally {
          this.running--;
          executeNext();
        }
      };

      // 启动初始任务
      for (let i = 0; i < this.concurrency; i++) {
        executeNext();
      }
    });
  }
}
```

## 代码示例

### Vue 组件实现

以下是一个完整的 Vue 3 组件，用于播放解灰后的歌单：

```vue
<template>
  <div class="playlist-player">
    <h1>{{ playlistTitle }}</h1>

    <div v-if="loading" class="loading">
      <div class="spinner"></div>
      <p>正在加载歌单...</p>
    </div>

    <div v-else-if="error" class="error">
      <p>{{ error }}</p>
      <button @click="loadPlaylist">重试</button>
    </div>

    <div v-else class="player-container">
      <!-- 当前播放歌曲信息 -->
      <div class="now-playing">
        <img v-if="currentSong.pic" :src="currentSong.pic" alt="封面" class="cover" />
        <div v-else class="cover placeholder-cover"></div>

        <div class="song-info">
          <h2>{{ currentSong.name }}</h2>
          <p>{{ currentSong.artist }}</p>
          <p>来源: {{ currentSong.source }}</p>
        </div>
      </div>

      <!-- 音频播放器 -->
      <audio
        ref="audioPlayer"
        controls
        @ended="playNext"
        @error="handlePlayError"
        :src="currentSong.url"
      ></audio>

      <!-- 歌词显示 -->
      <div v-if="currentSong.lrc" class="lyrics">
        <pre>{{ currentSong.lrc }}</pre>
      </div>

      <!-- 歌曲列表 -->
      <div class="song-list">
        <h3>歌单列表</h3>
        <ul>
          <li
            v-for="(song, index) in songs"
            :key="song.id"
            :class="{ active: currentIndex === index, 'ungrey-failed': song.ungreyFailed }"
            @click="playSong(index)"
          >
            <span class="song-index">{{ index + 1 }}</span>
            <span class="song-name">{{ song.name }}</span>
            <span class="song-artist">{{ song.artist }}</span>
            <span v-if="song.ungreyFailed" class="song-status">解灰失败</span>
            <span v-else-if="song.url" class="song-status">已解灰</span>
            <span v-else class="song-status">待解灰</span>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, reactive, onMounted, watch } from 'vue';

export default {
  props: {
    playlistId: {
      type: String,
      required: true
    },
    apiBaseUrl: {
      type: String,
      default: 'https://your-api-domain.com'
    }
  },

  setup(props) {
    const loading = ref(true);
    const error = ref(null);
    const songs = ref([]);
    const currentIndex = ref(0);
    const currentSong = reactive({
      id: '',
      name: '未选择歌曲',
      artist: '',
      url: '',
      pic: '',
      lrc: '',
      source: ''
    });
    const playlistTitle = ref('音乐歌单');
    const audioPlayer = ref(null);

    // 获取API密钥
    async function getApiKey() {
      const response = await fetch(`${props.apiBaseUrl}/api/config`);
      const data = await response.json();
      if (!data.success) {
        throw new Error(`获取API密钥失败: ${data.error}`);
      }
      return data.data.apiKey;
    }

    // 获取鉴权参数
    async function getAuthParam(apiKey, path) {
      const response = await fetch(`${props.apiBaseUrl}/api/auth?path=${encodeURIComponent(path)}`, {
        headers: {
          'X-API-Key': apiKey
        }
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(`获取鉴权参数失败: ${data.error}`);
      }
      return data.data.auth;
    }

    // 解灰单曲
    async function ungreySong(songId, apiKey) {
      try {
        // 获取音乐URL
        const musicUrlPath = `/api/match?type=url&id=${songId}`;
        const musicUrlAuth = await getAuthParam(apiKey, musicUrlPath);

        const musicUrlResponse = await fetch(`${props.apiBaseUrl}${musicUrlPath}&auth=${encodeURIComponent(musicUrlAuth)}`, {
          headers: { 'X-API-Key': apiKey }
        });
        const musicUrlData = await musicUrlResponse.json();

        if (!musicUrlData.success || !musicUrlData.data.url) {
          throw new Error(`获取音乐URL失败: ${musicUrlData.error || '未找到可用音源'}`);
        }

        // 获取封面图片
        const picPath = `/api/match?type=pic&id=${songId}`;
        const picAuth = await getAuthParam(apiKey, picPath);

        const picResponse = await fetch(`${props.apiBaseUrl}${picPath}&auth=${encodeURIComponent(picAuth)}`, {
          headers: { 'X-API-Key': apiKey }
        });
        const picData = await picResponse.json();

        // 获取歌词
        const lrcPath = `/api/match?type=lrc&id=${songId}`;
        const lrcAuth = await getAuthParam(apiKey, lrcPath);

        const lrcResponse = await fetch(`${props.apiBaseUrl}${lrcPath}&auth=${encodeURIComponent(lrcAuth)}`, {
          headers: { 'X-API-Key': apiKey }
        });
        const lrcData = await lrcResponse.json();

        return {
          url: musicUrlData.data.url,
          source: musicUrlData.data.source || '未知',
          pic: picData.success ? picData.data.pic : null,
          lrc: lrcData.success ? lrcData.data.lrc : null
        };
      } catch (error) {
        console.error(`解灰歌曲 ${songId} 失败:`, error);
        throw error;
      }
    }

    // 加载歌单
    async function loadPlaylist() {
      loading.value = true;
      error.value = null;

      try {
        // 获取歌单信息（使用第三方API）
        const playlistResponse = await fetch(`https://netease-cloud-music-api.example.com/playlist/detail?id=${props.playlistId}`);
        const playlistData = await playlistResponse.json();

        if (!playlistData.playlist) {
          throw new Error('获取歌单信息失败');
        }

        playlistTitle.value = playlistData.playlist.name;

        // 提取歌曲信息
        songs.value = playlistData.playlist.tracks.map(track => ({
          id: track.id,
          name: track.name,
          artist: track.ar.map(a => a.name).join('/'),
          album: track.al.name,
          duration: track.dt,
          picUrl: track.al.picUrl
        }));

        // 默认选择第一首歌
        if (songs.value.length > 0) {
          currentIndex.value = 0;
          await playSong(0);
        }

        loading.value = false;
      } catch (err) {
        error.value = `加载歌单失败: ${err.message}`;
        loading.value = false;
      }
    }

    // 播放指定索引的歌曲
    async function playSong(index) {
      if (index < 0 || index >= songs.value.length) {
        return;
      }

      currentIndex.value = index;
      const song = songs.value[index];

      // 如果歌曲已经解灰，直接播放
      if (song.url) {
        Object.assign(currentSong, song);
        if (audioPlayer.value) {
          audioPlayer.value.load();
          audioPlayer.value.play().catch(err => {
            console.error('播放失败:', err);
          });
        }
        return;
      }

      // 否则，先解灰再播放
      try {
        const apiKey = await getApiKey();
        const ungreyedData = await ungreySong(song.id, apiKey);

        // 更新歌曲信息
        songs.value[index] = {
          ...song,
          ...ungreyedData
        };

        // 更新当前播放歌曲
        Object.assign(currentSong, songs.value[index]);

        // 播放
        if (audioPlayer.value) {
          audioPlayer.value.load();
          audioPlayer.value.play().catch(err => {
            console.error('播放失败:', err);
          });
        }
      } catch (err) {
        songs.value[index].ungreyFailed = true;
        songs.value[index].error = err.message;
        error.value = `解灰歌曲失败: ${err.message}`;
      }
    }

    // 播放下一首
    function playNext() {
      const nextIndex = (currentIndex.value + 1) % songs.value.length;
      playSong(nextIndex);
    }

    // 处理播放错误
    function handlePlayError() {
      const song = songs.value[currentIndex.value];
      error.value = `播放歌曲 "${song.name}" 失败，可能是音源不可用`;

      // 标记为解灰失败
      song.ungreyFailed = true;

      // 自动尝试下一首
      setTimeout(() => {
        playNext();
      }, 3000);
    }

    // 组件挂载时加载歌单
    onMounted(() => {
      loadPlaylist();
    });

    // 监听 playlistId 变化，重新加载歌单
    watch(() => props.playlistId, (newId) => {
      if (newId) {
        loadPlaylist();
      }
    });

    return {
      loading,
      error,
      songs,
      currentIndex,
      currentSong,
      playlistTitle,
      audioPlayer,
      loadPlaylist,
      playSong,
      playNext,
      handlePlayError
    };
  }
};
</script>
```

## 常见问题与解决方案

### 1. 音源不可用

**问题**：解灰后的音源链接无法播放。

**解决方案**：
- 尝试使用不同的音源（通过 `server` 参数指定，如 `server=kuwo,kugou,bilibili`）
- 检查服务器是否配置了反向代理（对于不支持 HTTPS 的音源）
- 实现自动切换音源的逻辑，当一个音源失败时尝试其他音源
- 检查 `PROXY_URL` 环境变量是否正确配置（若需要接口反代）
- 确保 `MUSIC_API_URL` 环境变量指向有效的音乐API地址

### 2. 鉴权失败

**问题**：API 调用返回 401 错误。

**解决方案**：
- 确保 API_KEY、CLIENT_API_KEY 和 AUTH_SECRET 正确配置
- 检查鉴权参数是否过期（有效期为 300 秒）
- 确保请求路径与获取鉴权参数时的路径完全一致
- 检查响应格式处理是否正确（支持两种响应格式：直接返回和包含在data字段中）
- 确保使用了正确的API密钥类型（客户端/服务器）访问相应权限级别的API

### 3. 速率限制

**问题**：批量解灰时触发速率限制（429 Too Many Requests）。

**解决方案**：
- 实现请求队列，控制并发请求数量（如示例中的 `TaskQueue` 类）
- 添加请求重试逻辑，遇到 429 错误时使用指数退避策略延迟重试
- 调整服务器端的 RATE_LIMIT 配置（默认为每IP每分钟100次请求）
- 实现缓存机制，避免重复请求相同的资源

### 4. 响应格式不一致

**问题**：API 响应格式可能有两种不同的结构。

**解决方案**：
- 使用灵活的数据提取方式：`const data = response.data || response;`
- 使用可选链操作符：`const apiKey = data.apiKey || (data.data?.apiKey);`
- 添加适当的错误处理和日志记录，帮助诊断问题

### 5. CORS 问题

**问题**：浏览器中调用 API 时遇到跨域资源共享 (CORS) 错误。

**解决方案**：
- 确保服务器配置了正确的 CORS 头（已在服务器端实现）
- 检查 `ALLOWED_DOMAIN` 环境变量是否包含您的前端域名
- 如果在本地开发环境测试，可以临时使用浏览器插件禁用 CORS 检查
- 考虑使用服务器端代理转发请求，避免浏览器端的 CORS 限制

## 性能优化建议

1. **缓存解灰结果**：将解灰后的歌曲信息缓存在本地存储中，避免重复请求
   ```javascript
   // 缓存实现示例
   const CACHE_KEY_PREFIX = 'unm_song_';
   const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24小时过期

   // 从缓存获取歌曲信息
   function getSongFromCache(songId) {
     const cacheKey = `${CACHE_KEY_PREFIX}${songId}`;
     const cachedData = localStorage.getItem(cacheKey);

     if (cachedData) {
       try {
         const { data, timestamp } = JSON.parse(cachedData);
         // 检查缓存是否过期
         if (Date.now() - timestamp < CACHE_EXPIRY) {
           console.log(`从缓存获取歌曲 ${songId}`);
           return data;
         }
       } catch (e) {
         console.warn('缓存数据解析失败:', e);
       }
     }

     return null;
   }

   // 将歌曲信息保存到缓存
   function saveSongToCache(songId, songData) {
     const cacheKey = `${CACHE_KEY_PREFIX}${songId}`;
     const cacheData = {
       data: songData,
       timestamp: Date.now()
     };

     try {
       localStorage.setItem(cacheKey, JSON.stringify(cacheData));
       console.log(`歌曲 ${songId} 已缓存`);
     } catch (e) {
       console.warn('缓存保存失败:', e);
     }
   }
   ```

2. **懒加载策略**：只解灰当前播放和即将播放的歌曲，而不是一次性解灰整个歌单
   ```javascript
   // 懒加载实现示例
   function initPlaylist(songs) {
     // 初始化时只解灰第一首歌曲
     if (songs.length > 0) {
       playSongWithUngreying(songs[0].id).then(songData => {
         // 更新当前歌曲
         currentSong.value = { ...songs[0], ...songData };

         // 预加载下一首
         if (songs.length > 1) {
           preloadNextSong(songs[1].id);
         }
       });
     }
   }
   ```

3. **预加载机制**：在播放当前歌曲时，预加载下一首歌曲
   ```javascript
   // 预加载下一首歌曲
   function preloadNextSong(songId) {
     // 检查缓存
     if (getSongFromCache(songId)) {
       console.log(`歌曲 ${songId} 已在缓存中，无需预加载`);
       return;
     }

     console.log(`预加载歌曲 ${songId}`);
     playSongWithUngreying(songId)
       .then(songData => {
         // 保存到缓存
         saveSongToCache(songId, songData);
       })
       .catch(error => {
         console.warn(`预加载歌曲 ${songId} 失败:`, error);
       });
   }
   ```

4. **错误重试**：对于解灰失败的歌曲，实现智能重试机制
   ```javascript
   // 带重试的API调用
   async function fetchWithRetry(url, options = {}, maxRetries = 3, initialDelay = 1000) {
     let retries = 0;
     let delay = initialDelay;

     while (true) {
       try {
         const response = await fetch(url, options);

         // 如果是速率限制错误，则重试
         if (response.status === 429 && retries < maxRetries) {
           retries++;
           console.warn(`请求被限制，第 ${retries} 次重试，等待 ${delay}ms...`);
           await new Promise(resolve => setTimeout(resolve, delay));
           // 指数退避策略
           delay *= 2;
           continue;
         }

         // 其他错误直接抛出
         if (!response.ok) {
           throw new Error(`请求失败: ${response.status} ${response.statusText}`);
         }

         return await response.json();
       } catch (error) {
         if (retries < maxRetries) {
           retries++;
           console.warn(`请求失败，第 ${retries} 次重试，等待 ${delay}ms...`, error);
           await new Promise(resolve => setTimeout(resolve, delay));
           // 指数退避策略
           delay *= 2;
         } else {
           throw error;
         }
       }
     }
   }
   ```

5. **并发控制**：限制同时发起的 API 请求数量，避免服务器过载
   ```javascript
   // 使用前面定义的 TaskQueue 类控制并发
   const apiQueue = new TaskQueue(3); // 最多3个并发请求

   // 将API请求添加到队列
   function queueApiRequest(apiCall) {
     return new Promise((resolve, reject) => {
       apiQueue.push(async () => {
         try {
           const result = await apiCall();
           resolve(result);
           return result;
         } catch (error) {
           reject(error);
           throw error;
         }
       });
     });
   }

   // 使用示例
   queueApiRequest(() => playSongWithUngreying(songId))
     .then(result => console.log('API调用成功:', result))
     .catch(error => console.error('API调用失败:', error));
   ```

6. **API响应格式统一处理**：创建统一的API调用函数，处理不同的响应格式
   ```javascript
   // 统一的API调用函数
   async function callUnmApi(apiKey, path, authParam, apiBaseUrl = 'https://your-api-domain.com') {
     try {
       const separator = path.includes('?') ? '&' : '?';
       const url = `${apiBaseUrl}${path}${separator}auth=${encodeURIComponent(authParam)}`;

       const response = await fetchWithRetry(url, {
         headers: { 'X-API-Key': apiKey }
       });

       // 统一处理两种可能的响应格式
       return {
         success: true,
         data: response.data || response,
         raw: response
       };
     } catch (error) {
       return {
         success: false,
         error: error.message,
         raw: null
       };
     }
   }
   ```
