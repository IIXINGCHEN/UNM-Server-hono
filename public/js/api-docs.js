/**
 * API文档交互增强脚本
 */
document.addEventListener('DOMContentLoaded', function () {
  // 初始化语法高亮
  initSyntaxHighlighting();

  // 初始化复制功能
  initCopyButtons();

  // 初始化折叠/展开功能
  initExpandCollapse();

  // 初始化API测试功能
  initApiTesting();

  // 初始化真实API响应示例
  initRealApiExamples();

  // 初始化API操作按钮
  initApiActionButtons();
});

/**
 * 初始化语法高亮
 */
function initSyntaxHighlighting() {
  // 检查是否已加载语法高亮库
  if (window.hljs) {
    document.querySelectorAll('pre code').forEach(block => {
      hljs.highlightBlock(block);
    });
  } else if (window.Prism) {
    Prism.highlightAll();
  } else {
    console.warn('未检测到语法高亮库 (highlight.js 或 Prism.js)');

    // 加载highlight.js
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdn.jsdelivr.net/npm/highlight.js@11.7.0/styles/atom-one-dark.min.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/highlight.js@11.7.0/highlight.min.js';
    script.onload = function () {
      hljs.highlightAll();
    };
    document.head.appendChild(script);
  }
}

/**
 * 初始化复制功能
 */
function initCopyButtons() {
  document.querySelectorAll('.copy-btn').forEach(button => {
    button.addEventListener('click', event => {
      event.stopPropagation(); // 防止触发卡片折叠

      const container = button.closest('.api-url-container, .api-response');
      let textToCopy;

      if (container.classList.contains('api-url-container')) {
        textToCopy = container.querySelector('.api-url').textContent;
      } else {
        textToCopy = container.querySelector('pre code').textContent;
      }

      // 复制到剪贴板
      navigator.clipboard.writeText(textToCopy).then(() => {
        // 显示成功提示
        const originalText = button.innerHTML;
        button.innerHTML = '<i class="fas fa-check"></i>';
        button.style.color = 'var(--success)';

        setTimeout(() => {
          button.innerHTML = originalText;
          button.style.color = '';
        }, 2000);
      }).catch(err => {
        console.error('复制失败:', err);

        // 显示错误提示
        button.innerHTML = '<i class="fas fa-times"></i>';
        button.style.color = 'var(--error)';

        setTimeout(() => {
          button.innerHTML = '<i class="fas fa-copy"></i>';
          button.style.color = '';
        }, 2000);
      });
    });
  });
}

/**
 * 初始化折叠/展开功能
 */
function initExpandCollapse() {
  document.querySelectorAll('.api-header').forEach(header => {
    // 添加展开/折叠指示器
    const indicator = document.createElement('div');
    indicator.className = 'expand-indicator';
    indicator.innerHTML = '<i class="fas fa-chevron-down"></i>';
    indicator.style.marginLeft = 'auto';
    indicator.style.color = 'var(--neutral-600)';
    indicator.style.transition = 'transform 0.3s';
    header.appendChild(indicator);

    // 默认展开第一个卡片，折叠其他卡片
    const card = header.closest('.api-card');
    const details = card.querySelector('.api-details');
    const actions = card.querySelector('.api-actions');

    if (card !== document.querySelector('.api-card')) {
      details.style.display = 'none';
      actions.style.display = 'none';
    } else {
      indicator.style.transform = 'rotate(180deg)';
    }

    // 添加点击事件
    header.addEventListener('click', () => {
      if (details.style.display === 'none') {
        details.style.display = 'block';
        actions.style.display = 'flex';
        indicator.style.transform = 'rotate(180deg)';
      } else {
        details.style.display = 'none';
        actions.style.display = 'none';
        indicator.style.transform = 'rotate(0)';
      }
    });
  });
}

/**
 * 初始化API测试功能
 */
