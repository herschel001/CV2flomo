import { escapeHtml } from './formatter.js';

// 错误处理工具函数

/**
 * 错误类型定义
 */
export const ErrorTypes = {
    NETWORK_ERROR: 'NETWORK_ERROR',
    API_ERROR: 'API_ERROR',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    STORAGE_ERROR: 'STORAGE_ERROR',
    PERMISSION_ERROR: 'PERMISSION_ERROR',
    UNKNOWN_ERROR: 'UNKNOWN_ERROR'
};

/**
 * 错误消息映射
 */
const ErrorMessages = {
    [ErrorTypes.NETWORK_ERROR]: {
        title: '网络连接错误',
        message: '请检查您的网络连接是否正常',
        solutions: [
            '检查网络连接',
            '刷新页面重试',
            '检查防火墙设置'
        ]
    },
    [ErrorTypes.API_ERROR]: {
        title: 'API调用失败',
        message: '无法连接到flomo服务',
        solutions: [
            '检查API地址是否正确',
            '验证flomo账户是否正常',
            '稍后重试'
        ]
    },
    [ErrorTypes.VALIDATION_ERROR]: {
        title: '输入验证失败',
        message: '请检查您的输入内容',
        solutions: [
            '确保所有必填字段已填写',
            '检查内容格式是否正确',
            '确认标签数量不超过限制'
        ]
    },
    [ErrorTypes.STORAGE_ERROR]: {
        title: '存储错误',
        message: '无法保存数据',
        solutions: [
            '检查浏览器存储权限',
            '清除浏览器缓存',
            '重启浏览器'
        ]
    },
    [ErrorTypes.PERMISSION_ERROR]: {
        title: '权限错误',
        message: '缺少必要的权限',
        solutions: [
            '检查插件权限设置',
            '重新安装插件',
            '联系技术支持'
        ]
    },
    [ErrorTypes.UNKNOWN_ERROR]: {
        title: '未知错误',
        message: '发生了未知错误',
        solutions: [
            '刷新页面重试',
            '重启浏览器',
            '联系技术支持'
        ]
    }
};

/**
 * 错误处理类
 */
export class ErrorHandler {
    constructor() {
        this.errorLog = [];
        this.maxLogSize = 100;
    }

    /**
     * 处理错误
     * @param {Error} error - 错误对象
     * @param {string} context - 错误上下文
     * @returns {Object} 处理后的错误信息
     */
    handleError(error, context = '') {
        const errorInfo = this.analyzeError(error);
        const enhancedError = {
            ...errorInfo,
            context,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href
        };

        // 记录错误日志
        this.logError(enhancedError);

        // 显示用户友好的错误信息
        this.showUserFriendlyError(enhancedError);

        return enhancedError;
    }

    /**
     * 分析错误类型
     * @param {Error} error - 错误对象
     * @returns {Object} 错误分析结果
     */
    analyzeError(error) {
        let errorType = ErrorTypes.UNKNOWN_ERROR;
        let message = error.message || 'Unknown error';
        let originalError = error;

        // 网络错误
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            errorType = ErrorTypes.NETWORK_ERROR;
        } else if (error.message.includes('NetworkError') || 
                   error.message.includes('Failed to fetch')) {
            errorType = ErrorTypes.NETWORK_ERROR;
        }

        // API错误
        else if (error.message.includes('HTTP') || 
                 error.message.includes('API') ||
                 error.status) {
            errorType = ErrorTypes.API_ERROR;
        }

        // 存储错误
        else if (error.message.includes('storage') || 
                 error.message.includes('Storage') ||
                 error.message.includes('QuotaExceededError')) {
            errorType = ErrorTypes.STORAGE_ERROR;
        }

        // 权限错误
        else if (error.message.includes('permission') || 
                 error.message.includes('Permission') ||
                 error.message.includes('NotAllowedError')) {
            errorType = ErrorTypes.PERMISSION_ERROR;
        }

