import { DEFAULT_SETTINGS, validateSettings } from './validation.js';

export function emptyStatistics(now = new Date()) {
    return { dailyCount: 0, lastResetDate: now.toDateString(), totalSent: 0, lastSentDate: null };
}

export function normalizeStatistics(value = {}, now = new Date()) {
    const count = n => Number.isSafeInteger(n) && n >= 0 ? n : 0;
    return {
        dailyCount: value.lastResetDate === now.toDateString() ? count(value.dailyCount) : 0,
        lastResetDate: now.toDateString(),
        totalSent: count(value.totalSent),
        lastSentDate: typeof value.lastSentDate === 'string' && Number.isFinite(Date.parse(value.lastSentDate)) ? value.lastSentDate : null
    };
}

export async function initializeStorage(chrome, now = new Date()) {
    await Promise.all([
        chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' }),
        chrome.storage.sync.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' })
    ]);
    const [sync, local] = await Promise.all([chrome.storage.sync.get(null), chrome.storage.local.get(null)]);
    if (local.schemaVersion !== 2) {
        const migrated = { schemaVersion: 2 };
        if (!Object.hasOwn(local, 'apiUrl') && typeof sync.apiUrl === 'string') migrated.apiUrl = sync.apiUrl;
        if (!local.statistics) migrated.statistics = normalizeStatistics(sync, now);
        await chrome.storage.local.set(migrated);
    }
    // Remove cloud copies only after the local migration has succeeded.
    await chrome.storage.sync.remove(['apiUrl', 'dailyCount', 'lastResetDate', 'totalSent', 'lastSentDate']);
}

export async function readSettings(chrome) {
    const stored = await chrome.storage.sync.get(Object.keys(DEFAULT_SETTINGS).concat('tags'));
    const result = { ...DEFAULT_SETTINGS, commonTags: [], tags: [] };
    // A malformed legacy preference must not make the whole extension inaccessible.
    for (const [key, value] of Object.entries(stored)) {
        try { Object.assign(result, validateSettings({ [key]: value })); } catch { /* Keep the safe default. */ }
    }
    return result;
}
