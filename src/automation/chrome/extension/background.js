/**
 * 预置动作执行器（无任意 JS 字符串执行）。
 * 支持两种入口：
 * 1) popup 手动发送 INJECT_RPA_ACTION
 * 2) Native Messaging 宿主发送 inject 指令（action + params）
 */
const NATIVE_HOST_NAME = "com.rpa.script_bridge";
const MODE_MAIN = "main";
const MODE_ISOLATED = "isolated";

let nativePort = null;
let nativeConnected = false;
let reconnectTimer = null;
let lastNativeError = "";

function scheduleReconnect(delayMs = 2000) {
    if (reconnectTimer) {
        return;
    }
    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connectNativeHost();
    }, delayMs);
}

function isInjectableUrl(url) {
    if (typeof url !== "string" || !url) {
        return false;
    }
    return /^https?:\/\//i.test(url);
}

async function resolveTargetTabId(payload = {}) {
    if (Number.isInteger(payload.tabId)) {
        return payload.tabId;
    }

    if (typeof payload.urlContains === "string" && payload.urlContains.trim()) {
        const tabs = await chrome.tabs.query({});
        const key = payload.urlContains.trim();
        const hit = tabs.find((tab) => typeof tab.url === "string" && tab.url.includes(key));
        if (hit?.id != null) {
            return hit.id;
        }
    }

    const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (active?.id != null) {
        return active.id;
    }
    throw new Error("未找到可操作的标签页");
}

function normalizeFrameId(input) {
    if (Number.isInteger(input) && input >= 0) {
        return input;
    }
    return null;
}

const STORAGE_SELECTOR = "rpa_selector";
const STORAGE_MATCH_TEXT = "rpa_match_text";
const STORAGE_LAST_PICKED = "rpa_last_picked";

async function startElementPicker(tabId, frameId) {
    if (!Number.isInteger(tabId)) {
        throw new Error("tabId 无效");
    }
    const target = Number.isInteger(frameId) ? { tabId, frameIds: [frameId] } : { tabId };
    await chrome.scripting.executeScript({
        target,
        files: ["element-picker.js"],
        world: "ISOLATED",
    });
    return { started: true };
}

