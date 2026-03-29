import { formatNumber } from "./utils.js";
import {
  buildMinimalRecirculationTopology,
  buildUnifiedRecirculationTree,
  collectLeafSlots,
  measureSplitTree,
  layoutSplitTree
} from "./tree.js";

const DIAG = {
  diamondR: 28,
  entryW: 118,
  entryH: 42,
  leafW: 82,
  leafH: 38,
  mergerW: 112,
  mergerH: 42,
  factoryW: 148,
  factoryH: 46,
  unitW: 92,
  levelDy: 100,
  marginL: 18,
  marginT: 56,
  entryGap: 28
};

function createSvgElement(name, attrs = {}) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", name);
  Object.entries(attrs).forEach(([key, value]) => {
    el.setAttribute(key, String(value));
  });
  return el;
}

function childConnectorTopY(child) {
  if (child.type === "splitter") {
    return child.cy - DIAG.diamondR;
  }
  return child.cy - DIAG.leafH / 2;
}

function addPath(svg, d, markerId) {
  const path = createSvgElement("path", {
    d,
    fill: "none",
    stroke: "#cbd5e1",
    "stroke-width": 1.65,
    "marker-end": `url(#${markerId})`
  });
  svg.appendChild(path);
}

function addEdgeLabel(svg, x, y, text) {
  const fontSize = 10;
  const approxChar = fontSize * 0.55;
  const w = Math.max(32, text.length * approxChar + 10);
  const h = 16;
  const rx = 4;
  svg.appendChild(
    createSvgElement("rect", {
      x: x - w / 2,
      y: y - 12,
      width: w,
      height: h,
      rx,
      ry: rx,
      fill: "rgba(10, 15, 22, 0.92)"
    })
  );
  const t = createSvgElement("text", {
    x,
    y,
    fill: "#94a3b8",
    "font-size": fontSize,
    "text-anchor": "middle"
  });
  t.textContent = text;
  svg.appendChild(t);
}

function drawSplitterBranchEdges(svg, splitter, markerId) {
  const px = splitter.cx;
  const py = splitter.cy;
  const y1 = py + DIAG.diamondR;
  splitter.children.forEach((child) => {
    const x2 = child.cx;
    const y2 = childConnectorTopY(child);
    const midY = (y1 + y2) / 2;
    const d = `M ${px} ${y1} L ${px} ${midY} L ${x2} ${midY} L ${x2} ${y2}`;
    addPath(svg, d, markerId);
    addEdgeLabel(svg, x2, midY - 6, `${formatNumber(splitter.flowOutPerChild, 3)}/min`);
    if (child.type === "splitter") {
      drawSplitterBranchEdges(svg, child, markerId);
    }
  });
}

function drawDiamondSplitter(svg, node) {
  const { cx, cy } = node;
  const r = DIAG.diamondR;
  const points = `${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`;
  const poly = createSvgElement("polygon", {
    points,
    fill: "#fbbf24",
    stroke: "#b45309",
    "stroke-width": 2
  });
  svg.appendChild(poly);
  const t1 = createSvgElement("text", {
    x: cx,
    y: cy - 4,
    "text-anchor": "middle",
    fill: "#1c1917",
    "font-size": 13,
    "font-weight": 800
  });
  t1.textContent = `÷${node.div}`;
  svg.appendChild(t1);
  const t2 = createSvgElement("text", {
    x: cx,
    y: cy + 12,
    "text-anchor": "middle",
    fill: "#292524",
    "font-size": 10,
    "font-weight": 600
  });
  t2.textContent = `${formatNumber(node.flowIn, 3)}/min`;
  svg.appendChild(t2);
}

