import { describe, expect, it } from "vitest";

import { planLaneAllocations, renderDiagrams } from "../js/diagram.js";
import { findRecirculationSolution } from "../js/math.js";

const ENTRY_WIDTH = 118;

function createRefs() {
  document.body.innerHTML = `<div id="diagramWrap"></div>`;
  return {
    diagramWrap: document.getElementById("diagramWrap")
  };
}

function createFactories(weights) {
  return weights.map((weight, index) => ({
    name: `Fabrica ${index + 1}`,
    weight
  }));
}

function renderRecirc(weights, options = {}) {
  const { inputLanes = 1, flowPerLane = null } = options;
  const refs = createRefs();
  const factories = createFactories(weights);
  const solution = findRecirculationSolution(factories, 4, 60);
  const results = solution.rows.map((row, index) => ({
    ...row,
    color: `hsl(${index * 67}deg 80% 65%)`
  }));

  renderDiagrams(refs, results, {
    mode: "unified",
    unified: solution,
    recirc: solution,
    factories,
    totalFlow: 60,
    inputLanes,
    flowPerLane: flowPerLane ?? 60
  });

  const svg = refs.diagramWrap.querySelector("svg");
  return { refs, factories, solution, svg };
}

function renderDirect(flows, options = {}) {
  const { inputLanes = 1, flowPerLane = null, depthLimit = 4 } = options;
  const refs = createRefs();
  const results = flows.map((flow, index) => ({
    name: `Fabrica ${index + 1}`,
    realFlow: flow,
    color: `hsl(${index * 67}deg 80% 65%)`,
    targetFractionText: "",
    obtainedFractionText: ""
  }));
  const totalFlowGlobal = flows.reduce((sum, flow) => sum + flow, 0);

  renderDiagrams(refs, results, {
    mode: "direct",
    recirc: null,
    factories: createFactories(flows.map(() => 1)),
    totalFlow: flowPerLane ?? totalFlowGlobal,
    totalFlowGlobal,
    inputLanes,
    flowPerLane: flowPerLane ?? totalFlowGlobal,
    depthLimit
  });

  const svg = refs.diagramWrap.querySelector("svg");
  return { refs, results, svg };
}

function parsePolygonCenter(pointsText) {
  const points = pointsText
    .trim()
    .split(/\s+/)
    .map((point) => point.split(",").map(Number));
  const sum = points.reduce((acc, [x, y]) => ({
    x: acc.x + x,
    y: acc.y + y
  }), { x: 0, y: 0 });
  return {
    x: sum.x / points.length,
    y: sum.y / points.length
  };
}

function getTopRootSplitterCenter(svg) {
  const splitters = Array.from(svg.querySelectorAll("polygon"))
    .filter((node) => node.getAttribute("fill") === "#fbbf24")
    .map((node) => ({
      node,
      center: parsePolygonCenter(node.getAttribute("points"))
    }));

  splitters.sort((a, b) => a.center.y - b.center.y);
  return splitters[0]?.center;
}

function getFinalRowRects(svg) {
  return Array.from(svg.querySelectorAll("rect")).filter((rect) => {
    const stroke = rect.getAttribute("stroke");
    const height = Number(rect.getAttribute("height"));
    return (stroke === "#0f172a" || stroke === "#65a30d") && height === 46;
  });
}

function assertNoHorizontalOverlap(rects, minGap = 8) {
  const boxes = rects
    .map((rect) => ({
      left: Number(rect.getAttribute("x")),
      right: Number(rect.getAttribute("x")) + Number(rect.getAttribute("width"))
    }))
    .sort((a, b) => a.left - b.left);

  for (let i = 1; i < boxes.length; i += 1) {
    const gap = boxes[i].left - boxes[i - 1].right;
    expect(gap).toBeGreaterThanOrEqual(minGap);
  }
}

function countExactText(svg, text) {
  return Array.from(svg.querySelectorAll("text"))
    .filter((node) => node.textContent === text)
    .length;
}

