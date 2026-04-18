import { describe, expect, it } from "vitest";

import {
  countMergersForInputCount,
  chooseBestApproach,
  findBestFraction,
  findRecirculationSolution,
  gcdArray,
  gcdInt,
  normalizeWeightsToIntegerRatios
} from "../js/math.js";

describe("math helpers", () => {
  it("finds exact fractions with the expected denominator", () => {
    expect(findBestFraction(1 / 2, 4)).toMatchObject({ k: 1, d: 2, value: 0.5, error: 0 });
    expect(findBestFraction(1 / 3, 4)).toMatchObject({
      k: 1,
      d: 3,
      value: 1 / 3,
      error: 0
    });
    expect(findBestFraction(1 / 6, 4)).toMatchObject({
      k: 1,
      d: 6,
      value: 1 / 6,
      error: 0
    });
  });

  it("approximates one fifth within the configured depth", () => {
    const best = findBestFraction(1 / 5, 4);

    expect(best.error).toBeGreaterThan(0);
    expect(best.error).toBeLessThan(0.01);
    expect(best.value).toBeCloseTo(1 / 5, 2);
  });

  it("breaks ties using the smaller denominator", () => {
    const best = findBestFraction(3 / 4, 4);

    expect(best).toMatchObject({ k: 3, d: 4, error: 0 });
  });

  it("reduces integer ratios and guards small weights", () => {
    expect(gcdInt(24, 18)).toBe(6);
    expect(gcdArray([24, 18, 12])).toBe(6);
    expect(normalizeWeightsToIntegerRatios([
      { weight: 1.5 },
      { weight: 3 },
      { weight: 4.5 }
    ])).toEqual([1, 2, 3]);
    expect(normalizeWeightsToIntegerRatios([
      { weight: 0.00001 },
      { weight: 0.00002 }
    ])).toEqual([1, 1]);
  });

  it("counts merger cascades with a 3-input limit per block", () => {
    expect(countMergersForInputCount(0)).toBe(0);
    expect(countMergersForInputCount(1)).toBe(0);
    expect(countMergersForInputCount(2)).toBe(1);
    expect(countMergersForInputCount(3)).toBe(1);
    expect(countMergersForInputCount(4)).toBe(2);
    expect(countMergersForInputCount(5)).toBe(2);
    expect(countMergersForInputCount(6)).toBe(3);
  });
});