function drawRoundedBlock(svg, x, y, w, h, rx, fill, stroke, line1, line2, line1Fill, line2Fill) {
  svg.appendChild(
    createSvgElement("rect", {
      x,
      y,
      width: w,
      height: h,
      rx,
      ry: rx,
      fill,
      stroke,
      "stroke-width": 1.6
    })
  );
  svg.appendChild(
    createSvgElement("text", {
      x: x + w / 2,
      y: y + h / 2 - 5,
      "text-anchor": "middle",
      fill: line1Fill,
      "font-size": 12,
      "font-weight": 800
    })
  ).textContent = line1;
  svg.appendChild(
    createSvgElement("text", {
      x: x + w / 2,
      y: y + h / 2 + 12,
      "text-anchor": "middle",
      fill: line2Fill,
      "font-size": 10,
      "font-weight": 600
    })
  ).textContent = line2;
}

function drawSplittersDepthFirst(svg, node) {
  if (node.type === "splitter") {
    drawDiamondSplitter(svg, node);
    node.children.forEach((child) => drawSplittersDepthFirst(svg, child));
  }
}

function estimateTextWidth(text, fontSize = 12) {
  return Math.max(24, String(text || "").length * fontSize * 0.58);
}

function getMinimalNodeWidth(node) {
  if (node.type === "loopbackLeaf") {
    const title = estimateTextWidth("LOOP-BACK", 12);
    const flow = estimateTextWidth(`${formatNumber(node.flow, 3)}/min`, 10);
    return Math.max(DIAG.factoryW, Math.ceil(Math.max(title, flow) + 34));
  }

  const title = estimateTextWidth(node.factoryName || "Fabrica", 12);
  const flow = estimateTextWidth(`${formatNumber(node.flow, 3)}/min`, 10);
  return Math.max(DIAG.factoryW, Math.ceil(Math.max(title, flow) + 34));
}

function measureMinimalTopology(node, cfg = {}) {
  const { siblingGap = 28 } = cfg;

  if (node.type !== "splitter") {
    node._layoutW = getMinimalNodeWidth(node);
    node._leaves = node.spanLeaves ?? 1;
    return { width: node._layoutW, leaves: node._leaves };
  }

  let totalWidth = 0;
  let totalLeaves = 0;
  node.children.forEach((child, index) => {
    const measured = measureMinimalTopology(child, cfg);
    totalWidth += measured.width;
    totalLeaves += measured.leaves;
    if (index > 0) {
      totalWidth += siblingGap;
    }
  });

  node._layoutW = Math.max(totalWidth, DIAG.diamondR * 2 + 8);
  node._leaves = totalLeaves;
  return { width: node._layoutW, leaves: node._leaves };
}

function layoutMinimalTopology(node, leftX, depth, cfg = {}) {
  const { levelDy = DIAG.levelDy, marginT = DIAG.marginT, siblingGap = 28 } = cfg;
  node.cx = leftX + node._layoutW / 2;
  node.cy = marginT + depth * levelDy;

  if (node.type !== "splitter") {
    return;
  }

  let cursor = leftX;
  node.children.forEach((child) => {
    layoutMinimalTopology(child, cursor, depth + 1, cfg);
    cursor += child._layoutW + siblingGap;
  });
}

function translateMinimalTopology(node, dx, dy = 0) {
  node.cx += dx;
  node.cy += dy;
  if (node.type === "splitter") {
    node.children.forEach((child) => translateMinimalTopology(child, dx, dy));
  }
}

function childConnectorTopYMinimal(child) {
  if (child.type === "splitter") {
    return child.cy - DIAG.diamondR;
  }
  return child.cy - DIAG.factoryH / 2;
}

function drawMinimalBranchEdges(svg, splitter, markerId) {
  const px = splitter.cx;
  const py = splitter.cy;
  const y1 = py + DIAG.diamondR;
  splitter.children.forEach((child) => {
    const x2 = child.cx;
    const y2 = childConnectorTopYMinimal(child);
    const midY = (y1 + y2) / 2;
    const d = `M ${px} ${y1} L ${px} ${midY} L ${x2} ${midY} L ${x2} ${y2}`;
    addPath(svg, d, markerId);
    addEdgeLabel(svg, x2, midY - 6, `${formatNumber(splitter.flowOutPerChild, 3)}/min`);
    if (child.type === "splitter") {
      drawMinimalBranchEdges(svg, child, markerId);
    }
  });
}

