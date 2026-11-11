import { DEFAULT_SETTINGS, cleanTag, validateNote } from '../utils/validation.js';

export class FlomoPopup {
    constructor() {
        this.currentTab = null;
        this.tags = [];
        this.images = [];
        this.settings = { ...DEFAULT_SETTINGS, commonTags: [] };
        this.dailyCount = 0;
        this.requestId = crypto.randomUUID();
        this.apiConfigured = false;
        this.isInitialized = false;
        this.isSending = false;
        this.uncertain = false;
        this.initialization = this.init();
    }

    async request(action, data = {}) {
        const response = await chrome.runtime.sendMessage({ action, ...data });
        if (!response?.success) throw new Error(response?.error || '后台连接失败，请重试');
        return response;
    }

    async init() {
        this.bindEvents();
        this.setEditingEnabled(false);
        try {
            [this.currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!this.currentTab || !Number.isInteger(this.currentTab.id)) throw new Error('无法获取当前标签页');
            await this.loadSettings();
            await this.loadStatistics();
            const { draft } = await this.request('getDraft', { tabId: this.currentTab.id });
            if (draft) this.populateForm(draft);
            else this.tags = [...this.settings.tags];
            if (this.settings.autoFillPageInfo) {
                this.fillBasicPageInfo();
                await this.getPageInfo();
            }
            this.isInitialized = true;
            this.showStatus(this.apiConfigured ? '' : '请先在设置中配置 flomo API 地址', 'info');
            if (this.settings.autoSaveDraft && !draft && document.getElementById('originalContent').value) void this.saveDraft(true);
        } catch (error) { this.showStatus(error.message, 'error'); }
        finally { this.setEditingEnabled(true); this.updateUI(); }
        chrome.storage.onChanged.addListener((changes, area) => {
            if ((area === 'sync') || (area === 'local' && changes.apiUrl)) void this.loadSettings().catch(() => this.showStatus('设置更新失败', 'error'));
            if (area === 'local' && changes.statistics) void this.loadStatistics().catch(() => {});
        });
    }

    bindEvents() {
        const actions = {
            addTagBtn: () => this.addTag(),
            clearOriginalBtn: () => this.clearOriginalContent(),
            refreshPageInfoBtn: () => this.getPageInfo(true),
            saveDraftBtn: () => this.saveDraft(),
            sendBtn: () => this.sendToFlomo(),
            settingsBtn: () => chrome.runtime.openOptionsPage()
        };
        for (const [id, action] of Object.entries(actions)) document.getElementById(id).addEventListener('click', action);
        document.getElementById('tagInput').addEventListener('keydown', event => {
            if (event.key === 'Enter') { event.preventDefault(); this.addTag(); }
        });
        for (const id of ['originalContent', 'personalThoughts']) {
            document.getElementById(id).addEventListener('input', () => { this.changed(); this.updateCharCount(); });
        }
        document.getElementById('originalContent').addEventListener('paste', event => {
            if ([...event.clipboardData.items].some(item => item.type.startsWith('image/'))) {
                this.showStatus('本地图片不会上传；请将图片链接粘贴为文字，或使用 flomo 官方客户端上传', 'error');
            }
        });
        document.getElementById('originalContent').addEventListener('dragover', event => event.preventDefault());
        document.getElementById('originalContent').addEventListener('drop', event => {
            if (event.dataTransfer.files.length) {
                event.preventDefault();
                this.showStatus('当前只发送文字和链接，不接收本地文件', 'error');
            }
        });
    }

    async loadSettings() {
        const response = await this.request('getSettings');
        this.settings = { ...DEFAULT_SETTINGS, ...response.settings };
        this.apiConfigured = response.apiConfigured;
        this.renderSuggestions();
        this.updateCharCount();
    }

    async loadStatistics() {
        const response = await this.request('getStatistics');
        this.dailyCount = response.dailyCount;
        this.updateDailyCountDisplay();
    }

    fillBasicPageInfo() {
        document.getElementById('pageTitle').textContent = (this.currentTab?.title ?? '').slice(0, 500);
        document.getElementById('pageUrl').textContent = (this.currentTab?.url ?? '').slice(0, 2048);
    }

