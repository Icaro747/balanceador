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