function drawMinimalNodes(svg, node, colors) {
  if (node.type === "splitter") {
    drawDiamondSplitter(svg, node);
    node.children.forEach((child) => drawMinimalNodes(svg, child, colors));
    return;
  }

  const nodeW = node._layoutW || DIAG.factoryW;
  const x = node.cx - nodeW / 2;
  const y = node.cy - DIAG.factoryH / 2;

  if (node.type === "loopbackLeaf") {
    drawRoundedBlock(
      svg,
      x,
      y,
      nodeW,
      DIAG.factoryH,
      12,
      "#bef264",
      "#65a30d",
      "LOOP-BACK",
      `${formatNumber(node.flow, 3)}/min`,
      "#365314",
      "#365314"
    );
    return;
  }

  drawRoundedBlock(
    svg,
    x,
    y,
    nodeW,
    DIAG.factoryH,
    12,
    colors[node.factoryIndex] || "#14532d",
    "#0f172a",
    node.factoryName,
    `${formatNumber(node.flow, 3)}/min`,
    "#0b1020",
    "#f8fafc"
  );
}

function collectMinimalNodes(node, predicate, out) {
  if (predicate(node)) {
    out.push(node);
  }
  if (node.type === "splitter") {
    node.children.forEach((child) => collectMinimalNodes(child, predicate, out));
  }
}

function drawLeafSlots(svg, leaves, options = {}) {
  const { mode = "direct", accent = "#22c55e", factoryColors = [], factoryNames = [] } = options;
  leaves.forEach((leaf) => {
    const x = leaf.cx - DIAG.leafW / 2;
    const y = leaf.cy - DIAG.leafH / 2;
    let fill = "#0f2f1d";
    let stroke = "#22c55e";
    let line1 = `Saída ${leaf.leafIndex + 1}`;
    let line2 = "Outro destino";

    if (mode === "recirculation") {
      if (leaf.isLoopback) {
        fill = "#3a2208";
        stroke = "#f59e0b";
        line2 = "Loop-back";
      } else if (Number.isInteger(leaf.targetFactoryIndex)) {
        const fi = leaf.targetFactoryIndex;
        fill = factoryColors[fi] || "#14532d";
        stroke = "#0f172a";
        line2 = factoryNames[fi] || `Fábrica ${fi + 1}`;
      }
    } else {
      const active = leaf.active;
      fill = active ? "#14532d" : "#0f2f1d";
      stroke = active ? accent : "#22c55e";
      line2 = active ? `${formatNumber(leaf.flow, 4)}/min` : "Outro destino";
    }
    drawRoundedBlock(svg, x, y, DIAG.leafW, DIAG.leafH, 10, fill, stroke, line1, line2, "#ecfdf5", "#bbf7d0");
  });
}

