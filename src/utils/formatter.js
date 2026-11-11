export function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

// 格式化工具函数

/**
 * 格式化文件大小
 * @param {number} bytes - 字节数
 * @returns {string} 格式化的大小
 */
export function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 格式化日期时间
 * @param {string|Date} date - 日期
 * @param {string} format - 格式
 * @returns {string} 格式化的日期
 */
export function formatDateTime(date, format = 'YYYY-MM-DD HH:mm:ss') {
    const d = new Date(date);
    
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    
    return format
        .replace('YYYY', year)
        .replace('MM', month)
        .replace('DD', day)
        .replace('HH', hours)
        .replace('mm', minutes)
        .replace('ss', seconds);
}

/**
 * 格式化相对时间
 * @param {string|Date} date - 日期
 * @returns {string} 相对时间
 */
export function formatRelativeTime(date) {
    const d = new Date(date);
    const now = new Date();
    const diff = now - d;
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
        return days === 1 ? '昨天' : `${days}天前`;
    } else if (hours > 0) {
        return `${hours}小时前`;
    } else if (minutes > 0) {
        return `${minutes}分钟前`;
    } else {
        return '刚刚';
    }
}

/**
 * 截断文本
 * @param {string} text - 文本
 * @param {number} maxLength - 最大长度
 * @param {string} suffix - 后缀
 * @returns {string} 截断后的文本
 */
export function truncateText(text, maxLength = 100, suffix = '...') {
    if (!text || text.length <= maxLength) {
        return text;
    }
    
    return text.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * 清理标签格式
 * @param {string} tag - 标签文本
 * @returns {string} 清理后的标签
 */
export function cleanTag(tag) {
    if (!tag) return '';
    
    // 移除开头的#号
    let cleaned = tag.replace(/^#+/, '');
    
    // 移除空白字符
    cleaned = cleaned.replace(/\s+/g, '');
    
    // 限制长度
    if (cleaned.length > 20) {
        cleaned = cleaned.substring(0, 20);
    }
    
    return cleaned;
}

/**
 * 验证标签格式
 * @param {string} tag - 标签文本
 * @returns {boolean} 是否有效
 */
export function validateTag(tag) {
    if (!tag || tag.length === 0) return false;
    
    const cleaned = cleanTag(tag);
    
    // 检查长度
    if (cleaned.length === 0 || cleaned.length > 20) return false;
    
    // 检查是否只包含字母、数字、中文、下划线
    const tagPattern = /^[a-zA-Z0-9\u4e00-\u9fa5_]+$/;
    return tagPattern.test(cleaned);
}

/**
 * 格式化标签数组
 * @param {Array} tags - 标签数组
 * @returns {Array} 格式化后的标签数组
 */
export function formatTags(tags) {
    if (!Array.isArray(tags)) return [];
    
    return tags
        .map(tag => cleanTag(tag))
        .filter(tag => validateTag(tag))
        .filter((tag, index, array) => array.indexOf(tag) === index); // 去重
}

/**
 * 清理HTML内容
 * @param {string} html - HTML内容
 * @returns {string} 清理后的文本
 */
export function cleanHtml(html) {
    if (!html) return '';
    
    // 创建临时元素
    const template = document.createElement('template');
    template.innerHTML = html;
    const temp = template.content;
    
    // 移除脚本和样式
    const scripts = temp.querySelectorAll('script, style');
    scripts.forEach(script => script.remove());
    
    // 获取文本内容
    let text = temp.textContent || temp.innerText || '';
    
    // 清理空白字符
    text = text
        .replace(/\s+/g, ' ')
        .replace(/\n\s*\n/g, '\n')
        .trim();
    
    return text;
}

/**
 * 提取网页主要内容
 * @param {Document} doc - 文档对象
 * @returns {string} 主要内容
 */
export function extractMainContent(doc) {
    if (!doc) return '';
    
    // 尝试多种选择器
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
        contentElement = doc.querySelector(selector);
        if (contentElement) break;
    }
    
    // 如果没有找到主要内容区域，使用body
    if (!contentElement) {
        contentElement = doc.body;
    }
    
    // 克隆元素以避免修改原始DOM
    const clone = contentElement.cloneNode(true);
    
    // 移除不需要的元素
    const elementsToRemove = clone.querySelectorAll('script, style, nav, footer, header, aside, .advertisement, .ads');
    elementsToRemove.forEach(el => el.remove());
    
    // 获取文本内容
    let text = clone.textContent || clone.innerText || '';
    
    // 清理空白字符
    text = text
        .replace(/\s+/g, ' ')
        .replace(/\n\s*\n/g, '\n')
        .trim();
    
    return text;
}

/**
 * 生成内容预览
 * @param {string} content - 内容
 * @param {number} maxLength - 最大长度
 * @returns {string} 预览文本
 */
export function generatePreview(content, maxLength = 200) {
    if (!content) return '';
    
    // 清理HTML标签
    const cleanContent = content.replace(/<[^>]*>/g, '');
    
    // 截断文本
    return truncateText(cleanContent, maxLength);
}

/**
 * 验证URL格式
 * @param {string} url - URL
 * @returns {boolean} 是否有效
 */
export function validateUrl(url) {
    if (!url) return false;
    
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

/**
 * 获取文件扩展名
 * @param {string} filename - 文件名
 * @returns {string} 扩展名
 */
export function getFileExtension(filename) {
    if (!filename) return '';
    
    const parts = filename.split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : '';
}

/**
 * 验证图片文件
 * @param {File} file - 文件对象
 * @returns {Object} 验证结果
 */
export function validateImageFile(file) {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const maxSize = 5 * 1024 * 1024; // 5MB
    
    if (!file) {
        return { valid: false, error: '没有选择文件' };
    }
    
    if (!validTypes.includes(file.type)) {
        return { valid: false, error: '不支持的图片格式' };
    }
    
    if (file.size > maxSize) {
        return { valid: false, error: '图片大小不能超过5MB' };
    }
    
    return { valid: true, error: null };
}

/**
 * 将图片转换为Base64
 * @param {File} file - 图片文件
 * @returns {Promise<string>} Base64字符串
 */
export function imageToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            resolve(e.target.result);
        };
        
        reader.onerror = (error) => {
            reject(error);
        };
        
        reader.readAsDataURL(file);
    });
}

/**
 * 防抖函数
 * @param {Function} func - 要执行的函数
 * @param {number} wait - 等待时间（毫秒）
 * @returns {Function} 防抖函数
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * 节流函数
 * @param {Function} func - 要执行的函数
 * @param {number} limit - 时间限制（毫秒）
 * @returns {Function} 节流函数
 */
export function throttle(func, limit) {
    let inThrottle;
    return function executedFunction(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}