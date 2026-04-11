(function () {
  var CONFIG = __OPENCLAW_LOCALE_CONFIG__;
  var TERMS = __OPENCLAW_BILINGUAL_TERMS__;
  var OVERLAY_CSS = __OPENCLAW_OVERLAY_CSS__;
  var VALID_LOCALES = ["en", "zh-CN", "zh-TW"];
  var STORAGE_KEY = "openclaw.i18n.locale";
  var MODE_KEY = "openclaw.docker.i18n.mode";
  var TEXT_MODE_KEY = "openclaw.docker.i18n.textMode";
  var VALID_TEXT_MODES = ["zh-only", "zh-en", "en-only"];
  var LABELS = {
    auto: "跟随浏览器",
    en: "English",
    "zh-CN": "简体中文",
    "zh-TW": "繁體中文"
  };
  var HARD_CODED_ZH_TEXT = {
    Core: "核心",
    Environment: "环境",
    "Environment Variables": "环境变量",
    Authentication: "认证",
    Updates: "更新",
    Meta: "元数据",
    Metadata: "元数据",
    Logging: "日志",
    Diagnostics: "诊断",
    Cli: "CLI",
    CLI: "CLI",
    Secrets: "密钥",
    "AI & Agents": "AI 与代理",
    Agents: "代理",
    Models: "模型",
    Skills: "技能",
    Tools: "工具",
    Memory: "记忆",
    Session: "会话",
    Communication: "通讯",
    Channels: "渠道",
    Messages: "消息",
    Broadcast: "广播",
    Talk: "语音",
    Audio: "音频",
    Automation: "自动化",
    Commands: "命令",
    Hooks: "钩子",
    Bindings: "绑定",
    Cron: "Cron",
    Approvals: "审批",
    Plugins: "插件",
    Infrastructure: "基础设施",
    Gateway: "网关",
    Web: "Web",
    Browser: "浏览器",
    NodeHost: "节点主机",
    "Node Host": "节点主机",
    CanvasHost: "Canvas 主机",
    "Canvas Host": "Canvas 主机",
    Discovery: "服务发现",
    Media: "媒体",
    Acp: "ACP",
    ACP: "ACP",
    Mcp: "MCP",
    MCP: "MCP",
    Theme: "主题",
    UI: "界面",
    "Setup Wizard": "设置向导",
    Other: "其他",
    Settings: "设置",
    "Search settings...": "搜索设置...",
    "Search settings": "搜索设置",
    "Clear search": "清空搜索",
    Form: "表单",
    Raw: "原始",
    Save: "保存",
    "Saving…": "保存中…",
    Apply: "应用",
    "Applying…": "应用中…",
    Update: "更新",
    "Updating…": "更新中…",
    Open: "打开",
    Add: "添加",
    "Add Entry": "添加条目",
    "Remove item": "删除条目",
    "Custom entries": "自定义条目",
    "No custom entries.": "暂无自定义条目。",
    Key: "键名",
    "No items yet. Click \"Add\" to create one.": "暂无条目，点击“添加”创建。",
    "No changes": "无更改",
    "Unsaved changes": "未保存的更改",
    "No settings in this section": "此分区暂无设置",
    "Schema unavailable.": "Schema 不可用。",
    "Unsupported schema. Use Raw.": "暂不支持该 Schema，请使用原始模式。",
    "Open config file": "打开配置文件",
    "Form view can't safely edit some fields": "表单视图无法安全编辑部分字段",
    "Edit raw JSON/JSON5 config": "编辑原始 JSON/JSON5 配置",
    "Raw mode unavailable for this snapshot": "此快照不支持原始模式",
    "Raw mode disabled (snapshot cannot safely round-trip raw text).": "原始模式已禁用（当前快照无法安全往返原始文本）。",
    "Choose a theme family.": "选择一个主题系列。",
    "Chroma family": "Chroma 系列",
    "Black & red": "黑红风格",
    "Chocolate blueprint": "巧克力蓝图",
    None: "无",
    Slight: "轻微",
    Default: "默认",
    Round: "圆润",
    Full: "完全",
    "Environment variables passed to the gateway process": "传递给网关进程的环境变量",
    "Auto-update settings and release channel": "自动更新设置与发布通道",
    "Agent configurations, models, and identities": "代理配置、模型与身份",
    "API keys and authentication profiles": "API 密钥与认证配置",
    "Messaging channels (Telegram, Discord, Slack, etc.)": "消息渠道（Telegram、Discord、Slack 等）",
    "Message handling and routing settings": "消息处理与路由设置",
    "Custom slash commands": "自定义斜杠命令",
    "Webhooks and event hooks": "Webhook 与事件钩子",
    "Skill packs and capabilities": "技能包与能力",
    "Tool configurations (browser, search, etc.)": "工具配置（浏览器、搜索等）",
    "Gateway server settings (port, auth, binding)": "网关服务设置（端口、认证、绑定）",
    "Setup wizard state and history": "设置向导状态与历史",
    "Gateway metadata and version information": "网关元数据与版本信息",
    "Log levels and output configuration": "日志级别与输出配置",
    "Browser automation settings": "浏览器自动化设置",
    "User interface preferences": "用户界面偏好",
    "AI model configurations and providers": "AI 模型配置与提供商",
    "Key bindings and shortcuts": "按键绑定与快捷键",
    "Broadcast and notification settings": "广播与通知设置",
    "Audio input/output settings": "音频输入/输出设置",
    "Session management and persistence": "会话管理与持久化",
    "Scheduled tasks and automation": "定时任务与自动化",
    "Web server and API settings": "Web 服务与 API 设置",
    "Service discovery and networking": "服务发现与网络",
    "Canvas rendering and display": "Canvas 渲染与显示",
    "Voice and speech settings": "语音与说话设置",
    "Plugin management and extensions": "插件管理与扩展",
    "Instrumentation, OpenTelemetry, and cache-trace settings": "监控、OpenTelemetry 与缓存追踪设置",
    "CLI banner and startup behavior": "CLI 横幅与启动行为",
    "Secret provider configuration": "密钥提供方配置",
    "Agent Communication Protocol runtime and streaming settings": "Agent Communication Protocol 运行时与流式设置",
    "Model Context Protocol server definitions": "Model Context Protocol 服务器定义",
    "Broadcast Strategy": "广播策略",
    "Audio Transcription": "音频转写"
  };
  var TRANSLATABLE_ATTRIBUTES = ["placeholder", "aria-label", "title"];
  var BILINGUAL_RENDER_ATTR = "data-openclaw-bilingual-rendered";
  var BILINGUAL_SLOT_ATTR = "data-openclaw-bilingual-slot";
  var ORIGINAL_TEXT_ATTR = "data-openclaw-original-text";
  var TERM_ID_ATTR = "data-openclaw-term-id";
  var SEARCH_ATTR = "data-openclaw-search";
  var STYLE_ELEMENT_ID = "openclaw-locale-overlay-style";
  var SEARCH_HINT_ID = "openclaw-search-bridge-tip";
  var TEXT_MODE_LABELS = {
    "zh-only": "中文",
    "zh-en": "双语",
    "en-only": "English"
  };
  var HARD_CODED_SOURCE_LOOKUP = buildHardcodedSourceMap();
  var HARD_CODED_ZH_REVERSE = buildHardcodedReverseMap();
  var TERM_LOOKUP = buildTermLookup();
  var TEXT_RENDER_SELECTOR = [
    ".nav-item__text",
    ".config-top-tabs__tab",
    ".config-section-card__title",
    ".config-section-card__desc",
    ".config-section-hero__title",
    ".config-section-hero__desc",
    ".cfg-field__label",
    ".cfg-field__help",
    ".cfg-toggle-row__label",
    ".cfg-toggle-row__help",
    ".cfg-array__label",
    ".cfg-array__help",
    ".cfg-map__label",
    ".settings-theme-card__label",
    ".cfg-segmented__btn",
    ".pill"
  ].join(",");
  var SEARCH_CANDIDATE_SELECTOR = [
    ".config-section-card",
    ".config-section-hero",
    ".cfg-field",
    ".cfg-toggle-row",
    ".cfg-array",
    ".cfg-map",
    ".settings-theme-card"
  ].join(",");
  var SEARCH_INPUT_SELECTOR = [
    ".config-search__input",
    "input[type='search']",
    "input[placeholder*='Search']",
    "input[placeholder*='搜索']"
  ].join(",");
  var translationObserver = null;
  var translationScheduled = false;
  var translationApplying = false;

  function normalizeLocale(value) {
    if (typeof value !== "string") return "";
    if (value === "zh-TW" || value === "zh-HK") return "zh-TW";
    if (value.indexOf("zh") === 0) return "zh-CN";
    if (value.indexOf("en") === 0) return "en";
    return VALID_LOCALES.indexOf(value) >= 0 ? value : "";
  }

  function parseLocaleList(values) {
    if (!Array.isArray(values)) return [];
    var items = [];
    for (var index = 0; index < values.length; index += 1) {
      var value = values[index];
      if (value === "auto") {
        if (items.indexOf("auto") === -1) items.push("auto");
        continue;
      }
      var locale = normalizeLocale(value);
      if (locale && items.indexOf(locale) === -1) items.push(locale);
    }
    return items;
  }

  function normalizeTextMode(value) {
    if (typeof value !== "string") return "";
    var mode = value.trim();
    return VALID_TEXT_MODES.indexOf(mode) >= 0 ? mode : "";
  }

  function resolveActiveTextMode() {
    return normalizeTextMode(readStorage(TEXT_MODE_KEY)) || normalizeTextMode(CONFIG.defaultTextMode) || "zh-en";
  }

  function setTextMode(value) {
    var mode = normalizeTextMode(value);
    if (!mode) return;
    writeStorage(TEXT_MODE_KEY, mode);
  }

  function getTextMode() {
    return resolveActiveTextMode();
  }

  function resolveBrowserLocale() {
    return normalizeLocale(globalThis.navigator && globalThis.navigator.language) || "en";
  }

  function buildHardcodedSourceMap() {
    var lookup = {};
    for (var key in HARD_CODED_ZH_TEXT) {
      if (!Object.prototype.hasOwnProperty.call(HARD_CODED_ZH_TEXT, key)) continue;
      var normalized = normalizeLookupText(key);
      if (normalized) lookup[normalized] = key;
    }
    return lookup;
  }

  function buildHardcodedReverseMap() {
    var lookup = {};
    for (var key in HARD_CODED_ZH_TEXT) {
      if (!Object.prototype.hasOwnProperty.call(HARD_CODED_ZH_TEXT, key)) continue;
      var value = HARD_CODED_ZH_TEXT[key];
      var normalized = normalizeLookupText(value);
      if (normalized && !lookup[normalized]) lookup[normalized] = key;
    }
    return lookup;
  }

  function normalizeLookupText(value) {
    if (typeof value !== "string") return "";
    return value
      .replace(/[\r\n\t]+/g, " ")
      .replace(/[_-]+/g, " ")
      .replace(/[()（）\[\]{}]+/g, " ")
      .replace(/[,:;，。！？]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function uniqueValues(values) {
    var result = [];
    for (var index = 0; index < values.length; index += 1) {
      var value = values[index];
      if (typeof value !== "string") continue;
      var trimmed = value.trim();
      if (!trimmed || result.indexOf(trimmed) >= 0) continue;
      result.push(trimmed);
    }
    return result;
  }

  function hasHanScript(value) {
    return /[㐀-鿿]/.test(String(value || ""));
  }

  function buildTermLookup() {
    var lookup = { byId: {}, byText: {} };
    for (var id in TERMS) {
      if (!Object.prototype.hasOwnProperty.call(TERMS, id)) continue;
      var term = TERMS[id];
      if (!term || typeof term !== "object") continue;
      term.id = id;
      lookup.byId[id] = term;
      registerTermKey(lookup.byText, term.source, id);
      registerTermKey(lookup.byText, term.zh, id);
      registerTermKey(lookup.byText, term.en, id);
      registerTermKey(lookup.byText, term.path, id);
      if (Array.isArray(term.aliases)) {
        for (var index = 0; index < term.aliases.length; index += 1) {
          registerTermKey(lookup.byText, term.aliases[index], id);
        }
      }
    }
    return lookup;
  }

  function registerTermKey(target, value, id) {
    var normalized = normalizeLookupText(value);
    if (!normalized || target[normalized]) return;
    target[normalized] = id;
  }

  function resolveStoredTerm(element) {
    if (!element || element.nodeType !== 1) return null;
    var id = element.getAttribute(TERM_ID_ATTR);
    if (!id) return null;
    if (Object.prototype.hasOwnProperty.call(TERM_LOOKUP.byId, id)) return TERM_LOOKUP.byId[id];
    if (id.indexOf("auto:") === 0) return buildAutoTerm(id.slice(5), "");
    return null;
  }

  function buildAutoTerm(source, renderMode) {
    if (typeof source !== "string" || !source) return null;
    var zh = HARD_CODED_ZH_TEXT[source];
    if (typeof zh !== "string" || !zh) return null;
    return {
      id: "auto:" + source,
      source: source,
      zh: zh,
      en: source,
      kind: "auto",
      render: renderMode || inferRenderFromText(source),
      aliases: [zh, source]
    };
  }

  function resolveTermByValue(value, renderMode) {
    var normalized = normalizeLookupText(value);
    if (!normalized) return null;
    var explicitId = TERM_LOOKUP.byText[normalized];
    if (explicitId && Object.prototype.hasOwnProperty.call(TERM_LOOKUP.byId, explicitId)) {
      return TERM_LOOKUP.byId[explicitId];
    }
    var source = HARD_CODED_SOURCE_LOOKUP[normalized] || HARD_CODED_ZH_REVERSE[normalized] || "";
    return buildAutoTerm(source, renderMode);
  }

  function inferRenderFromText(value) {
    if (typeof value === "string" && value.indexOf("_") >= 0) return "codeish";
    return "inline";
  }

  function inferRenderFromElement(element, term) {
    if (term && typeof term.render === "string" && term.render) return term.render;
    var className = typeof element.className === "string" ? element.className : "";
    if (/desc|help/.test(className)) return "stacked";
    if (/pill|segmented/.test(className)) return "chip";
    var original = element.getAttribute(ORIGINAL_TEXT_ATTR) || collectElementBaseText(element);
    return inferRenderFromText(original);
  }

  function buildSearchCorpus(term) {
    if (!term || typeof term !== "object") return "";
    var values = [term.source, term.zh, term.en, term.path];
    if (Array.isArray(term.aliases)) values = values.concat(term.aliases);
    return normalizeLookupText(uniqueValues(values).join(" "));
  }

  function buildModeLabel(term, mode) {
    if (!term || typeof term !== "object") return "";
    var zh = term.zh || term.source || term.en || "";
    var en = term.en || term.source || zh;
    if (mode === "en-only") return en;
    if (mode === "zh-only") return zh || en;
    return uniqueValues([zh, en]).join(" ");
  }

  function createTextNodeElement(tagName, className, text) {
    var node = document.createElement(tagName);
    if (className) node.className = className;
    if (typeof text === "string") node.textContent = text;
    return node;
  }

  function buildRenderedTermNode(term, mode, renderMode) {
    var zh = term.zh || term.source || term.en || "";
    var en = term.en || term.source || zh;
    if (mode === "zh-only") {
      return createTextNodeElement("span", "openclaw-bilingual-single openclaw-bilingual-single--zh", zh || en);
    }
    if (mode === "en-only") {
      return createTextNodeElement("span", "openclaw-bilingual-single openclaw-bilingual-single--en", en);
    }

    var wrapperClass = "openclaw-bilingual-inline";
    if (renderMode === "stacked") wrapperClass = "openclaw-bilingual-stacked";
    if (renderMode === "chip") wrapperClass = "openclaw-bilingual-inline openclaw-bilingual-chip";
    if (renderMode === "codeish") wrapperClass = "openclaw-bilingual-inline openclaw-bilingual-codeish";

    var wrapper = createTextNodeElement("span", wrapperClass, "");
    wrapper.setAttribute(BILINGUAL_RENDER_ATTR, "1");
    wrapper.appendChild(createTextNodeElement("span", wrapperClass + "__zh", zh));

    if (renderMode === "stacked") {
      wrapper.appendChild(createTextNodeElement("span", wrapperClass + "__en", en));
      return wrapper;
    }

    wrapper.appendChild(createTextNodeElement("span", wrapperClass + "__sep", " /") );
    if (renderMode === "codeish") {
      var code = createTextNodeElement("code", wrapperClass + "__en", en);
      wrapper.appendChild(code);
      return wrapper;
    }
    wrapper.appendChild(createTextNodeElement("span", wrapperClass + "__en", en));
    return wrapper;
  }

  function matchesSelector(element, selector) {
    if (!element || element.nodeType !== 1 || typeof element.matches !== "function") return false;
    return element.matches(selector);
  }

  function collectTargetElements(root, selector) {
    var result = [];
    if (!root) return result;
    if (root.nodeType === 1 && matchesSelector(root, selector)) result.push(root);
    if (typeof root.querySelectorAll !== "function") return result;
    var nodes = root.querySelectorAll(selector);
    for (var index = 0; index < nodes.length; index += 1) result.push(nodes[index]);
    return result;
  }

  function collectDirectText(element) {
    if (!element || !element.childNodes) return "";
    var parts = [];
    for (var index = 0; index < element.childNodes.length; index += 1) {
      var child = element.childNodes[index];
      if (child.nodeType !== 3) continue;
      var value = child.nodeValue || "";
      if (!value.trim()) continue;
      parts.push(value.trim());
    }
    return parts.join(" ").trim();
  }

  function collectElementBaseText(element) {
    if (!element || element.nodeType !== 1) return "";
    var stored = element.getAttribute(ORIGINAL_TEXT_ATTR);
    var currentVisible = normalizeLookupText(element.textContent || "");
    var storedTerm = resolveStoredTerm(element);
    if (stored && storedTerm) {
      var renderedValue = normalizeLookupText(buildModeLabel(storedTerm, getTextMode()));
      var storedValue = normalizeLookupText(stored);
      if (!currentVisible || currentVisible === renderedValue || currentVisible === storedValue) return stored;
      element.removeAttribute(ORIGINAL_TEXT_ATTR);
      element.removeAttribute(TERM_ID_ATTR);
    } else if (stored && !currentVisible) {
      return stored;
    }
    var direct = collectDirectText(element);
    if (direct) return direct;
    return (element.textContent || "").trim();
  }

  function clearRenderedSlot(element) {
    if (!element || !element.childNodes) return;
    var nodes = [];
    for (var index = 0; index < element.childNodes.length; index += 1) nodes.push(element.childNodes[index]);
    for (var nodeIndex = 0; nodeIndex < nodes.length; nodeIndex += 1) {
      var child = nodes[nodeIndex];
      if (child.nodeType === 3) {
        element.removeChild(child);
        continue;
      }
      if (child.nodeType === 1 && child.getAttribute(BILINGUAL_SLOT_ATTR) === "1") {
        element.removeChild(child);
      }
    }
  }

  function renderTermIntoElement(element, term) {
    if (!element || element.nodeType !== 1 || !term) return;
    var original = element.getAttribute(ORIGINAL_TEXT_ATTR) || collectElementBaseText(element) || term.source || term.en || term.zh || "";
    if (original) element.setAttribute(ORIGINAL_TEXT_ATTR, original);
    element.setAttribute(TERM_ID_ATTR, term.id || "");
    element.setAttribute(SEARCH_ATTR, buildSearchCorpus(term));

    clearRenderedSlot(element);

    var slot = createTextNodeElement("span", "openclaw-bilingual-slot", "");
    slot.setAttribute(BILINGUAL_SLOT_ATTR, "1");
    slot.setAttribute(BILINGUAL_RENDER_ATTR, "1");
    slot.appendChild(buildRenderedTermNode(term, getTextMode(), inferRenderFromElement(element, term)));
    element.appendChild(slot);
  }

  function resetRenderedElement(element) {
    if (!element || element.nodeType !== 1) return;
    var original = element.getAttribute(ORIGINAL_TEXT_ATTR);
    if (!original) return;
    clearRenderedSlot(element);
    element.appendChild(document.createTextNode(original));
    element.removeAttribute(TERM_ID_ATTR);
    element.removeAttribute(SEARCH_ATTR);
  }

  function ensureOverlayStyles() {
    if (!document.head) return;
    var styleElement = document.getElementById(STYLE_ELEMENT_ID);
    if (styleElement) {
      if (styleElement.textContent !== OVERLAY_CSS) styleElement.textContent = OVERLAY_CSS;
      return;
    }
    styleElement = document.createElement("style");
    styleElement.id = STYLE_ELEMENT_ID;
    styleElement.textContent = OVERLAY_CSS;
    document.head.appendChild(styleElement);
  }

  function getOriginalAttributeStorageName(attributeName) {
    return "data-openclaw-original-" + String(attributeName || "").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  }

  function getOriginalAttributeValue(element, attributeName) {
    var storageName = getOriginalAttributeStorageName(attributeName);
    var stored = element.getAttribute(storageName);
    var current = element.getAttribute(attributeName);
    if (!stored && typeof current === "string" && current) {
      stored = current;
      element.setAttribute(storageName, current);
    }
    return stored || current || "";
  }

  function renderAttributeValue(term, mode) {
    if (!term) return "";
    var zh = term.zh || term.source || term.en || "";
    var en = term.en || term.source || zh;
    if (mode === "en-only") return en;
    if (mode === "zh-only") return zh || en;
    return uniqueValues([zh, en]).join(" / ");
  }

  function applyBilingualTextOverlay(root) {
    var elements = collectTargetElements(root, TEXT_RENDER_SELECTOR);
    for (var index = 0; index < elements.length; index += 1) {
      var element = elements[index];
      var renderHint = inferRenderFromElement(element, null);
      var term = resolveStoredTerm(element) || resolveTermByValue(collectElementBaseText(element), renderHint);
      if (term) {
        renderTermIntoElement(element, term);
      } else if (element.getAttribute(ORIGINAL_TEXT_ATTR)) {
        resetRenderedElement(element);
      }
    }
  }

  function buildCandidateSearchCorpus(element) {
    var values = [];
    var own = element.getAttribute(SEARCH_ATTR);
    if (own) values.push(own);
    values.push(element.textContent || "");
    if (typeof element.querySelectorAll === "function") {
      var tagged = element.querySelectorAll("[" + SEARCH_ATTR + "]");
      for (var index = 0; index < tagged.length; index += 1) {
        values.push(tagged[index].getAttribute(SEARCH_ATTR) || "");
      }
    }
    return normalizeLookupText(values.join(" "));
  }

  function matchesSearchQuery(corpus, query) {
    var normalizedCorpus = normalizeLookupText(corpus);
    var normalizedQuery = normalizeLookupText(query);
    if (!normalizedQuery) return true;
    var tokens = normalizedQuery.split(/\s+/g);
    for (var index = 0; index < tokens.length; index += 1) {
      var token = tokens[index];
      if (!token) continue;
      if (normalizedCorpus.indexOf(token) === -1) return false;
    }
    return true;
  }

  function clearLocalSearchFilter() {
    if (typeof document.querySelectorAll !== "function") return;
    var candidates = document.querySelectorAll(SEARCH_CANDIDATE_SELECTOR);
    for (var index = 0; index < candidates.length; index += 1) {
      candidates[index].classList.remove("openclaw-search-hidden");
    }
  }

  function applyLocalSearchFilter(query) {
    var normalizedQuery = normalizeLookupText(query);
    if (!normalizedQuery) {
      clearLocalSearchFilter();
      return;
    }
    var candidates = document.querySelectorAll(SEARCH_CANDIDATE_SELECTOR);
    for (var index = 0; index < candidates.length; index += 1) {
      var candidate = candidates[index];
      var visible = matchesSearchQuery(buildCandidateSearchCorpus(candidate), normalizedQuery);
      candidate.classList.toggle("openclaw-search-hidden", !visible);
    }
  }

  function updateSearchHint(input, message) {
    var container = typeof input.closest === "function" ? input.closest(".config-search") : null;
    if (!container) return;
    var hint = container.querySelector("#" + SEARCH_HINT_ID);
    if (!message) {
      if (hint && hint.parentNode) hint.parentNode.removeChild(hint);
      return;
    }
    if (!hint) {
      hint = document.createElement("div");
      hint.id = SEARCH_HINT_ID;
      hint.className = "openclaw-search-bridge-tip";
      container.appendChild(hint);
    }
    hint.textContent = message;
  }

  function handleSearchInputCapture(event) {
    var input = event.target;
    if (!input || input.nodeType !== 1) return;
    var query = input.value || "";
    if (hasHanScript(query)) {
      event.stopImmediatePropagation();
      applyLocalSearchFilter(query);
      updateSearchHint(input, "中文搜索已启用，可直接按中文过滤当前页面设置；按 Esc 清空。");
      return;
    }
    clearLocalSearchFilter();
    updateSearchHint(input, "");
  }

  function handleSearchKeydownCapture(event) {
    var input = event.target;
    if (!input || input.nodeType !== 1) return;
    if (event.key !== "Escape") return;
    input.value = "";
    clearLocalSearchFilter();
    updateSearchHint(input, "");
  }

  function bindSearchBridge() {
    if (typeof document.querySelectorAll !== "function") return;
    var inputs = document.querySelectorAll(SEARCH_INPUT_SELECTOR);
    for (var index = 0; index < inputs.length; index += 1) {
      var input = inputs[index];
      if (input.getAttribute("data-openclaw-search-bridge") === "1") continue;
      input.setAttribute("data-openclaw-search-bridge", "1");
      input.addEventListener("input", handleSearchInputCapture, true);
      input.addEventListener("keydown", handleSearchKeydownCapture, true);
    }
  }

  function readStorage(key) {
    try {
      return globalThis.localStorage ? globalThis.localStorage.getItem(key) : null;
    } catch (error) {
      return null;
    }
  }

  function writeStorage(key, value) {
    try {
      if (!globalThis.localStorage) return;
      if (value === null || value === "") {
        globalThis.localStorage.removeItem(key);
        return;
      }
      globalThis.localStorage.setItem(key, value);
    } catch (error) {}
  }

  function resolveActiveLocale() {
    var forceLocale = normalizeLocale(CONFIG.forceLocale);
    if (forceLocale) return forceLocale;

    var mode = readStorage(MODE_KEY);
    if (mode === "auto") return resolveBrowserLocale();

    var storedLocale = normalizeLocale(readStorage(STORAGE_KEY));
    if (storedLocale) return storedLocale;

    var htmlLocale = normalizeLocale(document.documentElement.lang);
    if (htmlLocale) return htmlLocale;

    var defaultLocale = normalizeLocale(CONFIG.defaultLocale);
    if (defaultLocale) return defaultLocale;

    return resolveBrowserLocale();
  }

  function applyInitialLocale() {
    var forceLocale = normalizeLocale(CONFIG.forceLocale);
    var defaultLocale = normalizeLocale(CONFIG.defaultLocale);
    var mode = readStorage(MODE_KEY);
    var storedLocale = normalizeLocale(readStorage(STORAGE_KEY));

    if (forceLocale) {
      writeStorage(STORAGE_KEY, forceLocale);
      writeStorage(MODE_KEY, "forced");
      document.documentElement.lang = forceLocale;
      return forceLocale;
    }

    if (mode === "auto") {
      writeStorage(STORAGE_KEY, null);
      var autoLocale = resolveBrowserLocale();
      document.documentElement.lang = autoLocale;
      return autoLocale;
    }

    if (storedLocale) {
      document.documentElement.lang = storedLocale;
      return storedLocale;
    }

    if (defaultLocale) {
      writeStorage(STORAGE_KEY, defaultLocale);
      writeStorage(MODE_KEY, "manual");
      document.documentElement.lang = defaultLocale;
      return defaultLocale;
    }

    var browserLocale = resolveBrowserLocale();
    document.documentElement.lang = browserLocale;
    return browserLocale;
  }

  function currentSelection() {
    if (normalizeLocale(CONFIG.forceLocale)) {
      return normalizeLocale(CONFIG.forceLocale);
    }
    var mode = readStorage(MODE_KEY);
    if (mode === "auto") return "auto";
    var storedLocale = normalizeLocale(readStorage(STORAGE_KEY));
    if (storedLocale) return storedLocale;
    var defaultLocale = normalizeLocale(CONFIG.defaultLocale);
    if (defaultLocale) return defaultLocale;
    return "auto";
  }

  function applySelection(value) {
    if (normalizeLocale(CONFIG.forceLocale)) return;
    if (value === "auto") {
      writeStorage(MODE_KEY, "auto");
      writeStorage(STORAGE_KEY, null);
    } else {
      writeStorage(MODE_KEY, "manual");
      writeStorage(STORAGE_KEY, normalizeLocale(value) || "zh-CN");
    }
    globalThis.location.reload();
  }

  function getHardcodedTranslationTable() {
    var locale = resolveActiveLocale();
    if (locale.indexOf("zh") !== 0) return null;
    return HARD_CODED_ZH_TEXT;
  }

  function preserveWhitespace(original, translated) {
    var leading = original.match(/^\s*/);
    var trailing = original.match(/\s*$/);
    return (leading ? leading[0] : "") + translated + (trailing ? trailing[0] : "");
  }

  function translateDynamicValue(trimmed) {
    var match = trimmed.match(/^(\d+)\s+items?$/i);
    if (match) return match[1] + " 项";

    match = trimmed.match(/^(\d+)\s+unsaved changes?$/i);
    if (match) return match[1] + " 项未保存更改";

    return "";
  }

  function translateValue(value, table) {
    if (typeof value !== "string") return value;
    var trimmed = value.trim();
    if (!trimmed) return value;

    if (Object.prototype.hasOwnProperty.call(table, trimmed)) {
      return preserveWhitespace(value, table[trimmed]);
    }

    var dynamicValue = translateDynamicValue(trimmed);
    if (dynamicValue) return preserveWhitespace(value, dynamicValue);

    return value;
  }

  function shouldSkipTextNode(node) {
    if (!node || !node.parentElement) return true;
    var parent = node.parentElement;
    var tagName = parent.tagName;
    if (tagName === "SCRIPT" || tagName === "STYLE" || tagName === "NOSCRIPT") return true;
    if (typeof parent.closest === "function" && parent.closest("#openclaw-locale-switcher")) return true;
    if (typeof parent.closest === "function" && parent.closest("[" + BILINGUAL_RENDER_ATTR + "='1']")) return true;
    return false;
  }

  function translateTextNodes(root, table) {
    if (!root || !document.createTreeWalker) return;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var node = walker.nextNode();
    while (node) {
      if (!shouldSkipTextNode(node)) {
        var translated = translateValue(node.nodeValue, table);
        if (translated !== node.nodeValue) node.nodeValue = translated;
      }
      node = walker.nextNode();
    }
  }

  function translateElementAttributes(element, table) {
    if (!element || element.nodeType !== 1) return;
    if (element.id === "openclaw-locale-switcher") return;
    if (typeof element.closest === "function" && element.closest("#openclaw-locale-switcher")) return;
    if (typeof element.closest === "function" && element.closest("[" + BILINGUAL_RENDER_ATTR + "='1']")) return;

    for (var index = 0; index < TRANSLATABLE_ATTRIBUTES.length; index += 1) {
      var attributeName = TRANSLATABLE_ATTRIBUTES[index];
      var currentValue = element.getAttribute(attributeName);
      if (typeof currentValue !== "string" || !currentValue) continue;
      var sourceValue = getOriginalAttributeValue(element, attributeName);
      var term = resolveTermByValue(sourceValue, inferRenderFromText(sourceValue));
      var localizedValue = sourceValue;
      if (term) {
        localizedValue = renderAttributeValue(term, getTextMode());
      } else if (table) {
        localizedValue = translateValue(sourceValue, table);
      }
      if (localizedValue !== currentValue) element.setAttribute(attributeName, localizedValue);
    }
  }

  function translateAttributes(root, table) {
    if (!root) return;

    if (root.nodeType === 1) {
      translateElementAttributes(root, table);
    }

    if (typeof root.querySelectorAll !== "function") return;
    var selector = "[placeholder],[aria-label],[title]";
    var elements = root.querySelectorAll(selector);
    for (var index = 0; index < elements.length; index += 1) {
      translateElementAttributes(elements[index], table);
    }
  }

  function isUnsafeDefaultChatModelValue(value) {
    return typeof value === "string" && value.trim().toLowerCase().indexOf("default/glm-") === 0;
  }

  function isUnsafeDefaultChatModelText(text) {
    if (typeof text !== "string") return false;
    var normalized = text.replace(/\s+/g, " ").trim().toLowerCase();
    return normalized.indexOf("default (glm-") >= 0 || normalized.indexOf("glm-") >= 0 && normalized.indexOf("· default") >= 0;
  }

  function isUnsafeChatModelOption(option) {
    if (!option) return false;
    return isUnsafeDefaultChatModelValue(option.value) || isUnsafeDefaultChatModelText(option.textContent || "");
  }

  function findSafeChatModelFallback(selectElement) {
    if (!selectElement || !selectElement.options) return null;

    for (var index = 0; index < selectElement.options.length; index += 1) {
      var option = selectElement.options[index];
      if (!option || option.disabled) continue;
      if (isUnsafeChatModelOption(option)) continue;
      if ((option.value || "").trim() === "") return option;
    }

    for (var optionIndex = 0; optionIndex < selectElement.options.length; optionIndex += 1) {
      var candidate = selectElement.options[optionIndex];
      if (!candidate || candidate.disabled) continue;
      if (isUnsafeChatModelOption(candidate)) continue;
      return candidate;
    }

    return null;
  }

  function guardSingleChatModelSelect(selectElement) {
    if (!selectElement || selectElement.nodeType !== 1) return;
    if ((selectElement.getAttribute("aria-label") || "") !== "Chat model") return;

    var selectedUnsafe = false;
    for (var index = 0; index < selectElement.options.length; index += 1) {
      var option = selectElement.options[index];
      if (!option) continue;
      if (!isUnsafeChatModelOption(option)) continue;
      if (option.selected || isUnsafeDefaultChatModelValue(selectElement.value)) selectedUnsafe = true;
      option.hidden = true;
      option.disabled = true;
      option.setAttribute("data-openclaw-unsafe-model", "1");
      option.title = "default/glm-* 当前在这条兼容链路里不稳定，已从聊天模型下拉中隐藏";
    }

    if (!selectedUnsafe) return;
    var fallback = findSafeChatModelFallback(selectElement);
    if (!fallback) return;
    if (selectElement.value === fallback.value && fallback.selected) return;
    selectElement.value = fallback.value;
    selectElement.dispatchEvent(new Event("input", { bubbles: true }));
    selectElement.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function applyUnsafeChatModelGuard(root) {
    var selectors = collectTargetElements(root || document, 'select[aria-label="Chat model"]');
    for (var index = 0; index < selectors.length; index += 1) {
      guardSingleChatModelSelect(selectors[index]);
    }
  }

  function reconnectTranslationObserver() {
    if (!translationObserver || !document.body) return;
    translationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: TRANSLATABLE_ATTRIBUTES
    });
  }

  function applyHardcodedTranslations() {
    var table = getHardcodedTranslationTable();
    if (!document.body || translationApplying) return;

    translationApplying = true;
    if (translationObserver) translationObserver.disconnect();

    try {
      ensureOverlayStyles();
      if (table) {
        translateTextNodes(document.body, table);
      }
      translateAttributes(document.body, table);
      applyBilingualTextOverlay(document.body);
      bindSearchBridge();
      applyUnsafeChatModelGuard(document.body);
    } finally {
      translationApplying = false;
      reconnectTranslationObserver();
    }
  }

  function scheduleHardcodedTranslations() {
    if (translationScheduled) return;
    translationScheduled = true;
    globalThis.requestAnimationFrame(function () {
      translationScheduled = false;
      applyHardcodedTranslations();
    });
  }

  function mountHardcodedTranslations() {
    if (!document.body) return;

    ensureOverlayStyles();
    scheduleHardcodedTranslations();

    if (translationObserver) return;
    translationObserver = new MutationObserver(function () {
      if (translationApplying) return;
      scheduleHardcodedTranslations();
    });

    reconnectTranslationObserver();

    globalThis.addEventListener("hashchange", function () {
      clearLocalSearchFilter();
      scheduleHardcodedTranslations();
    });
    globalThis.addEventListener("popstate", function () {
      clearLocalSearchFilter();
      scheduleHardcodedTranslations();
    });
  }

  function buildControlField(labelText, selectElement) {
    var wrapper = document.createElement("label");
    wrapper.style.display = "inline-flex";
    wrapper.style.alignItems = "center";
    wrapper.style.gap = "6px";

    var label = document.createElement("span");
    label.textContent = labelText;
    label.style.opacity = "0.78";
    label.style.fontWeight = "600";
    wrapper.appendChild(label);
    wrapper.appendChild(selectElement);
    return wrapper;
  }

  function buildSelectBase(id) {
    var select = document.createElement("select");
    select.id = id;
    select.style.border = "1px solid rgba(148, 163, 184, 0.28)";
    select.style.borderRadius = "999px";
    select.style.padding = "6px 28px 6px 12px";
    select.style.background = "rgba(255, 255, 255, 0.08)";
    select.style.color = "#f8fafc";
    select.style.fontSize = "13px";
    select.style.fontWeight = "600";
    select.style.outline = "none";
    select.style.cursor = "pointer";
    return select;
  }

  function buildRoot() {
    ensureOverlayStyles();

    var root = document.createElement("div");
    root.id = "openclaw-locale-switcher";
    root.setAttribute("role", "group");
    root.setAttribute("aria-label", "OpenClaw language and text mode switcher");
    root.style.position = "fixed";
    root.style.right = "16px";
    root.style.bottom = "16px";
    root.style.zIndex = "9999";
    root.style.display = "flex";
    root.style.alignItems = "center";
    root.style.flexWrap = "wrap";
    root.style.gap = "8px";
    root.style.padding = "10px 12px";
    root.style.borderRadius = "999px";
    root.style.border = "1px solid rgba(148, 163, 184, 0.35)";
    root.style.background = "rgba(15, 23, 42, 0.78)";
    root.style.backdropFilter = "blur(12px)";
    root.style.boxShadow = "0 12px 32px rgba(15, 23, 42, 0.24)";
    root.style.color = "#f8fafc";
    root.style.fontFamily = "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    root.style.fontSize = "13px";
    root.style.lineHeight = "1";

    var localeSelect = buildSelectBase("openclaw-locale-select");
    var locales = parseLocaleList(CONFIG.enabledLocales);
    if (locales.length === 0) locales = ["auto", "zh-CN", "zh-TW", "en"];
    for (var localeIndex = 0; localeIndex < locales.length; localeIndex += 1) {
      var localeValue = locales[localeIndex];
      var localeOption = document.createElement("option");
      localeOption.value = localeValue;
      localeOption.textContent = LABELS[localeValue] || localeValue;
      localeOption.style.color = "#0f172a";
      localeSelect.appendChild(localeOption);
    }
    localeSelect.value = currentSelection();
    localeSelect.addEventListener("change", function () {
      applySelection(localeSelect.value);
    });
    root.appendChild(buildControlField("语言", localeSelect));

    var textModeSelect = buildSelectBase("openclaw-text-mode-select");
    var enabledTextModes = Array.isArray(CONFIG.enabledTextModes) ? CONFIG.enabledTextModes : ["zh-only", "zh-en", "en-only"];
    for (var modeIndex = 0; modeIndex < enabledTextModes.length; modeIndex += 1) {
      var modeValue = normalizeTextMode(enabledTextModes[modeIndex]);
      if (!modeValue) continue;
      var modeOption = document.createElement("option");
      modeOption.value = modeValue;
      modeOption.textContent = TEXT_MODE_LABELS[modeValue] || modeValue;
      modeOption.style.color = "#0f172a";
      textModeSelect.appendChild(modeOption);
    }
    textModeSelect.value = getTextMode();
    textModeSelect.addEventListener("change", function () {
      setTextMode(textModeSelect.value);
      scheduleHardcodedTranslations();
    });
    root.appendChild(buildControlField("显示", textModeSelect));

    return root;
  }

  function mountSwitcher() {
    if (!CONFIG.showSwitcher) return;
    if (normalizeLocale(CONFIG.forceLocale)) return;
    ensureOverlayStyles();
    if (document.getElementById("openclaw-locale-switcher")) return;
    document.body.appendChild(buildRoot());
  }

  globalThis.__openclawDockerLocaleSwitcher = {
    setLocale: applySelection,
    getSelection: currentSelection,
    setTextMode: setTextMode,
    getTextMode: getTextMode,
    translateNow: scheduleHardcodedTranslations
  };

  applyInitialLocale();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      mountSwitcher();
      mountHardcodedTranslations();
    }, { once: true });
  } else {
    mountSwitcher();
    mountHardcodedTranslations();
  }
})();