        // 验证错误
        else if (error.name === 'ValidationError' || 
                 error.message.includes('validation') ||
                 error.message.includes('invalid')) {
            errorType = ErrorTypes.VALIDATION_ERROR;
        }

        return {
            type: errorType,
            message,
            originalError,
            stack: error.stack
        };
    }

    /**
     * 记录错误日志
     * @param {Object} errorInfo - 错误信息
     */
    logError(errorInfo) {
        this.errorLog.unshift({ type: errorInfo.type, timestamp: errorInfo.timestamp });
        
        // 限制日志大小
        if (this.errorLog.length > this.maxLogSize) {
            this.errorLog = this.errorLog.slice(0, this.maxLogSize);
        }

        // 控制台日志
        console.error('Flomo Web Clipper Error:', errorInfo.type);

        // 保存到存储（异步）
        this.saveErrorLog();
    }

    /**
     * 保存错误日志到存储
     */
    async saveErrorLog() {
        try {
            await chrome.storage.local.set({ 
                errorLog: this.errorLog 
            });
        } catch (error) {
            console.error('保存错误日志失败:');
        }
    }

    /**
     * 显示用户友好的错误信息
     * @param {Object} errorInfo - 错误信息
     */
    showUserFriendlyError(errorInfo) {
        const errorConfig = ErrorMessages[errorInfo.type] || ErrorMessages[ErrorTypes.UNKNOWN_ERROR];
        
        const userMessage = {
            title: errorConfig.title,
            message: errorConfig.message,
            solutions: errorConfig.solutions,
            details: errorInfo.message
        };

        // 显示错误通知
        this.showErrorNotification(userMessage);
    }

    /**
     * 显示错误通知
     * @param {Object} message - 错误消息
     */
    showErrorNotification(message) {
        // 创建错误通知元素
        const notification = document.createElement('div');
        notification.className = 'flomo-error-notification';
        notification.innerHTML = `
            <div class="error-header">
                <span class="error-icon">⚠️</span>
                <span class="error-title">${escapeHtml(message.title)}</span>
                <button class="error-close">×</button>
            </div>
            <div class="error-message">${escapeHtml(message.message)}</div>
            ${message.solutions.length > 0 ? `
                <div class="error-solutions">
                    <strong>解决方案：</strong>
                    <ul>
                        ${message.solutions.map(solution => `<li>${escapeHtml(solution)}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}
            ${message.details ? `
                <div class="error-details">
                    <details>
                        <summary>详细信息</summary>
                        <pre>${escapeHtml(message.details)}</pre>
                    </details>
                </div>
            ` : ''}
        `;

        // 添加样式
        const style = document.createElement('style');
        style.textContent = `
            .flomo-error-notification {
                position: fixed;
                top: 20px;
                right: 20px;
                background: #fff;
                border: 1px solid #dc3545;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                max-width: 400px;
                z-index: 10000;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 14px;
                line-height: 1.5;
            }
            
            .error-header {
                display: flex;
                align-items: center;
                padding: 12px 16px;
                background: #dc3545;
                color: white;
                border-radius: 8px 8px 0 0;
            }
            
            .error-icon {
                margin-right: 8px;
                font-size: 16px;
            }
            
            .error-title {
                flex: 1;
                font-weight: 600;
            }
            
            .error-close {
                background: none;
                border: none;
                color: white;
                font-size: 20px;
                cursor: pointer;
                padding: 0;
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 4px;
                transition: background-color 0.2s;
            }
            
            .error-close:hover {
                background: rgba(255,255,255,0.2);
            }
            
            .error-message {
                padding: 16px;
                color: #721c24;
                background: #f8d7da;
            }
            
            .error-solutions {
                padding: 16px;
                border-top: 1px solid #e9ecef;
            }
            
            .error-solutions strong {
                color: #495057;
                display: block;
                margin-bottom: 8px;
            }
            
            .error-solutions ul {
                margin: 0;
                padding-left: 20px;
            }
            
            .error-solutions li {
                margin-bottom: 4px;
                color: #6c757d;
            }
            
            .error-details {
                padding: 16px;
                border-top: 1px solid #e9ecef;
            }
            
            .error-details summary {
                cursor: pointer;
                color: #007bff;
                font-weight: 500;
                margin-bottom: 8px;
            }
            
            .error-details pre {
                background: #f8f9fa;
                border: 1px solid #e9ecef;
                border-radius: 4px;
                padding: 12px;
                font-size: 12px;
                color: #495057;
                overflow-x: auto;
                margin: 0;
            }
        `;

        if (!document.querySelector('.flomo-error-styles')) {
            style.className = 'flomo-error-styles';
            document.head.appendChild(style);
        }

        // 添加到页面
        document.body.appendChild(notification);

        // 绑定关闭事件
        notification.querySelector('.error-close').addEventListener('click', () => {
            notification.remove();
        });

        // 自动关闭（10秒后）
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 10000);
    }

    /**
     * 获取错误日志
     * @returns {Array} 错误日志数组
     */
    getErrorLog() {
        return this.errorLog;
    }

    /**
     * 清除错误日志
     */
    async clearErrorLog() {
        this.errorLog = [];
        try {
            await chrome.storage.local.remove('errorLog');
        } catch (error) {
            console.error('清除错误日志失败:');
        }
    }

    /**
     * 从存储加载错误日志
     */
    async loadErrorLog() {
        try {
            const result = await chrome.storage.local.get(['errorLog']);
            if (result.errorLog) {
                this.errorLog = result.errorLog;
            }
        } catch (error) {
            console.error('加载错误日志失败:');
        }
    }
}

