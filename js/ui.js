import { BELT_CAPACITY, FACTORY_COUNT_MAX, state } from "./state.js";
import { clamp, formatNumber, getFactoryColor, parsePositiveFloat } from "./utils.js";
import { buildDeviceTree } from "./tree.js";
import { chooseBestApproach } from "./math.js";
import { renderDiagrams as defaultRenderDiagrams } from "./diagram.js";
import { t } from "./i18n/index.js";

function getFactoryDefaultName(index) {
  return t("factories.defaultName", { index: index + 1 });
}

function isDefaultFactoryName(name, index) {
  const value = String(name || "").trim();
  if (!value) {
    return true;
  }
  const locales = ["pt-BR", "en"];
  return locales.some((locale) => (
    value === t("factories.defaultName", { index: index + 1 }, { locale })
  ));
}

function localizeDefaultFactoryNames(appState) {
  appState.factories.forEach((factory, index) => {
    if (isDefaultFactoryName(factory.name, index)) {
      factory.name = getFactoryDefaultName(index);
    }
  });
}

export function createRefs(documentLike = document) {
  return {
    beltType: documentLike.getElementById("beltType"),
    flowInput: documentLike.getElementById("flowInput"),
    manualLanesInput: documentLike.getElementById("manualLanesInput"),
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
    scenarioSummary: documentLike.getElementById("scenarioSummary"),
    toggleAdvancedColumnsBtn: documentLike.getElementById("toggleAdvancedColumnsBtn"),
    resultsTable: documentLike.getElementById("resultsTable"),
    resultsBody: documentLike.getElementById("resultsBody"),
    diagramWrap: documentLike.getElementById("diagramWrap")
  };
}

export function getFlowAndCapacity(refs) {
  const beltType = refs.beltType.value;
  const C = BELT_CAPACITY[beltType];
  const F = parsePositiveFloat(refs.flowInput.value);
  const manualRaw = Number.parseInt(refs.manualLanesInput?.value ?? "1", 10);
  const N_manual = Number.isFinite(manualRaw) && manualRaw > 0 ? manualRaw : 1;
  const N_min = F > 0 ? Math.ceil(F / C) : 0;
  const N_aplicado = F > 0 ? Math.max(N_min, N_manual) : 0;
  const F_por_linha = N_aplicado > 0 ? F / N_aplicado : 0;

  if (refs.manualLanesInput) {
    refs.manualLanesInput.value = String(N_manual);
  }

  return {
    beltType,
    C,
    F,
    N_min,
    N_manual,
    N_aplicado,
    F_por_linha
  };
}

export function updateBeltPreview(refs) {
  const {
    beltType,
    C,
    F,
    N_min,
    N_manual,
    N_aplicado,
    F_por_linha
  } = getFlowAndCapacity(refs);
  refs.capCard.textContent = `${formatNumber(C, 0)}/min`;
  refs.parallelCard.textContent = String(N_aplicado || 0);

  if (!F) {
    refs.beltPreview.className = "notice bad";
    refs.beltPreview.textContent = t("ui.preview.invalidFlow");
    return {
      beltType,
      C,
      F,
      N_min,
      N_manual,
      N_aplicado,
      F_por_linha
    };
  }

  if (N_aplicado <= 1) {
    refs.beltPreview.className = "notice good";
    refs.beltPreview.textContent = t("ui.preview.singleLane", {
      beltType,
      flow: formatNumber(F),
      capacity: formatNumber(C)
    });
    return {
      beltType,
      C,
      F,
      N_min,
      N_manual,
      N_aplicado,
      F_por_linha
    };
  }

  refs.beltPreview.className = "notice warn";
  refs.beltPreview.textContent = t("ui.preview.multiLane", {
    nMin: N_min,
    nManual: N_manual,
    nApplied: N_aplicado,
    flowPerLane: formatNumber(F_por_linha, 4),
    flow: formatNumber(F, 4),
    capacity: formatNumber(C)
  });
  return {
    beltType,
    C,
    F,
    N_min,
    N_manual,
    N_aplicado,
    F_por_linha
  };
}

