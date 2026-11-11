import { DEFAULT_SETTINGS, cleanTag, validateApiUrl, validateSettings, parseBackup } from '../utils/validation.js';

export class OptionsManager {
    constructor() {
        this.settings = { ...DEFAULT_SETTINGS, commonTags: [], apiUrl: '' };
        this.testRequestId = crypto.randomUUID();
        this.testing = false;
        this.init();
    }

    async request(action, data = {}) {
        const response = await chrome.runtime.sendMessage({ action, ...data });
        if (!response?.success) throw new Error(response?.error || '操作失败，请重新加载扩展');
        return response;
    }

    async init() {
        this.bindEvents();
        try {
            await this.loadSettings();
            await this.loadStatistics();
        } catch {
            this.showStatus('设置加载失败，请重新加载扩展', 'error');
        }
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area === 'local' && changes.statistics) void this.loadStatistics();
        });
    }

    async loadSettings() {
        const response = await this.request('getPrivateSettings');
        this.settings = { ...DEFAULT_SETTINGS, ...validateSettings(response.settings), apiUrl: typeof response.settings.apiUrl === 'string' ? response.settings.apiUrl : '' };
        this.updateUI();
    }

    bindEvents() {
        document.getElementById('apiUrl').addEventListener('input', event => {
            this.settings.apiUrl = event.target.value.trim();
            this.testRequestId = crypto.randomUUID();
            this.validateApiUrl();
        });
        for (const key of ['autoSaveDraft', 'autoFillPageInfo', 'showWordCount']) {
            document.getElementById(key).addEventListener('change', event => { this.settings[key] = event.target.checked; });
        }
        const actions = {
            testConnectionBtn: () => this.testConnection(),
            addCommonTagBtn: () => this.addCommonTag(),
            exportDataBtn: () => this.exportData(),
            importDataBtn: () => document.getElementById('fileInput').click(),
            clearDataBtn: () => this.clearData(),
            saveBtn: () => this.saveSettings(),
            resetBtn: () => this.resetSettings()
        };
        for (const [id, action] of Object.entries(actions)) document.getElementById(id).addEventListener('click', action);
        document.getElementById('commonTagInput').addEventListener('keydown', event => {
            if (event.key === 'Enter') { event.preventDefault(); this.addCommonTag(); }
        });
        document.getElementById('fileInput').addEventListener('change', event => this.handleFileImport(event));
    }

    updateUI() {
        document.getElementById('apiUrl').value = this.settings.apiUrl ?? '';
        for (const key of ['autoSaveDraft', 'autoFillPageInfo', 'showWordCount']) document.getElementById(key).checked = this.settings[key];
        this.renderCommonTags();
        this.validateApiUrl();
    }

    validateApiUrl() {
        let valid = false;
        try { validateApiUrl(this.settings.apiUrl); valid = true; } catch { /* Invalid URLs cannot be tested. */ }
        document.getElementById('testConnectionBtn').disabled = !valid || this.testing;
        this.showConnectionStatus(valid ? '格式有效；发送测试笔记将创建一条笔记并计入今日次数' : '请输入有效的 flomo API 地址', valid ? 'info' : 'error');
        return valid;
    }

    async testConnection() {
        if (this.testing || !this.validateApiUrl()) return;
        if (!confirm('将向当前地址发送一条测试笔记，消耗一次发送额度。继续吗？')) return;
        this.testing = true;
        document.getElementById('apiUrl').disabled = true;
        document.getElementById('testConnectionBtn').disabled = true;
        try {
            const result = await chrome.runtime.sendMessage({ action: 'testConnection', apiUrl: this.settings.apiUrl, requestId: this.testRequestId });
            if (result?.uncertain) {
                this.showConnectionStatus(result.error, 'error');
                if (confirm('发送结果未知。请先检查 flomo；确认没有收到后，是否允许下次点击重新发送？')) this.testRequestId = crypto.randomUUID();
            } else if (result?.success) {
                this.showConnectionStatus(result.warning || '测试笔记已发送，API 验证成功', result.warning ? 'error' : 'success');
            } else this.showConnectionStatus(result?.error || '测试失败', 'error');
            await this.loadStatistics();
        } catch {
            this.showConnectionStatus('后台连接中断，请先检查 flomo 是否已收到测试笔记', 'error');
        } finally {
            this.testing = false;
            document.getElementById('apiUrl').disabled = false;
            document.getElementById('testConnectionBtn').disabled = false;
        }
    }

    showConnectionStatus(message, type) {
        const element = document.getElementById('connectionStatus');
        element.textContent = message;
        element.className = `connection-status ${type}`;
    }

    async loadStatistics() {
        try {
            const data = await this.request('getStatistics');
            document.getElementById('todayCount').textContent = `${data.dailyCount} / 100`;
            document.getElementById('totalCount').textContent = String(data.totalSent);
            document.getElementById('lastSent').textContent = data.lastSentDate ? new Date(data.lastSentDate).toLocaleDateString('zh-CN') : '从未';
            document.getElementById('progressFill').style.width = `${Math.min(100, data.dailyCount)}%`;
            document.getElementById('progressText').textContent = `本机今日剩余 ${data.remaining} 条（其他设备或工具的用量以 flomo 为准）`;
        } catch { this.showStatus('统计读取失败，请重试', 'error'); }
    }

    renderCommonTags() {
        const container = document.getElementById('commonTagsContainer');
        container.replaceChildren();
        this.settings.commonTags.forEach((tag, index) => {
            const item = document.createElement('div');
            item.className = 'common-tag';
            const label = document.createElement('span');
            label.textContent = `#${tag}`;
            const remove = document.createElement('button');
            remove.className = 'remove';
            remove.type = 'button';
            remove.textContent = '×';
            remove.setAttribute('aria-label', `删除标签 ${tag}`);
            remove.addEventListener('click', () => { this.settings.commonTags.splice(index, 1); this.renderCommonTags(); });
            item.append(label, remove);
            container.appendChild(item);
        });
    }

    addCommonTag() {
        try {
            const input = document.getElementById('commonTagInput');
            const tag = cleanTag(input.value);
            if (this.settings.commonTags.includes(tag)) throw new Error('标签已存在');
            if (this.settings.commonTags.length >= 30) throw new Error('常用标签最多 30 个');
            this.settings.commonTags.push(tag);
            input.value = '';
            this.renderCommonTags();
        } catch (error) { this.showStatus(error.message, 'error'); }
    }

    async saveSettings() {
        try {
            const settings = validateSettings(this.settings, { includeApi: true });
            await this.request('saveSettings', { settings });
            this.showStatus('设置已保存，API 地址仅存于本机', 'success');
        } catch (error) { this.showStatus(error.message, 'error'); }
    }

    async resetSettings() {
        if (!confirm('重置偏好并清空本机 API 地址？草稿、发送记录与计数保留。')) return;
        try {
            await this.request('resetSettings');
            await this.loadSettings();
            this.showStatus('设置已重置', 'success');
        } catch { this.showStatus('重置失败，请重试', 'error'); }
    }

    async exportData() {
        try {
            const { backup } = await this.request('exportData');
            const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
            const link = document.createElement('a');
            link.href = url;
            link.download = `flomo-web-clipper-backup-${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            this.showStatus('已导出偏好和标签；不包含 API 地址、草稿、统计或发送记录', 'success');
        } catch { this.showStatus('导出失败，请重试', 'error'); }
    }

    async handleFileImport(event) {
        const file = event.target.files[0];
        if (!file) return;
        try {
            if (file.size > 128 * 1024) throw new Error('备份不能超过 128 KB');
            const backup = JSON.parse(await file.text());
            parseBackup(backup);
            if (!confirm('导入偏好和标签？API 地址、草稿和发送统计将保留。')) return;
            await this.request('importData', { backup });
            await this.loadSettings();
            this.showStatus('偏好和标签已导入', 'success');
        } catch { this.showStatus('导入失败，请检查备份版本、字段类型和标签内容', 'error'); }
        finally { event.target.value = ''; }
    }

    async clearData() {
        if (!confirm('清除本机 API 地址、所有草稿、偏好和标签？为防止误重发，发送确认记录和计数会保留。')) return;
        try {
            await this.request('clearData');
            await this.loadSettings();
            this.showStatus('API 地址、草稿、偏好和标签已清除', 'success');
        } catch { this.showStatus('清除失败，请重试', 'error'); }
    }

    showStatus(message, type) {
        const element = document.getElementById('statusMessage');
        element.textContent = message;
        element.className = `status-message ${type}`;
    }
}

document.addEventListener('DOMContentLoaded', () => { new OptionsManager(); });
