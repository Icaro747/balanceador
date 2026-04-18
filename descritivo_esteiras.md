# Balanceamento de esteiras com divisores e unificadores

Este documento descreve como a calculadora funciona na pratica: quais entradas ela recebe, quais familias de solucao ela considera, como escolhe a estrategia vencedora e por que alguns cenarios aparecem com um diagrama unico enquanto outros aparecem separados por fabrica.

## 1. Objetivo

O sistema distribui um fluxo total `F` entre varias fabricas usando apenas:

- divisores com 2 ou 3 saidas ativas;
- unificadores com ate 3 entradas.

Cada fabrica recebe uma parcela do fluxo proporcional ao peso configurado.

## 2. Entradas do problema

O calculo depende de:

- tipo de esteira;
- fluxo total `F` em itens por minuto;
- quantidade manual minima de entradas paralelas;
- profundidade maxima `D`;
- lista de fabricas com nome e peso.

### 2.1 Capacidade por tipo

| Tipo | Capacidade por esteira |
| --- | --- |
| t1 | 60/min |
| t2 | 120/min |
| t3 | 270/min |
| t4 | 480/min |
| t5 | 780/min |
| t6 | 1200/min |

### 2.2 Entradas paralelas

Se `F > C`, o sistema precisa de mais de uma esteira de entrada. O numero minimo e:

```text
N_min = ceil(F / C)
```

O numero aplicado no calculo e:

```text
N = max(N_min, N_manual)
```

O fluxo por linha fica:

```text
F_linha = F / N
```

Esse `F_linha` e o valor usado para validar a capacidade das ligacoes internas e para escolher a estrategia.

## 3. Fracoes que o hardware consegue representar

Com cascatas de divisores `2` e `3`, as fracoes exatas possiveis seguem a forma:

```text
k / (2^a * 3^b)
```

Isso significa que:

- fracoes como `1/2`, `1/3`, `1/4`, `1/6` sao exatas;
- fracoes como `1/5` e `1/7` nao sao exatas por divisao direta;
- para esses casos, o sistema pode usar aproximacao direta ou uma arvore unificada com loop-back.

## 4. Familias reais de solucao

Na pratica, o sistema trabalha com tres familias de resultado.

### 4.1 `direct`

Cada fabrica e resolvida individualmente pela melhor fracao alcancavel ate a profundidade `D`.

Caracteristicas:

- pode ser exato ou aproximado;
- soma o numero de dispositivos por fabrica;
- quando `N = 1`, a visualizacao costuma ser um diagrama por fabrica.

### 4.2 `unified exact`

O sistema encontra uma unica arvore exata para todo o cenario, sem retorno.

Caracteristicas:

- existe um unico denominador valido `d = 2^a * 3^b`;
- `d` coincide com o total util `sum(k)`;
- `r = d - sum(k) = 0`;
- o diagrama aparece como um unico cenario unificado;
- nao existe recirculacao fisica.

Exemplo:

- pesos `1,1,1`
- razao inteira `1,1,1`
- `sum(k) = 3`
- `d = 3`
- `r = 0`

Resultado: uma arvore unificada exata para as tres fabricas.

### 4.3 `unified loop-back`

O sistema encontra uma unica arvore exata, mas com saidas excedentes retornando para a entrada.

Caracteristicas:

- `d` e maior que `sum(k)`;
- `r = d - sum(k) > 0`;
- o retorno aumenta o fluxo efetivo interno da arvore;
- o resultado liquido entregue para as fabricas continua correto e exato.

Exemplo:

- pesos `1,1,1,1,1`
- razao inteira `1,1,1,1,1`
- `sum(k) = 5`
- menor `d` valido = `6`
- `r = 1`

Resultado: uma arvore unificada com uma saida de loop-back.

## 5. Como o algoritmo escolhe a estrategia

O sistema compara duas candidatas:

1. `direct`
2. `unified`

Hoje a busca da familia `unified` fica concentrada no solver historicamente chamado de "recirculacao". Esse nome e legado: ele cobre tanto os casos com loop-back quanto os casos unificados exatos sem retorno.