export function setFactoryCount(refs, appState, target) {
  const n = clamp(Math.floor(Number(target)), 1, FACTORY_COUNT_MAX);
  while (appState.factories.length < n) {
    const index = appState.factories.length + 1;
    appState.factories.push({ name: getFactoryDefaultName(index - 1), weight: 1 });
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
    nameInput.setAttribute("aria-label", t("factories.nameAria", { index: index + 1 }));
    nameInput.value = factory.name;

    const weightInput = documentLike.createElement("input");
    weightInput.type = "number";
    weightInput.setAttribute("aria-label", t("factories.weightAria", { index: index + 1 }));
    weightInput.min = "0.0001";
    weightInput.step = "0.0001";
    weightInput.value = String(factory.weight);

    nameInput.addEventListener("input", (event) => {
      appState.factories[index].name = event.target.value.trim() || getFactoryDefaultName(index);
    });

    weightInput.addEventListener("input", (event) => {
      appState.factories[index].weight = parsePositiveFloat(event.target.value, 1);
    });

    row.append(nameInput, weightInput);
    refs.factoryList.appendChild(row);
  });
}

export function setAdvancedColumnsVisibility(refs, visible) {
  if (!refs.resultsTable || !refs.toggleAdvancedColumnsBtn) {
    return;
  }

  refs.resultsTable.classList.toggle("show-advanced", visible);
  refs.toggleAdvancedColumnsBtn.setAttribute("aria-expanded", visible ? "true" : "false");
  refs.toggleAdvancedColumnsBtn.textContent = visible
    ? t("ui.table.hideTechnical")
    : t("ui.table.showTechnical");
}

function getUnifiedSolution(chosen) {
  return chosen?.unified || chosen?.recirc || null;
}

function getUnifiedMethodLabel(unified) {
  return unified?.usesLoopback
    ? t("ui.methods.recirculationWithLoopback")
    : t("ui.methods.unifiedExactTree");
}

function getEffectiveSolutionDepth(chosen, depthLimit) {
  const extractDepth = (a, b) => {
    const aNum = Number(a);
    const bNum = Number(b);
    if (!Number.isFinite(aNum) || !Number.isFinite(bNum)) {
      return null;
    }
    return Math.max(0, Math.round(aNum) + Math.round(bNum));
  };

  const unified = getUnifiedSolution(chosen);
  const unifiedDepth = extractDepth(unified?.a, unified?.b);
  if (unifiedDepth !== null) {
    return unifiedDepth;
  }

  const rowDepths = Array.isArray(chosen?.rows)
    ? chosen.rows
      .map((row) => extractDepth(row?.best?.a, row?.best?.b))
      .filter((value) => value !== null)
    : [];
  if (rowDepths.length > 0) {
    return Math.max(...rowDepths);
  }

  const fallbackDepth = Number(depthLimit);
  return Number.isFinite(fallbackDepth) ? fallbackDepth : 2;
}

function getImplementationDifficultyByDepth(effectiveDepth) {
  const depth = clamp(Math.round(Number(effectiveDepth) || 2), 2, 6);
  const level = t(`ui.summary.depthDifficultyLevels.${depth}`);
  return { depth, level };
}

function renderImplementationDifficultyItem(chosen, depthLimit) {
  const effectiveDepth = getEffectiveSolutionDepth(chosen, depthLimit);
  const { depth, level } = getImplementationDifficultyByDepth(effectiveDepth);
  return `<li><strong>${t("ui.summary.labelImplementationDifficulty")}</strong> ${t("ui.summary.implementationDifficultyByDepth", { effectiveDepth, depth, level })}</li>`;
}