function renderFactoryDiagram(result, diagramIndex) {
  const wrapper = document.createElement("article");
  wrapper.className = "diagram-card";
  const title = document.createElement("div");
  title.className = "diagram-title";
  title.textContent =
    `${result.name} — alvo ${result.targetFractionText}, obtido ${result.obtainedFractionText} (${formatNumber(result.realFlow, 3)}/min)`;
  wrapper.appendChild(title);

  const tree = result.tree;
  const markerId = `arrow-bal-${diagramIndex}-${Math.random().toString(36).slice(2, 9)}`;

  const svg = createSvgElement("svg", {
    class: "diagram-svg",
    role: "img",
    "aria-label": `Diagrama de ligacoes para ${result.name}`
  });

  const defs = createSvgElement("defs");
  const marker = createSvgElement("marker", {
    id: markerId,
    markerWidth: 10,
    markerHeight: 7,
    refX: 10,
    refY: 3.5,
    orient: "auto"
  });
  marker.appendChild(createSvgElement("polygon", { points: "0 0, 10 3.5, 0 7", fill: "#cbd5e1" }));
  defs.appendChild(marker);
  svg.appendChild(defs);

  const subtitle = createSvgElement("text", {
    x: DIAG.marginL,
    y: 28,
    fill: "#93c5fd",
    "font-size": 11
  });
  subtitle.textContent = `Ramos usados por esta fabrica: ${result.best.k} de ${result.best.d} (por sub-ramo: ${formatNumber(tree.meta.leafFlow, 4)}/min). Ramos nao destacados levam a outros destinos.`;
  svg.appendChild(subtitle);

  const { diamondR, entryW, entryH, leafH, mergerW, mergerH, factoryW, factoryH, unitW, levelDy, marginL, marginT, entryGap } = DIAG;
  const entrySlot = entryW + entryGap;

  let maxX = marginL + entrySlot + 400;
  let maxY = marginT + 240;

  const drawEntry = (ex, ey, flowLabel) => {
    drawRoundedBlock(
      svg,
      ex,
      ey,
      entryW,
      entryH,
      10,
      "#2563eb",
      "#1d4ed8",
      "ENTRADA",
      flowLabel,
      "#eff6ff",
      "#dbeafe"
    );
  };

  if (tree.trivial) {
    const ex = marginL;
    const ey = marginT;
    const flowLabel = `${formatNumber(tree.flow, 3)}/min`;
    drawEntry(ex, ey, flowLabel);

    const fx = ex + entryW + 70;
    const fy = ey + entryH / 2 - factoryH / 2;
    const midY = ey + entryH / 2;
    addPath(svg, `M ${ex + entryW} ${midY} L ${fx} ${midY}`, markerId);
    drawRoundedBlock(
      svg,
      fx,
      fy,
      factoryW,
      factoryH,
      12,
      result.color,
      "#0f172a",
      result.name,
      `${formatNumber(result.realFlow, 3)}/min`,
      "#0b1020",
      "#f8fafc"
    );
    maxX = Math.max(maxX, fx + factoryW + 40);
    maxY = Math.max(maxY, fy + factoryH + 36);
    svg.setAttribute("viewBox", `0 0 ${maxX} ${maxY}`);
    wrapper.appendChild(svg);
    return wrapper;
  }

  const splitRoot = tree.children[0];
  measureSplitTree(splitRoot);
  layoutSplitTree(splitRoot, 0, splitRoot._leaves, 0, {
    unitW,
    levelDy,
    marginL,
    marginT,
    entrySlot
  });

  const ex = marginL;
  const ey = splitRoot.cy - entryH / 2;
  drawEntry(ex, ey, `${formatNumber(tree.flow, 3)}/min`);

  const entryMidY = ey + entryH / 2;
  const joinX = splitRoot.cx - diamondR;
  addPath(svg, `M ${ex + entryW} ${entryMidY} L ${joinX} ${entryMidY} L ${joinX} ${splitRoot.cy}`, markerId);

  drawSplitterBranchEdges(svg, splitRoot, markerId);

  const leaves = [];
  collectLeafSlots(splitRoot, leaves);
  leaves.sort((a, b) => a.leafIndex - b.leafIndex);

  const activeLeaves = leaves.filter((leaf) => leaf.active);
  const k = tree.k;

  let merger = null;
  let factoryPos = null;

  const useMerger = k > 1 && activeLeaves.length > 1;
  if (useMerger) {
    const leafBottom = Math.max(...activeLeaves.map((leaf) => leaf.cy + leafH / 2));
    const yRail = leafBottom + 26;
    const mergerTop = yRail + 22;
    const mcx = activeLeaves.reduce((acc, leaf) => acc + leaf.cx, 0) / activeLeaves.length;
    merger = { cx: mcx, top: mergerTop };
    factoryPos = { cx: mcx, top: mergerTop + mergerH + 22 };
  } else if (activeLeaves.length === 1) {
    const leaf = activeLeaves[0];
    const y0 = leaf.cy + leafH / 2;
    factoryPos = { cx: leaf.cx, top: y0 + 26 };
  }

  drawSplittersDepthFirst(svg, splitRoot);
  drawLeafSlots(svg, leaves, { mode: "direct", accent: result.color });

  if (useMerger && merger) {
    const { cx: mcx, top: mergerTop } = merger;
    const yRail = mergerTop - 22;
    activeLeaves.forEach((leaf) => {
      const lx = leaf.cx;
      const y0 = leaf.cy + leafH / 2;
      const d = `M ${lx} ${y0} L ${lx} ${yRail} L ${mcx} ${yRail} L ${mcx} ${mergerTop}`;
      addPath(svg, d, markerId);
    });
    addEdgeLabel(svg, mcx, yRail - 6, `${formatNumber(tree.meta.leafFlow, 4)}/min cada`);
    drawRoundedBlock(
      svg,
      mcx - mergerW / 2,
      mergerTop,
      mergerW,
      mergerH,
      11,
      "#4c1d95",
      "#6d28d9",
      "UNIFICADOR",
      `${k} entradas`,
      "#f5f3ff",
      "#ddd6fe"
    );
  } else if (activeLeaves.length === 1 && factoryPos) {
    const leaf = activeLeaves[0];
    const y0 = leaf.cy + leafH / 2;
    addPath(svg, `M ${leaf.cx} ${y0} L ${leaf.cx} ${factoryPos.top}`, markerId);
  }

  if (factoryPos) {
    const fx = factoryPos.cx - factoryW / 2;
    const fy = factoryPos.top;
    if (useMerger && merger) {
      addPath(svg, `M ${merger.cx} ${merger.top + mergerH} L ${merger.cx} ${fy}`, markerId);
    }
    drawRoundedBlock(
      svg,
      fx,
      fy,
      factoryW,
      factoryH,
      12,
      result.color,
      "#0f172a",
      result.name,
      `${formatNumber(result.realFlow, 3)}/min`,
      "#0b1020",
      "#f8fafc"
    );

    maxY = Math.max(maxY, fy + factoryH + 40);
    maxX = Math.max(maxX, fx + factoryW + 40);
  }

  const rightEdge = marginL + entrySlot + splitRoot._leaves * unitW + 40;
  maxX = Math.max(maxX, rightEdge);

  const deepestY = leaves.reduce((acc, leaf) => Math.max(acc, leaf.cy + leafH / 2), marginT);
  maxY = Math.max(maxY, deepestY + (k > 1 ? mergerH + factoryH + 120 : factoryH + 100));

  svg.setAttribute("viewBox", `0 0 ${maxX} ${maxY}`);
  wrapper.appendChild(svg);
  return wrapper;
}

