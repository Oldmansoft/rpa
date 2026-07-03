const STORAGE_ACTION = "rpa_action";
const STORAGE_SELECTOR = "rpa_selector";
const STORAGE_MATCH_TEXT = "rpa_match_text";
const STORAGE_VALUE = "rpa_value";
const STORAGE_ATTR_NAME = "rpa_attr_name";
const STORAGE_FRAME_ID = "rpa_frame_id";
const STORAGE_FRAME_URL_CONTAINS = "rpa_frame_url_contains";
const STORAGE_SIMILAR_INDEX = "rpa_similar_index";
const STORAGE_PARENT_SELECTORS = "rpa_parent_selectors";
const STORAGE_LAST_PICKED = "rpa_last_picked";

function $(id) {
    return document.getElementById(id);
}

function parseLines(text) {
    return String(text || "")
        .split(/\r?\n/)
        .map((x) => x.trim())
        .filter(Boolean);
}

function collectLocatorInput() {
    const frameIdText = $("frameId").value.trim();
    const frameId = frameIdText === "" ? null : Number(frameIdText);
    const frameUrlContains = $("frameUrlContains").value.trim();
    const similarIndexText = $("similarIndex").value.trim();
    const similarIndex = similarIndexText === "" ? 0 : Number(similarIndexText);
    return { frameId, frameUrlContains, similarIndex };
}

function validateLocatorInput(locator) {
    if (locator.frameId != null && (!Number.isInteger(locator.frameId) || locator.frameId < 0)) {
        return "frameId 必须是大于等于 0 的整数。";
    }
    if (!Number.isInteger(locator.similarIndex) || locator.similarIndex < 0) {
        return "similarIndex 必须是大于等于 0 的整数。";
    }
    return "";
}

function setFieldVisible(name, visible) {
    const el = document.querySelector(`[data-field="${name}"]`);
    if (!el) {
        return;
    }
    el.classList.toggle("is-hidden", !visible);
}

function updateFieldVisibility() {
    const action = $("action").value;
    const isElementPicker = action === "elementPicker";
    const selectorActions = new Set([
        "click",
        "setValue",
        "setText",
        "getText",
        "getValue",
        "setAttribute",
        "getAttribute",
        "exists",
    ]);
    const frameActions = new Set([
        "click",
        "setValue",
        "setText",
        "getText",
        "getValue",
        "setAttribute",
        "getAttribute",
        "exists",
        "getInfos",
        "elementPicker",
    ]);
    const frameInfoAction = action === "getFrameInfo";

    const selectorVisible = selectorActions.has(action);
    const valueVisible = action === "setValue" || action === "setText" || action === "setAttribute";
    const attributeNameVisible = action === "setAttribute" || action === "getAttribute";
    const frameVisible = frameActions.has(action);
    const matchTextVisible = selectorActions.has(action);

    setFieldVisible("selector", selectorVisible || isElementPicker);
    setFieldVisible("pickedHtml", isElementPicker);
    setFieldVisible("matchText", matchTextVisible);
    setFieldVisible("parentSelectors", selectorVisible);
    setFieldVisible("attributeName", attributeNameVisible);
    setFieldVisible("value", valueVisible);
    setFieldVisible("frameId", frameVisible);
    setFieldVisible("frameUrlContains", frameInfoAction);
    setFieldVisible("similarIndex", frameInfoAction || selectorActions.has(action));
    setFieldVisible("frameHint", (frameVisible || frameInfoAction) && !isElementPicker);
    setFieldVisible("elementPickerHint", isElementPicker);
    setFieldVisible("startPicker", isElementPicker);
    setFieldVisible("runAction", !isElementPicker);
}

async function startElementPickerFlow(locator) {
    const tabId = await getActiveTabId();
    if (tabId == null) {
        setStatus("无法获取当前标签页。", "err");
        return;
    }
    try {
        const res = await chrome.runtime.sendMessage({
            type: "START_ELEMENT_PICKER",
            tabId,
            frameId: locator.frameId,
        });
        if (res?.ok === false) {
            setStatus("开启拾取失败: " + (res.error || "未知错误"), "err");
            return;
        }
        setStatus("拾取模式已开启：请在页面上点击目标元素（Esc 取消）。", "info");
    } catch (e) {
        setStatus("开启拾取失败: " + (e?.message || String(e)), "err");
    }
}