function renderScenarioSummary(refs, context) {
  if (!refs.scenarioSummary) {
    return;
  }

  const {
    chosen,
    totalFlow,
    depthLimit,
    maxError,
    inputLanes,
    flowPerLane
  } = context;
  if (!chosen) {
    refs.scenarioSummary.innerHTML = "";
    refs.scenarioSummary.classList.remove("is-visible");
    return;
  }

  if (chosen.mode === "blocked") {
    refs.scenarioSummary.innerHTML = `
      <h3>${t("ui.summary.title")}</h3>
      <p>${t("ui.summary.blockedLead")}</p>
      <ul>
        <li><strong>${t("ui.summary.labelTotalFlow")}</strong> F=${formatNumber(totalFlow, 4)}/min.</li>
        <li><strong>${t("ui.summary.labelInputLanes")}</strong> N=${inputLanes} (${t("ui.summary.perLineFlow", { flow: formatNumber(flowPerLane, 4) })}).</li>
        <li><strong>${t("ui.summary.labelStatus")}</strong> ${t("ui.summary.blockedStatus")}</li>
      </ul>
    `;
    refs.scenarioSummary.classList.add("is-visible");
    return;
  }

  const unified = getUnifiedSolution(chosen);
  if ((chosen.mode === "unified" || chosen.mode === "recirculation") && unified) {
    refs.scenarioSummary.innerHTML = `
      <h3>${t("ui.summary.title")}</h3>
      <p>${t("ui.summary.unifiedLead")}</p>
      <ul>
        <li><strong>${t("ui.summary.labelMethod")}</strong> ${getUnifiedMethodLabel(unified)} ${t("ui.summary.unifiedScenarioTag")}</li>
        <li><strong>${t("ui.summary.labelDKR", { d: unified.d, sumK: unified.sumK, loopbackCount: unified.loopbackCount })}</strong> ${t("ui.summary.unifiedDKR")}</li>
        <li><strong>${t("ui.summary.labelParallelInputs")}</strong> N=${inputLanes}, ${t("ui.summary.perLineFlow", { flow: formatNumber(flowPerLane, 4) })}.</li>
        <li><strong>${t("ui.summary.labelFlowsPerLane")}</strong> ${t("ui.summary.lineFlows", {
          flow: formatNumber(flowPerLane, 4),
          recirculatedFlow: formatNumber(unified.recirculatedFlow, 4),
          effectiveInput: formatNumber(unified.effectiveInput, 4)
        })}</li>
        ${renderImplementationDifficultyItem(chosen, depthLimit)}
        <li><strong>${t("ui.summary.labelDiagramReading")}</strong> ${t("ui.summary.unifiedReading")}</li>
      </ul>
    `;
    refs.scenarioSummary.classList.add("is-visible");
    return;
  }

  refs.scenarioSummary.innerHTML = `
    <h3>${t("ui.summary.title")}</h3>
    <p>${t("ui.summary.directLead")}</p>
    <ul>
      <li><strong>${t("ui.summary.labelMethod")}</strong> ${t("ui.summary.directMethod")}</li>
      <li><strong>${t("ui.summary.labelDepthLimit")}</strong> D=${depthLimit}.</li>
      <li><strong>${t("ui.summary.labelAnalyzedFlow")}</strong> F=${formatNumber(totalFlow, 4)}/min.</li>
      <li><strong>${t("ui.summary.labelParallelInputs")}</strong> N=${inputLanes}, ${t("ui.summary.perLineFlow", { flow: formatNumber(flowPerLane, 4) })}.</li>
      ${renderImplementationDifficultyItem(chosen, depthLimit)}
      <li><strong>${t("ui.summary.labelMaxObservedError")}</strong> ${formatNumber(maxError * 100, 4)}%.</li>
    </ul>
  `;
  refs.scenarioSummary.classList.add("is-visible");
}

