# Balanceamento de Esteiras com Divisores de Fração

> **Descritivo Técnico** — Março 2026

---

## 1. Contexto do Problema

Em sistemas de produção com múltiplas fábricas ou destinos alimentados por uma única esteira, é necessário distribuir um fluxo de itens entre os destinos de forma controlada. O desafio surge quando as proporções desejadas não coincidem diretamente com as frações que os dispositivos físicos são capazes de produzir.

**Cenário:** 60 itens/min em uma esteira precisam ser divididos entre 5 fábricas com proporções iguais ou configuradas pelo usuário, usando apenas os dispositivos disponíveis.

### 1.1 Dispositivos disponíveis

| Dispositivo | Configuração | Comportamento |
|-------------|-------------|---------------|
| Divisor | 1 entrada, até 3 saídas | Divide o fluxo igualmente entre as saídas conectadas (÷2 ou ÷3 automático) |
| Unificador | Até 3 entradas, 1 saída | Soma os fluxos de entrada em uma única saída |

O divisor funciona como um **balanceador automático**: se apenas 2 das 3 saídas estiverem conectadas, ele divide o fluxo igualmente entre as 2. Não é possível configurar proporções diferentes no mesmo dispositivo.

### 1.2 Capacidade máxima da esteira por tipo (input)
O **tipo de esteira** é um dos dados de entrada (junto com o fluxo total desejado). Ele define a **vazão máxima por esteira física** e o código **deve** usar esse limite no cálculo e na interpretação do layout: uma única esteira do tipo escolhido nunca transporta mais do que a capacidade da tabela.
| Tipo | Capacidade máxima (por esteira) |
|:----:|:-------------------------------:|
| t1 | 60/min |
| t2 | 120/min |
| t3 | 270/min |
| t4 | 480/min |
| t5 | 780/min |
| t6 | 1200/min |

**Esteiras de entrada em paralelo.** Se o fluxo total informado **F** (itens/min) for **maior** que a capacidade **C** do tipo selecionado, não cabe tudo em uma esteira só: presume-se **várias esteiras em paralelo** alimentando o mesmo ponto (ou um unificador antes da árvore de divisão). O número mínimo de esteiras de entrada desse tipo é:
```
N = ⌈F / C⌉   (arredondamento para cima)
```
Cada uma dessas **N** esteiras leva no máximo **C** itens/min; a soma cobre **F** (com as últimas linhas eventualmente abaixo de **C** se **F** não for múltiplo exato de **C**).
**Exemplos:** com **t1** (**C = 60**), fluxo **120/min** ⇒ **N = 2** esteiras de entrada; fluxo **123/min** ⇒ **N = ⌈123/60⌉ = 3** esteiras. O balanceamento por frações continua válido sobre o total **F**; o papel de **C** e **N** é dimensionar e, na interface, comunicar quantas linhas de alimentação o cenário exige.

---

## 2. Definição Matemática

### 2.1 Frações alcançáveis

Com os dois dispositivos em cascata, cada saída recebe uma fração do fluxo original da forma:

```
k / (2^a × 3^b)    onde k, a, b ∈ ℤ≥0  e  0 ≤ k ≤ 2^a × 3^b
```

Os denominadores possíveis formam a sequência: **1, 2, 3, 4, 6, 8, 9, 12, 18, 24, 36, 48, 72…**

Qualquer fração cujo denominador é composto apenas de fatores 2 e 3 pode ser representada exatamente.

### 2.2 Por que 5 partes iguais é impossível

Dividir em 5 partes iguais exigiria a fração 1/5. Para representá-la como `k/(2^a × 3^b)`, seria necessário que 5 dividisse `2^a × 3^b`. Mas 5 é primo e coprimo com 2 e 3, portanto:

```
mdc(5, 2^a × 3^b) = 1  para qualquer a, b ≥ 0
```

Logo, 1/5 nunca é exatamente alcançável. O mesmo vale para qualquer fração com fator primo diferente de 2 ou 3 no denominador (ex.: 1/7, 1/11, 2/15).

### 2.3 Exemplos de frações exatas e aproximadas

| Divisão desejada | Fração | Status | Representação |
|-----------------|--------|--------|---------------|
| 2 partes iguais | 1/2 | Exata | `1/(2¹×3⁰)` |
| 3 partes iguais | 1/3 | Exata | `1/(2⁰×3¹)` |
| 4 partes iguais | 1/4 | Exata | `1/(2²×3⁰)` |
| 6 partes iguais | 1/6 | Exata | `1/(2¹×3¹)` |
| 5 partes iguais | 1/5 | Impossível exato | Melhor: `13/64 ≈ 0.203` |
| 7 partes iguais | 1/7 | Impossível exato | Melhor: `9/64 ≈ 0.141` |

---

## 3. Algoritmo de Solução

### 3.1 Abordagem geral

Antes das frações, o algoritmo usa o **tipo de esteira** (capacidade **C**) e o fluxo total **F** para obter **N = ⌈F/C⌉** esteiras de entrada em paralelo, quando **F > C**. Esse **N** entra na validação da interface e, se desejado, no diagrama (várias entradas ou nota de paralelismo).
Em seguida:
1. Calcular a solução **direta** por aproximação racional para cada fração alvo (em função de **F** e dos pesos)
2. Calcular a solução por **recirculação (loop-back)** quando houver saídas excedentes
3. Escolher automaticamente o método com melhor custo/qualidade (exatidão primeiro, depois menos dispositivos)

