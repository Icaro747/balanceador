import { describe, expect, it } from "vitest";

import { renderDiagrams } from "../js/diagram.js";
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

function renderRecirc(weights) {
  const refs = createRefs();
  const factories = createFactories(weights);
  const solution = findRecirculationSolution(factories, 4, 60);
  const results = solution.rows.map((row, index) => ({
    ...row,
    color: `hsl(${index * 67}deg 80% 65%)`
  }));

  renderDiagrams(refs, results, {
    mode: "recirculation",
    recirc: solution,
    factories,
    totalFlow: 60
  });

  const svg = refs.diagramWrap.querySelector("svg");
  return { refs, factories, solution, svg };
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
});
