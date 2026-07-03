(() => {
  if (window.__RPA_ELEMENT_PICKER__?.stop) {
    window.__RPA_ELEMENT_PICKER__.stop();
  }

  const ROOT_ID = "rpa-element-picker-root";
  const HIGHLIGHT_ID = "rpa-element-picker-highlight";
  const TIP_ID = "rpa-element-picker-tip";

  const buildSelector = (el) => {
    if (!(el instanceof Element)) {
      return "";
    }
    if (el.id && /^[a-zA-Z][\w-]*$/.test(el.id)) {
      const idSel = "#" + CSS.escape(el.id);
      if (document.querySelectorAll(idSel).length === 1) {
        return idSel;
      }
    }
    for (const attr of ["data-testid", "name", "aria-label", "placeholder"]) {
      const value = el.getAttribute(attr);
      if (!value) {
        continue;
      }
      const sel = `${el.tagName.toLowerCase()}[${attr}="${CSS.escape(value)}"]`;
      if (document.querySelectorAll(sel).length === 1) {
        return sel;
      }
    }
    const parts = [];
    let cur = el;
    while (cur && cur.nodeType === 1 && cur !== document.documentElement) {
      let part = cur.tagName.toLowerCase();
      if (cur.id && /^[a-zA-Z][\w-]*$/.test(cur.id)) {
        parts.unshift("#" + CSS.escape(cur.id));
        break;
      }
      const parent = cur.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter((node) => node.tagName === cur.tagName);
        if (siblings.length > 1) {
          part += `:nth-of-type(${siblings.indexOf(cur) + 1})`;
        }
      }
      parts.unshift(part);
      cur = parent;
    }
    return parts.join(" > ");
  };

  const pickElementAt = (x, y) => {
    const stack = document.elementsFromPoint(x, y);
    for (const node of stack) {
      if (!(node instanceof Element)) {
        continue;
      }
      if (node.closest("[data-rpa-picker-ui]")) {
        continue;
      }
      if (node === document.documentElement || node === document.body) {
        continue;
      }
      return node;
    }
    return null;
  };

  const root = document.createElement("div");
  root.id = ROOT_ID;
  root.setAttribute("data-rpa-picker-ui", "1");

  const highlight = document.createElement("div");
  highlight.id = HIGHLIGHT_ID;
  highlight.setAttribute("data-rpa-picker-ui", "1");
  Object.assign(highlight.style, {
    position: "fixed",
    pointerEvents: "none",
    zIndex: "2147483646",
    border: "3px solid #ff3b30",
    background: "rgba(255, 59, 48, 0.12)",
    boxShadow: "0 0 0 1px rgba(255,255,255,0.8), 0 8px 24px rgba(255,59,48,0.35)",
    borderRadius: "4px",
    transition: "all 80ms ease-out",
    display: "none",
  });

  const tip = document.createElement("div");
  tip.id = TIP_ID;
  tip.setAttribute("data-rpa-picker-ui", "1");
  tip.textContent = "移动鼠标高亮元素，点击选中；按 Esc 取消";
  Object.assign(tip.style, {
    position: "fixed",
    top: "12px",
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: "2147483647",
    padding: "10px 16px",
    borderRadius: "8px",
    background: "rgba(20, 24, 32, 0.92)",
    color: "#fff",
    font: "13px/1.4 Segoe UI, Microsoft YaHei UI, sans-serif",
    boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
    pointerEvents: "none",
  });

  root.appendChild(highlight);
  root.appendChild(tip);
  document.documentElement.appendChild(root);

  let hovered = null;

  const updateHighlight = (el) => {
    if (!el) {
      highlight.style.display = "none";
      return;
    }
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 && rect.height <= 0) {
      highlight.style.display = "none";
      return;
    }
    highlight.style.display = "block";
    highlight.style.left = rect.left + "px";
    highlight.style.top = rect.top + "px";
    highlight.style.width = rect.width + "px";
    highlight.style.height = rect.height + "px";
  };

  const cleanup = () => {
    document.removeEventListener("mousemove", onMouseMove, true);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("keydown", onKeyDown, true);
    root.remove();
    delete window.__RPA_ELEMENT_PICKER__;
  };

  const finish = (payload) => {
    cleanup();
    chrome.runtime.sendMessage(payload);
  };

  const onMouseMove = (ev) => {
    const el = pickElementAt(ev.clientX, ev.clientY);
    if (el === hovered) {
      return;
    }
    hovered = el;
    updateHighlight(el);
  };

  const onClick = (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    const el = pickElementAt(ev.clientX, ev.clientY);
    if (!el) {
      return;
    }
    const selector = buildSelector(el);
    const text = (el.innerText || el.textContent || "").trim().slice(0, 120);
    const html = (el.outerHTML || "").slice(0, 8000);
    finish({
      type: "ELEMENT_PICKER_RESULT",
      ok: true,
      result: {
        selector,
        tagName: el.tagName.toLowerCase(),
        text,
        html,
      },
    });
  };

  const onKeyDown = (ev) => {
    if (ev.key !== "Escape") {
      return;
    }
    ev.preventDefault();
    ev.stopPropagation();
    finish({
      type: "ELEMENT_PICKER_RESULT",
      ok: false,
      error: "已取消元素拾取",
    });
  };

  document.addEventListener("mousemove", onMouseMove, true);
  document.addEventListener("click", onClick, true);
  document.addEventListener("keydown", onKeyDown, true);

  window.__RPA_ELEMENT_PICKER__ = { stop: cleanup };
})();
