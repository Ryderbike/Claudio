# Guía de estudio: partes 3 y 4 de la rúbrica (Dossier D03, Grupo 07)

Esta guía resume lo que hay que saber para responder preguntas sobre los pasos 3 y 4. Los detalles completos están en `03_procesamiento_datos.md` y `04_modelamiento_matematico.md`.

---

## 1. La idea en una frase

- **Paso 3:** verificamos que los datos sean correctos y documentamos cómo se procesan, para que cualquiera pueda reproducir cada número.
- **Paso 4:** traducimos el caso a un modelo matemático de optimización (IP/MIP) que representa todas las reglas del dossier.

---

## 2. Paso 3: procesamiento de datos

**Qué hicimos, en orden:**

1. Revisamos las fuentes: el PDF del dossier, tres CSV y un Excel con las mismas tablas.
2. Comprobamos que los datos embebidos en el cuaderno coincidan con los CSV, celda por celda.
3. Revisamos la lógica de la matriz de distancias: es simétrica, tiene diagonal cero y cumple la regla del rodeo (1,25 × línea recta, redondeada a 0,01 km).
4. Revisamos que las cifras del dossier cuadren con los datos: 150 clientes, 2 527 bidones, 2 957 min de descarga, y los totales de cada instancia.
5. Convertimos distancias a tiempos: minutos = km / 40 × 60.
6. Definimos las estructuras de datos: puntos, matriz, parámetros, instancias y la forma de una solución.
7. Corrimos la constructiva aleatoria en las tres instancias con 10 semillas. Todas las soluciones son factibles.

**Puntos que suelen preguntar:**

- *¿Por qué no aplicamos el factor 1,25 otra vez al calcular el tiempo?* Porque la matriz ya lo incluye. Aplicarlo dos veces sobrestimaría todos los tiempos y el costo por km.
- *¿Qué formato tiene una solución?* `{"rutas": [[clientes de la ruta 1], ...], "externos": [clientes con flete]}`. Cada cliente aparece exactamente una vez.
- *¿Qué es la "tabla estándar"?* Un registro por corrida, con instancia, método, valor, tiempo, semilla y si fue factible. Cada número del informe debe salir de ahí.
- *¿Los datos son reales?* No. Son de trabajo, verosímiles. Eso se declara como supuesto.

---

## 3. Paso 4: modelamiento matemático

**Tipo de problema:** ruteo de vehículos capacitado (CVRP) con flota limitada, restricción de jornada y opción de subcontratar (flete externo).

**Variables:**

- `x_ij` ∈ {0,1}: 1 si un camión va del punto *i* al *j*. **Binaria.**
- `z_i` ∈ {0,1}: 1 si el cliente *i* va con transportista. **Binaria.**
- `T_i`: minuto en que empieza la descarga en *i*. Auxiliar para la jornada.
- `u_i`: bidones acumulados en el camión hasta *i*. Auxiliar para la capacidad.

**Objetivo:** minimizar camiones × 55 000 + km × 450 + fletes externos.

**Restricciones (cada una corresponde a una regla del dossier):**

| Regla | Restricción |
|---|---|
| Cada cliente, una vez y completo | Entra una vez y sale una vez (por camión), o va con flete |
| Máximo 11 camiones | Número de salidas desde la base ≤ K |
| Cada camión vuelve a la base | Salidas de la base = regresos a la base |
| Capacidad 300 bidones | MTZ: la carga crece en la demanda de cada cliente visitado |
| Jornada 540 min | MTZ: el tiempo crece con viaje y descarga; el regreso cabe en L |

**Preguntas que suelen hacer:**

- *¿Por qué arcos dirigidos si la matriz es simétrica?* Porque el orden de visita afecta la hora de llegada y, por tanto, la jornada.
- *¿Qué son las cotas big-M?* Constantes grandes que "apagan" una restricción cuando el arco no se usa. Las elegimos ajustadas para que sean válidas: toda ruta factible cumple `T_i + s_i ≤ L`.
- *¿Por qué no hay restricciones que eliminen subtours (ciclos sin la base)?* Las restricciones de tiempo y de carga lo hacen: como cada descarga tarda al menos 12 min, el tiempo crece en cada arco, y un ciclo sin la base sería contradictorio.
- *¿Cuántas variables y restricciones tiene?* Reducida: 168 binarias, 326 restricciones. Intermedia: 2 600 binarias. Completa: 22 800 binarias y 45 452 restricciones.

---

## 4. Cifras clave para memorizar

| Dato | Valor |
|---|---|
| Óptimo certificado (reducida) | **106 786 $** (DP exacta) |
| Plan óptimo de la reducida | 1 camión, 12 clientes, 115,08 km, duración 402,6 min, sin flete |
| Valor del MIP (CBC, 600 s) | 107 236 $, **no certificado**, brecha de 0,42 % |
| Línea base aleatoria, reducida | promedio 250 919 $ (+135 % sobre el óptimo) |
| Línea base aleatoria, completa | promedio 8 981 095 $, 10 semillas |

---

## 5. Las dos cosas más importantes de este trabajo

1. **El MIP no demuestra el óptimo ni con 12 clientes en 600 s.** Por eso el óptimo de referencia se obtuvo con una programación dinámica exacta, y el MIP se reporta como incumbente con su brecha. Un estado "Optimal" de PuLP no garantiza optimalidad cuando CBC se detiene por tiempo; el cuaderno usa `sol_status` para distinguirlo.
2. **Con 150 clientes no hay exacto razonable.** La solución del proyecto se apoya en métodos aproximados y se compara contra la mejor cota disponible (paso 8).