describe("recirculation search", () => {
  it("returns null when there are no factories", () => {
    expect(findRecirculationSolution([], 4, 60)).toBeNull();
  });

  it("finds an exact loop-back solution for five equal factories", () => {
    const factories = Array.from({ length: 5 }, (_, index) => ({
      name: `Fabrica ${index + 1}`,
      weight: 1
    }));

    const solution = findRecirculationSolution(factories, 4, 60);

    expect(solution).toMatchObject({
      mode: "recirculation",
      d: 6,
      sumK: 5,
      loopbackCount: 1,
      totalDevices: 5
    });
    expect(solution.recirculatedFlow).toBeCloseTo(12, 10);
    expect(solution.rows).toHaveLength(5);
    expect(solution.rows.every((row) => row.exact)).toBe(true);
    expect(solution.rows.map((row) => row.realFlow)).toEqual([12, 12, 12, 12, 12]);
    expect(solution.topology).toMatchObject({
      type: "sourceMerge",
      freshFlow: 60,
      recirculatedFlow: 12,
      effectiveFlow: 72
    });
    expect(solution.topology.child).toMatchObject({
      type: "splitter",
      div: 3,
      flowIn: 72
    });
  });

  it("normalizes weights 1,1,1,0.5 to the integer ratio 2,2,2,1", () => {
    const factories = [
      { name: "Fabrica 1", weight: 1 },
      { name: "Fabrica 2", weight: 1 },
      { name: "Fabrica 3", weight: 1 },
      { name: "Fabrica 4", weight: 0.5 }
    ];

    expect(normalizeWeightsToIntegerRatios(factories)).toEqual([2, 2, 2, 1]);
  });

  it("finds the exact 2,2,2,1 loop-back solution for weights 1,1,1,0.5", () => {
    const factories = [
      { name: "Fabrica 1", weight: 1 },
      { name: "Fabrica 2", weight: 1 },
      { name: "Fabrica 3", weight: 1 },
      { name: "Fabrica 4", weight: 0.5 }
    ];

    const solution = findRecirculationSolution(factories, 4, 60);

    expect(solution).toMatchObject({
      mode: "recirculation",
      d: 8,
      sumK: 7,
      kValues: [2, 2, 2, 1],
      loopbackCount: 1,
      totalDevices: 5
    });
    expect(solution.recirculatedFlow).toBeCloseTo(60 / 7, 10);
    expect(solution.effectiveInput).toBeCloseTo(480 / 7, 10);
    expect(solution.leafFlow).toBeCloseTo(60 / 7, 10);
    expect(solution.rows.map((row) => row.realFlow)).toEqual([
      120 / 7,
      120 / 7,
      120 / 7,
      60 / 7
    ]);
    expect(solution.topology).toMatchObject({
      type: "sourceMerge",
      freshFlow: 60,
      recirculatedFlow: 60 / 7,
      effectiveFlow: 480 / 7
    });
    expect(solution.topology.child).toMatchObject({
      type: "splitter",
      div: 2,
      flowIn: 480 / 7
    });

    const [leftHalf, rightHalf] = solution.topology.child.children;
    expect(leftHalf.children).toEqual([
      expect.objectContaining({ type: "factoryLeaf", factoryName: "Fabrica 1", flow: 120 / 7 }),
      expect.objectContaining({ type: "factoryLeaf", factoryName: "Fabrica 2", flow: 120 / 7 })
    ]);
    expect(rightHalf.children[0]).toMatchObject({
      type: "factoryLeaf",
      factoryName: "Fabrica 3",
      flow: 120 / 7
    });
    expect(rightHalf.children[1]).toMatchObject({
      type: "splitter",
      div: 2,
      flowIn: 120 / 7,
      children: [
        expect.objectContaining({ type: "factoryLeaf", factoryName: "Fabrica 4", flow: 60 / 7 }),
        expect.objectContaining({ type: "loopbackLeaf", flow: 60 / 7 })
      ]
    });
  });

  it("finds the exact 2:1 split for weights 1 and 0.5 without loop-back and with cascade device count", () => {
    const factories = [
      { name: "Fabrica 1", weight: 1 },
      { name: "Fabrica 2", weight: 0.5 }
    ];
    const solution = findRecirculationSolution(factories, 4, 60);

    expect(solution).toMatchObject({
      mode: "direct-exact",
      solutionFamily: "unified",
      unifiedKind: "exact",
      usesLoopback: false,
      d: 3,
      sumK: 3,
      kValues: [2, 1],
      loopbackCount: 0,
      totalDevices: 2
    });
    expect(solution.topology.type).toBe("splitter");
    expect(solution.rows.map((row) => row.realFlow)).toEqual([40, 20]);
  });

  it("finds the exact 5:4 split for weights 1 and 0.8 without loop-back and keeps merger count consistent", () => {
    const factories = [
      { name: "Fabrica 1", weight: 1 },
      { name: "Fabrica 2", weight: 0.8 }
    ];
    const solution = findRecirculationSolution(factories, 4, 60);

    expect(solution).toMatchObject({
      mode: "direct-exact",
      solutionFamily: "unified",
      unifiedKind: "exact",
      usesLoopback: false,
      d: 9,
      sumK: 9,
      kValues: [5, 4],
      loopbackCount: 0,
      totalDevices: 4
    });
    expect(solution.topology.type).toBe("splitter");
    expect(solution.rows.map((row) => row.realFlow)).toEqual([60 * (5 / 9), 60 * (4 / 9)]);
  });

  it("handles the 'leftover 10 returns to input' case without recursive compounding", () => {
    const factories = Array.from({ length: 5 }, (_, index) => ({
      name: `Fabrica ${index + 1}`,
      weight: 1
    }));
    const solution = findRecirculationSolution(factories, 4, 50);

    // Case requested: F=50, d=6, r=1 -> F_recirc must be 10 (not repeatedly re-summed).
    expect(solution.d).toBe(6);
    expect(solution.sumK).toBe(5);
    expect(solution.loopbackCount).toBe(1);
    expect(solution.recirculatedFlow).toBeCloseTo(10, 10);
    expect(solution.effectiveInput).toBeCloseTo(60, 10);
    expect(solution.leafFlow).toBeCloseTo(10, 10);
    expect(solution.rows.map((row) => row.realFlow)).toEqual([10, 10, 10, 10, 10]);
  });

  it("matches loop-back fixed-point balance and keeps finite flow values", () => {
    const factories = [
      { name: "Fabrica 1", weight: 1 },
      { name: "Fabrica 2", weight: 1 },
      { name: "Fabrica 3", weight: 1 },
      { name: "Fabrica 4", weight: 0.5 }
    ];
    const totalFlow = 60;
    const solution = findRecirculationSolution(factories, 4, totalFlow);

    // Fixed-point relation in steady state: F_recirc = (r/d) * E and E = F + F_recirc
    const recircFromEffective = (solution.loopbackCount / solution.d) * solution.effectiveInput;
    expect(solution.recirculatedFlow).toBeCloseTo(recircFromEffective, 10);
    expect(solution.effectiveInput).toBeCloseTo(totalFlow + solution.recirculatedFlow, 10);

    // Net flow delivered to factories must remain exactly F (no runaway recursive amplification).
    const deliveredFlow = solution.rows.reduce((acc, row) => acc + row.realFlow, 0);
    expect(deliveredFlow).toBeCloseTo(totalFlow, 10);

    expect(Number.isFinite(solution.recirculatedFlow)).toBe(true);
    expect(Number.isFinite(solution.effectiveInput)).toBe(true);
    expect(Number.isFinite(solution.leafFlow)).toBe(true);
  });

  it("remains stable across repeated calls (no stateful recursive accumulation)", () => {
    const factories = Array.from({ length: 5 }, (_, index) => ({
      name: `Fabrica ${index + 1}`,
      weight: 1
    }));

    const baseline = findRecirculationSolution(factories, 4, 50);
    for (let i = 0; i < 200; i += 1) {
      const next = findRecirculationSolution(factories, 4, 50);
      expect(next.recirculatedFlow).toBeCloseTo(baseline.recirculatedFlow, 12);
      expect(next.effectiveInput).toBeCloseTo(baseline.effectiveInput, 12);
      expect(next.rows.map((row) => row.realFlow)).toEqual(baseline.rows.map((row) => row.realFlow));
    }
  });
});

