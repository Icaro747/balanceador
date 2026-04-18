import { formatNumber } from "./utils.js";
import { findRecirculationSolution } from "./math.js";
import { t } from "./i18n/index.js";
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

const DIAGRAM_INTERACTION = {
  minZoom: 0.5,
  maxZoom: 2.4,
  zoomStep: 0.2
};

function clampZoom(value) {
  return Math.max(DIAGRAM_INTERACTION.minZoom, Math.min(DIAGRAM_INTERACTION.maxZoom, value));
}

function parseSvgViewSize(svg) {
  const viewBoxText = svg.getAttribute("viewBox");
  if (viewBoxText) {
    const values = viewBoxText.trim().split(/\s+/).map(Number);
    if (values.length === 4 && values.every((value) => Number.isFinite(value))) {
      return {
        width: Math.max(280, Math.abs(values[2])),
        height: Math.max(220, Math.abs(values[3]))
      };
    }
  }

  const width = Number(svg.getAttribute("width")) || 900;
  const height = Number(svg.getAttribute("height")) || 500;
  return {
    width: Math.max(280, width),
    height: Math.max(220, height)
  };
}

function createInteractiveViewport(svg) {
  const { width: baseWidth, height: baseHeight } = parseSvgViewSize(svg);

  const viewport = document.createElement("div");
  viewport.className = "diagram-viewport";

  const toolbar = document.createElement("div");
  toolbar.className = "diagram-toolbar";

  const zoomOutBtn = document.createElement("button");
  zoomOutBtn.type = "button";
  zoomOutBtn.className = "muted-btn";
  zoomOutBtn.textContent = "Zoom -";

  const zoomInBtn = document.createElement("button");
  zoomInBtn.type = "button";
  zoomInBtn.className = "muted-btn";
  zoomInBtn.textContent = "Zoom +";

  const resetBtn = document.createElement("button");
  resetBtn.type = "button";
  resetBtn.className = "muted-btn";
  resetBtn.textContent = "100%";

  const fitBtn = document.createElement("button");
  fitBtn.type = "button";
  fitBtn.className = "muted-btn";
  fitBtn.textContent = t("diagram.controls.fit");

  const zoomValue = document.createElement("span");
  zoomValue.className = "diagram-zoom-value";
  zoomValue.textContent = "100%";

  toolbar.append(zoomOutBtn, zoomInBtn, resetBtn, fitBtn, zoomValue);

  const scroll = document.createElement("div");
  scroll.className = "diagram-scroll";
  const canvas = document.createElement("div");
  canvas.className = "diagram-canvas";
  scroll.appendChild(canvas);

  svg.style.width = `${baseWidth}px`;
  svg.style.height = `${baseHeight}px`;
  canvas.appendChild(svg);

  viewport.append(toolbar, scroll);

  let zoom = 1;
  let dragState = null;

  function applyZoom(nextZoom, focus = null) {
    const target = clampZoom(nextZoom);
    if (Math.abs(target - zoom) < 1e-9) {
      return;
    }

    const prevZoom = zoom;
    const prevWidth = baseWidth * prevZoom;
    const prevHeight = baseHeight * prevZoom;
    zoom = target;
    const nextWidth = baseWidth * zoom;
    const nextHeight = baseHeight * zoom;

    const localX = focus?.x ?? (scroll.clientWidth / 2);
    const localY = focus?.y ?? (scroll.clientHeight / 2);
    const anchorX = scroll.scrollLeft + localX;
    const anchorY = scroll.scrollTop + localY;
    const ratioX = prevWidth > 0 ? (nextWidth / prevWidth) : 1;
    const ratioY = prevHeight > 0 ? (nextHeight / prevHeight) : 1;

    svg.style.width = `${nextWidth}px`;
    svg.style.height = `${nextHeight}px`;

    scroll.scrollLeft = Math.max(0, anchorX * ratioX - localX);
    scroll.scrollTop = Math.max(0, anchorY * ratioY - localY);
    zoomValue.textContent = `${Math.round(zoom * 100)}%`;
  }

  function fitToViewport() {
    if (!scroll.clientWidth) {
      return;
    }
    const availableWidth = Math.max(200, scroll.clientWidth - 20);
    const fitZoom = clampZoom(Math.min(1, availableWidth / baseWidth));
    applyZoom(fitZoom);
  }

  zoomOutBtn.addEventListener("click", () => applyZoom(zoom - DIAGRAM_INTERACTION.zoomStep));
  zoomInBtn.addEventListener("click", () => applyZoom(zoom + DIAGRAM_INTERACTION.zoomStep));
  resetBtn.addEventListener("click", () => {
    applyZoom(1);
    scroll.scrollLeft = 0;
    scroll.scrollTop = 0;
  });
  fitBtn.addEventListener("click", fitToViewport);

  scroll.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) {
      return;
    }
    dragState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      left: scroll.scrollLeft,
      top: scroll.scrollTop
    };
    scroll.classList.add("panning");
    if (typeof scroll.setPointerCapture === "function") {
      scroll.setPointerCapture(event.pointerId);
    }
    event.preventDefault();
  });

  scroll.addEventListener("pointermove", (event) => {
    if (!dragState || event.pointerId !== dragState.pointerId) {
      return;
    }
    const dx = event.clientX - dragState.startX;
    const dy = event.clientY - dragState.startY;
    scroll.scrollLeft = dragState.left - dx;
    scroll.scrollTop = dragState.top - dy;
  });

  const finishPan = (event) => {
    if (!dragState || event.pointerId !== dragState.pointerId) {
      return;
    }
    if (typeof scroll.releasePointerCapture === "function") {
      scroll.releasePointerCapture(event.pointerId);
    }
    dragState = null;
    scroll.classList.remove("panning");
  };

  scroll.addEventListener("pointerup", finishPan);
  scroll.addEventListener("pointercancel", finishPan);

  scroll.addEventListener("wheel", (event) => {
    if (!event.ctrlKey) {
      return;
    }
    event.preventDefault();
    const rect = scroll.getBoundingClientRect();
    const focus = {
      x: Math.max(0, Math.min(scroll.clientWidth, event.clientX - rect.left)),
      y: Math.max(0, Math.min(scroll.clientHeight, event.clientY - rect.top))
    };
    const direction = event.deltaY < 0 ? 1 : -1;
    applyZoom(zoom + direction * DIAGRAM_INTERACTION.zoomStep, focus);
  }, { passive: false });

  return viewport;
}

function appendDiagramSvg(wrapper, svg) {
  attachDiagramHoverInteraction(svg);
  wrapper.appendChild(createInteractiveViewport(svg));
}

function countSplitters(node) {
  if (!node || node.type !== "splitter") {
    return 0;
  }
  return 1 + node.children.reduce((acc, child) => acc + countSplitters(child), 0);
}

function getLabelPolicy(root, limits = {}) {
  const leafLimit = limits.leafLimit ?? 18;
  const splitterLimit = limits.splitterLimit ?? 20;
  const leafCount = root?._leaves ?? 0;
  const splitterCount = countSplitters(root);
  const dense = leafCount >= leafLimit || splitterCount >= splitterLimit;
  return {
    showEdgeLabels: !dense
  };
}

function createSvgElement(name, attrs = {}) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", name);
  Object.entries(attrs).forEach(([key, value]) => {
    el.setAttribute(key, String(value));
  });
  return el;
}

function createNodeIdFactory(prefix) {
  let sequence = 0;
  return (kind = "node") => {
    sequence += 1;
    return `${prefix}-${kind}-${sequence}`;
  };
}

function assignDiagramNodeIds(node, nextNodeId) {
  if (!node || typeof nextNodeId !== "function") {
    return;
  }
  node._diagramNodeId = nextNodeId(node.type || "node");
  if (node.type === "splitter" && Array.isArray(node.children)) {
    node.children.forEach((child) => assignDiagramNodeIds(child, nextNodeId));
  }
}

function annotateFlowNode(element, nodeId) {
  if (!element || !nodeId) {
    return element;
  }
  element.classList.add("flow-node");
  element.setAttribute("data-node-id", nodeId);
  if (!element.hasAttribute("tabindex")) {
    element.setAttribute("tabindex", "0");
  }
  return element;
}