async function executeInTab({ action, params, tabId, frameId, executeMode }) {
    if (typeof action !== "string" || !action.trim()) {
        throw new Error("action 不能为空");
    }
    const actionName = action.trim();
    const paramsObj = params && typeof params === "object" ? params : {};
    if (actionName === "getTabInfo") {
        const tabs = await chrome.tabs.query({});
        const result = {
            id: null,
            title: null,
            url: null,
            tabs: [],
        };
        for (const tab of tabs) {
            result.tabs.push({
                id: Number.isInteger(tab?.id) ? tab?.id : null,
                title: typeof tab?.title === "string" ? tab?.title : null,
                url: typeof tab?.url === "string" ? tab?.url : null,
            });
            if (tab.active) {
                result.id = tab?.id;
                result.title = tab?.title;
                result.url = tab?.url;
            }
        }
        return result;
    }
    if (actionName === "getFrameInfo") {
        if (!Number.isInteger(tabId)) {
            throw new Error("tabId 无效");
        }
        if (!chrome.webNavigation?.getAllFrames) {
            throw new Error("当前环境不支持 frame 查询（缺少 webNavigation 权限）");
        }
        const frameUrlContains =
            typeof paramsObj.frameUrlContains === "string" ? paramsObj.frameUrlContains.trim() : "";
        const similarIndex =
            Number.isInteger(paramsObj.similarIndex) && paramsObj.similarIndex >= 0 ? paramsObj.similarIndex : 0;
        const allFrames = await chrome.webNavigation.getAllFrames({ tabId });
        let matches;
        if (frameUrlContains) {
            matches = Array.isArray(allFrames)
                ? allFrames.filter(
                    (frame) => Number.isInteger(frame?.frameId) && typeof frame.url === "string" && frame.url.includes(frameUrlContains)
                )
                : [];
        } else {
            matches = Array.isArray(allFrames)
                ? allFrames.filter((frame) => Number.isInteger(frame?.frameId))
                : [];
        }
        if (!matches.length || similarIndex >= matches.length) {
            return {
                tabId,
                matchCount: matches.length,
                frame: null,
            }
        }
        const hit = matches[similarIndex];
        const children = Array.isArray(allFrames)
            ? allFrames
                .filter(
                    (frame) =>
                        Number.isInteger(frame?.frameId) && frame.parentFrameId === hit.frameId
                )
                .map((frame) => ({
                    frameId: frame.frameId,
                    url: typeof frame.url === "string" ? frame.url : "",
                }))
            : [];
        return {
            tabId,
            matchCount: matches.length,
            frame: {
                frameId: hit.frameId,
                parentFrameId: Number.isInteger(hit.parentFrameId) ? hit.parentFrameId : null,
                url: typeof hit.url === "string" ? hit.url : "",
                children,
            },
        };
    }
    if (!Number.isInteger(tabId)) {
        throw new Error("tabId 无效");
    }

    const target = Number.isInteger(frameId) ? { tabId, frameIds: [frameId] } : { tabId };
    const mode = normalizeExecuteMode(executeMode);
    const world = mode === MODE_ISOLATED ? "ISOLATED" : "MAIN";
    const results = await chrome.scripting.executeScript({
        target,
        world,
        func: async (actionName, actionParams) => {
            const paramsObj = actionParams && typeof actionParams === "object" ? actionParams : {};
            const selector = typeof paramsObj.selector === "string" ? paramsObj.selector : "";
            const textFilter = typeof paramsObj.text === "string" ? paramsObj.text.trim() : "";
            const similarIndex =
                Number.isInteger(paramsObj.similarIndex) && paramsObj.similarIndex >= 0
                    ? paramsObj.similarIndex
                    : 0;

            const parentSelectors = Array.isArray(paramsObj.parentSelectors)
                ? paramsObj.parentSelectors.filter((x) => typeof x === "string" && x.trim())
                : [];

            const resolveScopedRoot = () => {
                let root = document;
                for (const rawSelector of parentSelectors) {
                    const selectorText = rawSelector.trim();
                    if (!selectorText) {
                        continue;
                    }

                    const parentNode = root.querySelector(selectorText);
                    if (!parentNode) {
                        throw new Error("未找到父域元素: " + selectorText);
                    }

                    // 逐层切换查询上下文：优先进入 iframe 文档，其次进入 shadowRoot，否则在该元素内继续查找。
                    if (
                        parentNode instanceof HTMLIFrameElement ||
                        parentNode instanceof HTMLFrameElement
                    ) {
                        const frameDoc = parentNode.contentDocument;
                        if (!frameDoc) {
                            throw new Error("无法访问 iframe 文档: " + selectorText);
                        }
                        root = frameDoc;
                    } else if (parentNode.shadowRoot) {
                        root = parentNode.shadowRoot;
                    } else {
                        root = parentNode;
                    }
                }
                return root;
            };

            const normalizeText = (value) => String(value || "").trim();

            const elementTextEquals = (el, targetText) => normalizeText(el.textContent) === targetText;

            const elementContainsMatchingText = (root, targetText) => {
                if (elementTextEquals(root, targetText)) {
                    return true;
                }
                return Array.from(root.querySelectorAll("*")).some((el) => elementTextEquals(el, targetText));
            };

            const formatNodeError = () => {
                let msg = "未找到元素: " + selector;
                if (textFilter) {
                    msg += ", text=" + textFilter;
                }
                if (similarIndex > 0 || textFilter) {
                    msg += ", similarIndex=" + similarIndex;
                }
                return msg;
            };

            const getNode = () => {
                if (!selector) {
                    return null;
                }
                const scopedRoot = resolveScopedRoot();
                const candidates = Array.from(scopedRoot.querySelectorAll(selector));
                if (!candidates.length) {
                    return null;
                }
                const matches = textFilter
                    ? candidates.filter((el) => elementContainsMatchingText(el, textFilter))
                    : candidates;
                return matches[similarIndex] ?? null;
            };

            const requireNode = () => {
                const el = getNode();
                if (!el) {
                    throw new Error(formatNodeError());
                }
                return el;
            };

            const isElementVisible = (el) => {
                if (!el || !(el instanceof Element)) {
                    return false;
                }
                if (el.hidden) {
                    return false;
                }
                let node = el;
                while (node && node instanceof Element) {
                    const style = window.getComputedStyle(node);
                    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) {
                        return false;
                    }
                    node = node.parentElement;
                }
                const rect = el.getBoundingClientRect();
                return rect.width > 0 || rect.height > 0;
            };

            const evaluateExistenceMode = (el, mode) => {
                const exists = Boolean(el);
                const normalized = String(mode || "存在").trim();
                if (normalized === "存在" || normalized === "exists" || normalized === "exist") {
                    return exists;
                }
                if (normalized === "消失" || normalized === "gone" || normalized === "disappear") {
                    return !exists;
                }
                if (!exists) {
                    return false;
                }
                const visible = isElementVisible(el);
                if (normalized === "可见" || normalized === "visible") {
                    return visible;
                }
                if (normalized === "隐藏" || normalized === "hidden" || normalized === "hide") {
                    return !visible;
                }
                throw new Error("不支持的 exists mode: " + mode);
            };

            const actionMap = {
                click: async () => {
                    const el = requireNode();
                    el.click();
                    return true;
                },
                setValue: async () => {
                    const el = requireNode();
                    if (!("value" in el)) {
                        throw new Error("目标元素不支持输入 value");
                    }
                    const value = paramsObj.value == null ? "" : String(paramsObj.value);
                    el.focus();
                    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                        window.HTMLInputElement.prototype, 'value'
                    ).set;
                    nativeInputValueSetter.call(el, value);
                    el.dispatchEvent(new Event("input", { bubbles: true }));
                    el.dispatchEvent(new Event("change", { bubbles: true }));
                    return el.value;
                },
                getValue: async () => {
                    const el = requireNode();
                    return "value" in el ? el.value : null;
                },
                setText: async () => {
                    const el = requireNode();
                    const content = paramsObj.content == null ? "" : String(paramsObj.content);
                    el.textContent = content;
                    if (el.isContentEditable) {
                        el.dispatchEvent(new Event("input", { bubbles: true }));
                        el.dispatchEvent(new Event("change", { bubbles: true }));
                    }
                    return (el.innerText || el.textContent || "").trim();
                },
                getText: async () => {
                    const el = requireNode();
                    return (el.innerText || el.textContent || "").trim();
                },
                setAttribute: async () => {
                    const el = requireNode();
                    const name = typeof paramsObj.name === "string" ? paramsObj.name.trim() : "";
                    if (!name) {
                        throw new Error("setAttribute 需要 params.name（属性名）");
                    }
                    const value = paramsObj.value == null ? "" : String(paramsObj.value);
                    el.setAttribute(name, value);
                    return el.getAttribute(name);
                },
                getAttribute: async () => {
                    const el = requireNode();
                    const name = typeof paramsObj.name === "string" ? paramsObj.name.trim() : "";
                    if (!name) {
                        throw new Error("getAttribute 需要 params.name（属性名）");
                    }
                    return el.getAttribute(name);
                },
                getInfos: async () => {
                    return {
                        location: String(window.location?.href || ""),
                        title: String(document.title || ""),
                    };
                },
                exists: async () => {
                    const el = getNode();
                    const mode = paramsObj.mode;
                    if (mode == null || mode === "") {
                        return Boolean(el);
                    }
                    return evaluateExistenceMode(el, mode);
                },
                trigger: async () => {
                    const el = requireNode();

                    const eventNames = Array.isArray(paramsObj.events)
                        ? paramsObj.events.filter((x) => typeof x === "string" && x.trim())
                        : [];
                    if (!eventNames.length) {
                        throw new Error("trigger 需要 params.events（事件名数组）");
                    }

                    const eventInit =
                        paramsObj.eventInit && typeof paramsObj.eventInit === "object" ? paramsObj.eventInit : {};
                    const delayMs = Number.isFinite(Number(paramsObj.delayMs))
                        ? Math.max(0, Number(paramsObj.delayMs))
                        : 0;

                    for (const eventName of eventNames) {
                        const name = eventName.trim();
                        let ev;
                        if (
                            name.startsWith("key") ||
                            name === "keydown" ||
                            name === "keyup" ||
                            name === "keypress"
                        ) {
                            ev = new KeyboardEvent(name, { bubbles: true, cancelable: true, ...eventInit });
                        } else if (
                            name.startsWith("mouse") ||
                            name === "click" ||
                            name === "dblclick" ||
                            name === "mousedown" ||
                            name === "mouseup"
                        ) {
                            ev = new MouseEvent(name, { bubbles: true, cancelable: true, ...eventInit });
                        } else {
                            ev = new Event(name, { bubbles: true, cancelable: true, ...eventInit });
                        }
                        el.dispatchEvent(ev);

                        if (delayMs > 0) {
                            await new Promise((r) => setTimeout(r, delayMs));
                        }
                    }
                    return { triggered: eventNames.map((x) => x.trim()), count: eventNames.length };
                },
            };

            if (!actionMap[actionName]) {
                throw new Error("不支持的 action: " + actionName);
            }

            try {
                const result = await actionMap[actionName]();
                return { ok: true, result };
            } catch (e) {
                return { ok: false, error: e?.message || String(e) };
            }
        },
        args: [actionName, paramsObj],
    });

    if (!results?.length) {
        throw new Error("未获得执行结果（页面可能禁止脚本）");
    }

    const parts = results.map((r) => r?.result);
    const failures = parts.filter((p) => p && p.ok === false);
    if (failures.length) {
        throw new Error(failures.map((f) => f.error).join(" | "));
    }

    const values = parts.map((p) => (p && "result" in p ? p.result : p));
    return values.length === 1 ? values[0] : values;
}