function setStatus(text, kind) {
    const el = $("status");
    el.textContent = text;
    el.className = "status " + (kind || "info");
}

async function getActiveTabId() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab?.id;
}

async function loadSaved() {
    const data = await chrome.storage.local.get([
        STORAGE_ACTION,
        STORAGE_SELECTOR,
        STORAGE_MATCH_TEXT,
        STORAGE_VALUE,
        STORAGE_ATTR_NAME,
        STORAGE_FRAME_ID,
        STORAGE_FRAME_URL_CONTAINS,
        STORAGE_SIMILAR_INDEX,
        STORAGE_PARENT_SELECTORS,
        STORAGE_LAST_PICKED,
    ]);
    let action = typeof data[STORAGE_ACTION] === "string" ? data[STORAGE_ACTION] : "click";
    if (action === "getElement") {
        action = "elementPicker";
    }
    $("action").value = action;
    $("selector").value = typeof data[STORAGE_SELECTOR] === "string" ? data[STORAGE_SELECTOR] : "";
    $("matchText").value = typeof data[STORAGE_MATCH_TEXT] === "string" ? data[STORAGE_MATCH_TEXT] : "";
    $("value").value = typeof data[STORAGE_VALUE] === "string" ? data[STORAGE_VALUE] : "";
    $("attributeName").value = typeof data[STORAGE_ATTR_NAME] === "string" ? data[STORAGE_ATTR_NAME] : "";
    $("frameId").value = Number.isInteger(data[STORAGE_FRAME_ID]) ? String(data[STORAGE_FRAME_ID]) : "";
    $("frameUrlContains").value =
        typeof data[STORAGE_FRAME_URL_CONTAINS] === "string" ? data[STORAGE_FRAME_URL_CONTAINS] : "";
    $("similarIndex").value = Number.isInteger(data[STORAGE_SIMILAR_INDEX]) ? String(data[STORAGE_SIMILAR_INDEX]) : "0";
    $("parentSelectors").value = Array.isArray(data[STORAGE_PARENT_SELECTORS])
        ? data[STORAGE_PARENT_SELECTORS].join("\n")
        : "";
    $("pickedHtml").value =
        typeof data[STORAGE_LAST_PICKED]?.html === "string" ? data[STORAGE_LAST_PICKED].html : "";
    updateFieldVisibility();
    if (data[STORAGE_LAST_PICKED]?.selector) {
        setStatus("上次拾取: " + data[STORAGE_LAST_PICKED].selector, "ok");
    }
}

async function saveScript(options = {}) {
    const silent = Boolean(options.silent);
    const action = $("action").value;
    const selector = $("selector").value;
    const matchText = $("matchText").value.trim();
    const value = $("value").value;
    const attributeName = $("attributeName").value.trim();
    const locator = collectLocatorInput();
    const parentSelectors = parseLines($("parentSelectors").value);
    const locatorError = validateLocatorInput(locator);
    if (locatorError) {
        setStatus(locatorError, "err");
        return false;
    }
    await chrome.storage.local.set({
        [STORAGE_ACTION]: action,
        [STORAGE_SELECTOR]: selector,
        [STORAGE_MATCH_TEXT]: matchText,
        [STORAGE_VALUE]: value,
        [STORAGE_ATTR_NAME]: attributeName,
        [STORAGE_FRAME_ID]: locator.frameId,
        [STORAGE_FRAME_URL_CONTAINS]: locator.frameUrlContains,
        [STORAGE_SIMILAR_INDEX]: locator.similarIndex,
        [STORAGE_PARENT_SELECTORS]: parentSelectors,
    });
    if (!silent) {
        setStatus("已保存动作参数。", "ok");
    }
    return true;
}

