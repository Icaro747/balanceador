export function collectLeafSlots(node, out) {
  if (node.type === "leafSlot") {
    out.push(node);
    return;
  }
  if (node.type === "splitter") {
    node.children.forEach((child) => collectLeafSlots(child, out));
  }
}

export function measureSplitTree(node) {
  if (node.type === "leafSlot") {
    node._leaves = 1;
    return 1;
  }
  if (node.type === "splitter") {
    let sum = 0;
    node.children.forEach((child) => {
      sum += measureSplitTree(child);
    });
    node._leaves = sum;
    return sum;
  }
  return 0;
}

export function layoutSplitTree(node, leftUnit, rightUnit, depth, cfg) {
  const { unitW, levelDy, marginL, marginT, entrySlot } = cfg;
  const centerX = marginL + entrySlot + ((leftUnit + rightUnit) / 2) * unitW;
  const y = marginT + depth * levelDy;

  if (node.type === "leafSlot") {
    node.cx = centerX;
    node.cy = y;
    return;
  }

  node.cx = centerX;
  node.cy = y;
  let cur = leftUnit;
  node.children.forEach((child) => {
    const w = child._leaves;
    layoutSplitTree(child, cur, cur + w, depth + 1, cfg);
    cur += w;
  });
}

export function buildDeviceTree(best, factoryName, color, totalFlow, factoryIndex = 0) {
  const factors = [
    ...Array.from({ length: best.b }, () => 3),
    ...Array.from({ length: best.a }, () => 2)
  ];
  const d = best.d;
  const k = best.k;
  const leafFlow = totalFlow / d;

  function buildLevel(level, leafIndexStart, spanLeaves) {
    if (level === factors.length) {
      const active =
        k === 1 && d > 1 ? leafIndexStart === factoryIndex % d : leafIndexStart < k;
      return {
        type: "leafSlot",
        leafIndex: leafIndexStart,
        flow: leafFlow,
        active
      };
    }
    const f = factors[level];
    const perChild = spanLeaves / f;
    const children = [];
    for (let i = 0; i < f; i += 1) {
      children.push(buildLevel(level + 1, leafIndexStart + i * perChild, perChild));
    }
    const flowIn = leafFlow * spanLeaves;
    return {
      type: "splitter",
      div: f,
      flowIn,
      flowOutPerChild: flowIn / f,
      children
    };
  }

  if (factors.length === 0) {
    return {
      type: "entry",
      flow: totalFlow,
      children: [],
      trivial: {
        type: "leafSlot",
        leafIndex: 0,
        flow: totalFlow,
        active: k > 0
      },
      meta: {
        totalLeaves: d,
        selectedLeaves: k,
        leafFlow: totalFlow
      },
      factoryName,
      color,
      k
    };
  }

  const splitRoot = buildLevel(0, 0, d);

  return {
    type: "entry",
    flow: totalFlow,
    children: [splitRoot],
    meta: {
      totalLeaves: d,
      selectedLeaves: k,
      leafFlow
    },
    factoryName,
    color,
    k
  };
}

function buildRecirculationAssignments(recirc) {
  const assignments = [];
  recirc.kValues.forEach((k, factoryIndex) => {
    for (let i = 0; i < k; i += 1) {
      assignments.push(factoryIndex);
    }
  });
  for (let i = 0; i < recirc.loopbackCount; i += 1) {
    assignments.push(null);
  }
  return assignments;
}

function countSplitterLeaves(node) {
  if (!node) {
    return 0;
  }
  if (node.type === "splitter") {
    return node.children.reduce((acc, child) => acc + countSplitterLeaves(child), 0);
  }
  return node.spanLeaves ?? 1;
}

function collectFactoryLeafStats(node, map) {
  if (!node) {
    return;
  }
  if (node.type === "factoryLeaf") {
    const current = map.get(node.factoryIndex) || {
      factoryIndex: node.factoryIndex,
      factoryName: node.factoryName,
      flow: 0,
      inputCount: 0
    };
    current.flow += node.flow;
    current.inputCount += 1;
    map.set(node.factoryIndex, current);
    return;
  }
  if (node.type === "splitter") {
    node.children.forEach((child) => collectFactoryLeafStats(child, map));
  }
}

function countMergersForInputCount(inputCount) {
  const n = Math.max(0, Math.trunc(inputCount));
  if (n <= 1) {
    return 0;
  }
  return Math.ceil((n - 1) / 2);
}