function renderRecirculationDiagram(solution, factories, totalFlow, colors) {
  const wrapper = document.createElement("article");
  wrapper.className = "diagram-card";
  const title = document.createElement("div");
  title.className = "diagram-title";
  title.textContent =
    `Diagrama unico do cenario — ${solution.loopbackCount} saida(s) em loop-back, fluxo recirculado ${formatNumber(solution.recirculatedFlow, 4)}/min`;
  wrapper.appendChild(title);

  const tree = buildUnifiedRecirculationTree(solution, factories, totalFlow);
  if (!tree.children.length) {
    const note = document.createElement("p");
    note.className = "small";
    note.textContent = "Cenario trivial sem divisores: fluxo segue direto para um unico destino.";
    wrapper.appendChild(note);
    return wrapper;
  }

  const markerId = `arrow-rec-${Math.random().toString(36).slice(2, 9)}`;
  const svg = createSvgElement("svg", {
    class: "diagram-svg",
    role: "img",
    "aria-label": "Diagrama unificado com recirculacao"
  });
  const defs = createSvgElement("defs");
  const marker = createSvgElement("marker", {
    id: markerId,
    markerWidth: 10,
    markerHeight: 7,
    refX: 10,
    refY: 3.5,
    orient: "auto"
  });
  marker.appendChild(createSvgElement("polygon", { points: "0 0, 10 3.5, 0 7", fill: "#cbd5e1" }));
  defs.appendChild(marker);
  svg.appendChild(defs);

  const subtitle = createSvgElement("text", {
    x: DIAG.marginL,
    y: 28,
    fill: "#93c5fd",
    "font-size": 11
  });
  subtitle.textContent =
    `d=${solution.d}, sum(k)=${solution.sumK}, r=${solution.loopbackCount} (cada ramo final ${formatNumber(solution.leafFlow, 4)}/min).`;
  svg.appendChild(subtitle);

  const splitRoot = tree.children[0];
  measureSplitTree(splitRoot);

  const entrySlot = DIAG.entryW + DIAG.entryGap;
  layoutSplitTree(splitRoot, 0, splitRoot._leaves, 0, {
    unitW: DIAG.unitW,
    levelDy: DIAG.levelDy,
    marginL: DIAG.marginL,
    marginT: DIAG.marginT,
    entrySlot
  });

  const ex = DIAG.marginL;
  const ey = splitRoot.cy - DIAG.entryH / 2;
  drawRoundedBlock(
    svg,
    ex,
    ey,
    DIAG.entryW,
    DIAG.entryH,
    10,
    "#2563eb",
    "#1d4ed8",
    "ENTRADA",
    `${formatNumber(totalFlow, 3)}/min`,
    "#eff6ff",
    "#dbeafe"
  );

  const joinX = splitRoot.cx - DIAG.diamondR;
  const entryMidY = ey + DIAG.entryH / 2;
  addPath(svg, `M ${ex + DIAG.entryW} ${entryMidY} L ${joinX} ${entryMidY} L ${joinX} ${splitRoot.cy}`, markerId);
  drawSplitterBranchEdges(svg, splitRoot, markerId);

  const leaves = [];
  collectLeafSlots(splitRoot, leaves);
  leaves.sort((a, b) => a.leafIndex - b.leafIndex);

  const topLoopY = Math.max(24, ey - 22);
  const leftReturnX = DIAG.marginL - 8;
  leaves.forEach((leaf) => {
    if (!leaf.isLoopback) {
      return;
    }
    const startY = leaf.cy + DIAG.leafH / 2;
    const startX = leaf.cx;
    const d = `M ${startX} ${startY} L ${startX} ${topLoopY} L ${leftReturnX} ${topLoopY} L ${leftReturnX} ${entryMidY} L ${ex} ${entryMidY}`;
    addPath(svg, d, markerId);
  });

  drawSplittersDepthFirst(svg, splitRoot);
  drawLeafSlots(svg, leaves, {
    mode: "recirculation",
    factoryColors: colors,
    factoryNames: factories.map((f) => f.name)
  });

  const legend = createSvgElement("text", {
    x: DIAG.marginL,
    y: topLoopY - 8,
    fill: "#fbbf24",
    "font-size": 11
  });
  legend.textContent = `Loop-back: ${solution.loopbackCount} saida(s) retornam ao topo (F_recirc=${formatNumber(solution.recirculatedFlow, 4)}/min).`;
  svg.appendChild(legend);

  let maxX = DIAG.marginL + entrySlot + splitRoot._leaves * DIAG.unitW + 40;
  let maxY = leaves.reduce((acc, leaf) => Math.max(acc, leaf.cy + DIAG.leafH / 2), DIAG.marginT) + 70;
  if (maxY < 220) {
    maxY = 220;
  }
  if (maxX < 620) {
    maxX = 620;
  }
  svg.setAttribute("viewBox", `0 0 ${maxX} ${maxY}`);

  wrapper.appendChild(svg);
  return wrapper;
}

