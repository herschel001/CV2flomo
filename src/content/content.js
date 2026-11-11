// 内容脚本 - 获取网页信息

(function() {
  'use strict';
  if (globalThis.__flomoClipperLoaded) return;
  globalThis.__flomoClipperLoaded = true;

  // 获取网页标题
  function getPageTitle() {
    // 尝试多种方式获取标题
    const title = document.title || 
                 document.querySelector('h1')?.textContent?.trim() ||
                 document.querySelector('title')?.textContent?.trim() ||
                 document.querySelector('meta[property="og:title"]')?.content ||
                 document.querySelector('meta[name="title"]')?.content ||
                 window.location.hostname;
    
    return title || '未知网页';
  }

  // 获取网页URL
  function getPageUrl() {
    return window.location.href;
  }

  // 获取网页主要内容（用于预览）
  function getPageContent() {
    // 移除脚本和样式标签
    const clone = document.body.cloneNode(true);
    const elementsToRemove = clone.querySelectorAll('script, style, nav, footer, header, aside');
    elementsToRemove.forEach(el => el.remove());
    
    // 尝试获取主要内容区域
    const contentSelectors = [
      'article',
      'main',
      '[role="main"]',
      '.content',
      '.main-content',
      '.article-content',
      '.post-content',
      '.entry-content',
      '#content',
      '#main',
      '#article'
    ];
    
    let contentElement = null;
    
    for (const selector of contentSelectors) {
      contentElement = clone.querySelector(selector);
      if (contentElement) break;
    }
    
    // 如果没有找到主要内容区域，使用body
    if (!contentElement) {
      contentElement = clone;
    }
    
    // 提取文本内容
    const textContent = contentElement.textContent || contentElement.innerText || '';
    
    // 清理空白字符
    const cleanedContent = textContent
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n')
      .trim();
    
    // 限制长度（最多500字符用于预览）
    if (cleanedContent.length > 500) {
      return cleanedContent.substring(0, 500) + '...';
    }
    
    return cleanedContent;
  }

  // 获取选中的文本
  function getSelectedText() {
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      return selection.toString().trim();
    }
    return '';
  }

  // 获取网页元信息
  function getPageMetaInfo() {
    const metaInfo = {};
    
    // 获取描述
    const description = document.querySelector('meta[name="description"]')?.content ||
                       document.querySelector('meta[property="og:description"]')?.content ||
                       '';
    
    // 获取关键词
    const keywords = document.querySelector('meta[name="keywords"]')?.content || '';
    
    // 获取作者
    const author = document.querySelector('meta[name="author"]')?.content || '';
    
    // 获取发布时间
    const publishTime = document.querySelector('meta[property="article:published_time"]')?.content ||
                       document.querySelector('meta[name="publishdate"]')?.content ||
                       '';
    
    metaInfo.description = description;
    metaInfo.keywords = keywords;
    metaInfo.author = author;
    metaInfo.publishTime = publishTime;
    
    return metaInfo;
  }

  // 监听来自popup的消息
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (sender.id !== chrome.runtime.id) return false;
    if (request?.action === 'getPageInfo') {
      try {
        const pageInfo = {
          title: getPageTitle(),
          url: getPageUrl(),
          content: getPageContent(),
          selectedText: getSelectedText(),
          meta: getPageMetaInfo(),
          timestamp: new Date().toISOString()
        };
        
        sendResponse({
          success: true,
          data: pageInfo
        });
      } catch (error) {

        sendResponse({
          success: false,
          error: error.message || '获取页面信息失败'
        });
      }
      return true; // 保持消息通道开放
    }
    
    if (request.action === 'getSelectedText') {
      try {
        const selectedText = getSelectedText();
        sendResponse({
          success: true,
          data: selectedText
        });
      } catch (error) {

        sendResponse({
          success: false,
          error: error.message || '获取选中文本失败'
        });
      }
      return true;
    }
  });

  // 监听页面加载完成
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {

    
    // 可以在这里添加更多的初始化逻辑
    // 例如：监听页面变化，自动保存阅读进度等
  }

})();