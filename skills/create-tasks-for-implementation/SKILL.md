---
name: create-tasks-for-implementation
description: Lee el plan de implementación (plan_implementacion_vX.Y.Z.md) y su PRD y genera el documento de control de tareas y progreso (tareas_vX.Y.Z.md) con protocolo de trabajo, estado actual, contexto, decisiones, puntos abiertos, fases desglosadas en tareas atómicas con casillas, Definition of Done por fase y checklist pre-release. Se usa cuando el usuario pide crear, armar o actualizar las tareas, el backlog o el control de progreso a partir de un plan de implementación.
---

# Create Tasks for Implementation

El documento de tareas convierte el plan en una lista de trabajo ejecutable **una
tarea por vez**, por un modelo de IA que puede arrancar con el contexto limpio. No
agrega alcance ni decisiones: el *qué* sale del PRD, el *cómo* sale del plan, y
este archivo solo define el *cuándo* y el *orden*, y lleva el progreso real.

Tiene que ser autosuficiente: quien lo abra sin memoria de la conversación debe
saber qué se construye, qué reglas no se rompen, cuál es la próxima tarea y cómo
verificarla.

## Paso 0 — Leer antes de desglosar

1. Leé el **plan de implementación** completo (`plan_implementacion_vX.Y.Z.md`).
   Es la referencia técnica de cada tarea: fases, pasos `N.k`, decisiones `D-xx`,
   puntos abiertos `P-xx`, estructura del proyecto, tests por fase, matriz de
   trazabilidad y checklist pre-release.
2. Leé el **PRD** que el plan declara como fuente canónica. Anotá sus IDs (RF,
   RNF, AC) y la sección "Fuera de Alcance". Si el plan contradice al PRD,
   **pará y avisá** antes de generar nada.
3. Buscá contexto del repo: `AGENTS.md` / `CLAUDE.md` (stack, reglas inmutables,
   comandos), contratos o docs de APIs externas, y documentos
   `tareas_v*.md` previos.
4. Determiná versión y numeración:
   - La versión del archivo de tareas **es la del plan** (`tareas_vX.Y.Z.md` ↔
     `plan_implementacion_vX.Y.Z.md`), y vive en la misma carpeta que el plan.
   - **No hay tareas previas** ⇒ documento inicial, las fases arrancan donde
     arranca el plan (Fase 0).
   - **Hay tareas previas** ⇒ documento incremental: las fases siguen la
     numeración del plan, y los ajustes de secuencia (`A-Vx-xx`) arrancan en 01
     para esta versión. Las decisiones y puntos abiertos previos que siguen
     vigentes se resumen, no se copian enteros.
5. Si el plan no alcanza para desglosar algo (comando de build/test, ubicación de
   archivos, cómo se corre la app), **preguntá**. No inventes stack, comandos ni
   rutas.

## Estructura obligatoria del documento

Archivo: `tareas_vX.Y.Z.md`. Secciones en este orden:

```
# Control de Tareas y Progreso — <Proyecto> vX.Y.Z (<tema de la versión, si es incremental>)

> **⚠️ LEE ESTE BLOQUE COMPLETO ANTES DE HACER NADA. Aplica también si acabás de recibir el contexto limpio.**

---
## 0. Protocolo de trabajo (obligatorio)
## 1. Estado Actual
## 2. Cómo retomar el trabajo con el contexto limpio
## 3. Contexto del Proyecto (leer siempre)
## 4. Decisiones de arquitectura (NO re-discutir)
## 5. Puntos abiertos del PRD                       ← si el plan tiene P-xx
## Resumen de Progreso por Fase
# Fase N — <Nombre>                                 ← una por fase del plan, en H1
# Checklist de Verificación Pre-Release (vX)
```

Separá cada sección y cada fase con `---`.

## Qué va en cada sección

**0. Protocolo de trabajo** — lista numerada con las reglas de ejecución:
1. Este archivo es la **única fuente de verdad del progreso**: el estado real es
   el de las casillas `[ ]` sin iniciar / `[/]` en progreso / `[x]` hecha. En incrementales, aclarar qué fases cubre
   cada `tareas_v*.md` anterior.
2. **Una tarea por vez:** completar, verificar, marcar, informar y **PARAR**
   hasta que el usuario confirme.
3. Al empezar una tarea, marcarla `[ ]` → `[/]`.
   Antes de ejecutar, **leer lo que cita el `Ref:`** de la tarea y abrir los
   archivos existentes antes de modificarlos (los fragmentos del plan son guías
   y firmas, no copias del código real).
4. Si la tarea tiene `⚠️ Confirmar P-xx`, preguntar **antes** de escribir código
   y anotar la respuesta en §5.
5. Al terminar: correr la `Verificación`; si pasa, `[/]` → `[x]`, agregar una
   línea `**Hecho (fecha):**` (desvíos, nombres reales, conteo de tests),
   actualizar `Resumen de Progreso` y `1. Estado Actual`, informar (qué se hizo,
   archivos tocados, resultado, próxima tarea) y **PARAR**.