function initApiTesting() {
  document.querySelectorAll('.try-btn').forEach(button => {
    button.addEventListener('click', event => {
      event.stopPropagation(); // 防止触发卡片折叠

      const card = button.closest('.api-card');
      const method = card.querySelector('.api-badge').textContent.trim();
      const endpoint = card.querySelector('.api-url').textContent.trim();

      // 创建或显示测试面板
      let testPanel = card.querySelector('.api-test-panel');

      if (!testPanel) {
        testPanel = document.createElement('div');
        testPanel.className = 'api-test-panel';
        testPanel.style.padding = 'var(--space-md) var(--space-lg)';
        testPanel.style.borderTop = '1px solid var(--neutral-200)';
        testPanel.style.backgroundColor = 'var(--neutral-50)';

        // 创建测试面板内容
        testPanel.innerHTML = `
          <h4 style="margin-top:0;font-size:0.875rem;font-weight:600;color:var(--neutral-700);">
            <i class="fas fa-flask" style="color:var(--primary-color);margin-right:0.5rem;"></i>
            API测试
          </h4>
          <div class="test-form" style="margin-bottom:1rem;">
            <div style="margin-bottom:0.5rem;">
              <label style="display:block;font-size:0.75rem;font-weight:500;margin-bottom:0.25rem;">请求参数</label>
              <textarea class="param-input" style="width:100%;padding:0.5rem;border-radius:var(--radius-sm);border:1px solid var(--neutral-300);font-family:monospace;font-size:0.875rem;min-height:80px;background:white;"></textarea>
            </div>
            <button class="send-request-btn" style="background-color:var(--primary-color);color:white;border:none;padding:0.5rem 1rem;border-radius:var(--radius-md);font-weight:500;cursor:pointer;">发送请求</button>
          </div>
          <div class="test-result" style="display:none;">
            <h5 style="font-size:0.75rem;font-weight:600;margin-bottom:0.5rem;">响应结果</h5>
            <div class="result-container" style="background-color:var(--neutral-900);border-radius:var(--radius-md);padding:var(--space-md);overflow-x:auto;">
              <pre style="margin:0;"><code class="result-code" style="font-family:'Fira Code',monospace;font-size:0.875rem;color:var(--neutral-200);"></code></pre>
            </div>
          </div>
        `;

        // 添加到卡片
        card.appendChild(testPanel);

        // 添加发送请求事件
        const sendBtn = testPanel.querySelector('.send-request-btn');
        sendBtn.addEventListener('click', async () => {
          // 获取真实API数据
          const paramInput = testPanel.querySelector('.param-input').value;
          const resultContainer = testPanel.querySelector('.test-result');
          const resultCode = testPanel.querySelector('.result-code');

          // 显示加载状态
          sendBtn.disabled = true;
          sendBtn.textContent = '请求中...';

          try {
            // 解析参数
            const params = paramInput ? JSON.parse(paramInput) : {};

            // 获取真实API响应
            const response = await generateMockResponse(endpoint, method, params);

            // 显示响应
            resultCode.textContent = JSON.stringify(response, null, 2);
            resultContainer.style.display = 'block';

            // 应用语法高亮
            if (window.hljs) {
              hljs.highlightBlock(resultCode);
            } else if (window.Prism) {
              Prism.highlightElement(resultCode);
            }
          } catch (error) {
            resultCode.textContent = `错误: ${error.message}`;
            resultContainer.style.display = 'block';
          } finally {
            // 恢复按钮状态
            sendBtn.disabled = false;
            sendBtn.textContent = '发送请求';
          }
        });
      } else {
        // 切换测试面板显示状态
        testPanel.style.display = testPanel.style.display === 'none' ? 'block' : 'none';
      }
    });
  });
}

/**
 * 初始化真实API响应示例
 */
