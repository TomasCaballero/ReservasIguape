---
name: create-prd
description: Crea o audita un PRD siguiendo el template y el checklist de calidad del curso, iterando en loop hasta que quede firme. Se usa cuando el usuario pide crear, escribir, revisar, auditar o endurecer un PRD.
---

# Create PRD

Trabajás en LOOP, nunca en one-shot: normalizar → auditar → esperar el juicio del
usuario → reescribir → volver a auditar. El PRD está listo solo cuando una
auditoría sale limpia.

## El template del curso (estructura obligatoria)

# PRD-001: <nombre del proyecto> — <una línea de qué es>
## Contexto y Problema           (el dolor real y para quién; personas: quién lo usa y qué necesita)
## Objetivos                     (qué significa ganar, a nivel producto)
## Requerimientos Funcionales    (RF-01, RF-02, … — "El sistema debe <una sola acción>")
## Requerimientos No Funcionales (RNF-01, … — cualidad CON número: "< 3 s p95", "≥ 85%")
## Lineamientos de Implementación (SOLID, buenas prácticas y patrones de diseño aplicables al proyecto)
## Criterios de Aceptación       (AC-01 (RF-01): Dado <contexto>, cuando <acción>, entonces <resultado medible>)
## Fuera de Alcance              (lo que explícitamente NO entra)
## Riesgos y Dependencias        (riesgo → mitigación; de qué depende)

### Contenido obligatorio de "Lineamientos de Implementación"

Todo PRD debe declarar, en esta sección:
- El código debe respetar los principios SOLID.
- El código debe seguir buenas prácticas de desarrollo (nombres claros, funciones
  chicas, DRY/KISS, manejo de errores, tests, sin código muerto).
- Según el proyecto, se aplicarán patrones de diseño creacionales, estructurales
  y/o de comportamiento. El PRD indica qué categorías aplican y por qué, o aclara
  "no aplica" con justificación.

## Paso 1 — Crear o normalizar

- Si el usuario pide un PRD nuevo: hacele TODAS las preguntas que necesites ANTES
  de escribir (el dolor, las personas, las features core, las restricciones).
  NO inventes requerimientos. Preguntá también qué tipo de proyecto es, para
  decidir qué categorías de patrones de diseño aplican (no inventes patrones
  concretos sin confirmar).
- Si el usuario trae un PRD existente: si no está en Markdown limpio, pasalo a
  Markdown. Validá que respete la estructura del template y decile qué secciones
  faltan o están fuera de lugar. Si falta alguna, agregá el encabezado vacío para
  dejar el molde completo, pero NO inventes requerimientos ni criterios. Excepción:
  en "Lineamientos de Implementación" escribí siempre el texto fijo de SOLID y
  buenas prácticas (es regla del curso) y dejá la elección de patrones pendiente
  de confirmación del usuario.

## Paso 2 — Auditar (sin reescribir todavía)

Auditá el contenido contra este checklist y marcá los problemas UNO POR UNO,
diciendo dónde está cada uno y por qué:
- ¿Cada RF es atómico (una sola acción) y dice "debe"?
- ¿Cada RNF tiene un número concreto? (no "rápido" → "< 3 s p95")
- ¿Cada RF tiene al menos un AC que lo verifique?
- ¿Cada AC es binario (pasa/no pasa) y está en formato Dado/Cuando/Entonces?
- ¿El "Fuera de Alcance" está explícito?
- ¿Hay un AC de control de acceso (que un usuario no vea datos de otro)?
- ¿Existe "Lineamientos de Implementación" con SOLID, buenas prácticas y la
  decisión sobre patrones creacionales/estructurales/de comportamiento?
NO agregues features nuevas.

## Paso 3 — Esperar el juicio del usuario

Presentá los hallazgos y esperá: el usuario aprueba o rechaza cada uno.
No corrijas nada sin aprobación.

## Paso 4 — Reescribir y volver a auditar

Reescribí SOLO los RF, RNF y AC que el usuario aprobó como débiles, aplicando las
correcciones aprobadas. Mantené el resto igual. Devolvé el PRD completo
actualizado. Después VOLVÉ al Paso 2 sobre la versión nueva: lo normal es que la
segunda pasada encuentre cosas que la primera no vio. Repetí el loop hasta que la
auditoría salga limpia.

## Reglas duras (siempre)

- Todo lo que el usuario no pidió explícitamente va a "Fuera de Alcance": nada de
  features "que quedan bien".
- Criterios con "correctamente" o "adecuado" no sirven: binarios o nada.
- Ante la duda, preguntá; nunca inventes.
- Todo PRD debe declarar explícitamente que el código respeta SOLID y buenas
  prácticas, y qué categorías de patrones de diseño aplican según el proyecto.