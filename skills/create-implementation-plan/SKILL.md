---
name: create-implementation-plan
description: Lee un PRD y genera el plan de implementación técnico (plan_implementacion_vX.Y.Z.md) con fases, decisiones de arquitectura, puntos abiertos, tests por fase, matriz de trazabilidad y checklist pre-release. Se usa cuando el usuario pide crear, armar o actualizar un plan de implementación a partir de un PRD.
---

# Create Implementation Plan

El plan traduce el PRD a un camino de construcción ejecutable fase por fase. No
agrega alcance: cada fase, archivo y test existe porque lo pide un RF, RNF o AC
del PRD. El PRD manda; el plan obedece.

## Paso 0 — Leer antes de planificar

1. Leé el PRD completo. Es la **fuente canónica**. Anotá todos sus IDs (RF, RNF,
   AC) y la sección "Lineamientos de Implementación" (SOLID, buenas prácticas y
   categorías de patrones de diseño que aplican).
2. Buscá contexto del repo: `AGENTS.md` / `CLAUDE.md`, contratos o docs de APIs
   externas referenciados por el PRD, y planes `plan_implementacion_v*.md` previos.
3. Determiná la versión del plan:
   - **No hay planes previos** ⇒ `v1.0.0`, plan inicial (arranca en Fase 0).
   - **Hay planes previos** ⇒ plan incremental: subí la versión según el PRD
     (mayor si el PRD es una versión nueva) y **continuá la numeración** de fases,
     decisiones `D-xx` y puntos abiertos `P-xx` del último plan.
4. Si hay código existente, relevalo: el plan se apoya en el **código real**, no en
   planes viejos. Lo que verifiques en el código va como hecho, no como suposición.
5. Si falta algo que el plan necesita y el PRD no dice (stack, estructura de
   capas, herramienta de tests, dónde vive el archivo), **preguntá** antes de
   escribir. No inventes stack ni requerimientos.

## Estructura obligatoria del plan

Archivo: `plan_implementacion_vX.Y.Z.md` (por defecto en `docs/`, o donde el
usuario indique). Secciones en este orden:

```
# Plan de Implementación vX.Y.Z — <Proyecto> (<tema de la versión, si es incremental>)

> **Versión:** X.Y.Z
> **Fecha:** <fecha de hoy>
> **Stack:** <tecnologías separadas por " · ">
> **Documentos de referencia:**
> - [PRD](ruta) — **fuente canónica de esta versión** (RF-..., RNF-..., AC-...)
> - <PRDs y planes previos, contratos, AGENTS.md — cada uno con una línea de para qué sirve>

---
## Cómo usar este plan (leer antes de codear)
## Precisiones sobre el PRD (hechos verificables, no decisiones)   ← solo si relevaste código
## Índice de Fases
## Punto de partida: qué se conserva, qué cambia y qué se retira  ← solo en incrementales
## Decisiones de arquitectura (D-xx en adelante)
## Puntos abiertos del PRD (defaults tomados)
## Estructura del Proyecto                                        ← "(solo cambios vX)" en incrementales
## Fase N — <Nombre>                                              ← una por fase
## Matriz de Trazabilidad: Criterio ↔ Fase ↔ Test
## Diagrama general                                               ← flujo/arquitectura en ASCII
## Checklist de Verificación Pre-Release
```

Separá cada sección de nivel `##` con `---`.

## Qué va en cada sección

**Cómo usar este plan** — lista numerada corta con:
- Qué fases abarca esta versión (y que las anteriores están cerradas, si aplica).
- Que los fragmentos de código son guías de diseño y firmas, no copias exactas:
  antes de tocar un archivo, abrirlo.
- **Precedencia:** PRD actual > PRDs previos > contratos externos > este plan > tareas.
  Si el plan contradice al PRD, **parar y avisar**.
- Cómo se tratan los puntos abiertos (`P-xx`, los "confirmar antes de implementar").
- Reglas inmutables del proyecto (de AGENTS.md / PRD) que aplican a todo el plan.

**Precisiones sobre el PRD** — hechos verificados en el código que ubican *dónde*
está la causa o el punto de cambio de cada requerimiento, con `archivo:línea`.
No cambian el alcance. Si algo es una hipótesis, decilo y planificá una tarea
de diagnóstico antes del arreglo.

**Índice de Fases** — tabla `| Fase | Nombre | RF/RNF/AC Cubiertos | Descripción |`
con el número de fase en negrita. Debajo, un párrafo **Orden:** que diga qué fases
son secuenciales, cuáles independientes y por qué (dependencias, riesgos de
mergear a medias).

**Punto de partida** (incrementales) — tres subsecciones:
- `### Se conserva intacto` — tabla `| Área | Archivos | Nota |`.
- `### Se modifica / se crea` — tabla `| Archivo | Cambio | Fase |` (marcá **NEW**).
- `### Se retira` — qué se elimina y qué decisión lo justifica, o "Nada".

