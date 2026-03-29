import { clamp, formatNumber } from "./utils.js";
import { buildMinimalRecirculationTopology, countMinimalTopologyDevices } from "./tree.js";

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

export function countDevicesForFraction(best) {
  const splitters = best.a + best.b;
  const merger = best.k > 1 ? 1 : 0;
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
  const recirculatedFlow = r > 0 ? (r * totalFlow) / sumK : 0;
  const effectiveInput = totalFlow + recirculatedFlow;
  const leafFlow = effectiveInput / bestDen.d;
  const solutionBase = {
    mode: r > 0 ? "recirculation" : "direct-exact",
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
      method: r > 0 ? "Recirculacao" : "Direta",
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

export function chooseBestApproach(factories, depthMax, totalFlow) {
  const weightSum = factories.reduce((acc, factory) => acc + factory.weight, 0);
  const directRows = factories.map((factory, index) => {
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

  const directTotalDevices = directRows.reduce((acc, row) => acc + row.devices, 0);
  const directAllExact = directRows.every((row) => row.exact);
  const directConservation = Math.abs(directRows.reduce((acc, row) => acc + row.best.value, 0) - 1);
  const directMaxError = directRows.reduce((acc, row) => Math.max(acc, row.error), 0);
  const recirc = findRecirculationSolution(factories, depthMax, totalFlow);

  if (!recirc) {
    return {
      mode: "direct",
      rows: directRows,
      directTotalDevices,
      directMaxError,
      directConservation
    };
  }

  const recircExact = true;
  const directExactGlobal = directAllExact && directConservation < 1e-9;
  const recircDevices = recirc.totalDevices;

  const preferRecirc =
    (recircExact && !directExactGlobal) ||
    (recircExact && directExactGlobal && recircDevices < directTotalDevices);

  if (preferRecirc) {
    return {
      mode: "recirculation",
      recirc,
      rows: recirc.rows
    };
  }

  return {
    mode: "direct",
    rows: directRows,
    directTotalDevices,
    directMaxError,
    directConservation
  };
}
