import { createService } from '../utils/service.js';

const service = createService({ chrome });
const popupActions = new Set(['getSettings', 'getStatistics', 'sendToFlomo', 'saveDraft', 'getDraft', 'saveTags']);
const optionsActions = new Set(['getPrivateSettings', 'saveSettings', 'getStatistics', 'testConnection', 'exportData', 'importData', 'resetSettings', 'clearData']);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const base = chrome.runtime.getURL('');
  const actions = sender.url === `${base}src/popup/popup.html` ? popupActions :
    sender.url === `${base}src/options/options.html` ? optionsActions : null;
  if (sender.id !== chrome.runtime.id || !actions?.has(request?.action)) {
    sendResponse({ success: false, error: '消息来源或操作无效' });
    return false;
  }
  service.handle(request).then(sendResponse, () => sendResponse({ success: false, error: '后台操作失败，请重试' }));
  return true;
});

chrome.runtime.onInstalled.addListener(() => {
  void service.handle({ action: 'getStatistics' });
});