### 3.2 Busca da solução direta (fração ótima)

Para cada fábrica com peso `w_i` (soma total `W`), a fração alvo é `w_i/W`. O algoritmo varre todas as combinações de expoentes `(a, b)` até a profundidade máxima configurada:

```
Para cada (a, b) com a+b ≤ D:
  d = 2^a × 3^b
  k = round(w_i/W × d)
  erro = |k/d - w_i/W|
  guardar melhor (k, d) com menor erro
```

### 3.3 Solução por recirculação (loop-back)

A recirculação é usada quando o denominador mínimo com fatores 2 e 3 é maior que o total necessário de partes. Em vez de descartar saídas, as saídas excedentes retornam ao topo da linha.

Definições:
- `k_i`: número inteiro de sub-ramos necessários para a fábrica `i` (proporcional ao peso)
- `S = Σk_i`: total de sub-ramos úteis
- `d = 2^a × 3^b`: menor denominador alcançável com `a+b ≤ D` e `d ≥ S`
- `r = d - S`: saídas excedentes recirculadas

Fluxo recirculado:

```
R = r × F / S
```

Com isso, cada sub-ramo final passa a transportar `F/S` e a divisão por fábrica fica exata (`k_i × F/S`), mesmo em casos como divisão por 5, 7 ou 10.

### 3.4 Construção da árvore física

Uma vez escolhido o método (direta ou recirculação), o algoritmo converte recursivamente em árvore de divisores:

- Se `b > 0`: inserir um divisor ÷3, processar `k/3` unidades de cada rama ativa
- Se `a > 0`: inserir um divisor ÷2, processar as duas metades
- Quando múltiplas ramas convergem para a mesma fábrica: inserir um unificador
- Folha da árvore: a fábrica receptora
- Na recirculação: folhas excedentes são conectadas de volta ao topo (loop-back)

**Exemplo:** Para `2/9 = 2/(3²)`: dividir por 3 (3 ramas de 1/3 cada) → de cada rama, dividir por 3 novamente (9 sub-ramas de 1/9) → selecionar 2 sub-ramas → unificar as 2 em um único fluxo de 2/9 para a fábrica.

---

## 4. Ferramentas Desenvolvidas

### 4.1 Calculadora interativa

Interface web que permite configurar o problema e calcular as soluções em tempo real.

| Funcionalidade | Descrição |
|---------------|-----------|
| Tipo de esteira (t1–t6) | Input que fixa a capacidade máxima **C** por esteira; usado para calcular **N = ⌈F/C⌉** quando **F > C** (ver §1.2) |
| Fluxo configurável | Total **F** de itens/min a distribuir; se **F > C**, o cenário equivale a **N** esteiras em paralelo na entrada |
| Múltiplas fábricas | Adiciona/remove destinos com pesos individuais |
| Profundidade máx. | Controla até quantos níveis de cascata são permitidos |
| Método escolhido | Mostra se a solução final foi **Direta** ou **Recirculação** |
| Dispositivos | Exibe a estimativa de divisores + unificadores da solução escolhida |
| Status exato/aprox. | Indica se a fração é exata ou a melhor aproximação possível |
| Métricas de erro | Mostra o erro absoluto e o fluxo real vs. alvo |

### 4.2 Visualizador de diagrama físico

Gera automaticamente o diagrama de ligações físicas para cada fábrica, mostrando como os divisores e unificadores devem ser conectados na prática.

| Elemento visual | Representação |
|----------------|---------------|
| Nó cinza ÷N | Divisor com N saídas ativas e fluxo de entrada |
| Nó colorido (fábrica) | Destino final com fluxo recebido em itens/min |
| Setas | Direção do fluxo entre dispositivos |
| Cor única por fábrica | Facilita identificar qual pipeline serve cada destino |

---

## 5. Limitações Conhecidas e Trabalho Futuro

### 5.1 Limitações atuais

- Sem recirculação, divisões em 5 ou 7 partes iguais não são exatas; com recirculação, tornam-se exatas ao custo de fluxo de retorno
- O diagrama atual não exibe o unificador de forma explicitamente separada quando múltiplas ramas convergem
- Não considera o custo físico (número de dispositivos) como critério de otimização
- Profundidade máxima de 6 por questões de performance (3⁶ = 729 combinações)

### 5.2 Melhorias planejadas

- Exibir os unificadores explicitamente no diagrama quando múltiplas ramas convergem para uma fábrica
- Adicionar otimização por número mínimo de dispositivos (BFS / programação dinâmica)
- Exportar o diagrama em formato SVG ou PNG para documentação
- Suporte a divisores com proporções configuráveis (se o hardware permitir no futuro)
- Validação de conservação de fluxo: garantir que 100% do fluxo seja distribuído sem desperdício

---

## 6. Referência Rápida

**Capacidade da esteira por tipo:** t1 60 · t2 120 · t3 270 · t4 480 · t5 780 · t6 1200 (todos em itens/min).

**Esteiras de entrada em paralelo:** `N = ⌈F / C⌉` (fluxo total **F**, capacidade do tipo **C**).

| Profundidade | Denominador máx. | Erro máx. em 1/5 | Dispositivos máx. |
|:-----------:|:----------------:|:----------------:|:-----------------:|
| 2 | 12 | 3.33% | 2 |
| 3 | 36 | 1.11% | 3 |
| 4 | 108 | 1.11% | 4 |
| 5 | 324 | 0.31% | 5 |
| 6 | 972 | 0.10% | 6 |