**Decisiones de arquitectura** — tabla `| # | Tema | Decisión |`. Una decisión
zanja un criterio o tradeoff, no un hecho. Cada fila: qué se decide, con qué
RF/RNF se relaciona, qué alternativa se descartó y por qué. Las que dependen de
validar con el usuario llevan **"Confirmar antes de X.Y"**. Acá se bajan a
concreto los patrones de diseño y principios SOLID que el PRD declaró en
"Lineamientos de Implementación" (qué patrón, en qué componente, para qué).

**Puntos abiertos** — tabla `| # | Hueco / decisión delegada por el PRD | Default de este plan | Estado |`.
Todo hueco o ambigüedad del PRD va acá con un default razonable y su
justificación. Estado: **Aplicar** o **Confirmar antes de X.Y**. Nunca resuelvas
un hueco en silencio dentro de una fase.

**Estructura del Proyecto** — árbol en bloque de código con `src/` y `tests/`.
Cada archivo con un comentario corto: responsabilidad, o `(NEW — D-xx)` /
`(MOD: qué cambia)` en incrementales.

**Cada Fase** — formato fijo:

```
## Fase N — <Nombre>

### Objetivo
<1–2 oraciones: qué queda funcionando al cerrar la fase>

### Cobertura PRD
<RF, RNF y AC que cubre; si son varios, en lista con una línea cada uno>

### N.1 <Paso concreto> (<IDs del PRD y decisiones que implementa>)
<explicación + fragmento de código: firma, interfaz, entidad o config,
 con comentario que referencie la tarea (`// tarea N.1`) y el RF/AC>

### N.k Tests de la Fase N
<por clase de test (NEW/MOD): lista de nombres de test descriptivos,
 marcando con ← **AC-xx** / RNF-xx cuál verifica cada uno>

**Verificación:** <comando concreto para correr los tests de la fase
 + verificación manual si aplica>
```

- La primera fase de un plan v1 es **scaffolding**: crear proyectos, referencias
  entre capas, dependencias, configuración y composición raíz (DI), con los
  comandos exactos.
- Los pasos se numeran `N.1, N.2, …` y son lo bastante chicos para ser una tarea.
- Los fragmentos de código muestran contratos y decisiones (firmas, interfaces,
  entidades, reglas), no implementaciones completas de relleno.
- Lo que sea manual (UI, dispositivos reales) se declara como verificación manual
  con pasos concretos.
- La última fase es de **verificación final y documentación**: suite completa,
  build de release, cobertura, docs a actualizar.

**Matriz de Trazabilidad** — tabla `| Criterio | Fase | Tests / verificación principal |`
con **todos** los AC del PRD y los RNF verificables. Ninguno puede quedar sin
fase ni sin test o verificación manual; si queda fuera, explicá por qué (p. ej.
"lo cubre otro repo").

**Diagrama general** — ASCII en bloque de código con los componentes, cómo se
comunican y los datos principales.

**Checklist Pre-Release** — checkboxes `- [ ]` binarios y verificables: build sin
warnings, tests al 100 % y cobertura, un ítem por cada AC/RNF crítico con su
número (`(AC-04)`), reglas del proyecto (`grep` de prácticas prohibidas, logs sin
datos sensibles) y documentación actualizada.

## Paso 2 — Validar antes de entregar

Antes de presentar el plan, revisá y corregí:
- ¿Cada RF, RNF y AC del PRD aparece en al menos una "Cobertura PRD"?
- ¿Cada AC está en la matriz con su test o verificación manual?
- ¿Cada fase tiene Objetivo, Cobertura PRD, pasos numerados, tests y Verificación?
- ¿Hay algo en el plan que el PRD no pide? Sacalo (o, si el usuario lo quiere,
  va al PRD primero, no al plan).
- ¿Toda ambigüedad del PRD quedó como `P-xx` y no resuelta en silencio?
- ¿Las decisiones reflejan SOLID y los patrones declarados en el PRD?
- ¿La numeración de fases, `D-xx` y `P-xx` continúa la del plan anterior?

Al entregar, resumí: versión, fases, decisiones tomadas y los `P-xx` que el
usuario tiene que confirmar.

## Reglas duras (siempre)

- El PRD es la fuente canónica: nada de features "que quedan bien". Lo que está
  en "Fuera de Alcance" del PRD no aparece en el plan.
- Trazabilidad total: todo paso cita su RF/RNF/AC o decisión; todo AC tiene test.
- Hechos (verificados en código) separados de decisiones (`D-xx`) y de huecos
  (`P-xx`). Nunca mezclar.
- Los planes de ejemplo de esta carpeta (`plan_implementacion_v*.md`) son
  referencia de **estructura y nivel de detalle**, no de contenido: no copies su
  stack, entidades ni decisiones a otro proyecto.
- Ante la duda, preguntá; nunca inventes stack, requerimientos ni APIs externas.
- El plan no incluye la lista de tareas: de él se deriva después un
  `tareas_vX.Y.Z.md` si el usuario lo pide.
