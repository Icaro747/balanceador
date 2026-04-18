# Balanceador de esteiras

Aplicacao web para estudar como distribuir fluxo entre fabricas usando apenas divisores `2` e `3` e unificadores de ate `3` entradas.

O projeto calcula a melhor estrategia para cada cenario e desenha a topologia resultante. Hoje ele distingue claramente tres familias praticas:

- `direct`: cada fabrica e resolvida individualmente;
- `unified exact`: uma unica arvore exata para o cenario, sem loop-back;
- `unified loop-back`: uma unica arvore exata com retorno para a entrada.

## Como executar

Instalar dependencias:

```bash
npm install
```

Rodar testes:

```bash
npm test
```

Abrir a interface:

1. sirva a pasta do projeto com um servidor estatico;
2. abra `index.html` no navegador pela URL local do servidor.

## Como usar

1. escolha o tipo de esteira;
2. informe o fluxo total `F`;
3. ajuste a quantidade manual minima de entradas, se necessario;
4. defina a profundidade maxima;
5. configure quantidade de fabricas, nomes e pesos;
6. clique em `Calcular`.

## O que a aplicacao decide

### Entradas paralelas

Com capacidade `C` do tipo selecionado:

```text
N_min = ceil(F / C)
N = max(N_min, N_manual)
F_linha = F / N
```

Esse `F_linha` e o valor usado na validacao por capacidade e na escolha da estrategia.

### Escolha da estrategia

O algoritmo compara:

1. `direct`
2. `unified`

Prioridades de escolha:

1. capacidade valida;
2. exatidao global;
3. menor erro maximo;
4. menor numero total de dispositivos;
5. empate final favorece `direct`.

## Como interpretar os diagramas

Regra pratica:

- se `N > 1`, a visualizacao sera unificada por entradas paralelas;
- se `N = 1` e a estrategia vencedora for `unified`, a visualizacao sera um diagrama unico do cenario;
- so aparece um diagrama por fabrica quando o vencedor final e `direct`.

Importante:

- diagrama unico nao significa automaticamente que ha loop-back;
- um caso `unified exact` tambem aparece como diagrama unico;
- para saber se existe retorno de fato, olhe `r` e `F_recirc`.

## Estrutura do projeto

- `index.html`: shell da interface
- `style.css`: estilos da UI
- `js/ui.js`: leitura de entradas, mensagens e fluxo principal da tela
- `js/math.js`: busca de fracoes, avaliacao de capacidade e escolha da estrategia
- `js/tree.js`: construcao de topologias
- `js/diagram.js`: renderizacao dos diagramas
- `tests/`: cobertura de calculo, UI, arvore e diagramas

## Documentacao

- [descritivo_esteiras.md](F:\Icaro\Documents\Dev\Projetos\balanceador\descritivo_esteiras.md): explicacao tecnica principal
- [regras_fluxo_decisao.md](F:\Icaro\Documents\Dev\Projetos\balanceador\regras_fluxo_decisao.md): consolidacao curta das regras reais do sistema
- [cenario_4_fabricas_pesos_1_1_1_0_5.md](F:\Icaro\Documents\Dev\Projetos\balanceador\cenario_4_fabricas_pesos_1_1_1_0_5.md): exemplo detalhado de loop-back