function renderMinimalRecirculationDiagram(solution, factories, totalFlow, colors) {
  const wrapper = document.createElement("article");
  wrapper.className = "diagram-card";
  const title = document.createElement("div");
  title.className = "diagram-title";
  title.textContent =
    `Diagrama unico do cenario - ${solution.loopbackCount} saida(s) em loop-back, fluxo recirculado ${formatNumber(solution.recirculatedFlow, 4)}/min`;
  wrapper.appendChild(title);

  const topology = solution.topology || buildMinimalRecirculationTopology(solution, factories, totalFlow);
  const splitRoot = topology.type === "sourceMerge" ? topology.child : topology;

  if (!splitRoot || splitRoot.type !== "splitter") {
    const note = document.createElement("p");
    note.className = "small";
    note.textContent = "Cenario trivial sem divisores: fluxo segue direto para um unico destino.";
    wrapper.appendChild(note);
    return wrapper;
  }

  const markerId = `arrow-rec-min-${Math.random().toString(36).slice(2, 9)}`;
  const svg = createSvgElement("svg", {
    class: "diagram-svg",
    role: "img",
    "aria-label": "Diagrama unificado com recirculacao"
  });
  const defs = createSvgElement("defs");
  const marker = createSvgElement("marker", {
    id: markerId,
    markerWidth: 10,
    markerHeight: 7,
    refX: 10,
    refY: 3.5,
    orient: "auto"
  });
  marker.appendChild(createSvgElement("polygon", { points: "0 0, 10 3.5, 0 7", fill: "#cbd5e1" }));
  defs.appendChild(marker);
  svg.appendChild(defs);

  const subtitle = createSvgElement("text", {
    x: DIAG.marginL,
    y: 28,
    fill: "#93c5fd",
    "font-size": 11
  });
  subtitle.textContent =
    `d=${solution.d}, sum(k)=${solution.sumK}, r=${solution.loopbackCount} (cada ramo final ${formatNumber(solution.leafFlow, 4)}/min).`;
  svg.appendChild(subtitle);

  const rootMarginT = 220;
  const siblingGap = 34;
  measureMinimalTopology(splitRoot, { siblingGap });
  layoutMinimalTopology(splitRoot, 0, 0, {
    marginT: rootMarginT,
    levelDy: 126,
    siblingGap
  });

  let mergeCx = splitRoot.cx;
  const mergeTop = 96;
  const mergeBottom = mergeTop + DIAG.mergerH;
  const hubGap = 96;
  let mergeLeft = mergeCx - DIAG.mergerW / 2;
  let mergeRight = mergeCx + DIAG.mergerW / 2;
  let freshX = mergeLeft - hubGap - DIAG.entryW;
  const freshY = mergeTop;

  if (freshX < DIAG.marginL + 24) {
    const shift = DIAG.marginL + 24 - freshX;
    translateMinimalTopology(splitRoot, shift, 0);
    mergeCx = splitRoot.cx;
    mergeLeft = mergeCx - DIAG.mergerW / 2;
    mergeRight = mergeCx + DIAG.mergerW / 2;
    freshX = mergeLeft - hubGap - DIAG.entryW;
  }

  const allNodes = [];
  collectMinimalNodes(splitRoot, () => true, allNodes);
  const minNodeLeft = allNodes.reduce((acc, node) => {
    const left = node.type === "splitter"
      ? node.cx - DIAG.diamondR
      : node.cx - ((node._layoutW || DIAG.factoryW) / 2);
    return Math.min(acc, left);
  }, Number.POSITIVE_INFINITY);
  const maxNodeRight = allNodes.reduce((acc, node) => {
    const right = node.type === "splitter"
      ? node.cx + DIAG.diamondR
      : node.cx + ((node._layoutW || DIAG.factoryW) / 2);
    return Math.max(acc, right);
  }, Number.NEGATIVE_INFINITY);
  const loopReturnX = Math.max(maxNodeRight + 92, mergeRight + 180);

  drawRoundedBlock(
    svg,
    freshX,
    freshY,
    DIAG.entryW,
    DIAG.entryH,
    10,
    "#2563eb",
    "#1d4ed8",
    "ENTRADA NOVA",
    `F = ${formatNumber(totalFlow, 3)}/min`,
    "#eff6ff",
    "#dbeafe"
  );
  drawRoundedBlock(
    svg,
    mergeLeft,
    mergeTop,
    DIAG.mergerW,
    DIAG.mergerH,
    11,
    "#4c1d95",
    "#6d28d9",
    "UNIFICADOR",
    `E = ${formatNumber(solution.effectiveInput, 3)}/min`,
    "#f5f3ff",
    "#ddd6fe"
  );

  const freshMidY = freshY + DIAG.entryH / 2;
  const mergeMidY = mergeTop + DIAG.mergerH / 2;
  addPath(svg, `M ${freshX + DIAG.entryW} ${freshMidY} L ${mergeLeft} ${mergeMidY}`, markerId);
  addPath(svg, `M ${mergeCx} ${mergeBottom} L ${mergeCx} ${splitRoot.cy - DIAG.diamondR}`, markerId);

  const loopLeaves = [];
  collectMinimalNodes(splitRoot, (node) => node.type === "loopbackLeaf", loopLeaves);
  loopLeaves.forEach((leaf, index) => {
    const startX = leaf.cx + ((leaf._layoutW || DIAG.factoryW) / 2);
    const startY = leaf.cy;
    const returnJoinY = mergeMidY + 22 + index * 22;
    const d = `M ${startX} ${startY} L ${loopReturnX} ${startY} L ${loopReturnX} ${returnJoinY} L ${mergeRight} ${returnJoinY} L ${mergeRight} ${mergeMidY}`;
    addPath(svg, d, markerId);
    addEdgeLabel(svg, loopReturnX - 20, returnJoinY - 6, `F_recirc = ${formatNumber(leaf.flow, 3)}/min`);
  });

  drawMinimalBranchEdges(svg, splitRoot, markerId);
  drawMinimalNodes(svg, splitRoot, colors);

  const legend = createSvgElement("text", {
    x: DIAG.marginL,
    y: mergeTop - 18,
    fill: "#fbbf24",
    "font-size": 11
  });
  legend.textContent = `Loop-back: ${solution.loopbackCount} saida(s) retornam ao topo (F_recirc=${formatNumber(solution.recirculatedFlow, 4)}/min).`;
  svg.appendChild(legend);

  const deepestY = allNodes.reduce((acc, node) => {
    const bottom = node.type === "splitter"
      ? node.cy + DIAG.diamondR
      : node.cy + DIAG.factoryH / 2;
    return Math.max(acc, bottom);
  }, mergeBottom);

  const minX = Math.min(minNodeLeft, freshX, mergeLeft) - 44;
  const maxX = Math.max(maxNodeRight, loopReturnX, freshX + DIAG.entryW, mergeRight) + 72;
  const minY = Math.min(16, mergeTop - 62);
  const maxY = Math.max(360, deepestY + 86);
  svg.setAttribute("viewBox", `${minX} ${minY} ${maxX - minX} ${maxY - minY}`);

  wrapper.appendChild(svg);
  return wrapper;
}

export function renderDiagrams(refs, results, scenario = null) {
  refs.diagramWrap.innerHTML = "";
  if (scenario && scenario.mode === "recirculation" && scenario.recirc) {
    const factories = scenario.factories || [];
    const colors = results.map((row) => row.color || "#14532d");
    refs.diagramWrap.appendChild(
      renderMinimalRecirculationDiagram(scenario.recirc, factories, scenario.totalFlow, colors)
    );
    return;
  }
  results.forEach((result, index) => {
    refs.diagramWrap.appendChild(renderFactoryDiagram(result, index));
  });
}
