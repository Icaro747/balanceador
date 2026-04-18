import { beforeEach, describe, expect, it } from "vitest";

import {
  calculateThroughput,
  calculateThroughputPlan,
  createThroughputRefs,
  initThroughputApp
} from "../js/throughput.js";

function mountFixture() {
  document.body.innerHTML = `
    <section>
      <input id="throughputInputCount" type="number" value="2">
      <input id="throughputInputRate" type="number" value="60">
      <input id="throughputOutputCount" type="number" value="3">
      <input id="throughputOutputRate" type="number" value="40">
      <button id="throughputCalculateBtn" type="button">Calcular</button>
      <strong id="throughputInputCard"></strong>
      <strong id="throughputTargetCard"></strong>
      <strong id="throughputBalanceCard"></strong>
      <div id="throughputNotice"></div>
      <article id="throughputSummary" class="scenario-summary"></article>
      <table><tbody id="throughputResultsBody"></tbody></table>
    </section>
  `;
}

describe("throughput plan", () => {
  it("reports a balanced scenario when the total input matches the target output", () => {
    const result = calculateThroughputPlan({
      inputCount: 2,
      inputRate: 60,
      outputCount: 3,
      outputRate: 40
    });

    expect(result.status).toBe("balanced");
    expect(result.totalInputFlow).toBe(120);
    expect(result.totalTargetFlow).toBe(120);
    expect(result.balance).toBe(0);
    expect(result.requiredInputsAtCurrentRate).toBe(2);
  });

  it("reports the extra capacity when there is surplus flow", () => {
    const result = calculateThroughputPlan({
      inputCount: 3,
      inputRate: 60,
      outputCount: 2,
      outputRate: 40
    });

    expect(result.status).toBe("surplus");
    expect(result.surplus).toBe(100);
    expect(result.perOutputWithCurrentInputs).toBe(90);
    expect(result.maxOutputsAtTargetRate).toBe(4);
  });

  it("reports the missing capacity when there is shortage", () => {
    const result = calculateThroughputPlan({
      inputCount: 2,
      inputRate: 30,
      outputCount: 3,
      outputRate: 40
    });

    expect(result.status).toBe("shortage");
    expect(result.shortage).toBe(60);
    expect(result.requiredInputsAtCurrentRate).toBe(4);
    expect(result.requiredRatePerInput).toBe(60);
  });
});

describe("throughput ui", () => {
  beforeEach(() => {
    mountFixture();
  });

  it("renders the balanced state on startup", () => {
    const app = initThroughputApp(document);

    expect(app.refs.notice.className).toBe("notice good");
    expect(app.refs.notice.textContent).toContain("Fluxo fechado");
    expect(app.refs.resultsBody.children).toHaveLength(7);
  });

  it("renders the shortage state when the current inputs are insufficient", () => {
    const refs = createThroughputRefs(document);

    refs.inputRate.value = "30";
    const result = calculateThroughput(refs, document);

    expect(result.status).toBe("shortage");
    expect(refs.notice.className).toBe("notice bad");
    expect(refs.balanceCard.textContent).toContain("-60");
    expect(refs.summary.textContent).toContain("Entradas necessarias");
  });

  it("rejects invalid values and clears the result cards", () => {
    const refs = createThroughputRefs(document);

    refs.inputCount.value = "0";
    const result = calculateThroughput(refs, document);

    expect(result).toBeNull();
    expect(refs.notice.className).toBe("notice bad");
    expect(refs.inputCard.textContent).toBe("n/d");
    expect(refs.resultsBody.children).toHaveLength(0);
  });
});
