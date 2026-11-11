export const DEFAULT_SETTINGS = Object.freeze({
    autoSaveDraft: true,
    autoFillPageInfo: true,
    showWordCount: true,
    commonTags: []
});

export function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function validateApiUrl(value, allowEmpty = false) {
    if (allowEmpty && value === '') return '';
    if (typeof value !== 'string' || value.length > 2048) throw new Error('请输入有效的 flomo API 地址');
    const text = value.trim();
    let url;
    try { url = new URL(text); } catch { throw new Error('请输入有效的 flomo API 地址'); }
    if (url.origin !== 'https://flomoapp.com' || url.username || url.password || url.search || url.hash ||
        !/^\/iwh\/[A-Za-z0-9_-]+\/(?:[A-Za-z0-9_-]+\/)?$/.test(url.pathname) || url.href !== text) {
        throw new Error('API 地址必须是 flomo 官方 HTTPS webhook 地址');
    }
    return text;
}

export function cleanTag(value) {
    if (typeof value !== 'string') throw new Error('标签必须是文字');
    const tag = value.trim().replace(/^#+/, '').replace(/\s+/g, '');
    if (!tag || tag.length > 20 || /[<>"'`\u0000-\u001f]/.test(tag)) throw new Error('标签需为 1–20 字，不能包含 HTML 符号');
    return tag;
}

export function validateTags(value, limit = 8) {
    if (!Array.isArray(value) || value.length > limit) throw new Error(`标签最多 ${limit} 个`);
    return [...new Set(value.map(cleanTag))];
}

export function validateSettings(value, { includeApi = false } = {}) {
    if (!isRecord(value)) throw new Error('设置格式无效');
    const result = {};
    for (const key of ['autoSaveDraft', 'autoFillPageInfo', 'showWordCount']) {
        if (Object.hasOwn(value, key)) {
            if (typeof value[key] !== 'boolean') throw new Error('偏好设置必须是布尔值');
            result[key] = value[key];
        }
    }
    if (Object.hasOwn(value, 'commonTags')) result.commonTags = validateTags(value.commonTags, 30);
    if (Object.hasOwn(value, 'tags')) result.tags = validateTags(value.tags);
    if (includeApi && Object.hasOwn(value, 'apiUrl')) result.apiUrl = validateApiUrl(value.apiUrl, true);
    return result;
}

function text(value, limit, label) {
    if (value === undefined) return '';
    if (typeof value !== 'string' || value.length > limit) throw new Error(`${label}格式无效或过长`);
    return value;
}

export function validateNote(value, { draft = false } = {}) {
    if (!isRecord(value)) throw new Error('笔记格式无效');
    const result = {
        tags: validateTags(value.tags ?? []),
        originalContent: text(value.originalContent, draft ? 1000000 : 5000, '原文'),
        personalThoughts: text(value.personalThoughts, draft ? 1000000 : 5000, '想法'),
        pageTitle: text(value.pageTitle, 500, '网页标题'),
        pageUrl: text(value.pageUrl, 2048, '网页地址')
    };
    if (value.images !== undefined && (!Array.isArray(value.images) || value.images.length > 10)) throw new Error('图片草稿格式无效');
    if (value.images?.length && !draft) throw new Error('当前 webhook 不上传本地图片，请先保存图片并从草稿中移除附件');
    // Preserve legacy attachments locally, but never interpret their names as HTML or upload them silently.
    result.images = (value.images ?? []).map(image => {
        if (!isRecord(image) || typeof image.name !== 'string' || typeof image.data !== 'string' ||
            !/^data:image\/[A-Za-z0-9.+-]+;base64,[A-Za-z0-9+/=\r\n]+$/.test(image.data)) {
            throw new Error('旧草稿含不支持的图片，请使用旧版本导出后处理');
        }
        return { name: image.name.slice(0, 500), data: image.data };
    });
    if (draft && JSON.stringify(result).length > 9 * 1024 * 1024) throw new Error('草稿过大，请先移除图片附件');
    if (!draft && !result.originalContent.trim() && !result.personalThoughts.trim()) throw new Error('请输入笔记内容');
    return result;
}

export function validateRequestId(value) {
    if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{16,100}$/.test(value)) throw new Error('请求编号无效，请重新打开弹窗');
    return value;
}

export function validateTabId(value) {
    if (!Number.isInteger(value) || value < 0) throw new Error('标签页编号无效');
    return value;
}

export function parseBackup(value) {
    if (!isRecord(value) || !['1.0.0', '2.0.0'].includes(value.version) || !isRecord(value.settings)) {
        throw new Error('不支持的备份格式或版本');
    }
    // Credentials, statistics and arbitrary storage keys are deliberately not imported.
    return validateSettings(value.settings);
}
