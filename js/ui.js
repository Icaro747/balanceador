import { BELT_CAPACITY, FACTORY_COUNT_MAX, state } from "./state.js";
import { clamp, formatNumber, getFactoryColor, parsePositiveFloat } from "./utils.js";
import { buildDeviceTree } from "./tree.js";
import { chooseBestApproach } from "./math.js";
import { renderDiagrams } from "./diagram.js";

const refs = {
  beltType: document.getElementById("beltType"),
  flowInput: document.getElementById("flowInput"),
  depthInput: document.getElementById("depthInput"),
  depthValue: document.getElementById("depthValue"),
  factoryList: document.getElementById("factoryList"),
  factoryCount: document.getElementById("factoryCount"),
  calculateBtn: document.getElementById("calculateBtn"),
  beltPreview: document.getElementById("beltPreview"),
  capCard: document.getElementById("capCard"),
  parallelCard: document.getElementById("parallelCard"),
  maxErrorCard: document.getElementById("maxErrorCard"),
  validationNotice: document.getElementById("validationNotice"),
  resultsBody: document.getElementById("resultsBody"),
  diagramWrap: document.getElementById("diagramWrap")
};

function getFlowAndCapacity() {
  const beltType = refs.beltType.value;
  const C = BELT_CAPACITY[beltType];
  const F = parsePositiveFloat(refs.flowInput.value);
  const N = F > 0 ? Math.ceil(F / C) : 0;
  return { beltType, C, F, N };
}

function updateBeltPreview() {
  const { beltType, C, F, N } = getFlowAndCapacity();
  refs.capCard.textContent = `${formatNumber(C, 0)}/min`;
  refs.parallelCard.textContent = String(N || 0);

  if (!F) {
    refs.beltPreview.className = "notice bad";
    refs.beltPreview.textContent = "Informe um fluxo total valido (> 0).";
    return;
  }

  if (N <= 1) {
    refs.beltPreview.className = "notice good";
    refs.beltPreview.textContent = `Uma esteira ${beltType} suporta este fluxo (${formatNumber(F)}/min <= ${formatNumber(C)}/min).`;
    return;
  }

  refs.beltPreview.className = "notice warn";
  refs.beltPreview.textContent =
    `Sao necessarias ${N} esteiras ${beltType} em paralelo: F=${formatNumber(F)}/min, C=${formatNumber(C)}/min por esteira.`;
}

function setFactoryCount(target) {
  const n = clamp(Math.floor(Number(target)), 1, FACTORY_COUNT_MAX);
  while (state.factories.length < n) {
    const i = state.factories.length + 1;
    state.factories.push({ name: `Fabrica ${i}`, weight: 1 });
  }
  while (state.factories.length > n) {
    state.factories.pop();
  }
  refs.factoryCount.value = String(state.factories.length);
}

function applyFactoryCountFromInput() {
  const parsed = Number.parseInt(refs.factoryCount.value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    refs.factoryCount.value = String(Math.max(1, state.factories.length));
    return;
  }
  setFactoryCount(parsed);
  renderFactoryRows();
}

function renderFactoryRows() {
  refs.factoryList.innerHTML = "";
  state.factories.forEach((factory, index) => {
    const row = document.createElement("div");
    row.className = "factory-row";
    row.innerHTML = `
        <input type="text" aria-label="Nome da fabrica ${index + 1}" value="${factory.name}">
        <input type="number" aria-label="Peso da fabrica ${index + 1}" min="0.0001" step="0.0001" value="${factory.weight}">
      `;

    const [nameInput, weightInput] = row.querySelectorAll("input");
    nameInput.addEventListener("input", (event) => {
      state.factories[index].name = event.target.value.trim() || `Fabrica ${index + 1}`;
    });
    weightInput.addEventListener("input", (event) => {
      const next = parsePositiveFloat(event.target.value, 1);
      state.factories[index].weight = next;
    });
    refs.factoryList.appendChild(row);
  });
}

function renderResultsTable(rows) {
  refs.resultsBody.innerHTML = "";
  rows.forEach((row) => {
    const tr = document.createElement("tr");
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

function calculate() {
  updateBeltPreview();
  const { F, C, N } = getFlowAndCapacity();
  const D = Number.parseInt(refs.depthInput.value, 10);
  const normalizedFactories = state.factories.map((factory, index) => ({
    name: factory.name?.trim() || `Fabrica ${index + 1}`,
    weight: parsePositiveFloat(factory.weight, 1)
  }));
  const weightSum = normalizedFactories.reduce((acc, factory) => acc + factory.weight, 0);

  if (!F || !Number.isFinite(F) || F <= 0 || !weightSum) {
    refs.validationNotice.className = "notice bad";
    refs.validationNotice.textContent = "Entradas invalidas: confira fluxo total e pesos das fabricas.";
    refs.resultsBody.innerHTML = "";
    refs.diagramWrap.innerHTML = "";
    refs.maxErrorCard.textContent = "n/d";
    refs.parallelCard.textContent = String(N || 0);
    refs.capCard.textContent = `${formatNumber(C, 0)}/min`;
    return;
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
        const obtainedFractionText = `${row.best.k}/${row.best.d} (${formatNumber(row.best.value * 100, 4)}%)`;
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
      `Metodo escolhido: recirculacao. d=${chosen.recirc.d}, sum(k)=${chosen.recirc.sumK}, r=${chosen.recirc.loopbackCount}. ` +
      `Fluxo recirculado: ${formatNumber(chosen.recirc.recirculatedFlow, 4)}/min. Divisao exata e menor complexidade.`;
  } else if (conservationError < 1e-9) {
    refs.validationNotice.className = "notice good";
    refs.validationNotice.textContent = "Conservacao de fluxo OK: a soma das fracoes obtidas totaliza 100%.";
  } else {
    const deficit = (1 - totalObtainedFraction) * F;
    const deficitLabel = deficit >= 0 ? "sobra/nao alocado" : "excesso";
    refs.validationNotice.className = "notice warn";
    refs.validationNotice.textContent =
      `A soma das fracoes obtidas e ${formatNumber(totalObtainedFraction * 100, 4)}% (erro ${formatNumber(conservationError * 100, 4)}%). ` +
      `Impacto no fluxo total: ${formatNumber(Math.abs(deficit), 4)}/min de ${deficitLabel}.`;
  }

  renderResultsTable(results);
  renderDiagrams(refs, results, {
    mode: chosen.mode,
    recirc: chosen.recirc || null,
    factories: normalizedFactories,
    totalFlow: F
  });
}

refs.factoryCount.addEventListener("change", applyFactoryCountFromInput);
refs.calculateBtn.addEventListener("click", calculate);
refs.depthInput.addEventListener("input", () => {
  refs.depthValue.textContent = refs.depthInput.value;
});
refs.beltType.addEventListener("change", updateBeltPreview);
refs.flowInput.addEventListener("input", updateBeltPreview);

refs.factoryCount.value = String(state.factories.length);
renderFactoryRows();
updateBeltPreview();
calculate();