async function initRealApiExamples() {
  try {
    // 获取客户端API密钥
    const apiKeyResponse = await fetch('/api/config');
    if (!apiKeyResponse.ok) {
      throw new Error(`获取API密钥失败: ${apiKeyResponse.status} ${apiKeyResponse.statusText}`);
    }
    const apiKeyData = await apiKeyResponse.json();

    // 从响应中提取API密钥（支持两种响应格式）
    const apiKey = apiKeyData.apiKey || (apiKeyData.data?.apiKey);

    if (!apiKey) {
      throw new Error('API密钥不存在');
    }

    // 更新config响应示例
    updateApiExample('config', apiKeyData);

    // 获取info响应示例
    const authInfoResponse = await fetch(`/api/auth?path=/info`, {
      headers: {
        'X-API-Key': apiKey
      }
    });

    if (!authInfoResponse.ok) {
      throw new Error(`获取info鉴权参数失败: ${authInfoResponse.status} ${authInfoResponse.statusText}`);
    }

    const authInfoData = await authInfoResponse.json();
    // 从响应中提取鉴权参数（支持两种响应格式）
    const authInfoParam = authInfoData.auth || (authInfoData.data?.auth);

    if (authInfoParam) {
      const infoResponse = await fetch(`/api/info?auth=${encodeURIComponent(authInfoParam)}`, {
        headers: {
          'X-API-Key': apiKey
        }
      });

      if (infoResponse.ok) {
        const infoData = await infoResponse.json();
        updateApiExample('info', infoData);
      }
    }

    // 获取match响应示例
    const authMatchResponse = await fetch(`/api/auth?path=/match?type=url&id=158616`, {
      headers: {
        'X-API-Key': apiKey
      }
    });

    if (!authMatchResponse.ok) {
      throw new Error(`获取match鉴权参数失败: ${authMatchResponse.status} ${authMatchResponse.statusText}`);
    }

    const authMatchData = await authMatchResponse.json();
    // 从响应中提取鉴权参数（支持两种响应格式）
    const authMatchParam = authMatchData.auth || (authMatchData.data?.auth);

    if (authMatchParam) {
      const matchResponse = await fetch(`/api/match?type=url&id=158616&auth=${encodeURIComponent(authMatchParam)}`, {
        headers: {
          'X-API-Key': apiKey
        }
      });

      if (matchResponse.ok) {
        const matchData = await matchResponse.json();
        updateApiExample('match', matchData);
      }
    }

    // 获取search响应示例
    const authSearchResponse = await fetch(`/api/auth?path=/search?name=${encodeURIComponent("太傻")}`, {
      headers: {
        'X-API-Key': apiKey
      }
    });

    if (!authSearchResponse.ok) {
      throw new Error(`获取search鉴权参数失败: ${authSearchResponse.status} ${authSearchResponse.statusText}`);
    }

    const authSearchData = await authSearchResponse.json();
    // 从响应中提取鉴权参数（支持两种响应格式）
    const authSearchParam = authSearchData.auth || (authSearchData.data?.auth);

    if (authSearchParam) {
      const searchResponse = await fetch(`/api/search?name=${encodeURIComponent("太傻")}&source=kuwo&auth=${encodeURIComponent(authSearchParam)}`, {
        headers: {
          'X-API-Key': apiKey
        }
      });

      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        updateApiExample('search', searchData);
      }
    }

  } catch (error) {
    console.error('初始化API示例错误:', error);
  }
}

/**
 * 更新API示例
 */
function updateApiExample(type, data) {
  let codeElement;

  switch (type) {
    case 'config':
      codeElement = document.querySelector('.api-card:nth-child(3) .api-response pre code');
      break;
    case 'info':
      codeElement = document.querySelector('.api-card:nth-child(3) .api-response pre code');
      break;
    case 'match':
      codeElement = document.querySelector('.api-card:nth-child(1) .api-response pre code');
      break;
    case 'search':
      codeElement = document.querySelector('.api-card:nth-child(2) .api-response pre code');
      break;
    default:
      return;
  }

  if (codeElement) {
    codeElement.textContent = JSON.stringify(data, null, 2);

    // 应用语法高亮
    if (window.hljs) {
      hljs.highlightBlock(codeElement);
    } else if (window.Prism) {
      Prism.highlightElement(codeElement);
    }
  }
}

/**
 * 获取真实API响应
 */