6. Si falla o hay bloqueo: **no marcar `[x]`** (queda en `[/]`), anotar en "Bloqueos" de §1, explicar
   y esperar instrucciones.
7. Al cerrar la última tarea de una fase, verificar su `✅ Definition of Done`.
8. No adelantar trabajo de tareas futuras (las dependencias van en `Depende de:`
   o en §4.3).
9. Cada tarea deja **el build y la suite existente en verde** (con el comando
   real del proyecto), salvo que la tarea diga qué tests viejos reemplaza.
10. Reglas propias de la versión que el plan o el PRD marquen como críticas
    (contratos que no se tocan fuera de una fase, datos sensibles, módulos que
    no son de este repo, etc.).

**1. Estado Actual** — blockquote "Esta sección la actualiza el modelo de IA al
terminar cada tarea. Es lo primero que debe leer quien retoma el trabajo." y una
lista con: **Fase en curso**, **Próxima tarea** (con aviso si requiere confirmar
un `P-xx`), **Última tarea completada**, **Rama de trabajo** (si aplica),
**Documentos creados**, **Puntos abiertos pendientes de confirmar**,
**Coordinación** con otros repos/equipos (si aplica), **Bloqueos activos** y
**Notas** (limitaciones del entorno: sin navegador, sin dispositivo, sin Docker…).
Al generar el documento queda en estado inicial: ninguna tarea completada,
próxima tarea = la primera de la primera fase.

**2. Cómo retomar el trabajo con el contexto limpio** — pasos numerados: leer §1
→ leer §3 y §4 → buscar la primera casilla `[/]` (tarea a medio hacer: revisar
qué quedó hecho antes de seguir) o, si no hay, la primera `[ ]` (si no coincide
con §1, preguntar) → leer su `Ref:` → si tiene `⚠️ Confirmar P-xx` sin confirmar,
preguntar → ejecutar solo esa tarea → correr su `Verificación` → marcar,
actualizar, informar y **PARAR**.

**3. Contexto del Proyecto** — subsecciones `###`:
- **Qué es esto** (v1) o **Qué cambia en vX** (incremental): párrafo corto del
  sistema; en incrementales, tabla `| Módulo | Qué se corrige/agrega | Fase |`,
  qué **no** es de este repo y qué **no** cambia.
- **Precisiones sobre el PRD** — solo si el plan las tiene: los hechos
  verificados en el código, resumidos, numerados.
- **Actores del sistema** — tabla `| Actor | Rol |` (en incrementales, "Rol en vX").
- **Stack obligatorio** — viñetas con tecnologías, versiones y herramientas de test.
- **Reglas inmutables** — viñetas `❌ **NO** …` tomadas de AGENTS.md / PRD.
- **Ubicación física de los archivos** — árbol en bloque de código marcando
  dónde viven el PRD, el plan y este archivo, más un bloque con los **comandos
  de uso frecuente** (build, test, test filtrado, migraciones, run).
- **Documentos de referencia** — tabla `| Documento | Para qué sirve |` con
  links relativos: plan (referencia principal de cada tarea), PRD (gana sobre
  el plan; parar y avisar), contratos, AGENTS.md, tareas previas.

**4. Decisiones de arquitectura (NO re-discutir)** — primero un blockquote con la
excepción: una decisión zanja un criterio, no un hecho; si contradice una fuente
canónica, **parar y avisar**. Luego:
- `### 4.1 Decisiones de versiones previas que siguen vigentes` (incrementales) —
  tabla `| # | Estado en vX |`, solo las que impactan esta versión.
- `### 4.2 Decisiones vX` — tabla `| # | Tema | Resumen |` con un resumen
  accionable de cada `D-xx` del plan (el detalle queda en el plan).
- `### 4.3 Ajustes de secuencia respecto del plan` — tabla
  `| # | Plan dice | Este archivo lo hace | Motivo |` con IDs `A-Vx-01…`. Acá se
  justifica cada vez que una sección del plan se parte en varias tareas, se
  reordena o se convierte en diagnóstico previo, para mantener el build verde o
  verificar por separado. Aclarar: **este archivo manda en el *cuándo*; el *qué*
  sigue siendo el del plan.** Si no hay ajustes, decirlo.

**5. Puntos abiertos del PRD** — blockquote "Actualizar la columna Estado al
confirmarlo (`Confirmado (fecha)` o `Cambiado (fecha): …`)" y tabla
`| # | Tema | Default | Confirmar antes de | Estado |` con todos los `P-xx` del
plan. Estado inicial: `⚠️ Pendiente` para los que el plan marca "Confirmar antes
de X.Y" (y la columna apunta a esa tarea), `Aplicar` para el resto.

**Resumen de Progreso por Fase** — una casilla por fase con su nombre corto y el
contador `(hechas/total)`, más una casilla para el Checklist Pre-Release. Debajo,
`**Total: 0/N**` con el desglose (tareas de desarrollo + verificaciones
pre-release). Los contadores tienen que coincidir con las casillas reales.

**Cada Fase** — formato fijo:

