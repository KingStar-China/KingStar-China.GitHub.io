export const VDITOR_VERSION = "4.0.0";
const assetBase = new URL(`./vendor/vditor-${VDITOR_VERSION}/`, import.meta.url).href.replace(/\/$/, "");
let assetsPromise;

function loadAsset(path, id, stylesheet = false) {
  if (document.getElementById(id)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const element = document.createElement(stylesheet ? "link" : "script");
    const timer = setTimeout(fail, 20000);
    function fail() {
      clearTimeout(timer);
      element.remove();
      reject(new Error("编辑器资源加载失败，源码已保留，请稍后重试。"));
    }
    element.onload = () => { clearTimeout(timer); element.id = id; resolve(); };
    element.onerror = fail;
    if (stylesheet) { element.rel = "stylesheet"; element.href = `${assetBase}/${path}`; }
    else { element.src = `${assetBase}/${path}`; element.async = true; }
    document.head.appendChild(element);
  });
}

async function loadVditor() {
  if (!assetsPromise) {
    assetsPromise = (async () => {
      await loadAsset("dist/index.css", "blogVditorStyle", true);
      await loadAsset("dist/css/content-theme/dark.css", "vditorContentTheme", true);
      await loadAsset("dist/index.min.js", "blogVditorScript");
      await loadAsset("dist/js/i18n/zh_CN.js", "vditorI18nScriptzh_CN");
      await loadAsset("dist/js/lute/lute.min.js", "vditorLuteScript");
      // Preload icons asynchronously, avoiding the library's synchronous XHR fallback.
      await loadAsset("dist/js/icons/ant.js", "vditorIconScript");
      return window.Vditor;
    })().catch((error) => { assetsPromise = null; throw error; });
  }
  return assetsPromise;
}

export function createMarkdownEditor({ source, container, modeControl, onChange, loadEditor = loadVditor }) {
  let editor;
  let active = false;
  let disabled = false;
  let generation = 0;
  let original = "";
  let rendered = "";
  let lastSource = null;
  let composing = false;
  let editorDisabled = false;

  function updateEditingState() {
    const next = disabled || !active;
    if (!editor || editorDisabled === next) return;
    next ? editor.disabled() : editor.enable();
    editorDisabled = next;
  }

  const compositionStart = () => { composing = true; };
  const compositionEnd = () => { composing = false; flush(true); };
  for (const element of [source, container]) {
    element.addEventListener("compositionstart", compositionStart);
    element.addEventListener("compositionend", compositionEnd);
  }

  function flush(notify = false) {
    if (!active || !editor) return source.value;
    const value = editor.getValue();
    // A mode switch (or undo to the initial document) must not rewrite Markdown formatting.
    const next = value === rendered ? original : value;
    lastSource = next;
    if (source.value !== next) { source.value = next; if (notify) onChange(); }
    return source.value;
  }

  async function showVisual() {
    const started = generation;
    if (!editor) {
      const Vditor = await loadEditor();
      if (started !== generation) return false;
      let instance;
      await new Promise((resolve) => {
        instance = new Vditor(container, {
          cdn: assetBase, mode: "wysiwyg", theme: "dark", lang: "zh_CN",
          cache: { enable: false }, height: 560, minHeight: 320,
          toolbar: ["headings", "bold", "italic", "strike", "link", "|", "list", "ordered-list", "check", "outdent", "indent", "|", "quote", "code", "inline-code", "table", "|", "undo", "redo"],
          toolbarConfig: { pin: false },
          hint: { emoji: {}, extend: [], parse: false },
          link: { isOpen: false }, image: { isPreview: false },
          preview: {
            mode: "editor", actions: [], hljs: { enable: false },
            theme: { current: "dark", path: `${assetBase}/dist/css/content-theme` },
            markdown: { sanitize: true, autoSpace: false, fixTermTypo: false, codeBlockPreview: false, mathBlockPreview: false },
            render: { media: { enable: false } },
          },
          input: () => { if (!composing) flush(true); },
          after: resolve,
        });
      });
      if (started !== generation) { instance.destroy(); return false; }
      editor = instance;
      const editable = container.querySelector('.vditor-wysiwyg [contenteditable="true"]');
      editable?.setAttribute("role", "textbox");
      editable?.setAttribute("aria-label", "可视化正文");
      editable?.setAttribute("aria-multiline", "true");
      container.querySelectorAll("button").forEach((button) => { button.type = "button"; });
      if (modeControl) container.querySelector(".vditor-toolbar").appendChild(modeControl);
    }
    if (source.value !== lastSource) {
      original = source.value;
      editor.setValue(original, true);
      rendered = editor.getValue();
      lastSource = original;
    }
    active = true;
    updateEditingState();
    return true;
  }

  return {
    showVisual,
    showSource() { flush(); active = false; updateEditingState(); },
    flush,
    isComposing: () => composing,
    setDisabled(value) {
      if (disabled === value) return;
      disabled = value;
      updateEditingState();
    },
    reset() {
      generation += 1;
      active = false;
      composing = false;
      original = rendered = "";
      lastSource = null;
      if (editor) editor.setValue("", true);
      updateEditingState();
    },
  };
}