function normalizeExecuteMode(input) {
    if (input === MODE_ISOLATED) {
        return MODE_ISOLATED;
    }
    return MODE_MAIN;
}

async function handleNativeInject(message) {
    const actionName = typeof message?.action === "string" ? message.action.trim() : "";
    const needsTab = actionName !== "getTabInfo";
    const tabId = needsTab ? await resolveTargetTabId(message) : null;
    const frameId = normalizeFrameId(message?.frameId);
    const executeMode = normalizeExecuteMode(message.executeMode);
    const result = await executeInTab({
        action: message.action,
        params: message.params,
        tabId,
        frameId,
        executeMode,
    });
    return {
        ok: true,
        tabId,
        frameId,
        result,
        executeMode,
    };
}

function sendToNative(payload) {
    if (!nativePort) {
        return;
    }
    try {
        nativePort.postMessage(payload);
    } catch (e) {
        lastNativeError = e?.message || String(e);
    }
}

function onNativeMessage(message) {
    if (!message || typeof message !== "object") {
        return;
    }

    if (message.type === "ping") {
        sendToNative({ type: "pong", ts: Date.now() });
        return;
    }

    if (message.type !== "inject") {
        sendToNative({ ok: false, error: "未知消息类型", originalType: message.type });
        return;
    }

    handleNativeInject(message)
        .then((res) => sendToNative({ type: "inject_result", requestId: message.requestId, ...res }))
        .catch((err) =>
            sendToNative({
                type: "inject_result",
                requestId: message.requestId,
                ok: false,
                error: err?.message || String(err),
            })
        );
}

