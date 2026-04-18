export const BELT_CAPACITY = {
  t1: 60,
  t2: 120,
  t3: 270,
  t4: 480,
  t5: 780,
  t6: 1200
};

export const state = {
  showAdvancedTableColumns: false,
  factories: [
    { name: "Fabrica 1", weight: 1 },
    { name: "Fabrica 2", weight: 1 },
    { name: "Fabrica 3", weight: 1 },
    { name: "Fabrica 4", weight: 1 },
    { name: "Fabrica 5", weight: 1 }
  ]
};

/* Limite pratico: muitas fabricas = muitas linhas na tabela e um SVG por fabrica (pode pesar no navegador). */
export const FACTORY_COUNT_MAX = 200;
