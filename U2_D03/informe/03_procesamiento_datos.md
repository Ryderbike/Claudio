# Paso 3. Procesamiento de datos

**Grupo 07 · Dossier D03, distribución de agua purificada en bidones (Aguas del Desierto Ltda.)**
**Rúbrica criterio 3 (6 %)**: *estructuras del modelo y de las plantillas generadas de forma documentada y verificable.*

Este paso documenta cómo se transforman los datos del dossier antes de modelar. Todo número citado aquí se reproduce ejecutando el cuaderno `IO2_U2_D03_Constructiva.ipynb` en Colab (*Entorno de ejecución > Ejecutar todas*), sin subir archivos.

---

## 3.1 Fuentes de datos

| Archivo | Contenido | SHA-256 (8 primeros … 4 últimos caracteres) |
|---|---|---|
| `Dossier_U2_D03.pdf` | Enunciado, reglas, costos, instancias y preguntas P1 a P3 | `43e24e4f…8c53` |
| `D03_puntos.csv` | 151 filas (base + 150 clientes): posición, demanda, minutos de descarga y pertenencia a instancias | `c35cd746…2aa5` |
| `D03_distancias.csv` | Matriz de 151 × 151 de distancias de viaje en km | `7a4fa7d1…48d8` |
| `D03_parametros.csv` | 13 parámetros: capacidad, jornada, velocidad, costos, flete externo, flota por instancia | `3e13f4f4…edd1` |
| `Datos_U2_D03.xlsx` | Mismas tablas en cuatro hojas (`Leeme`, `puntos`, `parametros`, `distancias`) | `a896e9fe…7d37` |
| `IO2_U2_D03_Constructiva.ipynb` | Cuaderno base; trae los datos embebidos en la celda 1 | ver nota |

*Nota: la huella del cuaderno cambia porque el grupo completó la celda del modelo exacto y agregó la celda de certificación; el cuaderno entregado es la versión del repositorio.*

Los datos son de trabajo (verosímiles, no reales). Esto se declara como supuesto en el paso 2.

---

## 3.2 Flujo de procesamiento

El cuaderno transforma los datos en cinco etapas. Cada etapa corresponde a una celda numerada.

1. **Carga (celda 1).** Los datos viajan embebidos como un bloque comprimido (gzip + base64) que se descomprime a un diccionario `DATA` con las tablas `puntos`, `distancias` y `parametros`.
2. **Estructuras de acceso (celda 3).** Se crean tres objetos: `PUNTOS` (diccionario id → fila), `DIST` (matriz `DIST[a][b]` en km) y `PAR` (diccionario parámetro → valor).
3. **Instancias (celda 3).** La función `instancia(nombre)` devuelve la lista de clientes de cada instancia, con su flota `K` y los parámetros del caso. Las instancias se definen por las banderas `en_reducida` y `en_intermedia` de la tabla de puntos.
4. **Derivados (celda 3).** La función `minutos(a, b, inst)` convierte la distancia en tiempo de viaje: `km / 40 × 60`. La función `costo_flete(i, inst)` calcula el flete externo de un cliente: `75 000 + 300 × demanda`.
5. **Evaluación y verificación (celda 5).** `evaluar` calcula el costo diario; `verificar` revisa una por una las reglas de la sección 3 del dossier y devuelve la lista de reglas violadas.

**Decisión de procesamiento.** La matriz de distancias ya incluye el rodeo de las calles (factor 1,25). Por eso el tiempo de viaje se calcula directamente con la distancia de la matriz y **no** se vuelve a aplicar el factor. Aplicarlo dos veces sobrestimaría todos los tiempos y el costo por kilómetro.

---

## 3.3 Controles de calidad de los datos

Antes de usar los datos se corrieron los siguientes controles. Cada uno es reproducible con los archivos listados en 3.1.

| Control | Resultado | Criterio |
|---|---|---|
| Datos embebidos en el cuaderno vs. `D03_puntos.csv` | 0 diferencias en 151 filas | Igualdad exacta de id, tipo, posición, demanda, minutos y banderas |
| Matriz embebida vs. `D03_distancias.csv` | Diferencia máxima 0,00 km | Igualdad exacta de las 151 × 151 celdas |
| Hojas del Excel vs. CSV | Idénticas en `puntos`, `distancias` y `parametros` | Igualdad celda a celda |
| Simetría de la matriz | Sí | `D[a][b] = D[b][a]` en todos los pares |
| Diagonal de la matriz | Cero en todos los puntos | `D[a][a] = 0` |
| Regla de rodeo | Error máximo 0,00 km | `D[a][b] = redondeo₀,₀₁(1,25 × distancia euclídea)` en todos los pares |
| Identificadores | 150 clientes con ids consecutivos 1 a 150 | Sin huecos ni duplicados |
| Demanda por cliente | Entre 6 y 40 bidones; promedio 16,85 | Coincide con «entre 6 y 40 (en promedio 17)» del dossier |
| Minutos de descarga | Entre 12 y 28 min | Coincide con «entre 12 y 28 minutos» del dossier |
| Totales por instancia | Completa 2 527 bidones y 2 957 min; reducida 204 y 230; intermedia 866 y 969 | Coinciden con la tabla de la sección 4 del dossier |
| Capacidad agregada `K × Q` | 3 300, 600 y 1 200 | Mayor que la demanda total en las tres instancias |
| Factibilidad individual | Ningún cliente excede la jornada por sí solo | Ruta base → cliente → base: entre 47,8 y 251,2 min, con L = 540 |
| Parámetros vs. sección 3 del dossier | Coinciden | Q = 300; L = 540 min (9 h); 40 km/h; 55 000 $/camión; 450 $/km; flete 75 000 $ + 300 $/bidón |

