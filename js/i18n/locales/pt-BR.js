export default {
  app: {
    title: "Suite de Solucoes de Vazao"
  },
  common: {
    nd: "n/d"
  },
  language: {
    label: "Idioma",
    ariaLabel: "Selecionar idioma",
    optionPtBr: "Portugues (Brasil)",
    optionEn: "English"
  },
  header: {
    eyebrow: "Suite de solucoes",
    title: "Estudos de vazao e balanceamento",
    description: "Use a navegacao abaixo para alternar entre as solucoes para problemas diferentes."
  },
  nav: {
    ariaLabel: "Navegacao entre solucoes",
    balance: "Balanceamento de esteiras",
    throughput: "Entradas e saidas por minuto"
  },
  factories: {
    defaultName: "Fabrica {{index}}",
    nameAria: "Nome da fabrica {{index}}",
    weightAria: "Peso da fabrica {{index}}"
  },
  balance: {
    configPanelAria: "Painel de configuracao",
    resultsPanelAria: "Resultados",
    title: "Calculadora de balanceamento",
    description: "Divide fluxo usando apenas divisores (2 e 3) e unificadores.",
    beltTypeLabel: "Tipo de esteira",
    beltTypeAria: "Tipo de esteira",
    flowInputLabel: "Fluxo total F (itens/min)",
    manualLanesLabel: "Esteiras de entrada manuais (N_manual)",
    manualLanesHintHtml: "O sistema aplica <span class=\"mono\">N = max(ceil(F/C), N_manual)</span> e divide o fluxo igualmente por linha.",
    depthLabel: "Profundidade maxima D:",
    depthHint: "Quanto maior a profundidade, maior a dificuldade de implementacao.",
    factoryCountLabel: "Quantidade de fabricas",
    factoryCountHint: "Ajusta a lista: aumenta ou remove fabricas; as extras sao retiradas do fim.",
    calculate: "Calcular",
    namesAndWeights: "Nomes e pesos",
    entryRuleHtml: "Regra de entrada: <span class=\"mono\">N = ceil(F / C)</span>.",
    resultsTitle: "Resultados",
    diagramTitle: "Diagrama de dispositivos",
    cardCapacity: "Capacidade por esteira (C)",
    cardParallel: "Esteiras em paralelo (N)",
    cardMaxError: "Erro maximo observado",
    tableControlsHelp: "As colunas tecnicas ficam ocultas por padrao para facilitar leitura.",
    tableAriaLabel: "Tabela de resultados",
    tableFactory: "Fabrica",
    tableWeight: "Peso",
    tableTargetFraction: "Fracao alvo",
    tableObtainedFraction: "Fracao obtida",
    tableMethod: "Metodo",
    tableDevices: "Dispositivos",
    tableStatus: "Status",
    tableError: "Erro",
    tableRealFlow: "Fluxo real (itens/min)"
  },
  throughput: {
    configPanelAria: "Configuracao da solucao de vazao",
    resultsPanelAria: "Resultados da solucao de vazao",
    eyebrow: "Nova solucao",
    title: "Conversor de entradas e saidas",
    descriptionHtml: "Parte de <span class=\"mono\">X entradas</span>, cada uma com <span class=\"mono\">Y itens/min</span>, para atender <span class=\"mono\">N saidas</span> com <span class=\"mono\">Z itens/min</span>.",
    inputCountLabel: "Quantidade de entradas (X)",
    inputRateLabel: "Itens por entrada (Y/min)",
    outputCountLabel: "Quantidade de saidas (N)",
    outputRateLabel: "Meta por saida (Z/min)",
    calculate: "Calcular cenario",
    resultTitle: "Resultado operacional",
    cardInputFlow: "Fluxo total de entrada",
    cardTargetFlow: "Fluxo total desejado",
    cardBalance: "Saldo",
    tableAriaLabel: "Tabela da solucao de vazao",
    tableIndicator: "Indicador",
    tableValue: "Valor",
    rowTotalInputFlow: "Fluxo total de entrada",
    rowTotalTargetFlow: "Fluxo total desejado nas saidas",
    rowPerOutput: "Saida real por linha com N saidas",
    rowRequiredInputs: "Entradas necessarias mantendo Y atual",
    rowRequiredInputRate: "Vazao por entrada mantendo X atual",
    rowMaxOutputs: "Saidas maximas mantendo Z atual",
    rowUtilization: "Utilizacao da capacidade de entrada"
  },
  ui: {
    preview: {
      invalidFlow: "Informe um fluxo total valido (> 0).",
      singleLane: "Uma esteira {{beltType}} suporta este fluxo ({{flow}}/min <= {{capacity}}/min). Distribuicao por linha: 100% em uma unica entrada.",
      multiLane: "N_min={{nMin}}, N_manual={{nManual}}, N_aplicado={{nApplied}}. Cada linha recebe {{flowPerLane}}/min (F={{flow}}/min, C={{capacity}}/min por esteira)."
    },
    table: {
      showTechnical: "Mostrar dados tecnicos da tabela",
      hideTechnical: "Ocultar dados tecnicos da tabela"
    },
    methods: {
      direct: "Direta",
      recirculationWithLoopback: "recirculacao com loop-back",
      unifiedExactTree: "arvore unificada exata"
    },
    status: {
      exact: "Exata",
      approx: "Aproximada"
    },
    summary: {
      title: "Resumo tecnico do cenario",
      blockedLead: "Nenhuma estrategia encontrada atende a capacidade da esteira escolhida.",
      blockedStatus: "bloqueado por capacidade nas ligacoes internas.",
      unifiedLead: "As informacoes de parametros foram movidas para este bloco para manter o diagrama limpo.",
      unifiedDKR: "d e o total de saidas finais, sum(k) e o total enviado para fabricas, r representa saidas em loop-back.",
      unifiedReading: "em cenarios densos, labels de arestas podem ser ocultados para priorizar clareza visual.",
      directLead: "As informacoes operacionais ficam aqui para que o diagrama foque na topologia.",
      directMethod: "divisao direta por fabrica (sem loop-back).",
      labelTotalFlow: "Fluxo total:",
      labelInputLanes: "Linhas aplicadas:",
      labelStatus: "Status:",
      labelMethod: "Metodo:",
      labelDKR: "d={{d}}, sum(k)={{sumK}}, r={{loopbackCount}}:",
      labelParallelInputs: "Entradas paralelas:",
      labelFlowsPerLane: "Fluxos por linha:",
      labelDiagramReading: "Leitura do diagrama:",
      labelDepthLimit: "Profundidade maxima configurada:",
      labelAnalyzedFlow: "Fluxo total analisado:",
      labelMaxObservedError: "Erro maximo observado:",
      labelImplementationDifficulty: "Dificuldade de implementacao:",
      perLineFlow: "{{flow}}/min por linha",
      unifiedScenarioTag: "(cenario unificado).",
      lineFlows: "F={{flow}}/min, F_recirc={{recirculatedFlow}}/min, E={{effectiveInput}}/min.",
      implementationDifficultyByDepth: "D efetivo da solucao={{effectiveDepth}}. Escala de dificuldade (2 a 6): D={{depth}} -> {{level}}.",
      depthDifficultyLevels: {
        2: "facil",
        3: "moderada",
        4: "dificil",
        5: "muito dificil",
        6: "pesadelo"
      }
    },
    validation: {
      invalidInputs: "Entradas invalidas: confira fluxo total e pesos das fabricas.",
      blockedPrefix: "Bloqueado por capacidade da esteira (C={{capacity}}/min). N_min={{nMin}}, N_manual={{nManual}}, N_aplicado={{nApplied}}, fluxo por linha={{flowPerLane}}/min.",
      blockedExcess: "Excessos: {{details}}.",
      blockedNoTopology: "Nenhuma topologia valida foi encontrada.",
      unifiedChosen: "Metodo escolhido: {{method}}. d={{d}}, sum(k)={{sumK}}, r={{loopbackCount}}. N={{inputLanes}}, F_linha={{flowPerLane}}/min, F_recirc={{recirculatedFlow}}/min, E={{effectiveInput}}/min. Divisao exata e menor complexidade.",
      conservationOk: "Conservacao de fluxo OK: a soma das fracoes obtidas totaliza 100% (N={{inputLanes}}, {{flowPerLane}}/min por linha).",
      conservationWarn: "A soma das fracoes obtidas e {{obtainedPercent}}% (erro {{errorPercent}}%). Impacto no fluxo total: {{deficit}}/min de {{deficitLabel}}. Calculo por linha: N={{inputLanes}}, {{flowPerLane}}/min.",
      deficitUnallocated: "sobra/nao alocado",
      deficitExcess: "excesso"
    }
  },
  throughputUi: {
    noticeBalanced: "Fluxo fechado: {{inputCount}} entradas a {{inputRate}}/min atendem {{outputCount}} saidas a {{outputRate}}/min sem ajustes.",
    noticeSurplus: "Ha sobra de {{surplus}}/min. Mantendo {{outputCount}} saidas, cada uma pode operar em {{perOutput}}/min.",
    noticeShortage: "Faltam {{shortage}}/min. Voce precisa de {{requiredInputs}} entradas a {{inputRate}}/min ou elevar cada entrada para {{requiredRate}}/min.",
    invalidInputs: "Informe valores positivos para X, Y, N e Z.",
    summaryBalancedTitle: "Cenario equilibrado",
    summaryBalancedLead: "O fluxo de entrada atende exatamente a meta de saida.",
    summaryBalancedInputs: "Entradas atuais:",
    summaryBalancedOutputs: "Saidas atuais:",
    summaryBalancedPractical: "Leitura pratica:",
    summaryBalancedPracticalValue: "nao ha sobra nem falta de vazao.",
    summarySurplusTitle: "Cenario com sobra",
    summarySurplusLead: "As entradas entregam mais fluxo do que a meta pedida para as saidas.",
    summarySurplusTotal: "Sobra total:",
    summarySurplusPerOutput: "Saida real por linha com {{outputCount}} saidas:",
    summarySurplusMaxOutputs: "Saidas maximas mantendo Z={{outputRate}}/min:",
    summaryShortageTitle: "Cenario com falta",
    summaryShortageLead: "O fluxo de entrada atual nao e suficiente para sustentar a meta informada.",
    summaryShortageTotal: "Falta total:",
    summaryShortageRequiredInputs: "Entradas necessarias mantendo Y={{inputRate}}/min:",
    summaryShortageRequiredRate: "Vazao por entrada mantendo X={{inputCount}}:"
  },
  diagram: {
    controls: {
      fit: "Ajustar"
    },
    labels: {
      merger: "UNIFICADOR",
      mergerInputs: "{{count}} entradas",
      fallbackFactory: "Fabrica {{index}}",
      loopback: "LOOP-BACK",
      branch: "RAMO",
      outputIndex: "Saida {{index}}",
      otherDestination: "Outro destino",
      entry: "ENTRADA",
      newEntry: "ENTRADA NOVA",
      inputIndex: "entrada {{index}}"
    },
    titles: {
      factoryDiagram: "{{name}} - alvo {{target}}, obtido {{obtained}} ({{flow}}/min por linha)",
      unifiedLoopback: "Diagrama unico do cenario - {{loopbackCount}} saida(s) em loop-back, fluxo recirculado {{recirculatedFlow}}/min",
      unifiedExact: "Diagrama unico do cenario - arvore unificada exata, sem loop-back",
      multiEntry: "Diagrama multi-entrada: {{laneCount}} entradas, {{flowPerLane}}/min por linha (F={{totalFlow}}/min)"
    },
    notes: {
      trivial: "Cenario trivial sem divisores: fluxo segue direto para um unico destino."
    },
    aria: {
      factoryDiagram: "Diagrama de ligacoes para {{name}}",
      unified: "Diagrama unificado com recirculacao",
      multiEntry: "Diagrama unificado com entradas paralelas"
    }
  },
  math: {
    methodRecirculation: "Recirculacao",
    methodUnifiedExact: "Arvore unificada exata",
    directEntry: "Entrada da linha direta",
    finalLinkToFactory: "Ligacao final para {{factoryName}}",
    mainMergerFreshInput: "Entrada nova do unificador principal",
    mainMergerLoopbackReturn: "Retorno de loop-back no unificador principal",
    mainMergerOutput: "Saida do unificador principal",
    factoryMergerOutput: "Saida do unificador da {{factoryName}}",
    splitterInput: "Entrada de divisor ({{path}})",
    splitterOutput: "Saida de divisor ({{path}})",
    splitterBranchSegment: "{{path}} > ramo {{index}}",
    loopbackLink: "Ligacao de loop-back",
    splitterRoot: "raiz"
  }
};