function attachDiagramHoverInteraction(svg) {
  if (!svg) {
    return;
  }
  const nodeSelector = "[data-node-id]";
  const edgeSelector = ".flow-edge";
  if (!svg.querySelector(nodeSelector) || !svg.querySelector(edgeSelector)) {
    return;
  }

  let activeNodeId = null;

  const clearHighlight = () => {
    activeNodeId = null;
    svg.classList.remove("diagram-highlight-active");
    svg.querySelectorAll(".flow-node").forEach((nodeElement) => {
      nodeElement.classList.remove("is-active", "is-dimmed");
    });
    svg.querySelectorAll(".flow-edge").forEach((edgeElement) => {
      edgeElement.classList.remove("is-active", "is-dimmed");
    });
  };

  const activateNode = (nodeId) => {
    if (!nodeId) {
      clearHighlight();
      return;
    }
    if (nodeId === activeNodeId) {
      return;
    }
    activeNodeId = nodeId;

    const edges = Array.from(svg.querySelectorAll(edgeSelector));
    const activeEdges = edges.filter((edgeElement) => (
      edgeElement.getAttribute("data-edge-from") === nodeId
      || edgeElement.getAttribute("data-edge-to") === nodeId
    ));
    const activeEdgeSet = new Set(activeEdges);
    const connectedNodeIds = new Set([nodeId]);
    activeEdges.forEach((edgeElement) => {
      const fromId = edgeElement.getAttribute("data-edge-from");
      const toId = edgeElement.getAttribute("data-edge-to");
      if (fromId) {
        connectedNodeIds.add(fromId);
      }
      if (toId) {
        connectedNodeIds.add(toId);
      }
    });

    svg.classList.add("diagram-highlight-active");
    edges.forEach((edgeElement) => {
      const active = activeEdgeSet.has(edgeElement);
      edgeElement.classList.toggle("is-active", active);
      edgeElement.classList.toggle("is-dimmed", !active);
    });

    svg.querySelectorAll(".flow-node").forEach((nodeElement) => {
      const currentNode = nodeElement.getAttribute("data-node-id");
      const active = connectedNodeIds.has(currentNode);
      nodeElement.classList.toggle("is-active", active);
      nodeElement.classList.toggle("is-dimmed", !active);
    });
  };

  const resolveNodeId = (eventTarget) => {
    if (!eventTarget || typeof eventTarget.closest !== "function") {
      return null;
    }
    const nodeElement = eventTarget.closest(nodeSelector);
    if (!nodeElement || !svg.contains(nodeElement)) {
      return null;
    }
    return nodeElement.getAttribute("data-node-id");
  };

  svg.addEventListener("pointerover", (event) => {
    const nodeId = resolveNodeId(event.target);
    if (!nodeId) {
      return;
    }
    activateNode(nodeId);
  });

  svg.addEventListener("pointerout", (event) => {
    const nextNodeId = resolveNodeId(event.relatedTarget);
    if (nextNodeId) {
      activateNode(nextNodeId);
      return;
    }
    clearHighlight();
  });

  svg.addEventListener("focusin", (event) => {
    const nodeId = resolveNodeId(event.target);
    if (!nodeId) {
      return;
    }
    activateNode(nodeId);
  });

  svg.addEventListener("focusout", (event) => {
    const nextNodeId = resolveNodeId(event.relatedTarget);
    if (nextNodeId) {
      activateNode(nextNodeId);
      return;
    }
    clearHighlight();
  });
}

function childConnectorTopY(child) {
  if (child.type === "splitter") {
    return child.cy - DIAG.diamondR;
  }
  return child.cy - DIAG.leafH / 2;
}

function addPath(svg, d, markerId, options = {}) {
  const path = createSvgElement("path", {
    d,
    fill: "none",
    stroke: "#cbd5e1",
    "stroke-width": 1.65,
    "marker-end": `url(#${markerId})`
  });
  path.classList.add("flow-edge");
  if (options.routeTag) {
    path.setAttribute("data-route", options.routeTag);
  }
  if (options.edgeFrom) {
    path.setAttribute("data-edge-from", options.edgeFrom);
  }
  if (options.edgeTo) {
    path.setAttribute("data-edge-to", options.edgeTo);
  }
  svg.appendChild(path);
  return path;
}

