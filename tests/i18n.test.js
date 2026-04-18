import { beforeEach, describe, expect, it } from "vitest";

import { applyTranslations, setLocale, t } from "../js/i18n/index.js";
import { formatNumber } from "../js/utils.js";

describe("i18n", () => {
  beforeEach(() => {
    setLocale("pt-BR", { persist: false, notify: false, documentLike: document });
  });

  it("switches between portuguese and english dictionaries", () => {
    expect(t("header.title")).toBe("Estudos de vazao e balanceamento");

    setLocale("en", { persist: false, notify: false, documentLike: document });
    expect(t("header.title")).toBe("Flow and balancing studies");
  });

  it("translates dom nodes and updates numeric formatting by locale", () => {
    document.body.innerHTML = `
      <h1 data-i18n="header.title"></h1>
      <input data-i18n-placeholder="language.ariaLabel">
    `;

    applyTranslations(document);
    expect(document.querySelector("h1").textContent).toBe("Estudos de vazao e balanceamento");
    expect(document.querySelector("input").getAttribute("placeholder")).toBe("Selecionar idioma");
    expect(formatNumber(1234.56, 2)).toBe("1.234,56");

    setLocale("en", { persist: false, notify: false, documentLike: document });
    expect(document.querySelector("h1").textContent).toBe("Flow and balancing studies");
    expect(document.querySelector("input").getAttribute("placeholder")).toBe("Select language");
    expect(formatNumber(1234.56, 2)).toBe("1,234.56");
  });
});
