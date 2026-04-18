import en from "./locales/en.js";
import ptBR from "./locales/pt-BR.js";

const DEFAULT_LOCALE = "pt-BR";
const FALLBACK_LOCALE = "en";
const STORAGE_KEY = "balanceador:locale";
const LOCALES = {
  "pt-BR": ptBR,
  en
};
const localeChangeListeners = new Set();

let currentLocale = DEFAULT_LOCALE;

function normalizeLocale(rawLocale) {
  const normalized = String(rawLocale || "").trim().toLowerCase();

  if (normalized.startsWith("pt")) {
    return "pt-BR";
  }
  if (normalized.startsWith("en")) {
    return "en";
  }
  return DEFAULT_LOCALE;
}

function resolveLocale(rawLocale) {
  const normalized = normalizeLocale(rawLocale);
  return LOCALES[normalized] ? normalized : DEFAULT_LOCALE;
}

function getByPath(source, path) {
  const keys = String(path || "").split(".");
  let cursor = source;
  for (const key of keys) {
    if (!cursor || typeof cursor !== "object" || !(key in cursor)) {
      return undefined;
    }
    cursor = cursor[key];
  }
  return cursor;
}

function interpolate(text, params = {}) {
  return String(text).replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => (
    key in params ? String(params[key]) : ""
  ));
}

function getTranslationCandidates(locale) {
  return Array.from(new Set([locale, FALLBACK_LOCALE, DEFAULT_LOCALE]));
}

function getStorage(windowLike = globalThis?.window) {
  try {
    return windowLike?.localStorage || null;
  } catch {
    return null;
  }
}

function syncDocumentLanguage(documentLike = globalThis?.document) {
  if (documentLike?.documentElement) {
    documentLike.documentElement.lang = currentLocale;
  }
}

function notifyLocaleChange(windowLike = globalThis?.window) {
  localeChangeListeners.forEach((listener) => {
    listener(currentLocale);
  });
  if (typeof windowLike?.dispatchEvent === "function" && typeof windowLike.CustomEvent === "function") {
    windowLike.dispatchEvent(new windowLike.CustomEvent("i18n:locale-changed", {
      detail: { locale: currentLocale }
    }));
  }
}

export function getLocale() {
  return currentLocale;
}

export function getIntlLocale() {
  return currentLocale;
}

export function t(key, params = {}, options = {}) {
  const locale = resolveLocale(options.locale || currentLocale);
  const candidates = getTranslationCandidates(locale);

  for (const candidate of candidates) {
    const dictionary = LOCALES[candidate];
    const found = getByPath(dictionary, key);
    if (typeof found === "string") {
      return interpolate(found, params);
    }
  }
  return String(key);
}

export function applyTranslations(root = globalThis?.document) {
  if (!root?.querySelectorAll) {
    return;
  }

  const setAttributeTranslations = (datasetKey, attributeName) => {
    root.querySelectorAll(`[${datasetKey}]`).forEach((element) => {
      const translationKey = element.getAttribute(datasetKey);
      if (!translationKey) {
        return;
      }
      element.setAttribute(attributeName, t(translationKey));
    });
  };

  root.querySelectorAll("[data-i18n]").forEach((element) => {
    const translationKey = element.getAttribute("data-i18n");
    if (!translationKey) {
      return;
    }
    element.textContent = t(translationKey);
  });

  root.querySelectorAll("[data-i18n-html]").forEach((element) => {
    const translationKey = element.getAttribute("data-i18n-html");
    if (!translationKey) {
      return;
    }
    element.innerHTML = t(translationKey);
  });

  setAttributeTranslations("data-i18n-aria-label", "aria-label");
  setAttributeTranslations("data-i18n-placeholder", "placeholder");
  setAttributeTranslations("data-i18n-title", "title");

  syncDocumentLanguage(root.ownerDocument || root);
}

export function setLocale(locale, options = {}) {
  const resolved = resolveLocale(locale);
  const {
    persist = true,
    notify = true,
    documentLike = globalThis?.document,
    windowLike = globalThis?.window
  } = options;
  const changed = resolved !== currentLocale;
  currentLocale = resolved;

  if (persist) {
    const storage = getStorage(windowLike);
    if (storage) {
      storage.setItem(STORAGE_KEY, currentLocale);
    }
  }

  applyTranslations(documentLike);

  if (notify && changed) {
    notifyLocaleChange(windowLike);
  }

  return currentLocale;
}

export function onLocaleChange(listener) {
  localeChangeListeners.add(listener);
  return () => {
    localeChangeListeners.delete(listener);
  };
}

export function initI18n(documentLike = globalThis?.document, windowLike = globalThis?.window) {
  const storage = getStorage(windowLike);
  const storedLocale = storage?.getItem(STORAGE_KEY);
  const initialLocale = resolveLocale(storedLocale || DEFAULT_LOCALE);
  setLocale(initialLocale, {
    persist: false,
    notify: false,
    documentLike,
    windowLike
  });

  const selector = documentLike?.getElementById("languageSelect");
  if (selector) {
    selector.value = currentLocale;
    selector.addEventListener("change", (event) => {
      setLocale(event.target.value, { documentLike, windowLike });
    });
  }

  onLocaleChange((locale) => {
    if (selector) {
      selector.value = locale;
    }
  });

  return {
    getLocale,
    setLocale: (locale) => setLocale(locale, { documentLike, windowLike }),
    onLocaleChange
  };
}