function addEdgeLabel(svg, x, y, text, options = {}) {
  if (options.visible === false) {
    return;
  }
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

function drawSplitterBranchEdges(svg, splitter, markerId, options = {}) {
  const px = splitter.cx;
  const py = splitter.cy;
  const y1 = py + DIAG.diamondR;
  splitter.children.forEach((child) => {
    const x2 = child.cx;
    const y2 = childConnectorTopY(child);
    const midY = (y1 + y2) / 2;
    const d = `M ${px} ${y1} L ${px} ${midY} L ${x2} ${midY} L ${x2} ${y2}`;
    addPath(svg, d, markerId, {
      routeTag: options.routeTag,
      edgeFrom: splitter._diagramNodeId,
      edgeTo: child._diagramNodeId
    });
    addEdgeLabel(svg, x2, midY - 6, `${formatNumber(splitter.flowOutPerChild, 3)}/min`, {
      visible: options.showEdgeLabels !== false
    });
    if (child.type === "splitter") {
      drawSplitterBranchEdges(svg, child, markerId, options);
    }
  });
}

function drawDiamondSplitter(svg, node, options = {}) {
  const { cx, cy } = node;
  const r = DIAG.diamondR;
  const points = `${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`;
  const group = createSvgElement("g");
  annotateFlowNode(group, options.nodeId || node?._diagramNodeId);
  const poly = createSvgElement("polygon", {
    points,
    fill: "#fbbf24",
    stroke: "#b45309",
    "stroke-width": 2
  });
  group.appendChild(poly);
  const t1 = createSvgElement("text", {
    x: cx,
    y: cy - 4,
    "text-anchor": "middle",
    fill: "#1c1917",
    "font-size": 13,
    "font-weight": 800
  });
  t1.textContent = `1/${node.div}`;
  group.appendChild(t1);
  const t2 = createSvgElement("text", {
    x: cx,
    y: cy + 12,
    "text-anchor": "middle",
    fill: "#292524",
    "font-size": 10,
    "font-weight": 600
  });
  t2.textContent = `${formatNumber(node.flowIn, 3)}/min`;
  group.appendChild(t2);
  svg.appendChild(group);
  return group;
}

function drawRoundedBlock(svg, x, y, w, h, rx, fill, stroke, line1, line2, line1Fill, line2Fill, options = {}) {
  const group = createSvgElement("g");
  annotateFlowNode(group, options.nodeId);
  const rect = createSvgElement("rect", {
    x,
    y,
    width: w,
    height: h,
    rx,
    ry: rx,
    fill,
    stroke,
    "stroke-width": 1.6
  });
  group.appendChild(rect);
  const line1Text = createSvgElement("text", {
    x: x + w / 2,
    y: y + h / 2 - 5,
    "text-anchor": "middle",
    fill: line1Fill,
    "font-size": 12,
    "font-weight": 800
  });
  line1Text.textContent = line1;
  group.appendChild(line1Text);
  const line2Text = createSvgElement("text", {
    x: x + w / 2,
    y: y + h / 2 + 12,
    "text-anchor": "middle",
    fill: line2Fill,
    "font-size": 10,
    "font-weight": 600
  });
  line2Text.textContent = line2;
  group.appendChild(line2Text);
  svg.appendChild(group);
  return group;
}

function drawSplittersDepthFirst(svg, node) {
  if (node.type === "splitter") {
    drawDiamondSplitter(svg, node, { nodeId: node._diagramNodeId });
    node.children.forEach((child) => drawSplittersDepthFirst(svg, child));
  }
}

function buildMergerCascade(inputs, gapY = 48) {
  const queue = inputs
    .filter((input) => Number.isFinite(input?.x) && Number.isFinite(input?.y))
    .map((input) => ({
      x: input.x,
      y: input.y,
      flow: Number(input.flow) || 0,
      nodeId: input.nodeId || null
    }));
  const mergers = [];

  if (queue.length <= 1) {
    return { mergers, output: queue[0] || null };
  }

  const addMerger = (size) => {
    const selected = queue.splice(0, size);
    if (selected.length < 2) {
      return;
    }
    const maxInputY = selected.reduce((acc, node) => Math.max(acc, node.y), Number.NEGATIVE_INFINITY);
    const cx = selected.reduce((acc, node) => acc + node.x, 0) / selected.length;
    const flow = selected.reduce((acc, node) => acc + node.flow, 0);
    const top = maxInputY + gapY;
    const output = {
      x: cx,
      y: top + DIAG.mergerH,
      flow,
      nodeId: null
    };
    const merger = {
      cx,
      top,
      inputCount: selected.length,
      inputs: selected,
      flow,
      output
    };
    mergers.push(merger);
    queue.push(output);
  };

  if (queue.length % 2 === 0) {
    addMerger(2);
  }
  while (queue.length > 1) {
    addMerger(3);
  }

  return {
    mergers,
    output: queue[0] || null
  };
}

function drawMergerCascade(svg, cascade, markerId, options = {}) {
  const {
    blockFill = "#4c1d95",
    blockStroke = "#6d28d9",
    line1Fill = "#f5f3ff",
    line2Fill = "#ddd6fe",
    routeTag,
    nodeIdFactory = null
  } = options;

  cascade.mergers.forEach((merger, index) => {
    const mergerNodeId = merger.nodeId || (
      typeof nodeIdFactory === "function"
        ? nodeIdFactory(`merger-${index + 1}`)
        : null
    );
    merger.nodeId = mergerNodeId;
    merger.output.nodeId = mergerNodeId;
    const yRail = merger.top - 22;
    merger.inputs.forEach((input) => {
      const d = `M ${input.x} ${input.y} L ${input.x} ${yRail} L ${merger.cx} ${yRail} L ${merger.cx} ${merger.top}`;
      addPath(svg, d, markerId, {
        routeTag,
        edgeFrom: input.nodeId,
        edgeTo: mergerNodeId
      });
    });
    drawRoundedBlock(
      svg,
      merger.cx - DIAG.mergerW / 2,
      merger.top,
      DIAG.mergerW,
      DIAG.mergerH,
      11,
      blockFill,
      blockStroke,
      t("diagram.labels.merger"),
      t("diagram.labels.mergerInputs", { count: merger.inputCount }),
      line1Fill,
      line2Fill,
      { nodeId: mergerNodeId }
    );
  });
}

export function planLaneAllocations(factoryFlows, inputLanes, flowPerLane, tolerance = 1e-6) {
  const laneCount = Math.max(1, Math.trunc(inputLanes || 1));
  const normalizedFlowPerLane = Math.max(0, Number(flowPerLane) || 0);
  const remaining = (factoryFlows || []).map((flow) => Math.max(0, Number(flow) || 0));
  const lanes = Array.from({ length: laneCount }, (_, laneIndex) => ({
    laneIndex,
    totalFlow: 0,
    segments: []
  }));

  function pickLargestFactoryIndex() {
    let picked = -1;
    let best = tolerance;
    for (let index = 0; index < remaining.length; index += 1) {
      const value = remaining[index];
      if (value > best + tolerance) {
        best = value;
        picked = index;
      }
    }
    return picked;
  }

  lanes.forEach((lane) => {
    let capacity = normalizedFlowPerLane;
    while (capacity > tolerance) {
      const factoryIndex = pickLargestFactoryIndex();
      if (factoryIndex < 0) {
        break;
      }
      const take = Math.min(capacity, remaining[factoryIndex]);
      if (take <= tolerance) {
        break;
      }
      lane.segments.push({
        laneIndex: lane.laneIndex,
        factoryIndex,
        flow: take
      });
      lane.totalFlow += take;
      remaining[factoryIndex] -= take;
      capacity -= take;
    }
  });

  const maxIterations = 20000;
  let iteration = 0;
  function getRemainingTotal() {
    return remaining.reduce((sum, value) => sum + Math.max(0, value), 0);
  }

  while (getRemainingTotal() > tolerance && iteration < maxIterations) {
    iteration += 1;
    const factoryIndex = pickLargestFactoryIndex();
    if (factoryIndex < 0) {
      break;
    }
    let targetLane = lanes[0];
    let largestSpare = normalizedFlowPerLane - targetLane.totalFlow;
    lanes.forEach((lane) => {
      const spare = normalizedFlowPerLane - lane.totalFlow;
      if (spare > largestSpare + tolerance) {
        largestSpare = spare;
        targetLane = lane;
      }
    });

    if (largestSpare <= tolerance) {
      targetLane = lanes.reduce((bestLane, lane) => (
        lane.totalFlow < bestLane.totalFlow ? lane : bestLane
      ), lanes[0]);
      largestSpare = Number.POSITIVE_INFINITY;
    }

    const take = Math.min(
      remaining[factoryIndex],
      largestSpare,
      normalizedFlowPerLane > 0 ? normalizedFlowPerLane : remaining[factoryIndex]
    );

    if (take <= tolerance) {
      break;
    }

    targetLane.segments.push({
      laneIndex: targetLane.laneIndex,
      factoryIndex,
      flow: take
    });
    targetLane.totalFlow += take;
    remaining[factoryIndex] -= take;
  }

  lanes.forEach((lane) => {
    const merged = new Map();
    lane.segments.forEach((segment) => {
      const current = merged.get(segment.factoryIndex) || 0;
      merged.set(segment.factoryIndex, current + segment.flow);
    });
    lane.segments = Array.from(merged.entries())
      .map(([factoryIndex, flow]) => ({
        laneIndex: lane.laneIndex,
        factoryIndex,
        flow
      }))
      .sort((a, b) => a.factoryIndex - b.factoryIndex);
    lane.totalFlow = lane.segments.reduce((sum, segment) => sum + segment.flow, 0);
  });

  return {
    lanes,
    remainingTotal: getRemainingTotal()
  };
}

function remapLaneTopology(node, laneSegments, results) {
  if (!node) {
    return null;
  }

  if (node.type === "splitter") {
    return {
      ...node,
      children: node.children.map((child) => remapLaneTopology(child, laneSegments, results))
    };
  }

  if (node.type === "factoryLeaf") {
    const segment = laneSegments[node.factoryIndex];
    const globalFactoryIndex = segment?.factoryIndex ?? 0;
    const row = results[globalFactoryIndex];
    return {
      ...node,
      globalFactoryIndex,
      factoryName: row?.name || t("diagram.labels.fallbackFactory", { index: globalFactoryIndex + 1 })
    };
  }

  return { ...node };
}

function buildLaneTopologyPlan(results, scenario) {
  const factoryFlows = results.map((row) => Math.max(0, Number(row.realFlow) || 0));
  const laneCount = Math.max(1, Math.trunc(scenario?.inputLanes || 1));
  const laneFlow = Math.max(0, Number(scenario?.flowPerLane) || 0);
  const depthLimit = Number.isFinite(scenario?.depthLimit) ? scenario.depthLimit : 6;
  const allocation = planLaneAllocations(factoryFlows, laneCount, laneFlow);

  const lanes = allocation.lanes.map((lane) => {
    const pseudoFactories = lane.segments.map((segment, index) => ({
      name: `${results[segment.factoryIndex]?.name || t("diagram.labels.fallbackFactory", { index: segment.factoryIndex + 1 })} L${lane.laneIndex + 1}-${index + 1}`,
      weight: Math.max(segment.flow, 1e-9)
    }));

    if (!pseudoFactories.length || lane.totalFlow <= 1e-9) {
      return {
        laneIndex: lane.laneIndex,
        totalFlow: 0,
        segments: lane.segments,
        topology: null
      };
    }

    const laneSolution = findRecirculationSolution(pseudoFactories, depthLimit, lane.totalFlow);
    const rawTopology = laneSolution?.topology
      ? (laneSolution.topology.type === "sourceMerge" ? laneSolution.topology.child : laneSolution.topology)
      : null;

    return {
      laneIndex: lane.laneIndex,
      totalFlow: lane.totalFlow,
      segments: lane.segments,
      topology: remapLaneTopology(rawTopology, lane.segments, results)
    };
  });

  return {
    lanes,
    remainingTotal: allocation.remainingTotal
  };
}

function estimateTextWidth(text, fontSize = 12) {
  return Math.max(24, String(text || "").length * fontSize * 0.58);
}

function getMinimalNodeWidth(node) {
  if (node.type === "loopbackLeaf") {
    const title = estimateTextWidth(t("diagram.labels.loopback"), 12);
    const flow = estimateTextWidth(`${formatNumber(node.flow, 3)}/min`, 10);
    return Math.max(DIAG.factoryW, Math.ceil(Math.max(title, flow) + 34));
  }

  const title = estimateTextWidth(node.factoryName || t("diagram.labels.fallbackFactory", { index: 1 }), 12);
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

function drawMinimalBranchEdges(svg, splitter, markerId, options = {}) {
  const px = splitter.cx;
  const py = splitter.cy;
  const y1 = py + DIAG.diamondR;
  splitter.children.forEach((child) => {
    const x2 = child.cx;
    const y2 = childConnectorTopYMinimal(child);
    const midY = (y1 + y2) / 2;
    const d = `M ${px} ${y1} L ${px} ${midY} L ${x2} ${midY} L ${x2} ${y2}`;
    addPath(svg, d, markerId, {
      routeTag: options.routeTag,
      edgeFrom: splitter._diagramNodeId,
      edgeTo: child._diagramNodeId
    });
    addEdgeLabel(svg, x2, midY - 6, `${formatNumber(splitter.flowOutPerChild, 3)}/min`, {
      visible: options.showEdgeLabels !== false
    });
    if (child.type === "splitter") {
      drawMinimalBranchEdges(svg, child, markerId, options);
    }
  });
}

function drawMinimalNodes(svg, node, colors, options = {}) {
  const { collapseFactoryLeaves = false } = options;
  if (node.type === "splitter") {
    drawDiamondSplitter(svg, node, { nodeId: node._diagramNodeId });
    node.children.forEach((child) => drawMinimalNodes(svg, child, colors, options));
    return;
  }

  const branchNode = collapseFactoryLeaves && node.type === "factoryLeaf";
  const nodeW = branchNode ? Math.min(node._layoutW || DIAG.factoryW, 126) : (node._layoutW || DIAG.factoryW);
  const nodeH = branchNode ? 38 : DIAG.factoryH;
  const x = node.cx - nodeW / 2;
  const y = node.cy - nodeH / 2;

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
      t("diagram.labels.loopback"),
      `${formatNumber(node.flow, 3)}/min`,
      "#365314",
      "#365314",
      { nodeId: node._diagramNodeId }
    );
    return;
  }

  if (branchNode) {
    drawRoundedBlock(
      svg,
      x,
      y,
      nodeW,
      nodeH,
      10,
      "#1e293b",
      "#334155",
      t("diagram.labels.branch"),
      `${formatNumber(node.flow, 3)}/min`,
      "#e2e8f0",
      "#cbd5e1",
      { nodeId: node._diagramNodeId }
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
    "#f8fafc",
    { nodeId: node._diagramNodeId }
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
    let line1 = t("diagram.labels.outputIndex", { index: leaf.leafIndex + 1 });
    let line2 = t("diagram.labels.otherDestination");

    if (mode === "recirculation") {
      if (leaf.isLoopback) {
        fill = "#3a2208";
        stroke = "#f59e0b";
        line2 = t("diagram.labels.loopback");
      } else if (Number.isInteger(leaf.targetFactoryIndex)) {
        const fi = leaf.targetFactoryIndex;
        fill = factoryColors[fi] || "#14532d";
        stroke = "#0f172a";
        line2 = factoryNames[fi] || t("diagram.labels.fallbackFactory", { index: fi + 1 });
      }
    } else {
      const active = leaf.active;
      fill = active ? "#14532d" : "#0f2f1d";
      stroke = active ? accent : "#22c55e";
      line2 = active ? `${formatNumber(leaf.flow, 4)}/min` : t("diagram.labels.otherDestination");
    }
    drawRoundedBlock(
      svg,
      x,
      y,
      DIAG.leafW,
      DIAG.leafH,
      10,
      fill,
      stroke,
      line1,
      line2,
      "#ecfdf5",
      "#bbf7d0",
      { nodeId: leaf._diagramNodeId }
    );
  });
}

