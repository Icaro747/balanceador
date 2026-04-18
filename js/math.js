import { clamp, formatNumber } from "./utils.js";
import { buildMinimalRecirculationTopology, countMinimalTopologyDevices } from "./tree.js";
import { t } from "./i18n/index.js";

export function findBestFraction(target, depthMax) {
  let best = null;
  const tolerance = 1e-12;

  for (let a = 0; a <= depthMax; a += 1) {
    for (let b = 0; b <= depthMax - a; b += 1) {
      const d = (2 ** a) * (3 ** b);
      const kRaw = Math.round(target * d);
      const k = clamp(kRaw, 0, d);
      const value = k / d;
      const error = Math.abs(value - target);

      if (!best) {
        best = { a, b, d, k, value, error };
        continue;
      }

      const sameError = Math.abs(error - best.error) < tolerance;
      if (
        error < best.error - tolerance ||
        (sameError && d < best.d) ||
        (sameError && d === best.d && a + b < best.a + best.b)
      ) {
        best = { a, b, d, k, value, error };
      }
    }
  }

  return best;
}

export function gcdInt(a, b) {
  let x = Math.abs(Math.trunc(a));
  let y = Math.abs(Math.trunc(b));
  while (y !== 0) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x || 1;
}

export function gcdArray(values) {
  return values.reduce((acc, value) => gcdInt(acc, value), 0) || 1;
}

export function normalizeWeightsToIntegerRatios(factories) {
  const SCALE = 1000;
  const ints = factories.map((factory) => Math.max(1, Math.round(factory.weight * SCALE)));
  const g = gcdArray(ints);
  return ints.map((value) => Math.max(1, Math.trunc(value / g)));
}

export function countMergersForInputCount(inputCount) {
  const n = Math.max(0, Math.trunc(inputCount));
  if (n <= 1) {
    return 0;
  }
  return Math.ceil((n - 1) / 2);
}

export function countDevicesForFraction(best) {
  const splitters = best.a + best.b;
  const merger = countMergersForInputCount(best.k);
  return splitters + merger;
}

export function findRecirculationSolution(factories, depthMax, totalFlow) {
  if (!factories.length) {
    return null;
  }

  const kValues = normalizeWeightsToIntegerRatios(factories);
  const sumK = kValues.reduce((acc, value) => acc + value, 0);
  const weightSum = factories.reduce((acc, factory) => acc + factory.weight, 0);
  let bestDen = null;

  for (let a = 0; a <= depthMax; a += 1) {
    for (let b = 0; b <= depthMax - a; b += 1) {
      const d = (2 ** a) * (3 ** b);
      if (d < sumK) {
        continue;
      }
      const devices = a + b;
      if (
        !bestDen ||
        d < bestDen.d ||
        (d === bestDen.d && devices < bestDen.devices)
      ) {
        bestDen = { a, b, d, devices };
      }
    }
  }

  if (!bestDen) {
    return null;
  }

  const r = bestDen.d - sumK;
  const usesLoopback = r > 0;
  const recirculatedFlow = usesLoopback ? (r * totalFlow) / sumK : 0;
  const effectiveInput = totalFlow + recirculatedFlow;
  const leafFlow = effectiveInput / bestDen.d;
  const solutionBase = {
    mode: usesLoopback ? "recirculation" : "direct-exact",
    solutionFamily: "unified",
    renderMode: "scenario-unified",
    usesLoopback,
    unifiedKind: usesLoopback ? "loopback" : "exact",
    a: bestDen.a,
    b: bestDen.b,
    d: bestDen.d,
    kValues,
    sumK,
    loopbackCount: r,
    recirculatedFlow,
    effectiveInput,
    leafFlow
  };
  const topology = buildMinimalRecirculationTopology(solutionBase, factories, totalFlow);
  const totalDevices = countMinimalTopologyDevices(topology);

  const rows = factories.map((factory, index) => {
    const k = kValues[index];
    const value = k / sumK;
    const target = factory.weight / weightSum;
    return {
      name: factory.name,
      weight: factory.weight,
      target,
      targetFractionText: `${formatNumber(target * 100, 4)}%`,
      obtainedFractionText: `${k}/${sumK} (${formatNumber(value * 100, 4)}%)`,
      method: usesLoopback ? t("math.methodRecirculation") : t("math.methodUnifiedExact"),
      devices: totalDevices,
      exact: true,
      error: 0,
      realFlow: totalFlow * value,
      k,
      denominator: sumK
    };
  });

  return {
    ...solutionBase,
    topology,
    rows,
    totalDevices
  };
}

