# Paso 4. Modelamiento matemático

**Grupo 07 · Dossier D03, distribución de agua purificada en bidones**
**Rúbrica criterio 4 (15 %)**: *modelo IP/MIP completo y correcto, con binarias bien usadas; nota de escalabilidad (qué crece al aumentar el tamaño).*

---

## 4.1 Clasificación del problema

El dossier no declara el tipo de problema. Nuestra clasificación es:

**Problema de ruteo de vehículos capacitado (CVRP) con flota limitada, restricción de duración y opción de subcontratación.**

Cada elemento proviene de una regla del caso:

| Rasgo del caso | Patrón de modelamiento |
|---|---|
| Visitar cada cliente una vez, con un camión o con transportista | Partición de clientes con opción externa (*outsourcing*) |
| Cada camión sale de la base y vuelve | Ruteo con depósito único |
| Capacidad de 300 bidones por ruta | Restricción de capacidad (CVRP) |
| Jornada de 540 min con viaje y descarga | Restricción de duración (*distance/time-constrained VRP*) |
| Como máximo 11 camiones | Flota limitada |
| $ 55 000 por camión + $ 450 por km | Costo fijo por vehículo + costo variable por distancia |

**Por qué un modelo y métodos aproximados.** La decisión tiene dos partes acopladas: qué clientes van juntos (asignación) y en qué orden se visitan (secuencia). El número de secuencias posibles para *n* clientes crece como *n!* (ver paso 1). Una regla manual no garantiza buena calidad y un solver sin reducción no escala. Por eso formulamos el modelo exacto para la instancia reducida y usamos métodos aproximados en las instancias mayores.

---

## 4.2 Conjuntos e índices

| Símbolo | Definición |
|---|---|
| *N* | Clientes de la instancia (12 en la reducida, 50 en la intermedia, 150 en la completa) |
| *V₀* | *N* ∪ {0}, donde 0 es la base |
| *A* | Arcos dirigidos *(i, j)* con *i, j ∈ V₀* e *i ≠ j* |

Usamos arcos dirigidos aunque la matriz es simétrica. Con distancias simétricas, una ruta y su inversa tienen el mismo costo y la misma duración total, así que una formulación no dirigida tendría la mitad de arcos. Mantenemos la dirigida porque las variables de tiempo *T_i* dependen del sentido de recorrido: la hora de llegada a cada cliente cambia con el orden, aunque la duración total no.

## 4.3 Parámetros

| Símbolo | Valor en el caso | Significado |
|---|---|---|
| *dᵢ* | 6 a 40 | Demanda del cliente *i*, en bidones |
| *sᵢ* | 12 a 28 | Minutos de descarga en *i* |
| *D_ij* | matriz del dossier | Distancia en km (ya incluye el rodeo) |
| *tᵢⱼ* | 60 · *D_ij* / 40 | Minutos de viaje de *i* a *j* |
| *K* | 2 (reducida) | Camiones disponibles |
| *Q* | 300 | Capacidad por ruta, en bidones |
| *L* | 540 | Jornada máxima, en minutos |
| *F* | 55 000 | Costo fijo por camión que sale |
| *c* | 450 | Costo por km recorrido |
| *f* | 75 000 | Flete externo fijo por cliente |
| *g* | 300 | Flete externo por bidón |

## 4.4 Variables de decisión

| Variable | Dominio | Significado |
|---|---|---|
| *x_ij* | **binaria** {0, 1}, para *(i, j) ∈ A* | 1 si un camión recorre el arco *i → j* |
| *z_i* | **binaria** {0, 1}, para *i ∈ N* | 1 si el cliente *i* va con transportista arrendado |
| *T_i* | continua en [0, *L* − *sᵢ*] | Minuto en que empieza la descarga en *i*, contado desde la salida de la base |
| *u_i* | continua en [*dᵢ*, *Q*] | Bidones acumulados en el camión hasta *i*, incluido *i* |

Las variables *T* y *u* no son decisiones: son auxiliares que expresan la secuencia. *T* impone la jornada y *u* impone la capacidad a lo largo de cada ruta, y ambas eliminan los ciclos que no pasan por la base.

## 4.5 Función objetivo

$$
\min Z = F \sum_{j \in N} x_{0j} \;+\; c \sum_{(i,j) \in A} D_{ij}\, x_{ij} \;+\; \sum_{i \in N} (f + g\, d_i)\, z_i
$$

Los tres términos son el costo diario del caso: camiones que salen, kilómetros recorridos (incluido el regreso a la base) y fletes externos.

## 4.6 Restricciones

**(R1) Atención.** Cada cliente se atiende una vez y completo: entra una vez y sale una vez por un camión, o va con transportista.