    async getPageInfo(manual = false) {
        if (!this.currentTab || (!manual && !this.settings.autoFillPageInfo)) return;
        this.fillBasicPageInfo();
        let timeout;
        try {
            const response = await Promise.race([
                (async () => {
                    try { return await chrome.tabs.sendMessage(this.currentTab.id, { action: 'getPageInfo' }); }
                    catch {
                        await chrome.scripting.executeScript({ target: { tabId: this.currentTab.id }, files: ['src/content/content.js'] });
                        return chrome.tabs.sendMessage(this.currentTab.id, { action: 'getPageInfo' });
                    }
                })(),
                new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('timeout')), 1500); })
            ]);
            if (response?.success) {
                document.getElementById('pageTitle').textContent = String(response.data.title ?? '').slice(0, 500);
                document.getElementById('pageUrl').textContent = String(response.data.url ?? '').slice(0, 2048);
                const field = document.getElementById('originalContent');
                if (response.data.selectedText && !field.value) field.value = String(response.data.selectedText).slice(0, 5000);
            }
            if (this.isInitialized) this.changed();
        } catch {
            if (manual) this.showStatus('当前页面不支持读取选区，已保留标签页标题和地址', 'info');
        } finally { clearTimeout(timeout); this.updateCharCount(); }
    }

    addTag(value) {
        if (!this.isInitialized || this.isSending) return;
        try {
            const input = document.getElementById('tagInput');
            const tag = cleanTag(typeof value === 'string' ? value : input.value);
            if (this.tags.length >= 8) throw new Error('最多 8 个标签');
            if (this.tags.includes(tag)) throw new Error('标签已存在');
            this.tags.push(tag);
            input.value = '';
            this.renderTags();
            this.changed();
            void this.request('saveTags', { tags: this.tags }).catch(() => this.showStatus('标签保存失败', 'error'));
        } catch (error) { this.showStatus(error.message, 'error'); }
    }

    renderTags() {
        const container = document.getElementById('tagsContainer');
        container.replaceChildren();
        this.tags.forEach((tag, index) => {
            const item = document.createElement('div');
            item.className = 'tag';
            const label = document.createElement('span');
            label.className = 'tag-text';
            label.textContent = `#${tag}`;
            const remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'tag-remove';
            remove.textContent = '×';
            remove.setAttribute('aria-label', `删除标签 ${tag}`);
            remove.addEventListener('click', () => {
                if (this.isSending) return;
                this.tags.splice(index, 1);
                this.renderTags();
                this.changed();
                void this.request('saveTags', { tags: this.tags }).catch(() => this.showStatus('标签保存失败', 'error'));
            });
            item.append(label, remove);
            container.appendChild(item);
        });
        document.getElementById('tagCount').textContent = `${this.tags.length}/8`;
        document.getElementById('addTagBtn').disabled = this.isSending || this.tags.length >= 8;
    }

    renderSuggestions() {
        const container = document.getElementById('commonTagSuggestions');
        container.replaceChildren();
        for (const tag of this.settings.commonTags) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'action-btn secondary';
            button.textContent = `#${tag}`;
            button.addEventListener('click', () => this.addTag(tag));
            container.appendChild(button);
        }
    }

    updateCharCount() {
        for (const [field, label] of [['originalContent', 'originalCharCount'], ['personalThoughts', 'thoughtsCharCount']]) {
            const element = document.getElementById(label);
            element.textContent = `${document.getElementById(field).value.length} 字`;
            element.hidden = !this.settings.showWordCount;
        }
    }

    updateDailyCountDisplay() {
        document.getElementById('dailyCount').textContent = `本机今日: ${this.dailyCount}/100`;
        document.getElementById('sendBtn').disabled = !this.isInitialized || this.isSending || this.dailyCount >= 100;
    }

    clearOriginalContent() {
        if (this.isSending) return;
        document.getElementById('originalContent').value = '';
        // Legacy attachments require an explicit remove action; clearing text must not silently discard them.
        this.changed();
        this.updateCharCount();
    }

    updateImagePreview() {
        const container = document.getElementById('imagePreview');
        container.replaceChildren();
        for (const [index, image] of this.images.entries()) {
            const item = document.createElement('div');
            item.className = 'legacy-image';
            const label = document.createElement('span');
            label.textContent = `旧草稿附件：${image.name}（不会上传）`;
            const remove = document.createElement('button');
            remove.type = 'button';
            remove.textContent = '移除附件';
            remove.addEventListener('click', () => {
                if (this.isSending || !confirm('此附件不会上传。请先自行保存原图片，确认从草稿中移除？')) return;
                this.images.splice(index, 1);
                this.updateImagePreview();
                this.changed();
            });
            const download = document.createElement('button');
            download.type = 'button';
            download.textContent = '保存原图';
            download.addEventListener('click', () => this.downloadImage(image));
            item.append(label, download, remove);
            container.appendChild(item);
        }
    }

    downloadImage(image) {
        const encoded = image.data.slice(image.data.indexOf(',') + 1);
        const bytes = Uint8Array.from(atob(encoded), char => char.charCodeAt(0));
        const url = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = image.name.replace(/[\\/:*?"<>|]/g, '_').slice(0, 200) || 'image';
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    changed() {
        if (!this.isInitialized || this.isSending) return;
        this.requestId = crypto.randomUUID();
        this.uncertain = false;
        if (this.settings.autoSaveDraft) void this.saveDraft(true);
    }

    async saveDraft(silent = false) {
        if (!this.currentTab || !this.isInitialized || this.isSending) return;
        try {
            const content = { ...this.getFormData(), requestId: this.requestId };
            // Dispatch immediately on input; a delayed timer is discarded when Chrome closes the popup.
            await this.request('saveDraft', { data: { tabId: this.currentTab.id, content } });
            if (!silent) this.showStatus('草稿已保存', 'success');
        } catch (error) { this.showStatus(error.message || '草稿保存失败', 'error'); }
    }

    async sendToFlomo() {
        if (!this.isInitialized || this.isSending) return;
        if (!this.apiConfigured) { this.showStatus('请先配置 flomo API 地址', 'error'); return; }
        if (this.uncertain) {
            if (!confirm('请先检查 flomo 是否已收到笔记。确认未收到，仍要重新发送吗？')) return;
            this.requestId = crypto.randomUUID();
            this.uncertain = false;
        }
        let form;
        try { form = validateNote(this.getFormData()); }
        catch (error) { this.showStatus(error.message, 'error'); return; }
        this.isSending = true;
        this.showLoading(true);
        let dispatched = false;
        try {
            // Lock before the first await; persist recovery data even with autosave disabled.
            await this.request('saveDraft', { data: { tabId: this.currentTab.id, content: { ...form, requestId: this.requestId } } });
            dispatched = true;
            const result = await chrome.runtime.sendMessage({ action: 'sendToFlomo', data: { ...form, tabId: this.currentTab.id, requestId: this.requestId } });
            if (result?.success) {
                this.clearForm();
                this.dailyCount = result.dailyCount;
                this.showStatus(result.warning || '发送成功！', result.warning ? 'error' : 'success');
            } else {
                this.uncertain = Boolean(result?.uncertain);
                this.showStatus(result?.error || '发送失败，草稿已保留', 'error');
            }
        } catch {
            this.uncertain = dispatched;
            this.showStatus(dispatched ? '后台连接中断，结果待确认；请先检查 flomo 再重试' : '恢复草稿保存失败，笔记未发送；请保留内容并重试', 'error');
        } finally {
            this.isSending = false;
            this.showLoading(false);
            this.updateUI();
        }
    }

    getFormData() {
        return {
            tags: [...this.tags],
            originalContent: document.getElementById('originalContent').value,
            personalThoughts: document.getElementById('personalThoughts').value,
            pageTitle: document.getElementById('pageTitle').textContent.trim(),
            pageUrl: document.getElementById('pageUrl').textContent.trim(),
            images: this.images
        };
    }

    populateForm(data) {
        const note = validateNote(data, { draft: true });
        this.tags = note.tags;
        this.images = note.images;
        document.getElementById('originalContent').value = note.originalContent;
        document.getElementById('personalThoughts').value = note.personalThoughts;
        document.getElementById('pageTitle').textContent = note.pageTitle;
        document.getElementById('pageUrl').textContent = note.pageUrl;
        if (/^[A-Za-z0-9_-]{16,100}$/.test(data.requestId ?? '')) this.requestId = data.requestId;
        this.updateUI();
    }

    clearForm() {
        this.tags = [];
        this.images = [];
        this.requestId = crypto.randomUUID();
        this.uncertain = false;
        document.getElementById('originalContent').value = '';
        document.getElementById('personalThoughts').value = '';
        this.updateUI();
    }

    showStatus(message, type = 'info') {
        const element = document.getElementById('statusMessage');
        element.textContent = message;
        element.className = `status-message ${type}`;
    }

    setEditingEnabled(enabled) {
        for (const node of document.querySelectorAll('input, textarea, button')) node.disabled = !enabled;
        this.updateDailyCountDisplay();
    }

    showLoading(show) {
        document.getElementById('loadingOverlay').classList.toggle('show', show);
        this.setEditingEnabled(!show);
    }

    updateUI() {
        this.renderTags();
        this.updateImagePreview();
        this.updateCharCount();
        this.updateDailyCountDisplay();
    }
}

document.addEventListener('DOMContentLoaded', () => { new FlomoPopup(); });