function collectDirectRows(factories, depthMax, totalFlow) {
  const weightSum = factories.reduce((acc, factory) => acc + factory.weight, 0);
  return factories.map((factory, index) => {
    const target = factory.weight / weightSum;
    const best = findBestFraction(target, depthMax);
    const exact = best.error < 1e-12;
    return {
      index,
      name: factory.name,
      weight: factory.weight,
      target,
      best,
      exact,
      error: best.error,
      realFlow: best.value * totalFlow,
      devices: countDevicesForFraction(best)
    };
  });
}

function pushCapacityViolation(violations, strategy, location, flow, capacity) {
  if (!Number.isFinite(flow) || !Number.isFinite(capacity)) {
    return;
  }
  if (flow <= capacity + 1e-9) {
    return;
  }
  violations.push({
    strategy,
    location,
    flow,
    capacity,
    overflow: flow - capacity
  });
}

function validateDirectCapacity(rows, beltCapacity, flowPerLane) {
  if (!Number.isFinite(beltCapacity) || beltCapacity <= 0) {
    return { valid: true, violations: [] };
  }

  const violations = [];
  pushCapacityViolation(violations, "direct", t("math.directEntry"), flowPerLane, beltCapacity);
  rows.forEach((row) => {
    pushCapacityViolation(
      violations,
      "direct",
      t("math.finalLinkToFactory", { factoryName: row.name }),
      row.realFlow,
      beltCapacity
    );
  });
  return {
    valid: violations.length === 0,
    violations
  };
}

function validateRecirculationCapacity(recirc, beltCapacity) {
  if (!recirc || !Number.isFinite(beltCapacity) || beltCapacity <= 0) {
    return { valid: true, violations: [] };
  }

  const violations = [];
  const topology = recirc.topology;
  const root = topology?.type === "sourceMerge" ? topology.child : topology;

  if (topology?.type === "sourceMerge") {
    pushCapacityViolation(
      violations,
      "recirculation",
      t("math.mainMergerFreshInput"),
      topology.freshFlow,
      beltCapacity
    );
    pushCapacityViolation(
      violations,
      "recirculation",
      t("math.mainMergerLoopbackReturn"),
      topology.recirculatedFlow,
      beltCapacity
    );
    pushCapacityViolation(
      violations,
      "recirculation",
      t("math.mainMergerOutput"),
      topology.effectiveFlow,
      beltCapacity
    );

    if (Array.isArray(topology.factoryMergers)) {
      topology.factoryMergers.forEach((merger) => {
        pushCapacityViolation(
          violations,
          "recirculation",
          t("math.factoryMergerOutput", { factoryName: merger.factoryName }),
          merger.flow,
          beltCapacity
        );
      });
    }
  }

  function visit(node, pathLabel) {
    if (!node) {
      return;
    }

    if (node.type === "splitter") {
      pushCapacityViolation(
        violations,
        "recirculation",
        t("math.splitterInput", { path: pathLabel }),
        node.flowIn,
        beltCapacity
      );
      pushCapacityViolation(
        violations,
        "recirculation",
        t("math.splitterOutput", { path: pathLabel }),
        node.flowOutPerChild,
        beltCapacity
      );
      node.children.forEach((child, index) => {
        visit(child, t("math.splitterBranchSegment", { path: pathLabel, index: index + 1 }));
      });
      return;
    }

    if (node.type === "factoryLeaf") {
      pushCapacityViolation(
        violations,
        "recirculation",
        t("math.finalLinkToFactory", { factoryName: node.factoryName }),
        node.flow,
        beltCapacity
      );
      return;
    }

    if (node.type === "loopbackLeaf") {
      pushCapacityViolation(
        violations,
        "recirculation",
        t("math.loopbackLink"),
        node.flow,
        beltCapacity
      );
    }
  }

  visit(root, t("math.splitterRoot"));
  return {
    valid: violations.length === 0,
    violations
  };
}