export function renderResultsTable(refs, rows, documentLike = document) {
  refs.resultsBody.innerHTML = "";

  rows.forEach((row) => {
    const tr = documentLike.createElement("tr");
    const method = row.method || t("ui.methods.direct");
    const devices = row.devices ?? "-";

    tr.innerHTML = `
      <td>${row.name}</td>
      <td>${formatNumber(row.weight, 3)}</td>
      <td>${row.targetFractionText}</td>
      <td>${row.obtainedFractionText}</td>
      <td class="advanced-col">${method}</td>
      <td class="advanced-col">${devices}</td>
      <td class="advanced-col"><span class="pill ${row.exact ? "exact" : "approx"}">${row.exact ? t("ui.status.exact") : t("ui.status.approx")}</span></td>
      <td class="advanced-col">${formatNumber(row.error * 100, 4)}%</td>
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

  const {
    F,
    C,
    N_min,
    N_manual,
    N_aplicado,
    F_por_linha
  } = updateBeltPreview(refs);
  const D = Number.parseInt(refs.depthInput.value, 10);
  const normalizedFactories = appState.factories.map((factory, index) => ({
    name: factory.name?.trim() || getFactoryDefaultName(index),
    weight: parsePositiveFloat(factory.weight, 1)
  }));
  const weightSum = normalizedFactories.reduce((acc, factory) => acc + factory.weight, 0);

  if (!F || !Number.isFinite(F) || F <= 0 || !weightSum) {
    refs.validationNotice.className = "notice bad";
    refs.validationNotice.textContent = t("ui.validation.invalidInputs");
    if (refs.scenarioSummary) {
      refs.scenarioSummary.innerHTML = "";
      refs.scenarioSummary.classList.remove("is-visible");
    }
    refs.resultsBody.innerHTML = "";
    refs.diagramWrap.innerHTML = "";
    refs.maxErrorCard.textContent = t("common.nd");
    refs.parallelCard.textContent = String(N_aplicado || 0);
    refs.capCard.textContent = `${formatNumber(C, 0)}/min`;
    return null;
  }

  const chosen = chooseBestApproach(normalizedFactories, D, F_por_linha, {
    beltCapacity: C,
    inputLanes: N_aplicado,
    flowPerLane: F_por_linha
  });

  if (chosen.mode === "blocked") {
    const failures = Array.isArray(chosen.capacityFailures) ? chosen.capacityFailures : [];
    const topViolations = failures
      .flatMap((failure) => (failure.violations || []).map((violation) => ({
        mode: failure.mode,
        ...violation
      })))
      .slice(0, 4);
    const detailText = topViolations
      .map((violation) => (
        `${violation.mode}: ${violation.location} ` +
        `(${formatNumber(violation.flow, 4)}/min > ${formatNumber(violation.capacity, 4)}/min)`
      ))
      .join(" | ");

    refs.validationNotice.className = "notice bad";
    refs.validationNotice.textContent =
      `${t("ui.validation.blockedPrefix", {
        capacity: formatNumber(C, 4),
        nMin: N_min,
        nManual: N_manual,
        nApplied: N_aplicado,
        flowPerLane: formatNumber(F_por_linha, 4)
      })} ` +
      (detailText
        ? t("ui.validation.blockedExcess", { details: detailText })
        : t("ui.validation.blockedNoTopology"));

    refs.maxErrorCard.textContent = t("common.nd");
    refs.parallelCard.textContent = String(N_aplicado);
    refs.capCard.textContent = `${formatNumber(C, 0)}/min`;
    refs.resultsBody.innerHTML = "";
    refs.diagramWrap.innerHTML = "";

    renderScenarioSummary(refs, {
      chosen,
      totalFlow: F,
      depthLimit: D,
      maxError: 0,
      inputLanes: N_aplicado,
      flowPerLane: F_por_linha
    });

    return {
      chosen,
      results: [],
      normalizedFactories,
      totalObtainedFraction: 0,
      conservationError: 0,
      maxError: 0
    };
  }

  const unified = getUnifiedSolution(chosen);
  const usingUnified = chosen.mode === "unified" || chosen.mode === "recirculation";
  const results = usingUnified
    ? chosen.rows.map((row, index) => ({
        name: row.name,
        weight: row.weight,
        targetFractionText: row.targetFractionText,
        obtainedFractionText: row.obtainedFractionText,
        method: row.method,
        devices: row.devices,
        exact: true,
        error: 0,
        realFlow: row.realFlow * N_aplicado,
        diagramRealFlow: row.realFlow,
        color: getFactoryColor(index, chosen.rows.length)
      }))
    : chosen.rows.map((row, index) => {
        const color = getFactoryColor(index, chosen.rows.length);
        const targetFractionText = `${formatNumber(row.target * 100, 4)}%`;
        const obtainedFractionText =
          `${row.best.k}/${row.best.d} (${formatNumber(row.best.value * 100, 4)}%)`;
        const tree = buildDeviceTree(row.best, row.name, color, F_por_linha, index);

        return {
          name: row.name,
          weight: row.weight,
          targetFractionText,
          obtainedFractionText,
          method: t("ui.methods.direct"),
          devices: row.devices,
          exact: row.exact,
          error: row.error,
          realFlow: row.realFlow * N_aplicado,
          diagramRealFlow: row.realFlow,
          best: row.best,
          tree,
          color
        };
      });

  const totalObtainedFraction = usingUnified
    ? 1
    : chosen.rows.reduce((acc, row) => acc + row.best.value, 0);
  const conservationError = Math.abs(totalObtainedFraction - 1);
  const maxError = results.reduce((acc, row) => Math.max(acc, row.error), 0);

  refs.maxErrorCard.textContent = `${formatNumber(maxError * 100, 4)}%`;
  refs.parallelCard.textContent = String(N_aplicado);
  refs.capCard.textContent = `${formatNumber(C, 0)}/min`;

  if (usingUnified && unified) {
    refs.validationNotice.className = "notice good";
    refs.validationNotice.textContent = t("ui.validation.unifiedChosen", {
      method: getUnifiedMethodLabel(unified),
      d: unified.d,
      sumK: unified.sumK,
      loopbackCount: unified.loopbackCount,
      inputLanes: N_aplicado,
      flowPerLane: formatNumber(F_por_linha, 4),
      recirculatedFlow: formatNumber(unified.recirculatedFlow, 4),
      effectiveInput: formatNumber(unified.effectiveInput, 4)
    });
  } else if (conservationError < 1e-9) {
    refs.validationNotice.className = "notice good";
    refs.validationNotice.textContent = t("ui.validation.conservationOk", {
      inputLanes: N_aplicado,
      flowPerLane: formatNumber(F_por_linha, 4)
    });
  } else {
    const deficit = (1 - totalObtainedFraction) * F;
    const deficitLabel = deficit >= 0
      ? t("ui.validation.deficitUnallocated")
      : t("ui.validation.deficitExcess");
    refs.validationNotice.className = "notice warn";
    refs.validationNotice.textContent = t("ui.validation.conservationWarn", {
      obtainedPercent: formatNumber(totalObtainedFraction * 100, 4),
      errorPercent: formatNumber(conservationError * 100, 4),
      deficit: formatNumber(Math.abs(deficit), 4),
      deficitLabel,
      inputLanes: N_aplicado,
      flowPerLane: formatNumber(F_por_linha, 4)
    });
  }

  renderScenarioSummary(refs, {
    chosen,
    totalFlow: F,
    depthLimit: D,
    maxError,
    inputLanes: N_aplicado,
    flowPerLane: F_por_linha
  });
  renderResultsTable(refs, results, documentLike);
  renderDiagramsFn(refs, results, {
    mode: chosen.mode,
    unified,
    recirc: chosen.recirc || null,
    factories: normalizedFactories,
    totalFlow: F_por_linha,
    totalFlowGlobal: F,
    depthLimit: D,
    inputLanes: N_aplicado,
    flowPerLane: F_por_linha
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
    setAdvancedColumnsVisibility: (visible) => {
      appState.showAdvancedTableColumns = Boolean(visible);
      setAdvancedColumnsVisibility(refs, appState.showAdvancedTableColumns);
    },
    toggleAdvancedColumnsVisibility: () => {
      appState.showAdvancedTableColumns = !appState.showAdvancedTableColumns;
      setAdvancedColumnsVisibility(refs, appState.showAdvancedTableColumns);
    },
    renderFactoryRows: () => renderFactoryRows(refs, appState, documentLike),
    renderResultsTable: (rows) => renderResultsTable(refs, rows, documentLike),
    calculate: () => calculate(refs, { appState, renderDiagramsFn, documentLike }),
    refreshTranslations: () => {
      localizeDefaultFactoryNames(appState);
      setAdvancedColumnsVisibility(refs, appState.showAdvancedTableColumns);
      renderFactoryRows(refs, appState, documentLike);
      updateBeltPreview(refs);
      calculate(refs, { appState, renderDiagramsFn, documentLike });
    }
  };

  refs.factoryCount.addEventListener("change", api.applyFactoryCountFromInput);
  refs.calculateBtn.addEventListener("click", api.calculate);
  refs.depthInput.addEventListener("input", () => {
    refs.depthValue.textContent = refs.depthInput.value;
  });
  refs.beltType.addEventListener("change", api.updateBeltPreview);
  refs.flowInput.addEventListener("input", api.updateBeltPreview);
  if (refs.manualLanesInput) {
    refs.manualLanesInput.addEventListener("input", api.updateBeltPreview);
  }
  if (refs.toggleAdvancedColumnsBtn) {
    refs.toggleAdvancedColumnsBtn.addEventListener("click", api.toggleAdvancedColumnsVisibility);
  }

  refs.factoryCount.value = String(appState.factories.length);
  localizeDefaultFactoryNames(appState);
  api.setAdvancedColumnsVisibility(appState.showAdvancedTableColumns);
  api.renderFactoryRows();
  api.updateBeltPreview();
  api.calculate();

  return api;
}