async function refreshBridgeStatus() {
    try {
        const res = await chrome.runtime.sendMessage({ type: "NATIVE_BRIDGE_STATUS" });
        if (!res?.ok) {
            return;
        }
        if (res.connected) {
            setStatus("Native Messaging 已连接: " + res.host, "ok");
        } else if (res.lastError) {
            setStatus("Native Messaging 未连接: " + res.lastError, "info");
        } else {
            setStatus("Native Messaging 未连接。", "info");
        }
    } catch (_e) {
        // 忽略 UI 启动时的状态查询失败，不影响手动注入功能。
    }
}

async function inject() {
    const action = $("action").value;
    const selector = $("selector").value.trim();
    const matchText = $("matchText").value.trim();
    const value = $("value").value;
    const attributeName = $("attributeName").value.trim();
    const locator = collectLocatorInput();
    const parentSelectors = parseLines($("parentSelectors").value);
    const locatorError = validateLocatorInput(locator);
    if (locatorError) {
        setStatus(locatorError, "err");
        return;
    }

    const selectorRequired = [
        "click",
        "setValue",
        "setText",
        "getText",
        "getValue",
        "setAttribute",
        "getAttribute",
        "exists",
    ];
    if (selectorRequired.includes(action) && !selector) {
        setStatus("该动作需要 selector。", "err");
        return;
    }
    if ((action === "setAttribute" || action === "getAttribute") && !attributeName) {
        setStatus("该动作需要属性名 name。", "err");
        return;
    }
    const saved = await saveScript({ silent: true });
    if (!saved) {
        return;
    }

    if (action === "elementPicker") {
        await startElementPickerFlow(locator);
        return;
    }

    let tabId = null;
    if (action !== "getTabInfo") {
        tabId = await getActiveTabId();
        if (tabId == null) {
            setStatus("无法获取当前标签页。", "err");
            return;
        }
    }

    const executeMode = "isolated";
    setStatus("正在执行动作…", "info");

    const params = {
        selector,
        parentSelectors,
    };
    if (selectorRequired.includes(action)) {
        if (matchText) {
            params.text = matchText;
        }
        params.similarIndex = locator.similarIndex;
    }
    if (action === "setValue") {
        params.value = value;
    }
    if (action === "setText") {
        params.content = value;
    }
    if (action === "setAttribute" || action === "getAttribute") {
        params.name = attributeName;
    }
    if (action === "setAttribute") {
        params.value = value;
    }
    if (action === "getFrameInfo") {
        params.frameUrlContains = locator.frameUrlContains;
        params.similarIndex = locator.similarIndex;
    }

    try {
        const res = await chrome.runtime.sendMessage({
            type: "INJECT_RPA_ACTION",
            action,
            params,
            tabId,
            frameId: locator.frameId,
            executeMode,
        });

        if (res?.ok === false) {
            setStatus(
                "执行失败(" + executeMode + "): " + (res.error || "未知错误"),
                "err"
            );
            return;
        }

        if (res?.result !== undefined && res?.result !== null) {
            const preview =
                typeof res.result === "object"
                    ? JSON.stringify(res.result)
                    : String(res.result);
            const short = preview.length > 400 ? preview.slice(0, 400) + "…" : preview;
            setStatus("完成。返回值: " + short, "ok");
        } else {
            setStatus("已执行（无返回值）。", "ok");
        }
    } catch (e) {
        setStatus("注入失败: " + (e?.message || String(e)), "err");
    }
}

document.addEventListener("DOMContentLoaded", () => {
    loadSaved();
    refreshBridgeStatus();
    $("action").addEventListener("change", updateFieldVisibility);
    $("inject").addEventListener("click", inject);
    $("startPicker").addEventListener("click", async () => {
        const locator = collectLocatorInput();
        const locatorError = validateLocatorInput(locator);
        if (locatorError) {
            setStatus(locatorError, "err");
            return;
        }
        await saveScript({ silent: true });
        await startElementPickerFlow(locator);
    });
});