export function buildMinimalRecirculationTopology(recirc, factories, totalFlow) {
  const factors = [
    ...Array.from({ length: recirc.b }, () => 3),
    ...Array.from({ length: recirc.a }, () => 2)
  ];
  const assignments = buildRecirculationAssignments(recirc);

  function createTerminalNode(targetFactoryIndex, spanLeaves) {
    const flow = recirc.leafFlow * spanLeaves;
    if (targetFactoryIndex === null) {
      return {
        type: "loopbackLeaf",
        flow,
        spanLeaves
      };
    }
    return {
      type: "factoryLeaf",
      factoryIndex: targetFactoryIndex,
      factoryName: factories[targetFactoryIndex].name,
      flow,
      spanLeaves
    };
  }

  function buildRange(level, start, spanLeaves) {
    const firstTarget = assignments[start];
    let homogeneous = true;
    for (let i = start + 1; i < start + spanLeaves; i += 1) {
      if (assignments[i] !== firstTarget) {
        homogeneous = false;
        break;
      }
    }

    if (homogeneous || level >= factors.length) {
      return createTerminalNode(firstTarget, spanLeaves);
    }

    const div = factors[level];
    const perChild = spanLeaves / div;
    const children = [];
    for (let i = 0; i < div; i += 1) {
      children.push(buildRange(level + 1, start + i * perChild, perChild));
    }

    return {
      type: "splitter",
      div,
      flowIn: recirc.leafFlow * spanLeaves,
      flowOutPerChild: recirc.leafFlow * perChild,
      spanLeaves,
      children
    };
  }

  const child = factors.length
    ? buildRange(0, 0, recirc.d)
    : createTerminalNode(assignments[0] ?? null, 1);

  const leafStats = new Map();
  collectFactoryLeafStats(child, leafStats);
  const factoryMergers = Array.from(leafStats.values())
    .filter((entry) => entry.inputCount > 1)
    .map((entry) => ({
      type: "factoryMerger",
      factoryIndex: entry.factoryIndex,
      factoryName: entry.factoryName,
      flow: entry.flow,
      inputCount: entry.inputCount
    }));

  if (recirc.loopbackCount > 0) {
    return {
      type: "sourceMerge",
      freshFlow: totalFlow,
      recirculatedFlow: recirc.recirculatedFlow,
      effectiveFlow: recirc.effectiveInput,
      factoryMergers,
      child
    };
  }

  return child;
}

export function countMinimalTopologyDevices(topology) {
  function countNode(node) {
    if (!node) {
      return 0;
    }
    if (node.type === "splitter") {
      return 1 + node.children.reduce((acc, child) => acc + countNode(child), 0);
    }
    return 0;
  }

  function collectFactoryInputs(node, stats) {
    if (!node) {
      return;
    }
    if (node.type === "factoryLeaf") {
      const current = stats.get(node.factoryIndex) || 0;
      stats.set(node.factoryIndex, current + 1);
      return;
    }
    if (node.type === "splitter") {
      node.children.forEach((child) => collectFactoryInputs(child, stats));
    }
  }

  if (!topology) {
    return 0;
  }

  const splitRoot = topology.type === "sourceMerge" ? topology.child : topology;
  const factoryInputs = new Map();
  collectFactoryInputs(splitRoot, factoryInputs);
  const factoryMergerCount = Array.from(factoryInputs.values())
    .reduce((acc, inputCount) => acc + countMergersForInputCount(inputCount), 0);

  if (topology.type === "sourceMerge") {
    return 1 + factoryMergerCount + countNode(topology.child);
  }

  return factoryMergerCount + countNode(topology);
}

export function buildUnifiedRecirculationTree(recirc, factories, totalFlow) {
  const factors = [
    ...Array.from({ length: recirc.b }, () => 3),
    ...Array.from({ length: recirc.a }, () => 2)
  ];
  const d = recirc.d;

  function buildLevel(level, leafIndexStart, spanLeaves) {
    if (level === factors.length) {
      return {
        type: "leafSlot",
        leafIndex: leafIndexStart,
        flow: recirc.leafFlow,
        isLoopback: false,
        targetFactoryIndex: null
      };
    }
    const f = factors[level];
    const perChild = spanLeaves / f;
    const children = [];
    for (let i = 0; i < f; i += 1) {
      children.push(buildLevel(level + 1, leafIndexStart + i * perChild, perChild));
    }
    const flowIn = recirc.leafFlow * spanLeaves;
    return {
      type: "splitter",
      div: f,
      flowIn,
      flowOutPerChild: flowIn / f,
      children
    };
  }

  if (!factors.length) {
    return {
      type: "entry",
      flow: totalFlow,
      children: [],
      trivial: true,
      meta: {
        ...recirc
      }
    };
  }

  const splitRoot = buildLevel(0, 0, d);
  const leaves = [];
  collectLeafSlots(splitRoot, leaves);
  leaves.sort((a, b) => a.leafIndex - b.leafIndex);

  const assignments = [];
  recirc.kValues.forEach((k, factoryIndex) => {
    for (let i = 0; i < k; i += 1) {
      assignments.push(factoryIndex);
    }
  });

  leaves.forEach((leaf, index) => {
    if (index < assignments.length) {
      leaf.targetFactoryIndex = assignments[index];
      leaf.targetFactoryName = factories[assignments[index]].name;
      leaf.isLoopback = false;
    } else {
      leaf.isLoopback = true;
      leaf.targetFactoryIndex = null;
      leaf.targetFactoryName = "Loop-back";
    }
  });

  return {
    type: "entry",
    flow: totalFlow,
    children: [splitRoot],
    meta: {
      ...recirc
    }
  };
}
