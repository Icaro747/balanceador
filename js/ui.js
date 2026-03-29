import { BELT_CAPACITY, FACTORY_COUNT_MAX, state } from "./state.js";
import { clamp, formatNumber, getFactoryColor, parsePositiveFloat } from "./utils.js";
import { buildDeviceTree } from "./tree.js";
import { chooseBestApproach } from "./math.js";
import { renderDiagrams as defaultRenderDiagrams } from "./diagram.js";

export function createRefs(documentLike = document) {
  return {
    beltType: documentLike.getElementById("beltType"),
    flowInput: documentLike.getElementById("flowInput"),
    depthInput: documentLike.getElementById("depthInput"),
    depthValue: documentLike.getElementById("depthValue"),
    factoryList: documentLike.getElementById("factoryList"),
    factoryCount: documentLike.getElementById("factoryCount"),
    calculateBtn: documentLike.getElementById("calculateBtn"),
    beltPreview: documentLike.getElementById("beltPreview"),
    capCard: documentLike.getElementById("capCard"),
    parallelCard: documentLike.getElementById("parallelCard"),
    maxErrorCard: documentLike.getElementById("maxErrorCard"),
    validationNotice: documentLike.getElementById("validationNotice"),
    resultsBody: documentLike.getElementById("resultsBody"),
    diagramWrap: documentLike.getElementById("diagramWrap")
  };
}

export function getFlowAndCapacity(refs) {
  const beltType = refs.beltType.value;
  const C = BELT_CAPACITY[beltType];
  const F = parsePositiveFloat(refs.flowInput.value);
  const N = F > 0 ? Math.ceil(F / C) : 0;
  return { beltType, C, F, N };
}

export function updateBeltPreview(refs) {
  const { beltType, C, F, N } = getFlowAndCapacity(refs);
  refs.capCard.textContent = `${formatNumber(C, 0)}/min`;
  refs.parallelCard.textContent = String(N || 0);

  if (!F) {
    refs.beltPreview.className = "notice bad";
    refs.beltPreview.textContent = "Informe um fluxo total valido (> 0).";
    return { beltType, C, F, N };
  }

  if (N <= 1) {
    refs.beltPreview.className = "notice good";
    refs.beltPreview.textContent =
      `Uma esteira ${beltType} suporta este fluxo (${formatNumber(F)}/min <= ${formatNumber(C)}/min).`;
    return { beltType, C, F, N };
  }

  refs.beltPreview.className = "notice warn";
  refs.beltPreview.textContent =
    `Sao necessarias ${N} esteiras ${beltType} em paralelo: ` +
    `F=${formatNumber(F)}/min, C=${formatNumber(C)}/min por esteira.`;
  return { beltType, C, F, N };
}

export function setFactoryCount(refs, appState, target) {
  const n = clamp(Math.floor(Number(target)), 1, FACTORY_COUNT_MAX);
  while (appState.factories.length < n) {
    const index = appState.factories.length + 1;
    appState.factories.push({ name: `Fabrica ${index}`, weight: 1 });
  }
  while (appState.factories.length > n) {
    appState.factories.pop();
  }
  refs.factoryCount.value = String(appState.factories.length);
  return appState.factories.length;
}

export function applyFactoryCountFromInput(refs, appState) {
  const parsed = Number.parseInt(refs.factoryCount.value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    refs.factoryCount.value = String(Math.max(1, appState.factories.length));
    return appState.factories.length;
  }
  setFactoryCount(refs, appState, parsed);
  renderFactoryRows(refs, appState);
  return appState.factories.length;
}

export function renderFactoryRows(refs, appState, documentLike = document) {
  refs.factoryList.innerHTML = "";

  appState.factories.forEach((factory, index) => {
    const row = documentLike.createElement("div");
    row.className = "factory-row";

    const nameInput = documentLike.createElement("input");
    nameInput.type = "text";
    nameInput.setAttribute("aria-label", `Nome da fabrica ${index + 1}`);
    nameInput.value = factory.name;

    const weightInput = documentLike.createElement("input");
    weightInput.type = "number";
    weightInput.setAttribute("aria-label", `Peso da fabrica ${index + 1}`);
    weightInput.min = "0.0001";
    weightInput.step = "0.0001";
    weightInput.value = String(factory.weight);

    nameInput.addEventListener("input", (event) => {
      appState.factories[index].name = event.target.value.trim() || `Fabrica ${index + 1}`;
    });

    weightInput.addEventListener("input", (event) => {
      appState.factories[index].weight = parsePositiveFloat(event.target.value, 1);
    });

    row.append(nameInput, weightInput);
    refs.factoryList.appendChild(row);
  });
}

export function renderResultsTable(refs, rows, documentLike = document) {
  refs.resultsBody.innerHTML = "";

  rows.forEach((row) => {
    const tr = documentLike.createElement("tr");
    const method = row.method || "Direta";
    const devices = row.devices ?? "-";

    tr.innerHTML = `
      <td>${row.name}</td>
      <td>${formatNumber(row.weight, 3)}</td>
      <td>${row.targetFractionText}</td>
      <td>${row.obtainedFractionText}</td>
      <td>${method}</td>
      <td>${devices}</td>
      <td><span class="pill ${row.exact ? "exact" : "approx"}">${row.exact ? "Exata" : "Aproximada"}</span></td>
      <td>${formatNumber(row.error * 100, 4)}%</td>
      <td>${formatNumber(row.realFlow, 4)}</td>
    `;

    refs.resultsBody.appendChild(tr);
  });
}