function getFinalFactoryRects(svg) {
  return Array.from(svg.querySelectorAll("rect")).filter((rect) => {
    const stroke = rect.getAttribute("stroke");
    const width = Number(rect.getAttribute("width"));
    const height = Number(rect.getAttribute("height"));
    return stroke === "#0f172a" && width === 148 && height === 46;
  });
}

function parsePathSegments(pathData) {
  const points = (pathData.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
  const segments = [];
  for (let i = 0; i + 3 < points.length; i += 2) {
    segments.push({
      x1: points[i],
      y1: points[i + 1],
      x2: points[i + 2],
      y2: points[i + 3]
    });
  }
  return segments;
}

function assertNoHorizontalSegmentOverlap(segments, tolerance = 1e-6) {
  const groups = new Map();
  segments.forEach((segment) => {
    if (Math.abs(segment.y1 - segment.y2) > tolerance) {
      return;
    }
    const yKey = Number(((segment.y1 + segment.y2) / 2).toFixed(3));
    const left = Math.min(segment.x1, segment.x2);
    const right = Math.max(segment.x1, segment.x2);
    const bucket = groups.get(yKey) || [];
    bucket.push({ left, right });
    groups.set(yKey, bucket);
  });

  groups.forEach((bucket) => {
    const sorted = bucket.sort((a, b) => a.left - b.left);
    let currentRight = Number.NEGATIVE_INFINITY;
    sorted.forEach((segment) => {
      const overlap = currentRight - segment.left;
      expect(overlap).toBeLessThanOrEqual(tolerance);
      currentRight = Math.max(currentRight, segment.right);
    });
  });
}

function collectHorizontalSegmentsByRoute(svg, routes) {
  const routeSet = new Set(routes);
  const paths = Array.from(svg.querySelectorAll("path[data-route]"))
    .filter((path) => routeSet.has(path.getAttribute("data-route")));
  return paths.flatMap((path) => (
    parsePathSegments(path.getAttribute("d") || "")
      .filter((segment) => Math.abs(segment.y1 - segment.y2) <= 1e-6)
  ));
}

function getFactoryFinalTrunkYValues(svg) {
  const finalPaths = Array.from(svg.querySelectorAll("path[data-route='factory-final']"));
  return finalPaths.map((path) => {
    const horizontal = parsePathSegments(path.getAttribute("d") || "")
      .find((segment) => Math.abs(segment.y1 - segment.y2) <= 1e-6);
    return horizontal ? Number(horizontal.y1.toFixed(6)) : null;
  }).filter((value) => value !== null);
}

describe("lane planner", () => {
  it("conserves total flow by lane and by factory", () => {
    const allocation = planLaneAllocations([30, 30, 30, 30], 2, 60);

    expect(allocation.remainingTotal).toBeLessThan(1e-8);
    expect(allocation.lanes.map((lane) => lane.totalFlow)).toEqual([60, 60]);

    const byFactory = new Map();
    allocation.lanes.forEach((lane) => {
      lane.segments.forEach((segment) => {
        const current = byFactory.get(segment.factoryIndex) || 0;
        byFactory.set(segment.factoryIndex, current + segment.flow);
      });
    });
    expect(Array.from(byFactory.values()).sort((a, b) => a - b)).toEqual([30, 30, 30, 30]);
  });

  it("splits one factory across multiple lanes when needed", () => {
    const allocation = planLaneAllocations([120], 2, 60);
    expect(allocation.lanes).toHaveLength(2);
    expect(allocation.lanes[0].segments[0]).toMatchObject({ factoryIndex: 0, flow: 60 });
    expect(allocation.lanes[1].segments[0]).toMatchObject({ factoryIndex: 0, flow: 60 });
  });
});

describe("recirculation diagrams layout", () => {
  it("keeps the hub centered on the root axis and keeps entry away from the extreme left corner", () => {
    const { svg } = renderRecirc([1, 1, 1, 0.5]);
    const texts = Array.from(svg.querySelectorAll("text"));
    const hub = texts.find((node) => node.textContent === "UNIFICADOR");
    const rootCenter = getTopRootSplitterCenter(svg);
    const entry = texts.find((node) => node.textContent === "ENTRADA NOVA");

    expect(hub).toBeTruthy();
    expect(rootCenter).toBeTruthy();
    expect(entry).toBeTruthy();

    const hubX = Number(hub.getAttribute("x"));
    const entryX = Number(entry.getAttribute("x"));
    const entryLeft = entryX - ENTRY_WIDTH / 2;

    expect(Math.abs(hubX - rootCenter.x)).toBeLessThan(1);
    expect(entryLeft).toBeGreaterThanOrEqual(40);
  });

  it("renders F, F_recirc and E and avoids final-row overlap for 1,1,1,0.5", () => {
    const { svg } = renderRecirc([1, 1, 1, 0.5]);
    const textValues = Array.from(svg.querySelectorAll("text")).map((node) => node.textContent);
    const finalRects = getFinalRowRects(svg);

    expect(textValues).toContain("F = 60/min");
    expect(textValues).toContain("E = 68,571/min");
    expect(textValues.some((text) => text.includes("F_recirc = 8,571"))).toBe(true);
    expect(finalRects.length).toBe(5);
    assertNoHorizontalOverlap(finalRects);
  });

  it("avoids final-row overlap for five equal factories (d=6, r=1)", () => {
    const { svg } = renderRecirc([1, 1, 1, 1, 1]);
    const finalRects = getFinalRowRects(svg);
    const textValues = Array.from(svg.querySelectorAll("text")).map((node) => node.textContent);

    expect(finalRects.length).toBe(6);
    expect(textValues).toContain("E = 72/min");
    assertNoHorizontalOverlap(finalRects);
  });

  it("collapses duplicated destination blocks for weights 1 and 0.5 and renders a factory merger", () => {
    const { refs, svg, solution } = renderRecirc([1, 0.5]);
    const finalRects = getFinalRowRects(svg);

    expect(solution.loopbackCount).toBe(0);
    expect(solution.topology.type).toBe("splitter");
    expect(refs.diagramWrap.textContent).toContain("arvore unificada exata, sem loop-back");
    expect(finalRects.length).toBe(2);
    expect(countExactText(svg, "Fabrica 1")).toBe(1);
    expect(countExactText(svg, "Fabrica 2")).toBe(1);
    expect(countExactText(svg, "UNIFICADOR")).toBe(2);
    assertNoHorizontalOverlap(finalRects);
  });

  it("collapses duplicated destination blocks for weights 1 and 0.8 and renders merger cascades", () => {
    const { svg, solution } = renderRecirc([1, 0.8]);
    const finalRects = getFinalRowRects(svg);

    expect(solution.loopbackCount).toBe(0);
    expect(solution.topology.type).toBe("splitter");
    expect(finalRects.length).toBe(2);
    expect(countExactText(svg, "Fabrica 1")).toBe(1);
    expect(countExactText(svg, "Fabrica 2")).toBe(1);
    expect(countExactText(svg, "UNIFICADOR")).toBe(3);
    assertNoHorizontalOverlap(finalRects);
  });

  it("renders explicit multiple entries in direct mode for 120/min into 4 equal factories", () => {
    const { svg } = renderDirect([30, 30, 30, 30], { inputLanes: 2, flowPerLane: 60 });
    const textValues = Array.from(svg.querySelectorAll("text")).map((node) => node.textContent);
    const splitterPolygons = Array.from(svg.querySelectorAll("polygon"))
      .filter((node) => node.getAttribute("fill") === "#fbbf24");

    expect(textValues).toContain("entrada 1");
    expect(textValues).toContain("entrada 2");
    expect(splitterPolygons.length).toBeGreaterThanOrEqual(2);
    expect(countExactText(svg, "Fabrica 1")).toBe(1);
    expect(countExactText(svg, "Fabrica 4")).toBe(1);
  });

  it("adds a merger when two entries feed a single factory", () => {
    const { svg } = renderDirect([120], { inputLanes: 2, flowPerLane: 60 });
    const textValues = Array.from(svg.querySelectorAll("text")).map((node) => node.textContent);

    expect(textValues).toContain("entrada 1");
    expect(textValues).toContain("entrada 2");
    expect(countExactText(svg, "UNIFICADOR")).toBeGreaterThanOrEqual(1);
    expect(countExactText(svg, "Fabrica 1")).toBe(1);
  });

  it("keeps staged/final routes separated and uses exclusive trunk levels in dense multi-entry mode", () => {
    const flows = Array.from({ length: 15 }, () => 4);
    const { svg } = renderDirect(flows, { inputLanes: 8, flowPerLane: 7.5, depthLimit: 4 });
    const finalFactoryRects = getFinalFactoryRects(svg);
    const finalConnectorPaths = Array.from(svg.querySelectorAll("path[data-route='factory-final']"));
    const trunkYValues = getFactoryFinalTrunkYValues(svg);

    for (let index = 1; index <= 8; index += 1) {
      expect(countExactText(svg, `entrada ${index}`)).toBe(1);
    }
    for (let index = 1; index <= 15; index += 1) {
      expect(countExactText(svg, `Fabrica ${index}`)).toBe(1);
    }
    expect(finalFactoryRects).toHaveLength(15);
    expect(finalConnectorPaths).toHaveLength(15);
    expect(new Set(trunkYValues).size).toBe(15);
    assertNoHorizontalOverlap(finalFactoryRects);

    const horizontalAggSegments = collectHorizontalSegmentsByRoute(svg, ["factory-merge", "factory-final"]);
    assertNoHorizontalSegmentOverlap(horizontalAggSegments);
  });

  it("highlights immediate connections on hover in multi-entry and clears on pointerout", () => {
    const flows = Array.from({ length: 15 }, () => 4);
    const { svg } = renderDirect(flows, { inputLanes: 8, flowPerLane: 7.5, depthLimit: 4 });
    const node = svg.querySelector("[data-node-id]");

    expect(node).toBeTruthy();
    expect(svg.querySelectorAll(".flow-edge").length).toBeGreaterThan(1);

    node.dispatchEvent(new Event("pointerover", { bubbles: true }));
    expect(svg.classList.contains("diagram-highlight-active")).toBe(true);
    expect(svg.querySelectorAll(".flow-edge.is-active").length).toBeGreaterThan(0);
    expect(svg.querySelectorAll(".flow-edge.is-dimmed").length).toBeGreaterThan(0);

    node.dispatchEvent(new Event("pointerout", { bubbles: true }));
    expect(svg.classList.contains("diagram-highlight-active")).toBe(false);
    expect(svg.querySelectorAll(".flow-edge.is-active").length).toBe(0);
    expect(svg.querySelectorAll(".flow-edge.is-dimmed").length).toBe(0);
  });

  it("highlights immediate connections on hover in recirculation diagrams", () => {
    const { svg } = renderRecirc([1, 1, 1, 0.5]);
    const node = svg.querySelector("[data-node-id]");

    expect(node).toBeTruthy();
    expect(svg.querySelectorAll(".flow-edge").length).toBeGreaterThan(1);

    node.dispatchEvent(new Event("pointerover", { bubbles: true }));
    expect(svg.classList.contains("diagram-highlight-active")).toBe(true);
    expect(svg.querySelectorAll(".flow-edge.is-active").length).toBeGreaterThan(0);
    expect(svg.querySelectorAll(".flow-edge.is-dimmed").length).toBeGreaterThan(0);

    node.dispatchEvent(new Event("pointerout", { bubbles: true }));
    expect(svg.classList.contains("diagram-highlight-active")).toBe(false);
  });
});