function renderFactoryDiagram(result, diagramIndex) {
  const wrapper = document.createElement("article");
  wrapper.className = "diagram-card";
  const diagramFlow = Number.isFinite(result.diagramRealFlow) ? result.diagramRealFlow : result.realFlow;
  const title = document.createElement("div");
  title.className = "diagram-title";
  title.textContent = t("diagram.titles.factoryDiagram", {
    name: result.name,
    target: result.targetFractionText,
    obtained: result.obtainedFractionText,
    flow: formatNumber(diagramFlow, 3)
  });
  wrapper.appendChild(title);

  const tree = result.tree;
  const markerId = `arrow-bal-${diagramIndex}-${Math.random().toString(36).slice(2, 9)}`;
  const nextNodeId = createNodeIdFactory(`factory-diagram-${diagramIndex}`);

  const svg = createSvgElement("svg", {
    class: "diagram-svg",
    role: "img",
    "aria-label": t("diagram.aria.factoryDiagram", { name: result.name })
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

  const { diamondR, entryW, entryH, leafH, mergerW, mergerH, factoryW, factoryH, unitW, levelDy, marginL, marginT, entryGap } = DIAG;
  const entrySlot = entryW + entryGap;

  let maxX = marginL + entrySlot + 400;
  let maxY = marginT + 240;

  const drawEntry = (ex, ey, flowLabel, nodeId) => {
    drawRoundedBlock(
      svg,
      ex,
      ey,
      entryW,
      entryH,
      10,
      "#2563eb",
      "#1d4ed8",
      t("diagram.labels.entry"),
      flowLabel,
      "#eff6ff",
      "#dbeafe",
      { nodeId }
    );
  };

  if (tree.trivial) {
    const entryNodeId = nextNodeId("entry");
    const finalFactoryNodeId = nextNodeId("factory");
    const ex = marginL;
    const ey = marginT;
    const flowLabel = `${formatNumber(tree.flow, 3)}/min`;
    drawEntry(ex, ey, flowLabel, entryNodeId);

    const fx = ex + entryW + 70;
    const fy = ey + entryH / 2 - factoryH / 2;
    const midY = ey + entryH / 2;
    addPath(svg, `M ${ex + entryW} ${midY} L ${fx} ${midY}`, markerId, {
      edgeFrom: entryNodeId,
      edgeTo: finalFactoryNodeId
    });
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
      `${formatNumber(diagramFlow, 3)}/min`,
      "#0b1020",
      "#f8fafc",
      { nodeId: finalFactoryNodeId }
    );
    maxX = Math.max(maxX, fx + factoryW + 40);
    maxY = Math.max(maxY, fy + factoryH + 36);
    svg.setAttribute("viewBox", `0 0 ${maxX} ${maxY}`);
    appendDiagramSvg(wrapper, svg);
    return wrapper;
  }

  const splitRoot = tree.children[0];
  measureSplitTree(splitRoot);
  assignDiagramNodeIds(splitRoot, nextNodeId);
  const labelPolicy = getLabelPolicy(splitRoot, { leafLimit: 18, splitterLimit: 20 });
  layoutSplitTree(splitRoot, 0, splitRoot._leaves, 0, {
    unitW,
    levelDy,
    marginL,
    marginT,
    entrySlot
  });

  const entryNodeId = nextNodeId("entry");
  const finalFactoryNodeId = nextNodeId("factory");
  const ex = marginL;
  const ey = splitRoot.cy - entryH / 2;
  drawEntry(ex, ey, `${formatNumber(tree.flow, 3)}/min`, entryNodeId);

  const entryMidY = ey + entryH / 2;
  const joinX = splitRoot.cx - diamondR;
  addPath(svg, `M ${ex + entryW} ${entryMidY} L ${joinX} ${entryMidY} L ${joinX} ${splitRoot.cy}`, markerId, {
    edgeFrom: entryNodeId,
    edgeTo: splitRoot._diagramNodeId
  });

  drawSplitterBranchEdges(svg, splitRoot, markerId, labelPolicy);

  const leaves = [];
  collectLeafSlots(splitRoot, leaves);
  leaves.sort((a, b) => a.leafIndex - b.leafIndex);

  const activeLeaves = leaves.filter((leaf) => leaf.active);
  const mergeInputs = activeLeaves.map((leaf) => ({
    x: leaf.cx,
    y: leaf.cy + leafH / 2,
    flow: leaf.flow,
    nodeId: leaf._diagramNodeId
  }));
  const mergeCascade = buildMergerCascade(mergeInputs, 48);
  const outputAnchor = mergeCascade.output;
  const factoryPos = outputAnchor
    ? { cx: outputAnchor.x, top: outputAnchor.y + 26 }
    : null;

  drawSplittersDepthFirst(svg, splitRoot);
  drawLeafSlots(svg, leaves, { mode: "direct", accent: result.color });
  if (mergeCascade.mergers.length > 0) {
    drawMergerCascade(svg, mergeCascade, markerId, {
      nodeIdFactory: (kind) => nextNodeId(`merger-${kind}`)
    });
  } else if (activeLeaves.length === 1 && factoryPos) {
    addPath(svg, `M ${activeLeaves[0].cx} ${activeLeaves[0].cy + leafH / 2} L ${activeLeaves[0].cx} ${factoryPos.top}`, markerId, {
      edgeFrom: activeLeaves[0]._diagramNodeId,
      edgeTo: finalFactoryNodeId
    });
  }

  if (factoryPos) {
    const fx = factoryPos.cx - factoryW / 2;
    const fy = factoryPos.top;
    if (outputAnchor && activeLeaves.length > 1) {
      addPath(svg, `M ${outputAnchor.x} ${outputAnchor.y} L ${outputAnchor.x} ${fy}`, markerId, {
        edgeFrom: outputAnchor.nodeId,
        edgeTo: finalFactoryNodeId
      });
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
      `${formatNumber(diagramFlow, 3)}/min`,
      "#0b1020",
      "#f8fafc",
      { nodeId: finalFactoryNodeId }
    );

    maxY = Math.max(maxY, fy + factoryH + 40);
    maxX = Math.max(maxX, fx + factoryW + 40);
  }

  const rightEdge = marginL + entrySlot + splitRoot._leaves * unitW + 40;
  maxX = Math.max(maxX, rightEdge);

  const deepestY = leaves.reduce((acc, leaf) => Math.max(acc, leaf.cy + leafH / 2), marginT);
  const deepestMergerY = mergeCascade.mergers.reduce((acc, merger) => (
    Math.max(acc, merger.top + mergerH)
  ), deepestY);
  maxY = Math.max(maxY, deepestMergerY + factoryH + 100);

  svg.setAttribute("viewBox", `0 0 ${maxX} ${maxY}`);
  appendDiagramSvg(wrapper, svg);
  return wrapper;
}

function renderRecirculationDiagram(solution, factories, totalFlow, colors) {
  const wrapper = document.createElement("article");
  wrapper.className = "diagram-card";
  const title = document.createElement("div");
  title.className = "diagram-title";
  title.textContent = t("diagram.titles.unifiedLoopback", {
    loopbackCount: solution.loopbackCount,
    recirculatedFlow: formatNumber(solution.recirculatedFlow, 4)
  });
  wrapper.appendChild(title);

  const tree = buildUnifiedRecirculationTree(solution, factories, totalFlow);
  if (!tree.children.length) {
    const note = document.createElement("p");
    note.className = "small";
    note.textContent = t("diagram.notes.trivial");
    wrapper.appendChild(note);
    return wrapper;
  }

  const markerId = `arrow-rec-${Math.random().toString(36).slice(2, 9)}`;
  const nextNodeId = createNodeIdFactory("recirc-diagram");
  const svg = createSvgElement("svg", {
    class: "diagram-svg",
    role: "img",
    "aria-label": t("diagram.aria.unified")
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

  const splitRoot = tree.children[0];
  measureSplitTree(splitRoot);
  assignDiagramNodeIds(splitRoot, nextNodeId);
  const labelPolicy = getLabelPolicy(splitRoot, { leafLimit: 16, splitterLimit: 18 });

  const entrySlot = DIAG.entryW + DIAG.entryGap;
  layoutSplitTree(splitRoot, 0, splitRoot._leaves, 0, {
    unitW: DIAG.unitW,
    levelDy: DIAG.levelDy,
    marginL: DIAG.marginL,
    marginT: DIAG.marginT,
    entrySlot
  });

  const entryNodeId = nextNodeId("entry");
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
    t("diagram.labels.entry"),
    `${formatNumber(totalFlow, 3)}/min`,
    "#eff6ff",
    "#dbeafe",
    { nodeId: entryNodeId }
  );

  const joinX = splitRoot.cx - DIAG.diamondR;
  const entryMidY = ey + DIAG.entryH / 2;
  addPath(svg, `M ${ex + DIAG.entryW} ${entryMidY} L ${joinX} ${entryMidY} L ${joinX} ${splitRoot.cy}`, markerId, {
    edgeFrom: entryNodeId,
    edgeTo: splitRoot._diagramNodeId
  });
  drawSplitterBranchEdges(svg, splitRoot, markerId, labelPolicy);

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
    addPath(svg, d, markerId, {
      edgeFrom: leaf._diagramNodeId,
      edgeTo: entryNodeId
    });
  });

  drawSplittersDepthFirst(svg, splitRoot);
  drawLeafSlots(svg, leaves, {
    mode: "recirculation",
    factoryColors: colors,
    factoryNames: factories.map((f) => f.name)
  });
  let maxX = DIAG.marginL + entrySlot + splitRoot._leaves * DIAG.unitW + 40;
  let maxY = leaves.reduce((acc, leaf) => Math.max(acc, leaf.cy + DIAG.leafH / 2), DIAG.marginT) + 70;
  if (maxY < 220) {
    maxY = 220;
  }
  if (maxX < 620) {
    maxX = 620;
  }
  svg.setAttribute("viewBox", `0 0 ${maxX} ${maxY}`);

  appendDiagramSvg(wrapper, svg);
  return wrapper;
}