```
# Fase N — <Nombre>

> **Objetivo de la fase:** <qué queda funcionando al cerrarla>
> **Regla de la fase:** <restricción especial, si la hay>
> **Cobertura PRD:** <RF, RNF y AC que cubre, igual que en el plan>

- [ ] **N.1 <Título concreto de la tarea>**
  - **Objetivo:** <una oración: qué queda resuelto con esta tarea>
  - **Depende de:** <tareas previas, o —>
  - **⚠️ Confirmar P-xx** antes de escribir código.      ← solo si aplica
  - **Archivos a crear:** <rutas reales>
  - **Archivos a modificar:** <rutas reales>
  - **Pasos:**
    1. <acción concreta y verificable, citando la sección del plan>
    2. <qué NO tocar, si hay riesgo de desborde>
  - **Verificación:** <comando concreto → resultado esperado · verificación manual si aplica>
  - **Ref:** [plan §N.1](./plan_implementacion_vX.Y.Z.md) | <RF/RNF/AC del PRD> | <D-xx> | <P-xx>

> **✅ Definition of Done — Fase N**
> - [ ] <build de release limpio y suite 100 %>
> - [ ] <un ítem binario por cada AC/RNF que la fase cierra>
> - [ ] <reglas de la fase respetadas (contratos, textos, datos sensibles)>
```

- Una tarea = una unidad que se puede hacer, verificar y commitear sola, dejando
  el build verde. Normalmente corresponde a un paso `N.k` del plan; si un paso
  es grande, se parte (y se registra en §4.3).
- Los **tests son tareas propias** (`N.k Tests de la Fase N`), con los nombres de
  test del plan, marcando qué AC verifica cada uno, y un `--filter` concreto en
  la `Verificación`. Las tareas de código previas verifican "build verde + sin
  regresiones" y aclaran "(Tests en N.k)".
- Si el plan plantea una hipótesis sin confirmar, la primera tarea es de
  **diagnóstico puro** (no cambia comportamiento) y la regla de la fase dice:
  si la evidencia no la confirma, parar y avisar antes de seguir.
- Lo que no se puede verificar en el entorno (UI, dispositivos, servicios
  externos reales) va como **verificación manual** con pasos concretos, y se
  repite en el Checklist Pre-Release.
- Rutas, nombres de clases y comandos son los reales del proyecto (del plan o
  del código), nunca genéricos.
- Las tareas se generan **sin** líneas `**Hecho:**`: esas las agrega quien
  ejecuta cada tarea.
- La última fase es de **verificación final y documentación**: verificación de
  punta a punta, docs a actualizar (con diff aprobado por el usuario si son
  compartidos), suite completa, cobertura y revisión de la matriz de
  trazabilidad del plan.

**Checklist de Verificación Pre-Release** — blockquote con las condiciones de
ejecución (después de la última fase, build de release, servicios reales que
tienen que estar corriendo, si reemplaza o no checklists anteriores). Luego
subsecciones `###` por área (Compilación y tests, cada módulo/feature,
Seguridad/Transversal) con casillas `- [ ]` binarias que citan su AC/RNF en
negrita (`(**AC-04**)`). Parte del checklist del plan y lo baja a acciones
concretas de verificación.

## Paso 2 — Validar antes de entregar

Antes de presentar el documento, revisá y corregí:
- ¿Cada paso `N.k` del plan quedó cubierto por al menos una tarea?
- ¿Cada RF, RNF y AC del PRD aparece en la `Cobertura PRD` de alguna fase y cada
  AC tiene una tarea de tests o una verificación manual que lo cite?
- ¿Cada tarea tiene Objetivo, Depende de, Archivos, Pasos, Verificación y Ref?
- ¿Toda tarea afectada por un `P-xx` pendiente tiene su bloque `⚠️ Confirmar`?
- ¿Cada vez que te apartaste del orden del plan quedó un `A-Vx-xx` en §4.3?
- ¿Las dependencias son coherentes (ninguna tarea depende de una posterior)?
- ¿Los contadores del Resumen coinciden con las casillas reales?
- ¿Hay alguna tarea que el plan o el PRD no piden? Sacala.

Al entregar, resumí: versión, cantidad de fases y tareas, ajustes de secuencia
respecto del plan, los `P-xx` que el usuario tiene que confirmar y cuál es la
primera tarea a ejecutar.

## Reglas duras (siempre)

- Precedencia: PRD > plan > tareas. El documento de tareas no decide nada que
  el plan no haya decidido; si algo falta, va como pregunta al usuario o como
  `P-xx` en el plan, no resuelto en silencio en una tarea.
- Nada de alcance nuevo: lo que está en "Fuera de Alcance" del PRD no aparece.
- Trazabilidad total: toda tarea tiene `Ref:` al plan y al PRD; todo AC termina
  en un test o en una verificación manual registrada.
- Verificaciones binarias y ejecutables: un comando con resultado esperado o
  pasos manuales concretos, nunca "verificar que funcione bien".
- Los archivos `tareas_v*.md` de esta carpeta son referencia de **estructura y
  nivel de detalle**, no de contenido: no copies su stack, fases, decisiones ni
  reglas a otro proyecto.
- Ante la duda, preguntá; nunca inventes stack, comandos, rutas ni requerimientos.
