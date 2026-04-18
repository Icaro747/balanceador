export default {
  app: {
    title: "Flow Solutions Suite"
  },
  common: {
    nd: "n/a"
  },
  language: {
    label: "Language",
    ariaLabel: "Select language",
    optionPtBr: "Portuguese (Brazil)",
    optionEn: "English"
  },
  header: {
    eyebrow: "Solutions suite",
    title: "Flow and balancing studies",
    description: "Use the navigation below to switch between solutions for different problems."
  },
  nav: {
    ariaLabel: "Solution navigation",
    balance: "Belt balancing",
    throughput: "Inputs and outputs per minute"
  },
  factories: {
    defaultName: "Factory {{index}}",
    nameAria: "Factory {{index}} name",
    weightAria: "Factory {{index}} weight"
  },
  balance: {
    configPanelAria: "Configuration panel",
    resultsPanelAria: "Results",
    title: "Balancing calculator",
    description: "Splits flow using only splitters (2 and 3) and mergers.",
    beltTypeLabel: "Belt type",
    beltTypeAria: "Belt type",
    flowInputLabel: "Total flow F (items/min)",
    manualLanesLabel: "Manual input belts (N_manual)",
    manualLanesHintHtml: "The system applies <span class=\"mono\">N = max(ceil(F/C), N_manual)</span> and splits flow equally per line.",
    depthLabel: "Maximum depth D:",
    depthHint: "The higher the depth, the harder the implementation.",
    factoryCountLabel: "Factory count",
    factoryCountHint: "Adjusts the list: add or remove factories; extra ones are removed from the end.",
    calculate: "Calculate",
    namesAndWeights: "Names and weights",
    entryRuleHtml: "Input rule: <span class=\"mono\">N = ceil(F / C)</span>.",
    resultsTitle: "Results",
    diagramTitle: "Device diagram",
    cardCapacity: "Capacity per belt (C)",
    cardParallel: "Parallel belts (N)",
    cardMaxError: "Maximum observed error",
    tableControlsHelp: "Technical columns are hidden by default for easier reading.",
    tableAriaLabel: "Results table",
    tableFactory: "Factory",
    tableWeight: "Weight",
    tableTargetFraction: "Target fraction",
    tableObtainedFraction: "Obtained fraction",
    tableMethod: "Method",
    tableDevices: "Devices",
    tableStatus: "Status",
    tableError: "Error",
    tableRealFlow: "Real flow (items/min)"
  },
  throughput: {
    configPanelAria: "Throughput solution configuration",
    resultsPanelAria: "Throughput solution results",
    eyebrow: "New solution",
    title: "Input and output converter",
    descriptionHtml: "Starts with <span class=\"mono\">X inputs</span>, each at <span class=\"mono\">Y items/min</span>, to serve <span class=\"mono\">N outputs</span> at <span class=\"mono\">Z items/min</span>.",
    inputCountLabel: "Input count (X)",
    inputRateLabel: "Items per input (Y/min)",
    outputCountLabel: "Output count (N)",
    outputRateLabel: "Target per output (Z/min)",
    calculate: "Calculate scenario",
    resultTitle: "Operational result",
    cardInputFlow: "Total input flow",
    cardTargetFlow: "Total desired flow",
    cardBalance: "Balance",
    tableAriaLabel: "Throughput solution table",
    tableIndicator: "Indicator",
    tableValue: "Value",
    rowTotalInputFlow: "Total input flow",
    rowTotalTargetFlow: "Total desired output flow",
    rowPerOutput: "Real output per line with N outputs",
    rowRequiredInputs: "Required inputs keeping current Y",
    rowRequiredInputRate: "Required rate per input keeping current X",
    rowMaxOutputs: "Maximum outputs keeping current Z",
    rowUtilization: "Input capacity utilization"
  },
  ui: {
    preview: {
      invalidFlow: "Enter a valid total flow (> 0).",
      singleLane: "A {{beltType}} belt supports this flow ({{flow}}/min <= {{capacity}}/min). Per-line distribution: 100% in a single input.",
      multiLane: "N_min={{nMin}}, N_manual={{nManual}}, N_aplicado={{nApplied}}. Each line receives {{flowPerLane}}/min (F={{flow}}/min, C={{capacity}}/min per belt)."
    },
    table: {
      showTechnical: "Show technical table data",
      hideTechnical: "Hide technical table data"
    },
    methods: {
      direct: "Direct",
      recirculationWithLoopback: "recirculation with loop-back",
      unifiedExactTree: "exact unified tree"
    },
    status: {
      exact: "Exact",
      approx: "Approximate"
    },
    summary: {
      title: "Technical scenario summary",
      blockedLead: "No strategy found can satisfy the selected belt capacity.",
      blockedStatus: "blocked due to capacity on internal links.",
      unifiedLead: "Parameter details were moved to this block to keep the diagram clean.",
      unifiedDKR: "d is the total final outputs, sum(k) is the amount sent to factories, and r is the loop-back outputs.",
      unifiedReading: "in dense scenarios, edge labels may be hidden to prioritize visual clarity.",
      directLead: "Operational details stay here so the diagram can focus on topology.",
      directMethod: "direct split per factory (without loop-back).",
      labelTotalFlow: "Total flow:",
      labelInputLanes: "Applied lanes:",
      labelStatus: "Status:",
      labelMethod: "Method:",
      labelDKR: "d={{d}}, sum(k)={{sumK}}, r={{loopbackCount}}:",
      labelParallelInputs: "Parallel inputs:",
      labelFlowsPerLane: "Per-line flows:",
      labelDiagramReading: "Diagram reading:",
      labelDepthLimit: "Configured maximum depth:",
      labelAnalyzedFlow: "Analyzed total flow:",
      labelMaxObservedError: "Maximum observed error:",
      labelImplementationDifficulty: "Implementation difficulty:",
      perLineFlow: "{{flow}}/min per line",
      unifiedScenarioTag: "(unified scenario).",
      lineFlows: "F={{flow}}/min, F_recirc={{recirculatedFlow}}/min, E={{effectiveInput}}/min.",
      implementationDifficultyByDepth: "Effective solution depth={{effectiveDepth}}. Difficulty scale (2 to 6): D={{depth}} -> {{level}}.",
      depthDifficultyLevels: {
        2: "easy",
        3: "moderate",
        4: "hard",
        5: "very hard",
        6: "nightmare"
      }
    },
    validation: {
      invalidInputs: "Invalid inputs: check total flow and factory weights.",
      blockedPrefix: "Blocked by belt capacity (C={{capacity}}/min). N_min={{nMin}}, N_manual={{nManual}}, N_aplicado={{nApplied}}, flow per line={{flowPerLane}}/min.",
      blockedExcess: "Excesses: {{details}}.",
      blockedNoTopology: "No valid topology was found.",
      unifiedChosen: "Chosen method: {{method}}. d={{d}}, sum(k)={{sumK}}, r={{loopbackCount}}. N={{inputLanes}}, F_linha={{flowPerLane}}/min, F_recirc={{recirculatedFlow}}/min, E={{effectiveInput}}/min. Exact split with lower complexity.",
      conservationOk: "Flow conservation OK: obtained fractions sum to 100% (N={{inputLanes}}, {{flowPerLane}}/min per line).",
      conservationWarn: "Obtained fractions sum to {{obtainedPercent}}% (error {{errorPercent}}%). Impact on total flow: {{deficit}}/min of {{deficitLabel}}. Per-line calculation: N={{inputLanes}}, {{flowPerLane}}/min.",
      deficitUnallocated: "leftover/unallocated",
      deficitExcess: "excess"
    }
  },
  throughputUi: {
    noticeBalanced: "Closed flow: {{inputCount}} inputs at {{inputRate}}/min serve {{outputCount}} outputs at {{outputRate}}/min without adjustments.",
    noticeSurplus: "There is a surplus of {{surplus}}/min. Keeping {{outputCount}} outputs, each can run at {{perOutput}}/min.",
    noticeShortage: "There is a shortage of {{shortage}}/min. You need {{requiredInputs}} inputs at {{inputRate}}/min or raise each input to {{requiredRate}}/min.",
    invalidInputs: "Enter positive values for X, Y, N and Z.",
    summaryBalancedTitle: "Balanced scenario",
    summaryBalancedLead: "Input flow exactly matches the output target.",
    summaryBalancedInputs: "Current inputs:",
    summaryBalancedOutputs: "Current outputs:",
    summaryBalancedPractical: "Practical reading:",
    summaryBalancedPracticalValue: "there is no surplus or shortage.",
    summarySurplusTitle: "Surplus scenario",
    summarySurplusLead: "Inputs deliver more flow than the requested output target.",
    summarySurplusTotal: "Total surplus:",
    summarySurplusPerOutput: "Real output per line with {{outputCount}} outputs:",
    summarySurplusMaxOutputs: "Maximum outputs keeping Z={{outputRate}}/min:",
    summaryShortageTitle: "Shortage scenario",
    summaryShortageLead: "Current input flow is not enough to sustain the informed target.",
    summaryShortageTotal: "Total shortage:",
    summaryShortageRequiredInputs: "Required inputs keeping Y={{inputRate}}/min:",
    summaryShortageRequiredRate: "Rate per input keeping X={{inputCount}}:"
  },
  diagram: {
    controls: {
      fit: "Fit"
    },
    labels: {
      merger: "MERGER",
      mergerInputs: "{{count}} inputs",
      fallbackFactory: "Factory {{index}}",
      loopback: "LOOP-BACK",
      branch: "BRANCH",
      outputIndex: "Output {{index}}",
      otherDestination: "Other destination",
      entry: "INPUT",
      newEntry: "NEW INPUT",
      inputIndex: "input {{index}}"
    },
    titles: {
      factoryDiagram: "{{name}} - target {{target}}, obtained {{obtained}} ({{flow}}/min per line)",
      unifiedLoopback: "Single scenario diagram - {{loopbackCount}} loop-back output(s), recirculated flow {{recirculatedFlow}}/min",
      unifiedExact: "Single scenario diagram - exact unified tree, no loop-back",
      multiEntry: "Multi-input diagram: {{laneCount}} inputs, {{flowPerLane}}/min per line (F={{totalFlow}}/min)"
    },
    notes: {
      trivial: "Trivial scenario without splitters: flow goes directly to a single destination."
    },
    aria: {
      factoryDiagram: "Connection diagram for {{name}}",
      unified: "Unified diagram with recirculation",
      multiEntry: "Unified diagram with parallel inputs"
    }
  },
  math: {
    methodRecirculation: "Recirculation",
    methodUnifiedExact: "Exact unified tree",
    directEntry: "Direct lane input",
    finalLinkToFactory: "Final link to {{factoryName}}",
    mainMergerFreshInput: "Main merger fresh input",
    mainMergerLoopbackReturn: "Main merger loop-back return",
    mainMergerOutput: "Main merger output",
    factoryMergerOutput: "Merger output for {{factoryName}}",
    splitterInput: "Splitter input ({{path}})",
    splitterOutput: "Splitter output ({{path}})",
    splitterBranchSegment: "{{path}} > branch {{index}}",
    loopbackLink: "Loop-back link",
    splitterRoot: "root"
  }
};
