import { formatNumber, parsePositiveFloat } from "./utils.js";
import { t } from "./i18n/index.js";

function parsePositiveInt(value, fallback = 1) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function createThroughputRefs(documentLike = document) {
  return {
    inputCount: documentLike.getElementById("throughputInputCount"),
    inputRate: documentLike.getElementById("throughputInputRate"),
    outputCount: documentLike.getElementById("throughputOutputCount"),
    outputRate: documentLike.getElementById("throughputOutputRate"),
    calculateBtn: documentLike.getElementById("throughputCalculateBtn"),
    inputCard: documentLike.getElementById("throughputInputCard"),
    targetCard: documentLike.getElementById("throughputTargetCard"),
    balanceCard: documentLike.getElementById("throughputBalanceCard"),
    notice: documentLike.getElementById("throughputNotice"),
    summary: documentLike.getElementById("throughputSummary"),
    resultsBody: documentLike.getElementById("throughputResultsBody")
  };
}

export function readThroughputInputs(refs) {
  const rawInputCount = Number.parseInt(refs.inputCount?.value ?? "", 10);
  const rawOutputCount = Number.parseInt(refs.outputCount?.value ?? "", 10);
  const rawInputRate = Number.parseFloat(refs.inputRate?.value ?? "");
  const rawOutputRate = Number.parseFloat(refs.outputRate?.value ?? "");

  const valid = (
    Number.isFinite(rawInputCount) && rawInputCount > 0 &&
    Number.isFinite(rawOutputCount) && rawOutputCount > 0 &&
    Number.isFinite(rawInputRate) && rawInputRate > 0 &&
    Number.isFinite(rawOutputRate) && rawOutputRate > 0
  );

  return {
    valid,
    inputCount: parsePositiveInt(refs.inputCount?.value, 1),
    inputRate: parsePositiveFloat(refs.inputRate?.value, 0),
    outputCount: parsePositiveInt(refs.outputCount?.value, 1),
    outputRate: parsePositiveFloat(refs.outputRate?.value, 0)
  };
}

export function calculateThroughputPlan(inputs) {
  const totalInputFlow = inputs.inputCount * inputs.inputRate;
  const totalTargetFlow = inputs.outputCount * inputs.outputRate;
  const balance = totalInputFlow - totalTargetFlow;
  const shortage = Math.max(0, -balance);
  const surplus = Math.max(0, balance);
  const perOutputWithCurrentInputs = totalInputFlow / inputs.outputCount;
  const requiredInputsAtCurrentRate = Math.ceil(totalTargetFlow / inputs.inputRate);
  const requiredRatePerInput = totalTargetFlow / inputs.inputCount;
  const maxOutputsAtTargetRate = Math.floor(totalInputFlow / inputs.outputRate);
  const utilization = totalTargetFlow / totalInputFlow;
  let status = "balanced";

  if (balance > 1e-9) {
    status = "surplus";
  } else if (balance < -1e-9) {
    status = "shortage";
  }

  return {
    ...inputs,
    status,
    totalInputFlow,
    totalTargetFlow,
    balance,
    shortage,
    surplus,
    perOutputWithCurrentInputs,
    requiredInputsAtCurrentRate,
    requiredRatePerInput,
    maxOutputsAtTargetRate,
    utilization
  };
}

function renderThroughputSummary(refs, result) {
  refs.summary.classList.add("is-visible");

  if (result.status === "balanced") {
    refs.summary.innerHTML = `
      <h3>${t("throughputUi.summaryBalancedTitle")}</h3>
      <p>${t("throughputUi.summaryBalancedLead")}</p>
      <ul>
        <li><strong>${t("throughputUi.summaryBalancedInputs")}</strong> ${result.inputCount} x ${formatNumber(result.inputRate, 4)}/min.</li>
        <li><strong>${t("throughputUi.summaryBalancedOutputs")}</strong> ${result.outputCount} x ${formatNumber(result.outputRate, 4)}/min.</li>
        <li><strong>${t("throughputUi.summaryBalancedPractical")}</strong> ${t("throughputUi.summaryBalancedPracticalValue")}</li>
      </ul>
    `;
    return;
  }

  if (result.status === "surplus") {
    refs.summary.innerHTML = `
      <h3>${t("throughputUi.summarySurplusTitle")}</h3>
      <p>${t("throughputUi.summarySurplusLead")}</p>
      <ul>
        <li><strong>${t("throughputUi.summarySurplusTotal")}</strong> ${formatNumber(result.surplus, 4)}/min.</li>
        <li><strong>${t("throughputUi.summarySurplusPerOutput", { outputCount: result.outputCount })}</strong> ${formatNumber(result.perOutputWithCurrentInputs, 4)}/min.</li>
        <li><strong>${t("throughputUi.summarySurplusMaxOutputs", { outputRate: formatNumber(result.outputRate, 4) })}</strong> ${result.maxOutputsAtTargetRate}.</li>
      </ul>
    `;
    return;
  }

  refs.summary.innerHTML = `
    <h3>${t("throughputUi.summaryShortageTitle")}</h3>
    <p>${t("throughputUi.summaryShortageLead")}</p>
    <ul>
      <li><strong>${t("throughputUi.summaryShortageTotal")}</strong> ${formatNumber(result.shortage, 4)}/min.</li>
      <li><strong>${t("throughputUi.summaryShortageRequiredInputs", { inputRate: formatNumber(result.inputRate, 4) })}</strong> ${result.requiredInputsAtCurrentRate}.</li>
      <li><strong>${t("throughputUi.summaryShortageRequiredRate", { inputCount: result.inputCount })}</strong> ${formatNumber(result.requiredRatePerInput, 4)}/min.</li>
    </ul>
  `;
}

