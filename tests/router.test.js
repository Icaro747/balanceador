import { describe, expect, it } from "vitest";

import { applyRoute, initRouter, normalizeRoute } from "../js/router.js";

function mountFixture() {
  document.body.innerHTML = `
    <nav>
      <a data-route-link="balanceamento" href="#/balanceamento">Balanceamento</a>
      <a data-route-link="vazao" href="#/vazao">Vazao</a>
    </nav>
    <section data-route="balanceamento">Tela 1</section>
    <section data-route="vazao" hidden>Tela 2</section>
  `;
}

describe("router", () => {
  it("normalizes unknown hashes to the default route", () => {
    expect(normalizeRoute("#/vazao")).toBe("vazao");
    expect(normalizeRoute("#/rota-inexistente")).toBe("balanceamento");
    expect(normalizeRoute("")).toBe("balanceamento");
  });

  it("applies the active route to panels and links", () => {
    mountFixture();

    const route = applyRoute("vazao");
    const balanceamento = document.querySelector('[data-route="balanceamento"]');
    const vazao = document.querySelector('[data-route="vazao"]');
    const activeLink = document.querySelector('[data-route-link="vazao"]');

    expect(route).toBe("vazao");
    expect(balanceamento.hidden).toBe(true);
    expect(vazao.hidden).toBe(false);
    expect(activeLink.classList.contains("is-active")).toBe(true);
    expect(activeLink.getAttribute("aria-current")).toBe("page");
  });

  it("syncs the hash to a canonical route on startup", () => {
    mountFixture();
    window.history.replaceState(null, "", "#/rota-velha");

    const router = initRouter(document, window);
    const balanceamento = document.querySelector('[data-route="balanceamento"]');
    const vazao = document.querySelector('[data-route="vazao"]');

    expect(window.location.hash).toBe("#/balanceamento");
    expect(balanceamento.hidden).toBe(false);
    expect(vazao.hidden).toBe(true);

    router.destroy();
  });
});
