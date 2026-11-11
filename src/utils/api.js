import { validateApiUrl, validateNote } from './validation.js';

export function formatContent(data) {
    const parts = [];
    if (data.tags?.length) parts.push(data.tags.map(tag => `#${tag}`).join(' '));
    if (data.originalContent?.trim()) parts.push(data.originalContent.trim());
    if (data.personalThoughts?.trim()) {
        if (data.originalContent?.trim()) parts.push('--------------------');
        parts.push(data.personalThoughts.trim());
    }
    if (data.pageTitle || data.pageUrl) {
        parts.push('--------------------');
        parts.push([data.pageTitle && `网页标题：${data.pageTitle}`, data.pageUrl && `网页URL：${data.pageUrl}`].filter(Boolean).join('\n'));
    }
    return parts.join('\n\n');
}

export class SendError extends Error {
    constructor(message, uncertain = false) {
        super(message);
        this.uncertain = uncertain;
    }
}

export async function sendToFlomo(apiUrl, data, { fetchImpl = fetch, timeoutMs = 15000 } = {}) {
    const url = validateApiUrl(apiUrl);
    const note = validateNote(data);
    const content = formatContent(note);
    if (content.length > 5000) throw new SendError('整条笔记（含标签和网页信息）不能超过 5000 字');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetchImpl(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content }),
            credentials: 'omit',
            redirect: 'error',
            cache: 'no-store',
            signal: controller.signal
        });
        if (!response.ok) throw new SendError(`flomo 返回 HTTP ${response.status}；请先检查是否已收到笔记，再决定是否重发`, true);
        let result;
        try { result = await response.json(); } catch {
            throw new SendError('无法确认 flomo 响应，请先检查笔记是否已收到', true);
        }
        if (!result || !Number.isInteger(result.code)) throw new SendError('flomo 响应格式异常，请先检查笔记是否已收到', true);
        if (result.code !== 0) throw new SendError(`flomo 拒绝了笔记（错误码 ${result.code}），请检查 API 配置或发送额度`);
        return { success: true };
    } catch (error) {
        if (error instanceof SendError) throw error;
        // Fetch errors can contain the credential-bearing URL; never expose the raw error.
        throw new SendError('网络中断或请求超时，结果无法确认；请先检查 flomo，勿直接重复发送', true);
    } finally {
        clearTimeout(timer);
    }
}
