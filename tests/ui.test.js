import { beforeEach, describe, expect, it, vi } from "vitest";

import { state } from "../js/state.js";
import { initApp } from "../js/ui.js";

function createDefaultFactories() {
  return Array.from({ length: 5 }, (_, index) => ({
    name: `Fabrica ${index + 1}`,
    weight: 1
  }));
}

function resetState() {
  state.factories.splice(0, state.factories.length, ...createDefaultFactories());
}

function mountFixture() {
  document.body.innerHTML = `
    <main>
      <select id="beltType">
        <option value="t1">t1</option>
        <option value="t2">t2</option>
        <option value="t3">t3</option>
        <option value="t4">t4</option>
        <option value="t5">t5</option>
        <option value="t6">t6</option>
      </select>
      <input id="flowInput" type="number" value="60">
      <input id="depthInput" type="range" min="2" max="6" value="4">
      <span id="depthValue">4</span>
      <input id="factoryCount" type="number" value="5">
      <button id="calculateBtn" type="button">Calcular</button>
      <div id="factoryList"></div>
      <div id="beltPreview"></div>
      <strong id="capCard"></strong>
      <strong id="parallelCard"></strong>
      <strong id="maxErrorCard"></strong>
      <div id="validationNotice"></div>
      <table><tbody id="resultsBody"></tbody></table>
      <div id="diagramWrap"></div>
    </main>
  `;
}

function createApp() {
  mountFixture();
  const renderDiagramsFn = vi.fn();
  const app = initApp(document, { renderDiagramsFn });
  return { app, renderDiagramsFn };
}