function connectNativeHost() {
    if (nativePort) {
        return;
    }

    try {
        nativePort = chrome.runtime.connectNative(NATIVE_HOST_NAME);
        nativeConnected = true;
        lastNativeError = "";

        nativePort.onMessage.addListener(onNativeMessage);
        nativePort.onDisconnect.addListener(() => {
            const err = chrome.runtime.lastError;
            nativeConnected = false;
            nativePort = null;
            lastNativeError = err?.message || "native host 连接已断开";
            scheduleReconnect(3000);
        });
    } catch (e) {
        nativeConnected = false;
        nativePort = null;
        lastNativeError = e?.message || String(e);
        scheduleReconnect(5000);
    }
}

function setupNativeBridge() {
    connectNativeHost();
}

chrome.runtime.onInstalled.addListener(() => {
    setupNativeBridge();
});

chrome.runtime.onStartup.addListener(() => {
    setupNativeBridge();
});

// Service worker 被唤醒时也尝试连接一次，避免错过外部请求。
setupNativeBridge();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === "START_ELEMENT_PICKER") {
        const tabId = Number.isInteger(message.tabId) ? message.tabId : null;
        const frameId = normalizeFrameId(message.frameId);
        startElementPicker(tabId, frameId)
            .then((result) => sendResponse({ ok: true, result }))
            .catch((err) => sendResponse({ ok: false, error: err?.message || String(err) }));
        return true;
    }

    if (message?.type === "ELEMENT_PICKER_RESULT") {
        if (message.ok && message.result?.selector) {
            chrome.storage.local.set({
                [STORAGE_SELECTOR]: message.result.selector,
                [STORAGE_MATCH_TEXT]: message.result.text || "",
                [STORAGE_LAST_PICKED]: message.result,
            });
        }
        return false;
    }

    if (message?.type === "INJECT_RPA_ACTION") {
        const actionName = typeof message?.action === "string" ? message.action.trim() : "";
        if (actionName === "elementPicker") {
            Promise.resolve()
                .then(() => resolveTargetTabId(message))
                .then((tabId) => startElementPicker(tabId, normalizeFrameId(message?.frameId)))
                .then((result) => sendResponse({ ok: true, result }))
                .catch((err) => sendResponse({ ok: false, error: err?.message || String(err) }));
            return true;
        }
        const needsTab = actionName !== "getTabInfo";
        const executeMode = normalizeExecuteMode(message.executeMode);
        Promise.resolve()
            .then(() => (needsTab ? resolveTargetTabId(message) : null))
            .then((tabId) =>
                executeInTab({
                    action: message.action,
                    params: message.params,
                    tabId,
                    frameId: normalizeFrameId(message?.frameId),
                    executeMode,
                }).then((result) => ({ result, tabId }))
            )
            .then(({ result, tabId }) =>
                sendResponse({
                    ok: true,
                    result,
                    executeMode,
                    tabId,
                    frameId: normalizeFrameId(message?.frameId),
                })
            )
            .catch((err) => sendResponse({ ok: false, error: err?.message || String(err) }));
        return true;
    }

    if (message?.type === "NATIVE_BRIDGE_STATUS") {
        sendResponse({
            ok: true,
            host: NATIVE_HOST_NAME,
            connected: nativeConnected,
            lastError: lastNativeError,
        });
        return false;
    }

    return false;
});
