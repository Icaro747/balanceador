import { describe, expect, it } from "vitest";

import {
  buildMinimalRecirculationTopology,
  buildDeviceTree,
  buildUnifiedRecirculationTree,
  collectLeafSlots
} from "../js/tree.js";
import { findRecirculationSolution } from "../js/math.js";

function sortedLeaves(treeRoot) {
  const leaves = [];
  const root = treeRoot.children[0] ?? treeRoot.trivial;
  if (root) {
    collectLeafSlots(root, leaves);
  }
  return leaves.sort((a, b) => a.leafIndex - b.leafIndex);
}

describe("buildDeviceTree", () => {
  it("creates a trivial tree when no splitters are needed", () => {
    const tree = buildDeviceTree({ a: 0, b: 0, d: 1, k: 1 }, "Fabrica 1", "#fff", 60);

    expect(tree.type).toBe("entry");
    expect(tree.children).toEqual([]);
    expect(tree.trivial).toMatchObject({
      type: "leafSlot",
      flow: 60,
      active: true
    });
    expect(tree.meta).toMatchObject({
      totalLeaves: 1,
      selectedLeaves: 1,
      leafFlow: 60
    });
  });

  it("marks a single active leaf using the factory index when k is 1", () => {
    const tree = buildDeviceTree({ a: 1, b: 1, d: 6, k: 1 }, "Fabrica 3", "#fff", 60, 2);
    const leaves = sortedLeaves(tree);

    expect(leaves).toHaveLength(6);
    expect(leaves.filter((leaf) => leaf.active).map((leaf) => leaf.leafIndex)).toEqual([2]);
    expect(tree.meta).toMatchObject({
      totalLeaves: 6,
      selectedLeaves: 1,
      leafFlow: 10
    });
  });

  it("marks the first k leaves as active when more than one branch is selected", () => {
    const tree = buildDeviceTree({ a: 2, b: 0, d: 4, k: 2 }, "Fabrica 1", "#fff", 80, 0);
    const leaves = sortedLeaves(tree);

    expect(leaves.filter((leaf) => leaf.active).map((leaf) => leaf.leafIndex)).toEqual([0, 1]);
    expect(tree.meta).toMatchObject({
      totalLeaves: 4,
      selectedLeaves: 2,
      leafFlow: 20
    });
  });
});

describe("buildUnifiedRecirculationTree", () => {
  it("assigns leaves to factories in order and marks the remainder as loop-back", () => {
    const factories = Array.from({ length: 5 }, (_, index) => ({
      name: `Fabrica ${index + 1}`,
      weight: 1
    }));
    const solution = findRecirculationSolution(factories, 4, 60);
    const tree = buildUnifiedRecirculationTree(solution, factories, 60);
    const leaves = sortedLeaves(tree);

    expect(leaves).toHaveLength(6);
    expect(leaves.slice(0, 5).map((leaf) => leaf.targetFactoryName)).toEqual([
      "Fabrica 1",
      "Fabrica 2",
      "Fabrica 3",
      "Fabrica 4",
      "Fabrica 5"
    ]);
    expect(leaves.slice(0, 5).every((leaf) => leaf.isLoopback === false)).toBe(true);
    expect(leaves[5]).toMatchObject({
      isLoopback: true,
      targetFactoryName: "Loop-back"
    });
  });
});

describe("buildMinimalRecirculationTopology", () => {
  it("compresses homogeneous subtrees into terminal factory leaves", () => {
    const factories = [
      { name: "Fabrica 1", weight: 1 },
      { name: "Fabrica 2", weight: 1 },
      { name: "Fabrica 3", weight: 1 },
      { name: "Fabrica 4", weight: 0.5 }
    ];
    const solution = findRecirculationSolution(factories, 4, 60);
    const topology = buildMinimalRecirculationTopology(solution, factories, 60);
    const root = topology.child;

    expect(topology).toMatchObject({
      type: "sourceMerge",
      freshFlow: 60,
      recirculatedFlow: 60 / 7,
      effectiveFlow: 480 / 7
    });
    expect(root).toMatchObject({
      type: "splitter",
      div: 2,
      flowIn: 480 / 7
    });
    expect(root.children[0].children).toEqual([
      expect.objectContaining({ type: "factoryLeaf", factoryName: "Fabrica 1", flow: 120 / 7 }),
      expect.objectContaining({ type: "factoryLeaf", factoryName: "Fabrica 2", flow: 120 / 7 })
    ]);
    expect(root.children[1].children[0]).toMatchObject({
      type: "factoryLeaf",
      factoryName: "Fabrica 3",
      flow: 120 / 7
    });
    expect(root.children[1].children[1]).toMatchObject({
      type: "splitter",
      children: [
        expect.objectContaining({ type: "factoryLeaf", factoryName: "Fabrica 4", flow: 60 / 7 }),
        expect.objectContaining({ type: "loopbackLeaf", flow: 60 / 7 })
      ]
    });
  });

  it("keeps a full child split only when a span still mixes destinations", () => {
    const factories = Array.from({ length: 5 }, (_, index) => ({
      name: `Fabrica ${index + 1}`,
      weight: 1
    }));
    const solution = findRecirculationSolution(factories, 4, 60);
    const topology = buildMinimalRecirculationTopology(solution, factories, 60);

    expect(topology.type).toBe("sourceMerge");
    expect(topology.child).toMatchObject({
      type: "splitter",
      div: 3,
      flowIn: 72
    });
    expect(topology.child.children).toHaveLength(3);
    expect(topology.child.children.every((child) => child.type === "splitter")).toBe(true);
  });
});