export function renderThroughputResult(refs, result, documentLike = document) {
  refs.inputCard.textContent = `${formatNumber(result.totalInputFlow, 4)}/min`;
  refs.targetCard.textContent = `${formatNumber(result.totalTargetFlow, 4)}/min`;

  if (result.status === "balanced") {
    refs.notice.className = "notice good";
    refs.notice.textContent = t("throughputUi.noticeBalanced", {
      inputCount: result.inputCount,
      inputRate: formatNumber(result.inputRate, 4),
      outputCount: result.outputCount,
      outputRate: formatNumber(result.outputRate, 4)
    });
    refs.balanceCard.textContent = "0/min";
  } else if (result.status === "surplus") {
    refs.notice.className = "notice warn";
    refs.notice.textContent = t("throughputUi.noticeSurplus", {
      surplus: formatNumber(result.surplus, 4),
      outputCount: result.outputCount,
      perOutput: formatNumber(result.perOutputWithCurrentInputs, 4)
    });
    refs.balanceCard.textContent = `+${formatNumber(result.surplus, 4)}/min`;
  } else {
    refs.notice.className = "notice bad";
    refs.notice.textContent = t("throughputUi.noticeShortage", {
      shortage: formatNumber(result.shortage, 4),
      requiredInputs: result.requiredInputsAtCurrentRate,
      inputRate: formatNumber(result.inputRate, 4),
      requiredRate: formatNumber(result.requiredRatePerInput, 4)
    });
    refs.balanceCard.textContent = `-${formatNumber(result.shortage, 4)}/min`;
  }

  renderThroughputSummary(refs, result);

  const rows = [
    [t("throughput.rowTotalInputFlow"), `${formatNumber(result.totalInputFlow, 4)}/min`],
    [t("throughput.rowTotalTargetFlow"), `${formatNumber(result.totalTargetFlow, 4)}/min`],
    [t("throughput.rowPerOutput"), `${formatNumber(result.perOutputWithCurrentInputs, 4)}/min`],
    [t("throughput.rowRequiredInputs"), String(result.requiredInputsAtCurrentRate)],
    [t("throughput.rowRequiredInputRate"), `${formatNumber(result.requiredRatePerInput, 4)}/min`],
    [t("throughput.rowMaxOutputs"), String(result.maxOutputsAtTargetRate)],
    [t("throughput.rowUtilization"), `${formatNumber(result.utilization * 100, 2)}%`]
  ];

  refs.resultsBody.innerHTML = "";
  rows.forEach(([label, value]) => {
    const tr = documentLike.createElement("tr");
    tr.innerHTML = `<td>${label}</td><td>${value}</td>`;
    refs.resultsBody.appendChild(tr);
  });
}

export function renderThroughputInvalidState(refs) {
  refs.notice.className = "notice bad";
  refs.notice.textContent = t("throughputUi.invalidInputs");
  refs.inputCard.textContent = t("common.nd");
  refs.targetCard.textContent = t("common.nd");
  refs.balanceCard.textContent = t("common.nd");
  refs.resultsBody.innerHTML = "";
  refs.summary.classList.remove("is-visible");
  refs.summary.innerHTML = "";
}

export function calculateThroughput(refs, documentLike = document) {
  const inputs = readThroughputInputs(refs);
  if (!inputs.valid) {
    renderThroughputInvalidState(refs);
    return null;
  }

  const result = calculateThroughputPlan(inputs);
  renderThroughputResult(refs, result, documentLike);
  return result;
}

export function initThroughputApp(documentLike = document) {
  const refs = createThroughputRefs(documentLike);

  if (!refs.inputCount || !refs.inputRate || !refs.outputCount || !refs.outputRate || !refs.calculateBtn) {
    return null;
  }

  const calculateCurrentScenario = () => calculateThroughput(refs, documentLike);

  refs.calculateBtn.addEventListener("click", calculateCurrentScenario);
  refs.inputCount.addEventListener("input", calculateCurrentScenario);
  refs.inputRate.addEventListener("input", calculateCurrentScenario);
  refs.outputCount.addEventListener("input", calculateCurrentScenario);
  refs.outputRate.addEventListener("input", calculateCurrentScenario);

  calculateCurrentScenario();

  return {
    refs,
    calculate: calculateCurrentScenario,
    refreshTranslations: calculateCurrentScenario
  };
}