export function calculate(refs, options = {}) {
  const {
    appState = state,
    renderDiagramsFn = defaultRenderDiagrams,
    documentLike = document
  } = options;

  const { F, C, N } = updateBeltPreview(refs);
  const D = Number.parseInt(refs.depthInput.value, 10);
  const normalizedFactories = appState.factories.map((factory, index) => ({
    name: factory.name?.trim() || `Fabrica ${index + 1}`,
    weight: parsePositiveFloat(factory.weight, 1)
  }));
  const weightSum = normalizedFactories.reduce((acc, factory) => acc + factory.weight, 0);

  if (!F || !Number.isFinite(F) || F <= 0 || !weightSum) {
    refs.validationNotice.className = "notice bad";
    refs.validationNotice.textContent =
      "Entradas invalidas: confira fluxo total e pesos das fabricas.";
    refs.resultsBody.innerHTML = "";
    refs.diagramWrap.innerHTML = "";
    refs.maxErrorCard.textContent = "n/d";
    refs.parallelCard.textContent = String(N || 0);
    refs.capCard.textContent = `${formatNumber(C, 0)}/min`;
    return null;
  }

  const chosen = chooseBestApproach(normalizedFactories, D, F);
  const usingRecirculation = chosen.mode === "recirculation";
  const results = usingRecirculation
    ? chosen.rows.map((row, index) => ({
        name: row.name,
        weight: row.weight,
        targetFractionText: row.targetFractionText,
        obtainedFractionText: row.obtainedFractionText,
        method: row.method,
        devices: row.devices,
        exact: true,
        error: 0,
        realFlow: row.realFlow,
        color: getFactoryColor(index, chosen.rows.length)
      }))
    : chosen.rows.map((row, index) => {
        const color = getFactoryColor(index, chosen.rows.length);
        const targetFractionText = `${formatNumber(row.target * 100, 4)}%`;
        const obtainedFractionText =
          `${row.best.k}/${row.best.d} (${formatNumber(row.best.value * 100, 4)}%)`;
        const tree = buildDeviceTree(row.best, row.name, color, F, index);

        return {
          name: row.name,
          weight: row.weight,
          targetFractionText,
          obtainedFractionText,
          method: "Direta",
          devices: row.devices,
          exact: row.exact,
          error: row.error,
          realFlow: row.realFlow,
          best: row.best,
          tree,
          color
        };
      });

  const totalObtainedFraction = usingRecirculation
    ? 1
    : chosen.rows.reduce((acc, row) => acc + row.best.value, 0);
  const conservationError = Math.abs(totalObtainedFraction - 1);
  const maxError = results.reduce((acc, row) => Math.max(acc, row.error), 0);

  refs.maxErrorCard.textContent = `${formatNumber(maxError * 100, 4)}%`;
  refs.parallelCard.textContent = String(N);
  refs.capCard.textContent = `${formatNumber(C, 0)}/min`;

  if (usingRecirculation && chosen.recirc) {
    refs.validationNotice.className = "notice good";
    refs.validationNotice.textContent =
      `Metodo escolhido: recirculacao. d=${chosen.recirc.d}, ` +
      `sum(k)=${chosen.recirc.sumK}, r=${chosen.recirc.loopbackCount}. ` +
      `F=${formatNumber(F, 4)}/min, ` +
      `F_recirc=${formatNumber(chosen.recirc.recirculatedFlow, 4)}/min, ` +
      `E=${formatNumber(chosen.recirc.effectiveInput, 4)}/min. ` +
      "Divisao exata e menor complexidade.";
  } else if (conservationError < 1e-9) {
    refs.validationNotice.className = "notice good";
    refs.validationNotice.textContent =
      "Conservacao de fluxo OK: a soma das fracoes obtidas totaliza 100%.";
  } else {
    const deficit = (1 - totalObtainedFraction) * F;
    const deficitLabel = deficit >= 0 ? "sobra/nao alocado" : "excesso";
    refs.validationNotice.className = "notice warn";
    refs.validationNotice.textContent =
      `A soma das fracoes obtidas e ${formatNumber(totalObtainedFraction * 100, 4)}% ` +
      `(erro ${formatNumber(conservationError * 100, 4)}%). ` +
      `Impacto no fluxo total: ${formatNumber(Math.abs(deficit), 4)}/min de ${deficitLabel}.`;
  }

  renderResultsTable(refs, results, documentLike);
  renderDiagramsFn(refs, results, {
    mode: chosen.mode,
    recirc: chosen.recirc || null,
    factories: normalizedFactories,
    totalFlow: F
  });

  return {
    chosen,
    results,
    normalizedFactories,
    totalObtainedFraction,
    conservationError,
    maxError
  };
}

export function initApp(documentLike = document, options = {}) {
  const refs = createRefs(documentLike);
  const appState = options.appState ?? state;
  const renderDiagramsFn = options.renderDiagramsFn ?? defaultRenderDiagrams;

  const api = {
    refs,
    appState,
    updateBeltPreview: () => updateBeltPreview(refs),
    setFactoryCount: (target) => setFactoryCount(refs, appState, target),
    applyFactoryCountFromInput: () => applyFactoryCountFromInput(refs, appState),
    renderFactoryRows: () => renderFactoryRows(refs, appState, documentLike),
    renderResultsTable: (rows) => renderResultsTable(refs, rows, documentLike),
    calculate: () => calculate(refs, { appState, renderDiagramsFn, documentLike })
  };

  refs.factoryCount.addEventListener("change", api.applyFactoryCountFromInput);
  refs.calculateBtn.addEventListener("click", api.calculate);
  refs.depthInput.addEventListener("input", () => {
    refs.depthValue.textContent = refs.depthInput.value;
  });
  refs.beltType.addEventListener("change", api.updateBeltPreview);
  refs.flowInput.addEventListener("input", api.updateBeltPreview);

  refs.factoryCount.value = String(appState.factories.length);
  api.renderFactoryRows();
  api.updateBeltPreview();
  api.calculate();

  return api;
}