### 5.1 Ordem de prioridade

Entre as candidatas validas, a escolha segue esta ordem:

1. capacidade valida;
2. exatidao global;
3. menor erro maximo;
4. menor numero total de dispositivos;
5. empate final favorece `direct`.

### 5.2 Consequencia pratica

Isso explica um comportamento que parecia contraditorio:

- um cenario pode nao ter loop-back;
- ainda assim ele pode vencer como `unified`;
- nesse caso o diagrama continua sendo unico.

Portanto, "diagrama unico" nao significa necessariamente "ha recirculacao". Muitas vezes significa apenas "a melhor estrategia foi uma arvore unificada exata".

## 6. Como o diagrama e escolhido

A renderizacao segue esta ordem:

1. se `N > 1`, o sistema mostra um diagrama unificado multi-entrada;
2. senao, se a estrategia vencedora for `unified`, o sistema mostra um diagrama unico do cenario;
3. senao, mostra um diagrama por fabrica.

Resumo rapido:

- `N > 1` sempre unifica a visualizacao;
- `N = 1` ainda pode gerar diagrama unico;
- so aparece "um por fabrica" quando o vencedor final e realmente `direct`.

## 7. Exemplo importante: 3 fabricas iguais com 1 entrada

Configuracao:

- `F = 60/min`
- `N = 1`
- pesos `1,1,1`

Passos:

1. a razao inteira ja e `1,1,1`;
2. `sum(k) = 3`;
3. `d = 3` e um denominador valido;
4. `r = 0`;
5. a familia vencedora e `unified exact`.

Resultado observado:

- metodo: arvore unificada exata;
- `F_recirc = 0`;
- `r = 0`;
- diagrama: unico.

Esse caso e o principal exemplo de que "unificado" e diferente de "recirculacao com retorno".

## 8. Exemplo importante: 4 fabricas com pesos 1,1,1,0.5

Configuracao:

- pesos `1,1,1,0.5`
- razao inteira `2,2,2,1`
- `sum(k) = 7`
- menor `d` valido = `8`
- `r = 1`

Interpretacao:

- existe uma folha excedente;
- ela retorna ao topo da arvore;
- isso produz um fluxo efetivo maior dentro da rede;
- o resultado liquido final entregue para as fabricas continua exatamente `2/7, 2/7, 2/7, 1/7`.

## 9. O que a UI deve comunicar

Para evitar ambiguidade, a leitura correta da interface depende destes campos:

- `Metodo escolhido`
- `d`
- `sum(k)`
- `r`
- `F_recirc`
- quantidade de cards de diagrama

Interpretacao recomendada:

- `Metodo escolhido: arvore unificada exata` + `r=0` -> diagrama unico sem loop-back
- `Metodo escolhido: recirculacao com loop-back` + `r>0` -> diagrama unico com retorno
- `Metodo escolhido: direta` -> visualizacao possivelmente separada por fabrica

## 10. Mapeamento para o codigo

Arquivos principais:

- `js/math.js`: calcula candidatas e escolhe a estrategia vencedora
- `js/ui.js`: monta as mensagens e o contexto exibido na tela
- `js/diagram.js`: decide se o diagrama sera unico, multi-entrada ou por fabrica
- `js/tree.js`: constroi a topologia fisica da arvore unificada

Metadados importantes no estado atual:

- `mode = "direct"` ou `mode = "unified"`
- `unifiedKind = "exact"` ou `unifiedKind = "loopback"`
- `usesLoopback = true/false`

Esses campos existem para deixar evidente a diferenca entre:

- uma arvore unificada exata sem retorno;
- uma arvore unificada com loop-back;
- uma estrategia direta por fabrica.

## 11. Documentos relacionados

- `regras_fluxo_decisao.md`: consolidacao rapida das regras de decisao e renderizacao
- `cenario_4_fabricas_pesos_1_1_1_0_5.md`: walkthrough detalhado do caso `1,1,1,0.5`
