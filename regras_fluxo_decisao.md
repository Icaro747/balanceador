# Regras de decisao e renderizacao

Este documento consolida as regras que o sistema usa hoje para:

1. escolher a estrategia de balanceamento;
2. nomear o resultado;
3. decidir se o diagrama sera unico ou separado por fabrica.

## 1. Tres familias praticas de resultado

Na pratica, os resultados caem em uma destas familias:

### 1. `direct`

- Cada fabrica e tratada individualmente.
- O algoritmo procura a melhor fracao para cada destino.
- Pode haver erro de aproximacao.
- Quando `N = 1`, a interface tende a mostrar um diagrama por fabrica.

### 2. `unified exact`

- O sistema encontra uma unica arvore exata para todo o cenario.
- Nao existe loop-back.
- Isso acontece quando o total de partes uteis `sum(k)` ja e um denominador valido do tipo `2^a * 3^b`.
- Exemplo classico: 3 fabricas com pesos `1,1,1`.
  - `sum(k) = 3`
  - `d = 3`
  - `r = d - sum(k) = 0`
  - Resultado: arvore unificada exata, sem loop-back.

### 3. `unified loop-back`

- O sistema encontra uma unica arvore exata, mas com saidas excedentes retornando para a entrada.
- Isso acontece quando o menor denominador valido `d` e maior que `sum(k)`.
- Exemplo classico: 5 fabricas com pesos `1,1,1,1,1`.
  - `sum(k) = 5`
  - menor `d` valido = `6`
  - `r = 1`
  - Resultado: arvore unificada com loop-back.

## 2. Regra de escolha do algoritmo

O algoritmo compara duas candidatas principais:

1. a solucao `direct`;
2. a solucao `unified` gerada pela busca hoje chamada no codigo de `findRecirculationSolution`.

A escolha segue esta prioridade:

1. capacidade valida;
2. exatidao global;
3. menor erro maximo;
4. menor numero total de dispositivos;
5. desempate favorecendo `direct`.

Observacao importante:

- a busca "de recirculacao" tambem produz casos sem retorno;
- por isso ela nao representa apenas recirculacao;
- ela representa a familia de solucao unificada;
- quando `r = 0`, o resultado correto e `unified exact`, nao "recirculacao" no sentido fisico.

## 3. Regra de renderizacao do diagrama

O render aplica a seguinte ordem:

1. se `inputLanes > 1`, mostra diagrama unificado multi-entrada;
2. senao, se a estrategia vencedora for `unified`, mostra um unico diagrama do cenario;
3. senao, mostra um diagrama por fabrica.

Em outras palavras:

- `N > 1` sempre unifica a visualizacao;
- `N = 1` ainda pode gerar diagrama unico, se a estrategia vencedora for `unified`;
- so aparece "um diagrama por fabrica" quando o vencedor final e realmente `direct`.

## 4. Casos que costumam confundir

### Caso A: 3 fabricas iguais, 1 entrada

- Entradas: `1,1,1`
- `sum(k) = 3`
- `d = 3`
- `r = 0`
- Estrategia vencedora: `unified exact`
- Visualizacao: um unico diagrama

Esse caso parece "sem recirculacao", e de fato e. Mas ele continua sendo uma arvore unificada para o cenario inteiro.

### Caso B: 5 fabricas iguais, 1 entrada

- Entradas: `1,1,1,1,1`
- `sum(k) = 5`
- `d = 6`
- `r = 1`
- Estrategia vencedora: `unified loop-back`
- Visualizacao: um unico diagrama

### Caso C: uma fabrica apenas

- O caminho `direct` costuma vencer porque ja e exato e mais simples.
- Visualizacao: um diagrama da fabrica.

## 5. Leitura recomendada da UI

Para interpretar a tela corretamente, leia estes sinais em conjunto:

1. `Metodo escolhido`
2. `r`
3. `N`
4. quantidade de cards em "Diagrama de dispositivos"

Interpretacao rapida:

- `Metodo escolhido: arvore unificada exata` + `r=0` -> diagrama unico sem loop-back
- `Metodo escolhido: recirculacao com loop-back` + `r>0` -> diagrama unico com retorno
- `Metodo escolhido: direta` -> pode haver um card por fabrica quando `N=1`

## 6. Consequencia para manutencao do codigo

O ponto mais sensivel do codigo e semantico:

- o solver historicamente chamado de "recirculacao" na verdade cobre duas subfamilias;
- isso pode induzir leitura errada da UI e dos testes;
- por isso o codigo agora precisa manter explicito:
  - `mode = direct` ou `mode = unified`;
  - `unifiedKind = exact` ou `unifiedKind = loopback`;
  - `usesLoopback = true/false`.

Essa separacao deixa mais claro o que o algoritmo decidiu e por que o diagrama apareceu como unico ou separado.