**Lectura.** Los datos son internamente consistentes y coinciden con el enunciado. La capacidad agregada de la flota no es el límite del problema: la jornada y la distancia sí lo son, porque el mismo total de bidones puede repartirse en rutas factibles o infactibles según su orden.

---

## 3.4 Estructuras de datos del modelo

Cada estructura tiene un uso definido en las etapas del análisis.

| Estructura | Tipo en Python | Contenido | Usada en |
|---|---|---|---|
| `DATA` | diccionario | Tablas `puntos`, `distancias`, `parametros` y código `D03` | Carga |
| `PUNTOS[i]` | diccionario | Fila del punto `i`: `x_km`, `y_km`, `demanda`, `servicio_min`, banderas | Modelo, verificador, costo |
| `DIST[a][b]` | lista de listas | Distancia de viaje en km del punto `a` al `b` (0 = base) | Costo por km, tiempos |
| `PAR` | diccionario | 13 parámetros del caso | Todas las funciones |
| `instancia(n)` | diccionario | `ids`, `K`, `Q`, `L`, `vel`, `F`, `c_km`, `flete_fijo`, `flete_unidad` | Todo cálculo por instancia |
| Solución | diccionario | `{"rutas": [[i₁, i₂, …], …], "externos": [j₁, …]}` | `evaluar`, `verificar`, salidas |
| `TABLA` | lista de registros | Por corrida: dossier, instancia, método, valor, tiempo, semilla, factibilidad, notas | Tabla estándar de resultados |

**Formato de la solución.** Cada ruta es la secuencia de clientes que visita un camión, saliendo de la base y volviendo a ella. Los externos son los clientes que se despachan con transportista arrendado. Un cliente aparece exactamente una vez: en una ruta o en `externos`.

**Formato de la tabla estándar.** Cada corrida que se reporta deja una fila con las columnas `dossier`, `instancia`, `metodo`, `valor`, `tiempo_s`, `semilla`, `factible` y `notas`. La tabla se exporta a `tabla_estandar_D03.csv`, y las soluciones de la línea base a `soluciones_aleatoria_D03.json`.

---

## 3.5 Plantillas generadas y su estado

| Plantilla | Estado | Evidencia reproducible |
|---|---|---|
| Constructiva aleatoria (línea base) | Ejecutada: 10 semillas × 3 instancias | Celda 9: «Todas las soluciones son factibles: 30 de 30» |
| Verificador de reglas | Operativo; revisa las cuatro reglas del dossier (asignación, flota, capacidad, jornada) | Celda 5; cada solución de la tabla pasa por él |
| Modelo exacto (IP/MIP) | Implementado en la celda 18; ver paso 4 | Celda 18: estado, valor y bandera de certificación |
| Certificación exacta independiente (DP) | Implementada en la celda 19 | Celda 19: costo óptimo y brecha del CBC |
| Constructiva propia | **Pendiente.** La plantilla todavía devuelve la aleatoria | Celda 16; se entrega en U2-A3 y U2-A4 |
| Metaheurística (SA/TS/GA) | **Pendiente.** Plantilla de la sesión 10 | Se entrega en U2-A4 |

**Honestidad sobre el estado.** Las dos plantillas pendientes no forman parte de este paso. Se listan aquí porque el criterio 3 exige documentar las plantillas generadas, incluidas las que todavía no producen resultados.

---

## 3.6 Línea base generada

RESULTADOS_LINEA_BASE

---

## 3.7 Limitaciones del procesamiento

- **Datos sintéticos.** Los datos son verosímiles y no reales. Los resultados sirven para comparar métodos, no para predecir costos de la empresa.
- **Día tipo y determinismo.** Las demandas se conocen la tarde anterior y los tiempos son medias fijas. No hay tráfico, ventanas horarias ni variabilidad en la descarga.
- **Velocidad constante.** La velocidad de 40 km/h se aplica a todo el recorrido, aunque en caminos de faena sea menor. Esto subestima el tiempo en los campamentos más lejanos.
- **Sin inventario de la base.** La carga en la base no consume jornada, como indica el dossier.
