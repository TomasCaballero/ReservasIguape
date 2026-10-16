---
name: create-agents-md
description: Lee un PRD (y, si existen, el plan de implementación, las tareas y el código) y genera o actualiza el AGENTS.md del proyecto con propósito, rol del agente, flujo de trabajo, stack, comandos exactos, reglas inmutables trazadas al PRD y estándares condicionales (invariantes de dominio, logging/datos sensibles, versionado). Se usa cuando el usuario pide crear, armar o actualizar un AGENTS.md o CLAUDE.md a partir de un PRD.
---

# Create AGENTS.md

El AGENTS.md es lo primero que lee un agente al abrir el repo, y se carga en
**cada** turno: cada línea cuesta. Su trabajo es decirle al agente qué es esto,
cómo se trabaja acá, cómo se corre y qué no se rompe nunca. No repite el PRD,
el plan ni las tareas: **apunta** a ellos.

Encaja en esta cadena (cada skill lee lo que generó la anterior):
`create-prd` → **`create-agents-md`** → `create-implementation-plan` →
`create-tasks-for-implementation`. El plan y las tareas leen el AGENTS.md en
su Paso 0 para sacar stack, comandos y reglas inmutables.

## Paso 0 — Leer antes de escribir

1. Leé el PRD completo. Es la **fuente canónica**. Anotá:
   - Versión del sistema y propósito (Contexto y Problema, Objetivos).
   - "Lineamientos de Implementación": SOLID y categorías de patrones.
   - RNF de seguridad, privacidad, performance, offline, UI.
   - RF/RNF que imponen un **orden** o invariante (pipelines, estados, flujos).
   - "Fuera de Alcance".
2. Buscá lo que ya existe:
   - `AGENTS.md` / `CLAUDE.md` previo ⇒ **modo actualización**: conservá lo que
     sigue vigente, mostrá un diff de lo que cambia y no borres reglas sin
     aprobación del usuario.
   - `plan_implementacion_v*.md` y `tareas_v*.md` ⇒ tomá de ahí rutas reales,
     decisiones `D-xx` que bajan patrones a componentes, y la carpeta donde viven.
   - `graphify-out/` ⇒ el proyecto usa graphify (ver skill `use-graphify`).
   - **Mentalidad Ponytail (Lazy Senior Dev):** identificá si el PRD (RNF de
     dependencias, offline, tamaño de bundle, mantenibilidad) o el repo (pocas
     dependencias, AGENTS.md previo minimalista) ya exigen código minimalista.
     Ponytail se hereda **siempre** en el AGENTS.md generado; lo que cambia es
     qué RNF lo refuerzan, y eso se cita en §2 y §6.
3. Relevá el repo para sacar **comandos reales**: `package.json` (scripts),
   `*.csproj` / `*.sln`, `pyproject.toml`, `Makefile`, `scripts/`, `docker-compose`,
   README. Lo que verifiques en el repo va como hecho; lo que no, se pregunta.
4. Antes de escribir, hacé **TODAS** las preguntas que falten, en un solo
   bloque. Como mínimo, confirmá lo que no esté en el PRD ni en el repo:
   - Stack y versiones que importan (runtime, framework, DB, test runner).
   - Comandos exactos: instalar, levantar, tests, test filtrado, build, migraciones.
   - Puertos, rutas base y dónde vive cada app.
   - Carpeta del PRD, del plan y de las tareas (`docs/` por defecto).
   - Patrones concretos y en qué componente (si el plan todavía no existe).
   - ¿Usa graphify? ¿Hay script de release y dónde está la versión única?
   - Perfil del agente: dominio de experiencia relevante para el negocio.
   No inventes stack, comandos, rutas ni reglas.

## Estructura del documento

Archivo: `AGENTS.md` en la raíz del repo (salvo que el usuario diga otra cosa).
Secciones en este orden; las marcadas *(condicional)* van **solo** si el PRD o
el usuario las justifican — si no, no se escriben (ni con "N/A").

```
# AGENTS.md — <Proyecto> v<X.Y.Z>

> <1 línea: este archivo manda sobre el comportamiento del agente en este repo>

## 1. Propósito
## 2. Rol del agente y principios de diseño
## 3. Flujo de trabajo
## 4. Stack
## 5. Cómo correr
## 6. Reglas inmutables
## 7. Invariantes de dominio            ← (condicional)
## 8. Logging y datos sensibles         ← (condicional)
## 9. Estándares de interfaz            ← (condicional)
## 10. Versionado y release             ← (condicional)
```

Separá cada sección `##` con `---`.

## Qué va en cada sección