async function generateMockResponse(endpoint, _method, params) {
  try {
    // 获取客户端API密钥
    const apiKeyResponse = await fetch('/api/config');
    if (!apiKeyResponse.ok) {
      throw new Error(`获取API密钥失败: ${apiKeyResponse.status} ${apiKeyResponse.statusText}`);
    }
    const apiKeyData = await apiKeyResponse.json();

    // 从响应中提取API密钥（支持两种响应格式）
    const apiKey = apiKeyData.apiKey || (apiKeyData.data?.apiKey);

    if (!apiKey) {
      throw new Error('API密钥不存在');
    }

    // 构建请求URL和参数
    let url = '';
    let authParam = '';

    if (endpoint.includes('/match')) {
      // 获取鉴权参数
      const id = params.id || "158616";
      const type = params.type || "url";
      const authPath = `/match?type=${type}&id=${id}`;

      const authResponse = await fetch(`/api/auth?path=${encodeURIComponent(authPath)}`, {
        headers: {
          'X-API-Key': apiKey
        }
      });

      if (!authResponse.ok) {
        throw new Error(`获取鉴权参数失败: ${authResponse.status} ${authResponse.statusText}`);
      }

      const authData = await authResponse.json();
      // 从响应中提取鉴权参数（支持两种响应格式）
      authParam = authData.auth || (authData.data?.auth);

      if (!authParam) {
        throw new Error('鉴权参数不存在');
      }

      // 调用真实API
      url = `/api/match?type=${type}&id=${id}&auth=${encodeURIComponent(authParam)}`;

    } else if (endpoint.includes('/search')) {
      // 获取鉴权参数
      const name = params.name || "太傻";
      const source = params.source || "kuwo";
      const authPath = `/search?name=${encodeURIComponent(name)}`;

      const authResponse = await fetch(`/api/auth?path=${encodeURIComponent(authPath)}`, {
        headers: {
          'X-API-Key': apiKey
        }
      });

      if (!authResponse.ok) {
        throw new Error(`获取鉴权参数失败: ${authResponse.status} ${authResponse.statusText}`);
      }

      const authData = await authResponse.json();
      // 从响应中提取鉴权参数（支持两种响应格式）
      authParam = authData.auth || (authData.data?.auth);

      if (!authParam) {
        throw new Error('鉴权参数不存在');
      }

      // 调用真实API
      url = `/api/search?name=${encodeURIComponent(name)}&source=${source}&auth=${encodeURIComponent(authParam)}`;

    } else if (endpoint.includes('/info')) {
      // 获取鉴权参数
      const authPath = '/info';

      const authResponse = await fetch(`/api/auth?path=${encodeURIComponent(authPath)}`, {
        headers: {
          'X-API-Key': apiKey
        }
      });

      if (!authResponse.ok) {
        throw new Error(`获取鉴权参数失败: ${authResponse.status} ${authResponse.statusText}`);
      }

      const authData = await authResponse.json();
      // 从响应中提取鉴权参数（支持两种响应格式）
      authParam = authData.auth || (authData.data?.auth);

      if (!authParam) {
        throw new Error('鉴权参数不存在');
      }

      // 调用真实API
      url = `/api/info?auth=${encodeURIComponent(authParam)}`;

    } else {
      // 默认情况，直接调用config接口
      url = '/api/config';
    }

    // 发送请求
    const response = await fetch(url, {
      headers: {
        'X-API-Key': apiKey
      }
    });

    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
    }

    // 返回真实数据
    return await response.json();

  } catch (error) {
    console.error('API请求错误:', error);
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * 初始化API操作按钮
 */
function initApiActionButtons() {
  // 处理"在线调试"按钮点击事件
  document.querySelectorAll('.api-action-btn.primary').forEach(button => {
    button.addEventListener('click', event => {
      event.stopPropagation(); // 防止事件冒泡

      const card = button.closest('.api-docs-card');
      const method = card.querySelector('.http-method-badge').textContent.trim();
      const endpoint = card.querySelector('.api-url-codeblock code').textContent.trim();

      // 创建或显示测试面板
      let testPanel = card.querySelector('.api-test-panel');

      if (!testPanel) {
        testPanel = document.createElement('div');
        testPanel.className = 'api-test-panel';
        testPanel.style.padding = '1.5rem';
        testPanel.style.borderTop = '1px solid';
        testPanel.style.marginTop = '1.5rem';

        // 根据当前主题设置边框颜色
        if (document.documentElement.classList.contains('dark')) {
          testPanel.style.borderColor = '#374151'; // dark:border-gray-700
          testPanel.style.backgroundColor = '#1f2937'; // dark:bg-gray-800
        } else {
          testPanel.style.borderColor = '#e5e7eb'; // border-gray-200
          testPanel.style.backgroundColor = '#f9fafb'; // bg-gray-50
        }

        // 创建测试面板内容
        testPanel.innerHTML = `
          <h4 style="margin-top:0;font-size:1rem;font-weight:600;margin-bottom:1rem;display:flex;align-items:center;">
            <i class="fas fa-flask" style="margin-right:0.5rem;"></i>
            API测试控制台
          </h4>
          <div class="test-form" style="margin-bottom:1.5rem;">
            <div style="margin-bottom:1rem;">
              <label style="display:block;font-size:0.875rem;font-weight:500;margin-bottom:0.5rem;">请求参数 (JSON格式)</label>
              <textarea class="param-input" style="width:100%;padding:0.75rem;border-radius:0.375rem;border:1px solid;font-family:monospace;font-size:0.875rem;min-height:100px;"></textarea>
            </div>
            <button class="send-request-btn" style="padding:0.6rem 1.2rem;border-radius:0.375rem;font-weight:500;display:inline-flex;align-items:center;gap:0.5rem;cursor:pointer;">
              <i class="fas fa-paper-plane"></i> 发送请求
            </button>
          </div>
          <div class="test-result" style="display:none;">
            <h5 style="font-size:0.875rem;font-weight:600;margin-bottom:0.5rem;display:flex;align-items:center;">
              <i class="fas fa-reply" style="margin-right:0.5rem;"></i>响应结果
            </h5>
            <div class="result-container" style="border-radius:0.5rem;padding:1rem;overflow-x:auto;position:relative;">
              <pre style="margin:0;"><code class="language-json result-code"></code></pre>
              <button class="copy-result-btn" style="position:absolute;top:0.5rem;right:0.5rem;padding:0.25rem 0.5rem;border-radius:0.375rem;font-size:0.75rem;background-color:#4b5563;color:#f3f4f6;border:none;cursor:pointer;">
                <i class="fas fa-copy"></i>
              </button>
            </div>
          </div>
        `;

        // 根据当前主题设置样式
        if (document.documentElement.classList.contains('dark')) {
          const paramInput = testPanel.querySelector('.param-input');
          paramInput.style.backgroundColor = '#111827'; // dark:bg-gray-900
          paramInput.style.borderColor = '#374151'; // dark:border-gray-700
          paramInput.style.color = '#e5e7eb'; // dark:text-gray-200

          const sendBtn = testPanel.querySelector('.send-request-btn');
          sendBtn.style.backgroundColor = '#60a5fa'; // dark:bg-blue-400
          sendBtn.style.color = 'white';

          const resultContainer = testPanel.querySelector('.result-container');
          resultContainer.style.backgroundColor = '#111827'; // dark:bg-gray-900
          resultContainer.style.border = '1px solid #374151'; // dark:border-gray-700
        } else {
          const paramInput = testPanel.querySelector('.param-input');
          paramInput.style.backgroundColor = 'white';
          paramInput.style.borderColor = '#e5e7eb'; // border-gray-200
          paramInput.style.color = '#1f2937'; // text-gray-800

          const sendBtn = testPanel.querySelector('.send-request-btn');
          sendBtn.style.backgroundColor = '#3b82f6'; // bg-blue-500
          sendBtn.style.color = 'white';

          const resultContainer = testPanel.querySelector('.result-container');
          resultContainer.style.backgroundColor = '#f3f4f6'; // bg-gray-100
          resultContainer.style.border = '1px solid #e5e7eb'; // border-gray-200
        }

        // 添加到卡片
        card.appendChild(testPanel);

        // 添加发送请求事件
        const sendBtn = testPanel.querySelector('.send-request-btn');
        sendBtn.addEventListener('click', async () => {
          // 获取真实API数据
          const paramInput = testPanel.querySelector('.param-input').value;
          const resultContainer = testPanel.querySelector('.test-result');
          const resultCode = testPanel.querySelector('.result-code');

          // 显示加载状态
          sendBtn.disabled = true;
          sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 请求中...';

          try {
            // 解析参数
            const params = paramInput ? JSON.parse(paramInput) : {};

            // 获取真实API响应
            const response = await generateMockResponse(endpoint, method, params);

            // 显示响应
            resultCode.textContent = JSON.stringify(response, null, 2);
            resultContainer.style.display = 'block';

            // 应用语法高亮
            if (window.hljs) {
              hljs.highlightBlock(resultCode);
            }
          } catch (error) {
            resultCode.textContent = `错误: ${error.message}`;
            resultContainer.style.display = 'block';
          } finally {
            // 恢复按钮状态
            sendBtn.disabled = false;
            sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i> 发送请求';
          }
        });

        // 添加复制结果按钮事件
        const copyResultBtn = testPanel.querySelector('.copy-result-btn');
        copyResultBtn.addEventListener('click', () => {
          const resultCode = testPanel.querySelector('.result-code');
          navigator.clipboard.writeText(resultCode.textContent).then(() => {
            copyResultBtn.innerHTML = '<i class="fas fa-check"></i>';
            setTimeout(() => {
              copyResultBtn.innerHTML = '<i class="fas fa-copy"></i>';
            }, 2000);
          }).catch(err => {
            console.error('复制失败:', err);
            copyResultBtn.innerHTML = '<i class="fas fa-times"></i>';
            setTimeout(() => {
              copyResultBtn.innerHTML = '<i class="fas fa-copy"></i>';
            }, 2000);
          });
        });
      } else {
        // 切换测试面板显示状态
        testPanel.style.display = testPanel.style.display === 'none' ? 'block' : 'none';
      }
    });
  });

  // 处理"详细文档"按钮点击事件
  document.querySelectorAll('.api-action-btn.secondary').forEach(button => {
    button.addEventListener('click', event => {
      event.stopPropagation(); // 防止事件冒泡

      const card = button.closest('.api-docs-card');
      const apiTitle = card.querySelector('.api-docs-title').textContent.trim();
      const endpoint = card.querySelector('.api-url-codeblock code').textContent.trim();

      // 创建或显示详细文档面板
      let docsPanel = card.querySelector('.api-docs-panel');

      if (!docsPanel) {
        docsPanel = document.createElement('div');
        docsPanel.className = 'api-docs-panel';
        docsPanel.style.padding = '1.5rem';
        docsPanel.style.borderTop = '1px solid';
        docsPanel.style.marginTop = '1.5rem';

        // 根据当前主题设置边框颜色
        if (document.documentElement.classList.contains('dark')) {
          docsPanel.style.borderColor = '#374151'; // dark:border-gray-700
          docsPanel.style.backgroundColor = '#1f2937'; // dark:bg-gray-800
        } else {
          docsPanel.style.borderColor = '#e5e7eb'; // border-gray-200
          docsPanel.style.backgroundColor = '#f9fafb'; // bg-gray-50
        }

        // 创建详细文档内容
        docsPanel.innerHTML = `
          <h4 style="margin-top:0;font-size:1rem;font-weight:600;margin-bottom:1rem;display:flex;align-items:center;">
            <i class="fas fa-book" style="margin-right:0.5rem;"></i>
            详细文档: ${apiTitle}
          </h4>
          <div class="docs-content">
            <h5 style="font-size:0.875rem;font-weight:600;margin-bottom:0.5rem;">接口说明</h5>
            <p style="margin-bottom:1rem;">此接口 (${endpoint}) 提供了更详细的使用说明和示例代码。</p>

            <h5 style="font-size:0.875rem;font-weight:600;margin-bottom:0.5rem;">请求示例</h5>
            <div style="margin-bottom:1rem;border-radius:0.5rem;overflow:hidden;">
              <pre style="margin:0;"><code class="language-javascript">// 使用fetch API
fetch('${window.location.origin}${endpoint}?auth=YOUR_AUTH_PARAM', {
  method: 'GET',
  headers: {
    'X-API-Key': 'YOUR_API_KEY'
  }
})
.then(response => response.json())
.then(data => console.log(data))
.catch(error => console.error('Error:', error));</code></pre>
            </div>

            <h5 style="font-size:0.875rem;font-weight:600;margin-bottom:0.5rem;">使用注意事项</h5>
            <ul style="padding-left:1.5rem;margin-bottom:1rem;list-style-type:disc;">
              <li style="margin-bottom:0.5rem;">请确保请求中包含有效的API密钥和鉴权参数</li>
              <li style="margin-bottom:0.5rem;">鉴权参数可通过 /api/auth 接口获取</li>
              <li style="margin-bottom:0.5rem;">请求频率限制: 每分钟60次</li>
              <li style="margin-bottom:0.5rem;">返回数据格式: JSON</li>
            </ul>

            <h5 style="font-size:0.875rem;font-weight:600;margin-bottom:0.5rem;">错误码说明</h5>
            <div style="overflow-x:auto;margin-bottom:1rem;">
              <table style="width:100%;border-collapse:collapse;font-size:0.875rem;">
                <thead>
                  <tr>
                    <th style="text-align:left;padding:0.5rem;border-bottom:1px solid;">错误码</th>
                    <th style="text-align:left;padding:0.5rem;border-bottom:1px solid;">说明</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style="padding:0.5rem;border-bottom:1px solid;">401</td>
                    <td style="padding:0.5rem;border-bottom:1px solid;">未授权，API密钥无效或缺失</td>
                  </tr>
                  <tr>
                    <td style="padding:0.5rem;border-bottom:1px solid;">403</td>
                    <td style="padding:0.5rem;border-bottom:1px solid;">鉴权参数无效或已过期</td>
                  </tr>
                  <tr>
                    <td style="padding:0.5rem;border-bottom:1px solid;">404</td>
                    <td style="padding:0.5rem;border-bottom:1px solid;">请求的资源不存在</td>
                  </tr>
                  <tr>
                    <td style="padding:0.5rem;border-bottom:1px solid;">429</td>
                    <td style="padding:0.5rem;border-bottom:1px solid;">请求频率超限</td>
                  </tr>
                  <tr>
                    <td style="padding:0.5rem;border-bottom:1px solid;">500</td>
                    <td style="padding:0.5rem;border-bottom:1px solid;">服务器内部错误</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        `;

        // 根据当前主题设置样式
        if (document.documentElement.classList.contains('dark')) {
          const tableHeaders = docsPanel.querySelectorAll('th');
          const tableCells = docsPanel.querySelectorAll('td');
          const tableBorders = docsPanel.querySelectorAll('th, td');

          tableHeaders.forEach(th => {
            th.style.color = '#e5e7eb'; // dark:text-gray-200
          });

          tableCells.forEach(td => {
            td.style.color = '#d1d5db'; // dark:text-gray-300
          });

          tableBorders.forEach(cell => {
            cell.style.borderColor = '#374151'; // dark:border-gray-700
          });

          const codeBlock = docsPanel.querySelector('pre');
          codeBlock.style.backgroundColor = '#111827'; // dark:bg-gray-900
        } else {
          const tableHeaders = docsPanel.querySelectorAll('th');
          const tableCells = docsPanel.querySelectorAll('td');
          const tableBorders = docsPanel.querySelectorAll('th, td');

          tableHeaders.forEach(th => {
            th.style.color = '#111827'; // text-gray-900
          });

          tableCells.forEach(td => {
            td.style.color = '#1f2937'; // text-gray-800
          });

          tableBorders.forEach(cell => {
            cell.style.borderColor = '#e5e7eb'; // border-gray-200
          });

          const codeBlock = docsPanel.querySelector('pre');
          codeBlock.style.backgroundColor = '#f3f4f6'; // bg-gray-100
        }

        // 添加到卡片
        card.appendChild(docsPanel);

        // 应用语法高亮
        if (window.hljs) {
          docsPanel.querySelectorAll('pre code').forEach(block => {
            hljs.highlightBlock(block);
          });
        }
      } else {
        // 切换详细文档面板显示状态
        docsPanel.style.display = docsPanel.style.display === 'none' ? 'block' : 'none';
      }
    });
  });
}
