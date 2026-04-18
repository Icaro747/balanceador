import { initRouter } from "./router.js";
import { initThroughputApp } from "./throughput.js";
import { initApp } from "./ui.js";
import { initI18n } from "./i18n/index.js";

const i18n = initI18n();
const app = initApp();
const throughputApp = initThroughputApp();
initRouter();

i18n.onLocaleChange(() => {
  app?.refreshTranslations?.();
  throughputApp?.refreshTranslations?.();
});