**1. Propósito** — 2–3 líneas: qué es la app, para quién, qué dolor resuelve.
Link al PRD canónico: `[PRD](docs/PRD.md) — fuente canónica de requerimientos`.

**2. Rol del agente y principios de diseño**
- **Identidad:** rol + seniority + dominio de negocio que importa para decidir
  (ej. "hospitality, donde el SLA en recepción y el modo offline son críticos").
  Una oración, no un currículum.
- **Mentalidad Ponytail (Lazy Senior Dev):** la identidad incorpora siempre
  esta línea: el agente es un senior *perezoso pero eficiente* que busca la
  solución más chica que cumple el requerimiento, prefiere reusar antes que
  escribir y rechaza la sobre-ingeniería (abstracciones, capas o dependencias
  que ningún RF/RNF pide). La pereza **no** pasa por encima de los patrones y
  decisiones `D-xx` que el PRD o el plan ya fijaron: esos se implementan igual,
  con el mínimo código.
- **Principios:** SOLID y buenas prácticas, tal como los declara el PRD.
- **Patrones:** cada uno bajado a **dónde** y **para qué**
  (`**Strategy** — motores de extracción MRZ/barcode/OCR, sin acoplar el flujo`).
  Si el plan ya existe, citá su `D-xx`. Si el PRD dice "no aplica", no inventes.

**3. Flujo de trabajo** — lista numerada que encadena los documentos:
0. **Contexto por grafo** *(solo si usa graphify)*: antes de leer código, leer
   `graphify-out/GRAPH_REPORT.md` y consultar el grafo para ubicar archivos
   (detalle en la skill `use-graphify`).
1. **Precedencia:** PRD > plan > tareas > este archivo para alcance; este
   archivo manda en cómo se trabaja. Si dos documentos se contradicen,
   **parar y avisar**.
2. **Paso Ponytail (antes de crear o modificar archivos):** recorrer la
   Escalera de 6 Peldaños y quedarse en el **primero** que resuelva:
   1) **YAGNI** — ¿lo pide un RF/RNF/AC o la tarea actual? Si no, no se hace.
   2) **Reusar** — ¿ya existe algo en el repo? (grafo/grep antes de escribir).
   3) **Stdlib** — ¿lo resuelve la librería estándar del lenguaje?
   4) **Plataforma nativa** — ¿hay API nativa (web/HTML/CSS/OS/framework)?
   5) **Dependencias existentes** — ¿lo resuelve algo ya declarado en el
      manifiesto (`package.json`, `*.csproj`, `requirements.txt`…)?
   6) **Código mínimo** — escribir lo más chico **y legible** posible; editar
      solo lo necesario, nunca reescribir archivos enteros.
   **Salida de emergencia** (contra la deuda y la rigidez): si el peldaño
   alcanzado obliga a un parche precario, a duplicar lógica por tercera vez o
   a forzar la stdlib donde hace falta una librería robusta, **parar y
   proponer** la refactorización o la dependencia nueva con su justificación;
   se aprueba como `D-xx` en el plan antes de implementarla.
3. **Plan:** apegarse al último `<carpeta>/plan_implementacion_vX.Y.Z.md`.
   Cambios de arquitectura ⇒ proponer y esperar aprobación (se actualiza el plan).
4. **Tareas:** seguir `<carpeta>/tareas_vX.Y.Z.md` respetando su §0 Protocolo
   (no copiarlo acá). Notación: `[ ]` sin iniciar · `[/]` en progreso · `[x]` hecha.
5. **Troubleshooting:** todo error técnico no trivial se documenta en
   `walkthroughs/troubleshooting_<tema>.md` con síntoma, causa raíz y solución.
6. **Cambios transversales:** si una tarea obliga a tocar un módulo fuera de su
   foco: alcance mínimo, sin refactor adyacente sin aprobación, el **por qué**
   va en el commit, correr los tests del módulo tocado (o crear uno básico), y
   si rompe algo, revertir y documentar en troubleshooting.
7. **Commits:** Conventional Commits (skill `conventional-commit`), si el
   proyecto la usa.

Si el plan y las tareas todavía no existen, escribí las rutas igual (con la
carpeta acordada) y aclaralo en una línea: "se generan con las skills
`create-implementation-plan` y `create-tasks-for-implementation`".

**4. Stack** — viñetas por capa (backend, frontend, DB, ML, infra) con **solo
las versiones que importan** y librerías clave con su rol en una frase. Puertos
y rutas base de cada app. Nada de librerías triviales.

**5. Cómo correr** — bloque de código con los comandos **exactos**, comentados:

```
# Instalar dependencias
# Levantar backend / frontend
# Tests (suite completa)
# Test filtrado (un test o una clase)
# Build de release
# Migraciones (si hay DB)
```

Si un comando no se pudo verificar en el repo y el usuario lo dictó, va igual;
si nadie lo sabe, preguntá — nunca un genérico tipo `npm test` "por las dudas".

**6. Reglas inmutables** — 3 a 8 viñetas `❌ **NO** <prohibición concreta>
(<RF/RNF-xx>)`. Cada una sale de un RNF, de "Fuera de Alcance" o de una
restricción que el usuario confirmó. Son las que el skill de tareas copia a su
§3. Nada de obviedades ("escribir código limpio") ni reglas de estilo genéricas.

La primera viñeta es **siempre** la regla Ponytail (es convención del flujo del
curso; si algún RNF la refuerza, citalo):
`❌ **NO** agregar dependencias externas ni escribir código nuevo sin pasar por
la Escalera de 6 Peldaños de Ponytail (§3.2); una dependencia o refactor nuevo
solo entra aprobado como D-xx.`
Cuenta dentro del tope de 3 a 8 viñetas.

**7. Invariantes de dominio** *(condicional)* — cuando el PRD define un flujo
cuyo orden o precondición es crítico (pipeline de procesamiento, máquina de
estados, cálculo en etapas): lista numerada con cada paso, qué entra, qué sale
y **por qué** el orden importa. Citar RF.

**8. Logging y datos sensibles** *(condicional: hay RNF de seguridad,
privacidad o diagnóstico)* — formato de log con ejemplo real, correlation ID si
aplica, y qué datos **nunca** se loguean (PII, tokens, imágenes, credenciales).

**9. Estándares de interfaz** *(condicional: hay UI y el PRD impone
restricciones)* — solo restricciones verificables que salen del PRD: offline
(sin CDNs), unidades/escala, prohibición de diálogos nativos, accesibilidad
con número. Si es preferencia estética sin respaldo del PRD, no va.

**10. Versionado y release** *(condicional: hay más de un artefacto que
publicar o script de release)* — dónde vive la versión única, el script
obligatorio de publicación, qué genera y dónde, y cómo se expone la versión.

## Paso 2 — Validar antes de entregar

Antes de mostrar el borrador, revisá y corregí:
- ¿Cada regla de §6–§9 cita un RF/RNF o una confirmación del usuario? (única
  excepción: la regla Ponytail, que es convención del flujo).
- ¿Están la línea Ponytail en §2, el Paso Ponytail con su salida de emergencia
  en §3 y la regla Ponytail como primera viñeta de §6?
- ¿Hay alguna regla de estilo genérica u obviedad? Sacala.
- ¿Cada comando de §5 está verificado en el repo o dictado por el usuario?
- ¿Las rutas de PRD, plan y tareas son las reales y coinciden con las que usan
  `create-implementation-plan` y `create-tasks-for-implementation`?
- ¿La notación de tareas es `[ ]` / `[/]` / `[x]`?
- ¿Se copió algo del protocolo de tareas o del plan que debería ser un link?
- ¿Alguna sección condicional quedó vacía o con relleno? Sacala.
- ¿Hay algo de "Fuera de Alcance" del PRD que aparezca como si se construyera?
- ¿Largo ≤ ~150 líneas? Si se pasa, recortá prosa antes que reglas.

Mostrá el borrador, esperá el OK del usuario y recién ahí guardalo como
`AGENTS.md`. Al entregar, resumí: secciones incluidas, condicionales
omitidas y por qué, y qué datos quedaron confirmados por el usuario vs.
verificados en el repo.

## Reglas duras (siempre)

- Preguntar primero, escribir después. Nunca inventes stack, comandos,
  rutas, puertos ni reglas.
- El PRD es la fuente canónica: toda prohibición se traza a un RF/RNF o a una
  confirmación explícita del usuario (salvo la regla Ponytail, que es fija).
- Ponytail recorta código, no requisitos: nunca justifica saltear un RF/RNF/AC,
  un test o un patrón decidido en el plan.
- AGENTS.md no duplica: el *qué* está en el PRD, el *cómo técnico* en el plan,
  el *cuándo* en las tareas. Acá va el *cómo se trabaja* y *qué no se rompe*.
- Hechos verificados en el repo separados de lo que dictó el usuario.
- El AGENTS.md de ejemplo de esta carpeta es referencia de **estructura y nivel
  de detalle**, no de contenido: no copies su stack, patrones ni reglas a otro
  proyecto.
- En modo actualización, ninguna regla existente se borra sin aprobación.