$$
\sum_{j \in V_0,\, j \neq i} x_{ji} + z_i = 1, \qquad \sum_{j \in V_0,\, j \neq i} x_{ij} + z_i = 1 \qquad \forall\, i \in N
$$

**(R2) Flota.** A lo más *K* rutas por día.

$$
\sum_{j \in N} x_{0j} \le K
$$

**(R3) Vuelta a la base.** Cada ruta que sale vuelve.

$$
\sum_{j \in N} x_{0j} = \sum_{i \in N} x_{i0}
$$

*Esta igualdad es consecuencia de (R1) al sumar sobre todos los nodos; la escribimos explícita para que se lea.*

**(R4) Capacidad (MTZ).** La carga acumulada crece en *d_j* al entrar a *j*, y nunca supera *Q*.

$$
u_j \ge u_i + d_j - Q\,(1 - x_{ij}) \quad \forall\, i \ne j \in N, \qquad u_i \ge d_i \quad \forall\, i \in N
$$

*Si el arco no se usa, la restricción queda inactiva porque u_i ≤ Q y d_j ≤ u_j.*

**(R5) Jornada.** Viaje desde la base, descarga en cada punto y regreso no superan *L*.

$$
\begin{aligned}
T_j &\ge t_{0j} - t_{0j}\,(1 - x_{0j}) && \forall\, j \in N \\
T_j &\ge T_i + s_i + t_{ij} - (L + t_{ij})\,(1 - x_{ij}) && \forall\, i \ne j \in N \\
T_j + s_j + t_{j0} &\le L + (L + t_{j0})\,(1 - x_{j0}) && \forall\, j \in N
\end{aligned}
$$

**Por qué las cotas grandes (*big-M*) son válidas.** Toda ruta factible cumple *T_i + s_i ≤ L*, porque la descarga en *i* termina antes del regreso a la base. Por eso el lado izquierdo de cada restricción nunca supera el valor de su *M* cuando el arco no se usa. Para *M_0j* y *M_ij* son las cotas más pequeñas posibles. Para el arco de regreso, *M_j0 = L + t_j0* es válida pero holgada en *L* minutos: la restricción ya suma *L* en su lado derecho, así que la cota más fuerte sería *t_j0*. Ese valor más fuerte no se usó en el cuaderno. Una cota global de *L* más los máximos también sería válida, pero más grande.

**(R6) Dominios.** *x* y *z* son binarias; *T* y *u* son continuas en sus intervalos.

---

## 4.7 Mapeo de reglas del dossier a restricciones

| Regla del dossier (sección 3) | Restricción |
|---|---|
| Cada cliente se atiende una sola vez y completo; los pedidos no se dividen | R1 |
| Cada camión hace a lo más una ruta al día, sale de la base y vuelve | R2, R3 y la estructura de arcos |
| Pueden salir a lo más *K* = 11 camiones | R2 |
| La demanda de una ruta no supera *Q* = 300 | R4 |
| La duración de una ruta (viaje más descarga) no supera *L* = 540 min | R5 |
| Costo diario: $ 55 000 por camión, $ 450 por km, flete externo | Función objetivo |
| El transportista arrendado está siempre disponible | Variables *z_i* sin límite |
| Distancias simétricas con rodeo incluido | Matriz *D* sin factor adicional |

---

## 4.8 Implementación y verificación del modelo

El modelo está en la celda 18 del cuaderno, en PuLP 3.3.2 con el solver CBC.

**Control 1: solución extraída del modelo.** Después de resolver, la celda traduce las variables *x* y *z* a la solución del paso 2 (rutas y externos), y la pasa por el verificador del cuaderno. Si el verificador encuentra una regla violada, el cuaderno se detiene. Si el costo de la solución no coincide con el valor del objetivo, también se detiene.

**Control 2: certificación del óptimo.** PuLP reporta «Optimal» también cuando CBC se detiene por límite de tiempo con una solución. Por eso el cuaderno usa `modelo.sol_status`, que solo vale `LpSolutionOptimal` cuando CBC demostró el óptimo.

**Control 3: referencia exacta independiente.** La celda 19 calcula el óptimo de la reducida con programación dinámica sobre subconjuntos (Held-Karp), sin CBC. Para cada subconjunto de clientes guarda la distancia mínima de una ruta que lo visita, y luego combina hasta *K* rutas disjuntas. Es exacta porque, para un mismo subconjunto y último cliente, la duración crece con la distancia: el camino más corto es también el más factible.

### Resultados en la instancia reducida

| Método | Valor | Estado | Tiempo |
|---|---|---|---|
| Exacto DP (subconjuntos) | **106 786,00 $** | Óptimo certificado | < 1 s |
| Exacto CBC (MIP final, límite 600 s) | 106 786,00 $ | **No certificado**: la mejor solución encontrada iguala al óptimo, pero CBC no demostró optimalidad | 600 s (límite) |
| Exacto CBC (MIP primera versión, cotas big-M globales) | 107 236,00 $ | No certificado; brecha de 0,42 % | 600 s (límite) |
| Línea base aleatoria (10 semillas) | 219 980 a 268 360 $ | Factible | < 0,001 s |