function renderMinimalRecirculationDiagram(solution, factories, totalFlow, colors) {
  const wrapper = document.createElement("article");
  wrapper.className = "diagram-card";
  const title = document.createElement("div");
  title.className = "diagram-title";
  title.textContent = solution.usesLoopback
    ? t("diagram.titles.unifiedLoopback", {
      loopbackCount: solution.loopbackCount,
      recirculatedFlow: formatNumber(solution.recirculatedFlow, 4)
    })
    : t("diagram.titles.unifiedExact");
  wrapper.appendChild(title);

  const topology = solution.topology || buildMinimalRecirculationTopology(solution, factories, totalFlow);
  const splitRoot = topology.type === "sourceMerge" ? topology.child : topology;

  if (!splitRoot || splitRoot.type !== "splitter") {
    const note = document.createElement("p");
    note.className = "small";
    note.textContent = t("diagram.notes.trivial");
    wrapper.appendChild(note);
    return wrapper;
  }

  const markerId = `arrow-rec-min-${Math.random().toString(36).slice(2, 9)}`;
  const nextNodeId = createNodeIdFactory("recirc-min");
  const svg = createSvgElement("svg", {
    class: "diagram-svg",
    role: "img",
    "aria-label": t("diagram.aria.unified")
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

  const rootMarginT = 220;
  const siblingGap = 34;
  measureMinimalTopology(splitRoot, { siblingGap });
  assignDiagramNodeIds(splitRoot, nextNodeId);
  const labelPolicy = getLabelPolicy(splitRoot, { leafLimit: 14, splitterLimit: 16 });
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
  const freshEntryNodeId = nextNodeId("entry");
  const sourceMergerNodeId = nextNodeId("source-merger");

  drawRoundedBlock(
    svg,
    freshX,
    freshY,
    DIAG.entryW,
    DIAG.entryH,
    10,
    "#2563eb",
    "#1d4ed8",
    t("diagram.labels.newEntry"),
    `F = ${formatNumber(totalFlow, 3)}/min`,
    "#eff6ff",
    "#dbeafe",
    { nodeId: freshEntryNodeId }
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
    t("diagram.labels.merger"),
    `E = ${formatNumber(solution.effectiveInput, 3)}/min`,
    "#f5f3ff",
    "#ddd6fe",
    { nodeId: sourceMergerNodeId }
  );

  const freshMidY = freshY + DIAG.entryH / 2;
  const mergeMidY = mergeTop + DIAG.mergerH / 2;
  addPath(svg, `M ${freshX + DIAG.entryW} ${freshMidY} L ${mergeLeft} ${mergeMidY}`, markerId, {
    edgeFrom: freshEntryNodeId,
    edgeTo: sourceMergerNodeId
  });
  addPath(svg, `M ${mergeCx} ${mergeBottom} L ${mergeCx} ${splitRoot.cy - DIAG.diamondR}`, markerId, {
    edgeFrom: sourceMergerNodeId,
    edgeTo: splitRoot._diagramNodeId
  });

  const loopLeaves = [];
  collectMinimalNodes(splitRoot, (node) => node.type === "loopbackLeaf", loopLeaves);
  loopLeaves.forEach((leaf, index) => {
    const startX = leaf.cx + ((leaf._layoutW || DIAG.factoryW) / 2);
    const startY = leaf.cy;
    const returnJoinY = mergeMidY + 22 + index * 22;
    const d = `M ${startX} ${startY} L ${loopReturnX} ${startY} L ${loopReturnX} ${returnJoinY} L ${mergeRight} ${returnJoinY} L ${mergeRight} ${mergeMidY}`;
    addPath(svg, d, markerId, {
      edgeFrom: leaf._diagramNodeId,
      edgeTo: sourceMergerNodeId
    });
    addEdgeLabel(svg, loopReturnX - 20, returnJoinY - 6, `F_recirc = ${formatNumber(leaf.flow, 3)}/min`, {
      visible: labelPolicy.showEdgeLabels
    });
  });

  drawMinimalBranchEdges(svg, splitRoot, markerId, labelPolicy);
  drawMinimalNodes(svg, splitRoot, colors, { collapseFactoryLeaves: true });
  const factoryLeaves = [];
  collectMinimalNodes(splitRoot, (node) => node.type === "factoryLeaf", factoryLeaves);
  const leavesByFactory = new Map();
  factoryLeaves.forEach((leaf) => {
    const bucket = leavesByFactory.get(leaf.factoryIndex) || [];
    bucket.push(leaf);
    leavesByFactory.set(leaf.factoryIndex, bucket);
  });

  const factoryLayouts = Array.from(leavesByFactory.entries()).map(([factoryIndex, leavesForFactory]) => {
    const ordered = [...leavesForFactory].sort((a, b) => a.cx - b.cx);
    const inputs = ordered.map((leaf) => ({
      x: leaf.cx,
      y: leaf.cy + 19,
      flow: leaf.flow,
      nodeId: leaf._diagramNodeId
    }));
    const cascade = buildMergerCascade(inputs, 48);
    const output = cascade.output || inputs[0] || null;
    const totalFactoryFlow = ordered.reduce((acc, leaf) => acc + leaf.flow, 0);
    return {
      factoryIndex,
      name: factories[factoryIndex]?.name || t("diagram.labels.fallbackFactory", { index: factoryIndex + 1 }),
      totalFactoryFlow,
      cascade,
      output,
      factoryCx: output?.x ?? 0,
      factoryTop: null,
      nodeId: nextNodeId(`factory-${factoryIndex + 1}`)
    };
  });

  factoryLayouts.forEach((layout) => {
    if (layout.cascade.mergers.length > 0) {
      drawMergerCascade(svg, layout.cascade, markerId, {
        routeTag: "factory-merge",
        nodeIdFactory: (kind) => nextNodeId(`factory-merge-${layout.factoryIndex + 1}-${kind}`)
      });
    }
  });

  if (factoryLayouts.length > 0) {
    const sortedLayouts = [...factoryLayouts].sort((a, b) => (a.output?.x || 0) - (b.output?.x || 0));
    const minCenterX = DIAG.marginL + DIAG.factoryW / 2;
    const minGap = DIAG.factoryW + 18;
    let cursor = Number.NEGATIVE_INFINITY;
    sortedLayouts.forEach((layout, index) => {
      const preferredX = layout.output?.x ?? minCenterX;
      const minAllowedX = index === 0
        ? minCenterX
        : cursor + minGap;
      layout.factoryCx = Math.max(preferredX, minAllowedX);
      cursor = layout.factoryCx;
    });

    const maxOutputY = sortedLayouts.reduce((acc, layout) => (
      Math.max(acc, layout.output?.y ?? mergeBottom)
    ), mergeBottom);
    const factoryTop = maxOutputY + 34;

    sortedLayouts.forEach((layout) => {
      const outX = layout.output?.x ?? layout.factoryCx;
      const outY = layout.output?.y ?? factoryTop;
      const trunkY = factoryTop - 16;
      if (Math.abs(layout.factoryCx - outX) < 0.5) {
        addPath(svg, `M ${outX} ${outY} L ${layout.factoryCx} ${factoryTop}`, markerId, {
          routeTag: "factory-final",
          edgeFrom: layout.output?.nodeId,
          edgeTo: layout.nodeId
        });
      } else {
        addPath(svg, `M ${outX} ${outY} L ${outX} ${trunkY} L ${layout.factoryCx} ${trunkY} L ${layout.factoryCx} ${factoryTop}`, markerId, {
          routeTag: "factory-final",
          edgeFrom: layout.output?.nodeId,
          edgeTo: layout.nodeId
        });
      }
      drawRoundedBlock(
        svg,
        layout.factoryCx - DIAG.factoryW / 2,
        factoryTop,
        DIAG.factoryW,
        DIAG.factoryH,
        12,
        colors[layout.factoryIndex] || "#14532d",
        "#0f172a",
        layout.name,
        `${formatNumber(layout.totalFactoryFlow, 3)}/min`,
        "#0b1020",
        "#f8fafc",
        { nodeId: layout.nodeId }
      );
      layout.factoryTop = factoryTop;
    });
  }

  const deepestY = allNodes.reduce((acc, node) => {
    const bottom = node.type === "splitter"
      ? node.cy + DIAG.diamondR
      : node.cy + DIAG.factoryH / 2;
    return Math.max(acc, bottom);
  }, mergeBottom);
  const deepestAggregationY = factoryLayouts.reduce((acc, layout) => {
    const mergerBottom = layout.cascade.mergers.reduce((innerAcc, merger) => (
      Math.max(innerAcc, merger.top + DIAG.mergerH)
    ), Number.NEGATIVE_INFINITY);
    const factoryBottom = Number.isFinite(layout.factoryTop)
      ? layout.factoryTop + DIAG.factoryH
      : Number.NEGATIVE_INFINITY;
    return Math.max(acc, mergerBottom, factoryBottom);
  }, Number.NEGATIVE_INFINITY);
  const aggregationBounds = factoryLayouts.reduce((acc, layout) => {
    layout.cascade.mergers.forEach((merger) => {
      acc.min = Math.min(acc.min, merger.cx - DIAG.mergerW / 2);
      acc.max = Math.max(acc.max, merger.cx + DIAG.mergerW / 2);
    });
    if (Number.isFinite(layout.factoryCx) && Number.isFinite(layout.factoryTop)) {
      acc.min = Math.min(acc.min, layout.factoryCx - DIAG.factoryW / 2);
      acc.max = Math.max(acc.max, layout.factoryCx + DIAG.factoryW / 2);
    }
    return acc;
  }, { min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY });

  const minX = Math.min(minNodeLeft, freshX, mergeLeft, aggregationBounds.min) - 44;
  const maxX = Math.max(maxNodeRight, loopReturnX, freshX + DIAG.entryW, mergeRight, aggregationBounds.max) + 72;
  const minY = Math.min(16, mergeTop - 62);
  const maxY = Math.max(360, deepestY + 86, deepestAggregationY + 72);
  svg.setAttribute("viewBox", `${minX} ${minY} ${maxX - minX} ${maxY - minY}`);

  appendDiagramSvg(wrapper, svg);
  return wrapper;
}

function drawEntryCircle(svg, cx, cy, label, flow, options = {}) {
  const radius = 34;
  const group = createSvgElement("g");
  annotateFlowNode(group, options.nodeId);
  group.appendChild(createSvgElement("circle", {
    cx,
    cy,
    r: radius,
    fill: "#93c5fd",
    stroke: "#1d4ed8",
    "stroke-width": 2
  }));

  const title = createSvgElement("text", {
    x: cx,
    y: cy - 2,
    "text-anchor": "middle",
    fill: "#1e293b",
    "font-size": 11,
    "font-weight": 700
  });
  title.textContent = label;
  group.appendChild(title);

  const flowText = createSvgElement("text", {
    x: cx,
    y: cy + 14,
    "text-anchor": "middle",
    fill: "#1e293b",
    "font-size": 10
  });
  flowText.textContent = `${formatNumber(flow, 3)}/min`;
  group.appendChild(flowText);
  svg.appendChild(group);
  return group;
}

function getCollapsedNodeTop(node) {
  if (node.type === "splitter") {
    return node.cy - DIAG.diamondR;
  }
  if (node.type === "factoryLeaf") {
    return node.cy - 19;
  }
  return node.cy - DIAG.factoryH / 2;
}

function getCollapsedNodeBottom(node) {
  if (node.type === "splitter") {
    return node.cy + DIAG.diamondR;
  }
  if (node.type === "factoryLeaf") {
    return node.cy + 19;
  }
  return node.cy + DIAG.factoryH / 2;
}

function collectFactoryLeafAnchors(node, out) {
  if (!node) {
    return;
  }
  if (node.type === "factoryLeaf") {
    out.push({
      factoryIndex: node.globalFactoryIndex ?? node.factoryIndex ?? 0,
      flow: node.flow || 0,
      x: node.cx,
      y: getCollapsedNodeBottom(node),
      nodeId: node._diagramNodeId || null
    });
    return;
  }
  if (node.type === "splitter") {
    node.children.forEach((child) => collectFactoryLeafAnchors(child, out));
  }
}

function renderMultiEntryScenarioDiagram(results, scenario) {
  const laneCount = Math.max(1, Math.trunc(scenario?.inputLanes || 1));
  if (laneCount <= 1) {
    return null;
  }

  const lanePlan = buildLaneTopologyPlan(results, scenario);
  const wrapper = document.createElement("article");
  wrapper.className = "diagram-card";

  const title = document.createElement("div");
  title.className = "diagram-title";
  const totalFlowGlobal = Number.isFinite(scenario?.totalFlowGlobal)
    ? scenario.totalFlowGlobal
    : results.reduce((sum, row) => sum + (Number(row.realFlow) || 0), 0);
  title.textContent = t("diagram.titles.multiEntry", {
    laneCount,
    flowPerLane: formatNumber(scenario?.flowPerLane || 0, 4),
    totalFlow: formatNumber(totalFlowGlobal, 4)
  });
  wrapper.appendChild(title);

  const markerId = `arrow-multi-${Math.random().toString(36).slice(2, 9)}`;
  const nextNodeId = createNodeIdFactory("multi-entry");
  const svg = createSvgElement("svg", {
    class: "diagram-svg",
    role: "img",
    "aria-label": t("diagram.aria.multiEntry")
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

  const laneGap = 140;
  const laneStartY = 210;
  const entryY = 70;
  const laneSiblingGap = 28;
  const laneLevelDy = 110;
  const laneEntries = [];
  const laneLayouts = [];
  const stagedAnchorsByFactory = new Map();
  let loopbackRouteOrdinal = 0;
  let cursorX = 44;
  let maxLaneBottom = laneStartY;
  let rightMostX = 0;

  lanePlan.lanes.forEach((lane) => {
    const laneRoot = lane.topology;
    const laneEntryNodeId = nextNodeId(`entry-${lane.laneIndex + 1}`);
    let laneWidth = 150;
    let laneLeft = cursorX;
    let laneRight = laneLeft + laneWidth;
    let laneCenterX = cursorX + laneWidth / 2;
    let laneBottom = laneStartY;
    const laneFactoryGroups = new Map();

    if (laneRoot) {
      measureMinimalTopology(laneRoot, { siblingGap: laneSiblingGap });
      assignDiagramNodeIds(laneRoot, nextNodeId);
      laneWidth = Math.max(150, laneRoot._layoutW + 24);
      laneLeft = cursorX;
      laneRight = laneLeft + laneWidth;
      layoutMinimalTopology(laneRoot, cursorX, 0, {
        marginT: laneStartY,
        levelDy: laneLevelDy,
        siblingGap: laneSiblingGap
      });
      laneCenterX = laneRoot.cx;
    }

    laneEntries.push({
      laneIndex: lane.laneIndex,
      x: laneCenterX,
      y: entryY,
      flow: lane.totalFlow,
      nodeId: laneEntryNodeId
    });

    if (laneRoot) {
      const rootTop = getCollapsedNodeTop(laneRoot);
      addPath(svg, `M ${laneCenterX} ${entryY + 34} L ${laneCenterX} ${rootTop}`, markerId, {
        routeTag: "lane-entry",
        edgeFrom: laneEntryNodeId,
        edgeTo: laneRoot._diagramNodeId
      });

      if (laneRoot.type === "splitter") {
        const labelPolicy = getLabelPolicy(laneRoot, { leafLimit: 14, splitterLimit: 16 });
        drawMinimalBranchEdges(svg, laneRoot, markerId, {
          ...labelPolicy,
          routeTag: "lane-tree"
        });
      }
      drawMinimalNodes(svg, laneRoot, results.map((row) => row.color), { collapseFactoryLeaves: true });

      const laneFactoryAnchors = [];
      collectFactoryLeafAnchors(laneRoot, laneFactoryAnchors);
      laneFactoryAnchors.forEach((anchor) => {
        const list = laneFactoryGroups.get(anchor.factoryIndex) || [];
        list.push(anchor);
        laneFactoryGroups.set(anchor.factoryIndex, list);
      });

      const loopbackLeaves = [];
      collectMinimalNodes(laneRoot, (node) => node.type === "loopbackLeaf", loopbackLeaves);
      loopbackLeaves.forEach((leaf, index) => {
        const startX = leaf.cx + ((leaf._layoutW || DIAG.factoryW) / 2);
        const startY = leaf.cy;
        const routeSlot = lane.laneIndex * 7 + index * 3 + loopbackRouteOrdinal;
        const returnY = 8 + (routeSlot % 18) * 3;
        loopbackRouteOrdinal += 1;
        addPath(
          svg,
          `M ${startX} ${startY} L ${startX} ${returnY} L ${laneCenterX} ${returnY} L ${laneCenterX} ${entryY + 34}`,
          markerId,
          {
            routeTag: "lane-loopback",
            edgeFrom: leaf._diagramNodeId,
            edgeTo: laneEntryNodeId
          }
        );
      });

      const laneNodes = [];
      collectMinimalNodes(laneRoot, () => true, laneNodes);
      laneBottom = laneNodes.reduce(
        (maxBottom, node) => Math.max(maxBottom, getCollapsedNodeBottom(node)),
        laneStartY
      );
      maxLaneBottom = Math.max(maxLaneBottom, laneBottom);
      rightMostX = Math.max(rightMostX, laneCenterX + laneWidth / 2);
    } else {
      rightMostX = Math.max(rightMostX, laneCenterX + laneWidth / 2);
    }

    laneLayouts.push({
      laneIndex: lane.laneIndex,
      laneLeft,
      laneRight,
      laneCenterX,
      laneBottom,
      factoryGroups: laneFactoryGroups
    });

    cursorX += laneWidth + laneGap;
  });

  laneEntries.forEach((entry) => {
    drawEntryCircle(
      svg,
      entry.x,
      entry.y,
      t("diagram.labels.inputIndex", { index: entry.laneIndex + 1 }),
      entry.flow,
      { nodeId: entry.nodeId }
    );
  });

  const stageBandTop = maxLaneBottom + 58;
  const laneStageGap = 44;
  let stageBottom = stageBandTop;
  laneLayouts.forEach((laneLayout) => {
    const grouped = Array.from(laneLayout.factoryGroups.entries())
      .sort((a, b) => a[0] - b[0]);
    const laneExitBaseY = stageBandTop + laneLayout.laneIndex * laneStageGap;
    grouped.forEach(([factoryIndex, anchors], localIndex) => {
      const orderedAnchors = [...anchors].sort((a, b) => a.x - b.x || a.y - b.y);
      const cascadeInputs = orderedAnchors.map((anchor) => ({
        x: anchor.x,
        y: anchor.y,
        flow: anchor.flow,
        nodeId: anchor.nodeId
      }));
      const laneCascade = cascadeInputs.length > 1
        ? buildMergerCascade(cascadeInputs, 24)
        : { mergers: [], output: cascadeInputs[0] || null };

      if (laneCascade.mergers.length > 0) {
        drawMergerCascade(svg, laneCascade, markerId, {
          routeTag: "lane-stage",
          nodeIdFactory: (kind) => nextNodeId(`lane-${laneLayout.laneIndex + 1}-factory-${factoryIndex + 1}-${kind}`)
        });
      }

      const stageSource = laneCascade.output || cascadeInputs[0];
      if (!stageSource) {
        return;
      }

      const laneExitY = laneExitBaseY + localIndex * 12;
      const stageNodeId = nextNodeId(`lane-${laneLayout.laneIndex + 1}-factory-${factoryIndex + 1}-exit`);
      addPath(
        svg,
        `M ${stageSource.x} ${stageSource.y} L ${stageSource.x} ${laneExitY}`,
        markerId,
        {
          routeTag: "lane-stage",
          edgeFrom: stageSource.nodeId,
          edgeTo: stageNodeId
        }
      );

      const stagedAnchor = {
        factoryIndex,
        x: stageSource.x,
        y: laneExitY,
        flow: orderedAnchors.reduce((sum, anchor) => sum + (anchor.flow || 0), 0),
        nodeId: stageNodeId,
        laneIndex: laneLayout.laneIndex
      };
      const list = stagedAnchorsByFactory.get(factoryIndex) || [];
      list.push(stagedAnchor);
      stagedAnchorsByFactory.set(factoryIndex, list);
      stageBottom = Math.max(stageBottom, laneExitY);
    });
  });

  const activeFactoryIndices = results
    .map((row, index) => ({ index, flow: row.realFlow }))
    .filter((row) => row.flow > 1e-9)
    .map((row) => row.index);
  const minCenterX = DIAG.marginL + DIAG.factoryW / 2;
  const minGap = DIAG.factoryW + 18;
  const factoryLayouts = activeFactoryIndices.map((factoryIndex) => {
    const row = results[factoryIndex];
    const inputs = [...(stagedAnchorsByFactory.get(factoryIndex) || [])]
      .sort((a, b) => a.x - b.x || a.y - b.y);
    const cascade = inputs.length > 1
      ? buildMergerCascade(inputs, 52)
      : { mergers: [], output: inputs[0] || null };
    const outputAnchor = cascade.output || inputs[0] || null;
    return {
      factoryIndex,
      row,
      inputs,
      cascade,
      outputAnchor,
      preferredX: outputAnchor?.x ?? minCenterX,
      factoryCx: minCenterX,
      nodeId: nextNodeId(`factory-${factoryIndex + 1}`)
    };
  });

  factoryLayouts.forEach((layout) => {
    if (layout.cascade.mergers.length > 0) {
      drawMergerCascade(svg, layout.cascade, markerId, {
        routeTag: "factory-merge",
        nodeIdFactory: (kind) => nextNodeId(`factory-merge-${layout.factoryIndex + 1}-${kind}`)
      });
    }
  });

  const sortedFactoryLayouts = [...factoryLayouts]
    .sort((a, b) => a.preferredX - b.preferredX || a.factoryIndex - b.factoryIndex);

  let factoryRowY = maxLaneBottom + 170;
  let factoryRightEdge = rightMostX;
  if (sortedFactoryLayouts.length > 0) {
    let cursorCenter = Number.NEGATIVE_INFINITY;
    sortedFactoryLayouts.forEach((layout, index) => {
      const minAllowedX = index === 0 ? minCenterX : cursorCenter + minGap;
      layout.factoryCx = Math.max(layout.preferredX, minAllowedX);
      cursorCenter = layout.factoryCx;
    });

    const maxOutputY = sortedFactoryLayouts.reduce(
      (acc, layout) => Math.max(acc, layout.outputAnchor?.y ?? stageBottom + 24),
      stageBottom + 24
    );
    const baseTrunkY = maxOutputY + 32;
    factoryRowY = baseTrunkY + Math.max(36, (sortedFactoryLayouts.length - 1) * 18 + 28);

    sortedFactoryLayouts.forEach((layout, index) => {
      const targetTop = factoryRowY;
      const outX = layout.outputAnchor?.x ?? layout.factoryCx;
      const outY = layout.outputAnchor?.y ?? (baseTrunkY - 16);
      const trunkY = baseTrunkY + index * 18;
      addPath(
        svg,
        `M ${outX} ${outY} L ${outX} ${trunkY} L ${layout.factoryCx} ${trunkY} L ${layout.factoryCx} ${targetTop}`,
        markerId,
        {
          routeTag: "factory-final",
          edgeFrom: layout.outputAnchor?.nodeId,
          edgeTo: layout.nodeId
        }
      );

      drawRoundedBlock(
        svg,
        layout.factoryCx - DIAG.factoryW / 2,
        targetTop,
        DIAG.factoryW,
        DIAG.factoryH,
        12,
        layout.row.color || "#14532d",
        "#0f172a",
        layout.row.name,
        `${formatNumber(layout.row.realFlow, 3)}/min`,
        "#0b1020",
        "#f8fafc",
        { nodeId: layout.nodeId }
      );

      factoryRightEdge = Math.max(factoryRightEdge, layout.factoryCx + DIAG.factoryW / 2, outX);
    });
  }

  const width = Math.max(920, cursorX + 40, factoryRightEdge + 72, rightMostX + 60);
  const height = Math.max(520, factoryRowY + DIAG.factoryH + 110, stageBottom + 150);
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

  appendDiagramSvg(wrapper, svg);
  return wrapper;
}

export function renderDiagrams(refs, results, scenario = null) {
  refs.diagramWrap.innerHTML = "";
  const inputLanes = Math.max(1, Math.trunc(scenario?.inputLanes || 1));
  if (inputLanes > 1) {
    const unified = renderMultiEntryScenarioDiagram(results, scenario);
    if (unified) {
      refs.diagramWrap.appendChild(unified);
      return;
    }
  }

  const unified = scenario?.unified || scenario?.recirc || null;
  if (scenario && (scenario.mode === "unified" || scenario.mode === "recirculation") && unified) {
    const factories = scenario.factories || [];
    const colors = results.map((row) => row.color || "#14532d");
    refs.diagramWrap.appendChild(
      renderMinimalRecirculationDiagram(unified, factories, scenario.totalFlow, colors)
    );
    return;
  }
  results.forEach((result, index) => {
    refs.diagramWrap.appendChild(renderFactoryDiagram(result, index));
  });
}