describe("ui flows", () => {
  beforeEach(() => {
    resetState();
  });

  it("shows an invalid preview when the flow is not positive", () => {
    const { app } = createApp();

    app.refs.flowInput.value = "0";
    app.updateBeltPreview();

    expect(app.refs.beltPreview.className).toBe("notice bad");
    expect(app.refs.beltPreview.textContent).toContain("fluxo total valido");
    expect(app.refs.parallelCard.textContent).toBe("0");
  });

  it("shows a single belt or multiple parallel belts according to flow and capacity", () => {
    const { app } = createApp();

    app.refs.beltType.value = "t1";
    app.refs.flowInput.value = "60";
    app.updateBeltPreview();
    expect(app.refs.beltPreview.textContent).toContain("Uma esteira t1 suporta este fluxo");

    app.refs.flowInput.value = "123";
    app.updateBeltPreview();
    expect(app.refs.beltPreview.textContent).toContain("Sao necessarias 3 esteiras t1 em paralelo");
    expect(app.refs.parallelCard.textContent).toBe("3");
  });

  it("clears the results when the inputs are invalid", () => {
    const { app, renderDiagramsFn } = createApp();
    renderDiagramsFn.mockClear();

    app.refs.flowInput.value = "0";
    const result = app.calculate();

    expect(result).toBeNull();
    expect(app.refs.validationNotice.className).toBe("notice bad");
    expect(app.refs.resultsBody.children).toHaveLength(0);
    expect(app.refs.diagramWrap.innerHTML).toBe("");
    expect(app.refs.maxErrorCard.textContent).toBe("n/d");
    expect(renderDiagramsFn).not.toHaveBeenCalled();
  });

  it("renders cards, rows and validation for a direct scenario", () => {
    const { app, renderDiagramsFn } = createApp();
    renderDiagramsFn.mockClear();

    app.setFactoryCount(1);
    app.renderFactoryRows();
    const result = app.calculate();

    expect(result.chosen.mode).toBe("direct");
    expect(app.refs.capCard.textContent).toBe("60/min");
    expect(app.refs.parallelCard.textContent).toBe("1");
    expect(app.refs.resultsBody.children).toHaveLength(1);
    expect(app.refs.validationNotice.textContent).toContain("Conservacao de fluxo OK");
    expect(renderDiagramsFn).toHaveBeenCalledWith(
      app.refs,
      expect.any(Array),
      expect.objectContaining({ mode: "direct", totalFlow: 60 })
    );
  });

  it("shows the recirculation notice and zero max error for five equal factories", () => {
    const { app, renderDiagramsFn } = createApp();

    expect(app.refs.validationNotice.textContent).toContain("Metodo escolhido: recirculacao");
    expect(app.refs.maxErrorCard.textContent).toBe("0%");
    expect(app.refs.resultsBody.children).toHaveLength(5);
    expect(renderDiagramsFn).toHaveBeenCalledWith(
      app.refs,
      expect.any(Array),
      expect.objectContaining({ mode: "recirculation", totalFlow: 60 })
    );
  });

  it("shows F, F_recirc and E in the recirculation notice and uses the minimized device count", () => {
    state.factories.splice(0, state.factories.length,
      { name: "Fabrica 1", weight: 1 },
      { name: "Fabrica 2", weight: 1 },
      { name: "Fabrica 3", weight: 1 },
      { name: "Fabrica 4", weight: 0.5 }
    );

    mountFixture();
    const app = initApp(document);
    const result = app.calculate();
    const rows = Array.from(app.refs.resultsBody.querySelectorAll("tr"));

    expect(result.chosen.mode).toBe("recirculation");
    expect(app.refs.validationNotice.textContent).toContain("F=60");
    expect(app.refs.validationNotice.textContent).toContain("F_recirc=8,5714");
    expect(app.refs.validationNotice.textContent).toContain("E=68,5714");
    expect(rows.map((row) => row.children[5].textContent)).toEqual(["5", "5", "5", "5"]);
  });

  it("renders the exact 1,1,1,0.5 recirculation summary in the UI", () => {
    state.factories.splice(0, state.factories.length,
      { name: "Fabrica 1", weight: 1 },
      { name: "Fabrica 2", weight: 1 },
      { name: "Fabrica 3", weight: 1 },
      { name: "Fabrica 4", weight: 0.5 }
    );

    const { app, renderDiagramsFn } = createApp();
    renderDiagramsFn.mockClear();

    const result = app.calculate();
    const rows = Array.from(app.refs.resultsBody.querySelectorAll("tr"));

    expect(result.chosen.mode).toBe("recirculation");
    expect(app.refs.maxErrorCard.textContent).toBe("0%");
    expect(app.refs.validationNotice.textContent).toContain("Metodo escolhido: recirculacao");
    expect(app.refs.validationNotice.textContent).toContain("d=8");
    expect(app.refs.validationNotice.textContent).toContain("sum(k)=7");
    expect(app.refs.validationNotice.textContent).toContain("r=1");
    expect(rows).toHaveLength(4);
    expect(rows.map((row) => row.children[2].textContent)).toEqual([
      "28,5714%",
      "28,5714%",
      "28,5714%",
      "14,2857%"
    ]);
    expect(rows.map((row) => row.children[3].textContent)).toEqual([
      "2/7 (28,5714%)",
      "2/7 (28,5714%)",
      "2/7 (28,5714%)",
      "1/7 (14,2857%)"
    ]);
    expect(renderDiagramsFn).toHaveBeenCalledWith(
      app.refs,
      expect.any(Array),
      expect.objectContaining({ mode: "recirculation", totalFlow: 60 })
    );
  });

  it("updates the factory list when the requested count changes", () => {
    const { app } = createApp();

    app.refs.factoryCount.value = "7";
    app.applyFactoryCountFromInput();

    expect(state.factories).toHaveLength(7);
    expect(app.refs.factoryList.children).toHaveLength(7);
    const lastRowInputs = app.refs.factoryList.lastElementChild.querySelectorAll("input");
    expect(lastRowInputs[0].value).toBe("Fabrica 7");
    expect(lastRowInputs[1].value).toBe("1");

    app.refs.factoryCount.value = "4";
    app.applyFactoryCountFromInput();

    expect(state.factories).toHaveLength(4);
    expect(app.refs.factoryList.children).toHaveLength(4);
    expect(app.refs.factoryCount.value).toBe("4");
  });
});