describe("approach selection", () => {
  it("stays with the direct approach when recirculation is unavailable", () => {
    const factories = Array.from({ length: 5 }, (_, index) => ({
      name: `Fabrica ${index + 1}`,
      weight: 1
    }));

    const result = chooseBestApproach(factories, 1, 60);

    expect(result.mode).toBe("direct");
    expect(result.rows).toHaveLength(5);
  });

  it("chooses recirculation when it provides an exact solution with fewer devices", () => {
    const factories = Array.from({ length: 5 }, (_, index) => ({
      name: `Fabrica ${index + 1}`,
      weight: 1
    }));

    const result = chooseBestApproach(factories, 4, 60);

    expect(result.mode).toBe("unified");
    expect(result.unifiedKind).toBe("loopback");
    expect(result.recirc).toMatchObject({
      d: 6,
      sumK: 5,
      loopbackCount: 1
    });
  });

  it("keeps the direct path for an already exact single-factory scenario", () => {
    const result = chooseBestApproach([{ name: "Fabrica 1", weight: 1 }], 4, 60);

    expect(result.mode).toBe("direct");
    expect(result.directConservation).toBe(0);
    expect(result.directMaxError).toBe(0);
  });

  it("chooses recirculation for weights 1,1,1,0.5 and preserves the exact outputs", () => {
    const factories = [
      { name: "Fabrica 1", weight: 1 },
      { name: "Fabrica 2", weight: 1 },
      { name: "Fabrica 3", weight: 1 },
      { name: "Fabrica 4", weight: 0.5 }
    ];

    const result = chooseBestApproach(factories, 4, 60);

    expect(result.mode).toBe("unified");
    expect(result.unifiedKind).toBe("loopback");
    expect(result.recirc).toMatchObject({
      d: 8,
      sumK: 7,
      loopbackCount: 1
    });
    expect(result.rows.map((row) => row.realFlow)).toEqual([
      120 / 7,
      120 / 7,
      120 / 7,
      60 / 7
    ]);
  });

  it("falls back to direct when recirculation exceeds belt capacity for the selected lane flow", () => {
    const factories = Array.from({ length: 5 }, (_, index) => ({
      name: `Fabrica ${index + 1}`,
      weight: 1
    }));

    const result = chooseBestApproach(factories, 4, 60, {
      beltCapacity: 60,
      inputLanes: 1,
      flowPerLane: 60
    });

    expect(result.mode).toBe("direct");
    expect(result.capacity.valid).toBe(true);
  });

  it("allows recirculation again when manual parallel inputs reduce per-line flow", () => {
    const factories = Array.from({ length: 5 }, (_, index) => ({
      name: `Fabrica ${index + 1}`,
      weight: 1
    }));

    const result = chooseBestApproach(factories, 4, 30, {
      beltCapacity: 60,
      inputLanes: 2,
      flowPerLane: 30
    });

    expect(result.mode).toBe("unified");
    expect(result.unifiedKind).toBe("loopback");
    expect(result.capacity.valid).toBe(true);
    expect(result.recirc.effectiveInput).toBeCloseTo(36, 10);
  });

  it("returns blocked when every strategy violates the per-line belt capacity", () => {
    const factories = [
      { name: "Fabrica 1", weight: 1 },
      { name: "Fabrica 2", weight: 1 }
    ];
    const result = chooseBestApproach(factories, 4, 120, {
      beltCapacity: 60,
      inputLanes: 1,
      flowPerLane: 120
    });

    expect(result.mode).toBe("blocked");
    expect(result.capacityBlocked).toBe(true);
    expect(result.capacityFailures.length).toBeGreaterThan(0);
  });

  it("chooses recirculation for weights 1 and 0.8 and uses cascade-aware device count", () => {
    const factories = [
      { name: "Fabrica 1", weight: 1 },
      { name: "Fabrica 2", weight: 0.8 }
    ];
    const result = chooseBestApproach(factories, 4, 60);

    expect(result.mode).toBe("unified");
    expect(result.unifiedKind).toBe("exact");
    expect(result.recirc).toMatchObject({
      d: 9,
      kValues: [5, 4],
      loopbackCount: 0,
      totalDevices: 4
    });
  });

  it("classifies three equal factories as a unified exact scenario without loop-back", () => {
    const factories = Array.from({ length: 3 }, (_, index) => ({
      name: `Fabrica ${index + 1}`,
      weight: 1
    }));

    const result = chooseBestApproach(factories, 4, 60);

    expect(result.mode).toBe("unified");
    expect(result.unifiedKind).toBe("exact");
    expect(result.recirc).toMatchObject({
      d: 3,
      sumK: 3,
      loopbackCount: 0,
      usesLoopback: false
    });
  });
});