**Solución óptima certificada.** Un solo camión sale de la base y visita los 12 clientes en este orden: 137, 88, 15, 113, 115, 68, 62, 86, 8, 26, 21, 53. Recorre 115,08 km y termina en 402,6 min de jornada (172,6 de viaje y 230 de descarga). Carga 204 bidones. Ningún cliente va con transportista arrendado.

**Comprobación a mano.** Costo = 55 000 + 450 × 115,08 = 106 786 $. Duración = 115,08 / 40 × 60 + 230 = 402,6 ≤ 540. Carga = 204 ≤ 300.

**Lectura del resultado.** En la reducida, el mejor plan usa un solo camión. Dividir los clientes en dos camiones no ahorra kilómetros suficientes para pagar el segundo camión (55 000 $). El flete externo no conviene: cada cliente despachado con flete cuesta al menos 75 000 $, mientras que el camión propio atiende a todos por 106 786 $ en total.

### Hallazgo: el MIP no certifica el óptimo en 600 s

El modelo tiene 168 variables binarias y 326 restricciones, y CBC no logra demostrar optimalidad en 600 s con 12 clientes. No medimos la relajación lineal, pero la hipótesis más probable es que las cotas *big-M* la debilitan y el árbol de ramificación crece.

La primera versión, con cotas big-M globales, terminó en 107 236 $ (brecha de 0,42 % sobre el óptimo). Ajustar las cotas por arco, como está en el modelo final, llevó a CBC a 106 786 $: el mismo valor que la DP. Aun así, CBC se detuvo en su límite de 600 s sin demostrar que ese valor es óptimo. Que el valor coincida con la DP es evidencia, no certificación.

**Consecuencia para el informe.** El óptimo de referencia de la reducida es el de la DP (106 786 $), que sí está certificado. El MIP final tiene brecha de 0,00 % frente a esa referencia, pero sin certificación propia. El paso 8 usará la DP como referencia exacta.

---

## 4.9 Nota de escalabilidad

Al aumentar el número de clientes *n*, el modelo crece así:

| Instancia | *n* | Binarias | Restricciones | Estado del MIP |
|---|---|---|---|---|
| Reducida | 12 | 168 | 326 | Óptimo certificado por DP; CBC no certifica en 600 s |
| Intermedia | 50 | 2 600 | 5 152 | Sin resolver (no se intentó) |
| Completa | 150 | 22 800 | 45 452 | Inviable para resolver exactamente |

**Qué crece y cómo.**

- **Variables.** Los arcos crecen con *n²*: *n(n+1)* binarias de ruteo, más *n* de flete externo. Pasar de 12 a 50 clientes multiplica las binarias por unas 15 (de 168 a 2 600), y llegar a 150 las deja en 22 800.
- **Restricciones.** Las de capacidad (MTZ) y de jornada también crecen con *n²*, porque hay una por cada par de clientes. Son la mayor parte del modelo en la completa.
- **Espacio de soluciones.** El número de secuencias posibles crece como *n!*, mucho más rápido que el tamaño del modelo. El modelo no puede recorrerlo por enumeración: depende del solver, y el solver necesita relajaciones fuertes para podar.
- **Calidad de la relajación.** Con 12 clientes el solver ya no demuestra el óptimo en 600 s. La hipótesis es la debilidad de las cotas *big-M*, pero no la medimos: sería el primer paso si se quisiera mejorar el exacto.

**Consecuencia gerencial.** Para la decisión diaria con 150 clientes no hay certificación exacta en un tiempo razonable. Por eso la solución del proyecto usa métodos aproximados (constructiva propia y metaheurística), los compara contra la mejor cota disponible en la completa, e indica el tiempo de cómputo del exacto cuando lo haya.

**Mejoras posibles si se requiriera un exacto para tamaños mayores.** Formulación de conjuntos de partición con generación de columnas, o cortes de capacidad y de jornada. Ambas quedan fuera del alcance de este informe.

---

## 4.10 Limitaciones del modelo

- **Día tipo y determinismo.** Las demandas, los tiempos y las velocidades son fijos, como en el dossier. Un modelo estocástico cambiaría la solución.
- **Sin ventanas horarias.** El dossier no las incluye, así que el modelo tampoco.
- **Flota fija.** No se modela la compra de vehículos ni las horas extra, que el dossier deja fuera de alcance.
- **Velocidad uniforme.** Una velocidad distinta por tramo requeriría cambiar *tᵢⱼ*, sin cambiar la estructura del modelo.