/**
 * 全局错误处理器实例
 */
export const errorHandler = new ErrorHandler();

/**
 * 包装异步函数，自动处理错误
 * @param {Function} asyncFunc - 异步函数
 * @param {string} context - 上下文信息
 * @returns {Function} 包装后的函数
 */
export function withErrorHandling(asyncFunc, context = '') {
    return async function(...args) {
        try {
            return await asyncFunc.apply(this, args);
        } catch (error) {
            return errorHandler.handleError(error, context);
        }
    };
}

/**
 * 验证用户输入
 * @param {Object} data - 用户输入数据
 * @returns {Object} 验证结果
 */
export function validateUserInput(data) {
    const errors = [];
    
    // 验证API地址
    if (data.apiUrl) {
        const urlPattern = /^https:\/\/flomoapp\.com\/iwh\/[^/]+\/[^/]+\/$/;
        if (!urlPattern.test(data.apiUrl)) {
            errors.push('API地址格式不正确');
        }
    }
    
    // 验证标签
    if (data.tags && data.tags.length > 8) {
        errors.push('标签数量不能超过8个');
    }
    
    // 验证内容长度
    if (data.originalContent && data.originalContent.length > 10000) {
        errors.push('原文内容过长（最大10000字符）');
    }
    
    if (data.personalThoughts && data.personalThoughts.length > 5000) {
        errors.push('个人想法内容过长（最大5000字符）');
    }
    
    // 验证图片
    if (data.images && data.images.length > 10) {
        errors.push('图片数量不能超过10张');
    }
    
    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * 显示成功消息
 * @param {string} message - 成功消息
 * @param {number} duration - 显示时长（毫秒）
 */
export function showSuccessMessage(message, duration = 3000) {
    const notification = document.createElement('div');
    notification.className = 'flomo-success-notification';
    notification.innerHTML = `
        <div class="success-content">
            <span class="success-icon">✅</span>
            <span class="success-message">${escapeHtml(message)}</span>
        </div>
    `;

    const style = document.createElement('style');
    style.textContent = `
        .flomo-success-notification {
            position: fixed;
            top: 20px;
            right: 20px;
            background: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
            border-radius: 8px;
            padding: 16px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            max-width: 300px;
        }
        
        .success-content {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .success-icon {
            font-size: 16px;
        }
    `;

    if (!document.querySelector('.flomo-success-styles')) {
        document.head.appendChild(style);
    }

    document.body.appendChild(notification);

    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, duration);
}