function compareCandidates(left, right) {
  if (left.exactGlobal !== right.exactGlobal) {
    return left.exactGlobal ? -1 : 1;
  }

  if (Math.abs(left.maxError - right.maxError) > 1e-12) {
    return left.maxError - right.maxError;
  }

  if (left.totalDevices !== right.totalDevices) {
    return left.totalDevices - right.totalDevices;
  }

  if (left.mode === right.mode) {
    return 0;
  }

  return left.mode === "direct" ? -1 : 1;
}

export function chooseBestApproach(factories, depthMax, totalFlow, options = {}) {
  const {
    beltCapacity = Number.POSITIVE_INFINITY,
    inputLanes = 1,
    flowPerLane = totalFlow
  } = options;

  const normalizedFlowPerLane = Number.isFinite(flowPerLane) && flowPerLane > 0
    ? flowPerLane
    : totalFlow;
  const normalizedInputLanes = Math.max(1, Math.trunc(inputLanes || 1));
  const directRows = collectDirectRows(factories, depthMax, normalizedFlowPerLane);
  const directTotalDevices = directRows.reduce((acc, row) => acc + row.devices, 0);
  const directAllExact = directRows.every((row) => row.exact);
  const directConservation = Math.abs(directRows.reduce((acc, row) => acc + row.best.value, 0) - 1);
  const directMaxError = directRows.reduce((acc, row) => Math.max(acc, row.error), 0);
  const directCapacity = validateDirectCapacity(directRows, beltCapacity, normalizedFlowPerLane);
  const recirc = findRecirculationSolution(factories, depthMax, normalizedFlowPerLane);
  const recircCapacity = validateRecirculationCapacity(recirc, beltCapacity);

  const directCandidate = {
    mode: "direct",
    exactGlobal: directAllExact && directConservation < 1e-9,
    maxError: directMaxError,
    totalDevices: directTotalDevices,
    validCapacity: directCapacity.valid,
    renderMode: normalizedInputLanes > 1 ? "multi-entry-unified" : "per-factory"
  };
  const recircCandidate = recirc
    ? {
        mode: "unified",
        exactGlobal: true,
        maxError: 0,
        totalDevices: recirc.totalDevices,
        validCapacity: recircCapacity.valid,
        renderMode: "scenario-unified"
      }
    : null;

  const validCandidates = [directCandidate, recircCandidate]
    .filter(Boolean)
    .filter((candidate) => candidate.validCapacity);

  if (validCandidates.length === 0) {
    const failures = [];
    if (directCapacity.violations.length > 0) {
      failures.push({
        mode: "direct",
        violations: directCapacity.violations
      });
    }
    if (recircCapacity.violations.length > 0) {
      failures.push({
        mode: "recirculation",
        violations: recircCapacity.violations
      });
    }

    return {
      mode: "blocked",
      rows: [],
      capacityBlocked: true,
      capacityFailures: failures,
      beltCapacity,
      inputLanes: normalizedInputLanes,
      flowPerLane: normalizedFlowPerLane
    };
  }

  validCandidates.sort(compareCandidates);
  const winner = validCandidates[0];

  if (winner.mode === "unified" && recirc) {
    return {
      mode: "unified",
      unifiedKind: recirc.unifiedKind,
      renderMode: "scenario-unified",
      unified: recirc,
      recirc,
      rows: recirc.rows,
      beltCapacity,
      inputLanes: normalizedInputLanes,
      flowPerLane: normalizedFlowPerLane,
      capacity: recircCapacity
    };
  }

  return {
    mode: "direct",
    renderMode: directCandidate.renderMode,
    rows: directRows,
    directTotalDevices,
    directMaxError,
    directConservation,
    beltCapacity,
    inputLanes: normalizedInputLanes,
    flowPerLane: normalizedFlowPerLane,
    capacity: directCapacity
  };
}
