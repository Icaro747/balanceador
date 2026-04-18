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
  state.showAdvancedTableColumns = false;
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
      <input id="manualLanesInput" type="number" value="1">
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
      <article id="scenarioSummary"></article>
      <button id="toggleAdvancedColumnsBtn" type="button"></button>
      <table id="resultsTable" class="results-table"><tbody id="resultsBody"></tbody></table>
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

  it("applies N = max(N_min, N_manual) and updates per-line preview", () => {
    const { app } = createApp();

    app.refs.beltType.value = "t1";
    app.refs.flowInput.value = "60";
    app.refs.manualLanesInput.value = "1";
    app.updateBeltPreview();
    expect(app.refs.beltPreview.textContent).toContain("Uma esteira t1 suporta este fluxo");

    app.refs.flowInput.value = "123";
    app.refs.manualLanesInput.value = "1";
    app.updateBeltPreview();
    expect(app.refs.beltPreview.textContent).toContain("N_min=3");
    expect(app.refs.parallelCard.textContent).toBe("3");

    app.refs.flowInput.value = "120";
    app.refs.manualLanesInput.value = "4";
    app.updateBeltPreview();
    expect(app.refs.beltPreview.textContent).toContain("N_manual=4");
    expect(app.refs.parallelCard.textContent).toBe("4");
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

  it("uses effective solution depth for implementation difficulty instead of configured depth", () => {
    const { app } = createApp();

    app.setFactoryCount(1);
    app.renderFactoryRows();

    app.refs.depthInput.value = "6";
    app.refs.depthValue.textContent = "6";
    app.calculate();
    expect(app.refs.scenarioSummary.textContent).toContain("Dificuldade de implementacao:");
    expect(app.refs.scenarioSummary.textContent).toContain("D efetivo da solucao=0");
    expect(app.refs.scenarioSummary.textContent).toContain("D=2 -> facil");
    expect(app.refs.scenarioSummary.textContent).not.toContain("D=6 -> pesadelo");
  });

  it("falls back to direct mode when recirculation violates the belt capacity", () => {
    const { app, renderDiagramsFn } = createApp();

    expect(app.refs.validationNotice.textContent).toContain("A soma das fracoes obtidas");
    expect(app.refs.maxErrorCard.textContent).not.toBe("n/d");
    expect(app.refs.resultsBody.children).toHaveLength(5);
    expect(renderDiagramsFn).toHaveBeenCalledWith(
      app.refs,
      expect.any(Array),
      expect.objectContaining({ mode: "direct", totalFlow: 60, inputLanes: 1 })
    );
  });

  it("keeps advanced table columns hidden by default and toggles visibility on demand", () => {
    const { app } = createApp();

    expect(app.refs.resultsTable.classList.contains("show-advanced")).toBe(false);
    expect(app.refs.toggleAdvancedColumnsBtn.textContent).toContain("Mostrar");

    app.toggleAdvancedColumnsVisibility();
    expect(app.refs.resultsTable.classList.contains("show-advanced")).toBe(true);
    expect(app.refs.toggleAdvancedColumnsBtn.textContent).toContain("Ocultar");
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
    app.refs.manualLanesInput.value = "2";
    const result = app.calculate();
    const rows = Array.from(app.refs.resultsBody.querySelectorAll("tr"));

    expect(result.chosen.mode).toBe("unified");
    expect(app.refs.validationNotice.textContent).toContain("N=2");
    expect(app.refs.validationNotice.textContent).toContain("F_linha=30");
    expect(app.refs.validationNotice.textContent).toContain("F_recirc=4,2857");
    expect(app.refs.validationNotice.textContent).toContain("E=34,2857");
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

    app.refs.manualLanesInput.value = "2";
    const result = app.calculate();
    const rows = Array.from(app.refs.resultsBody.querySelectorAll("tr"));

    expect(result.chosen.mode).toBe("unified");
    expect(app.refs.maxErrorCard.textContent).toBe("0%");
    expect(app.refs.validationNotice.textContent).toContain("Metodo escolhido: recirculacao com loop-back");
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
      expect.objectContaining({ mode: "unified", totalFlow: 30, inputLanes: 2 })
    );
  });

  it("describes three equal factories as a unified exact tree without loop-back", () => {
    state.factories.splice(0, state.factories.length,
      { name: "Fabrica 1", weight: 1 },
      { name: "Fabrica 2", weight: 1 },
      { name: "Fabrica 3", weight: 1 }
    );

    const { app, renderDiagramsFn } = createApp();
    renderDiagramsFn.mockClear();

    const result = app.calculate();

    expect(result.chosen.mode).toBe("unified");
    expect(result.chosen.unifiedKind).toBe("exact");
    expect(app.refs.validationNotice.textContent).toContain("Metodo escolhido: arvore unificada exata");
    expect(app.refs.validationNotice.textContent).toContain("r=0");
    expect(app.refs.validationNotice.textContent).toContain("F_recirc=0");
    expect(renderDiagramsFn).toHaveBeenCalledWith(
      app.refs,
      expect.any(Array),
      expect.objectContaining({ mode: "unified", totalFlow: 60, inputLanes: 1 })
    );
  });

  it("renders explicit entrada 1 and entrada 2 nodes for 120/min in t1 with four equal factories", () => {
    state.factories.splice(0, state.factories.length,
      { name: "Fabrica 1", weight: 1 },
      { name: "Fabrica 2", weight: 1 },
      { name: "Fabrica 3", weight: 1 },
      { name: "Fabrica 4", weight: 1 }
    );

    mountFixture();
    const app = initApp(document);
    app.refs.beltType.value = "t1";
    app.refs.flowInput.value = "120";
    app.refs.manualLanesInput.value = "1";
    app.calculate();

    const textValues = Array.from(app.refs.diagramWrap.querySelectorAll("text"))
      .map((node) => node.textContent);
    expect(textValues).toContain("entrada 1");
    expect(textValues).toContain("entrada 2");
    expect(textValues).toContain("Fabrica 1");
    expect(textValues).toContain("Fabrica 4");
  });

  it("renders a merger when one factory is fed by two 60/min entradas", () => {
    state.factories.splice(0, state.factories.length,
      { name: "Fabrica 1", weight: 1 }
    );

    mountFixture();
    const app = initApp(document);
    app.refs.beltType.value = "t1";
    app.refs.flowInput.value = "120";
    app.refs.manualLanesInput.value = "1";
    app.calculate();

    const textValues = Array.from(app.refs.diagramWrap.querySelectorAll("text"))
      .map((node) => node.textContent);
    const mergerCount = textValues.filter((text) => text === "UNIFICADOR").length;
    expect(textValues).toContain("entrada 1");
    expect(textValues).toContain("entrada 2");
    expect(mergerCount).toBeGreaterThanOrEqual(1);
    expect(textValues).toContain("Fabrica 1");
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
