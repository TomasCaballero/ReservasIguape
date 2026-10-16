---
name: use-graphify
description: Usa el grafo de conocimiento del repo generado por graphify (graphify-out/GRAPH_REPORT.md y graph.json) para ubicar módulos y archivos antes de leer código, y lo mantiene actualizado. Se usa al arrancar una tarea en un repo que tiene graphify-out/, cuando el usuario pide entender la arquitectura, buscar dónde vive algo o instalar/regenerar graphify.
---

# Use Graphify

graphify convierte el repo en un grafo (nodos = archivos, clases, funciones,
conceptos; aristas = relaciones) y lo deja en `graphify-out/`. Sirve para
**leer menos archivos**: primero se ubica en el grafo, después se abre solo lo
necesario. No reemplaza leer el código antes de modificarlo.

Esta skill define **cómo se usa graphify en el flujo del curso**. La herramienta
trae su propia skill oficial (`/graphify`), que es la que construye el grafo.

## Instalación (una vez por máquina / repo)

Solo si el usuario lo pide o `graphify` no existe. Confirmá antes de instalar.

```bash
uv tool install graphifyy      # o: pipx install graphifyy / pip install graphifyy
graphify install --project     # registra la skill oficial en .claude/skills/graphify/
```

- El paquete de PyPI es `graphifyy` (doble y). Otros `graphify*` no son oficiales.
- Opcional: `graphify hook install` regenera el grafo en cada commit y checkout.
- Primera construcción, dentro del asistente: `/graphify .`

## Qué hay en `graphify-out/`

| Archivo | Para qué |
|---|---|
| `GRAPH_REPORT.md` | **Punto de entrada.** Resumen, comunidades (módulos), "god nodes" (lo más conectado), conexiones sorprendentes y preguntas sugeridas. |
| `graph.json` | Grafo completo. Se consulta con `graphify query/path/explain`, no se lee entero. |
| `graph.html` | Vista interactiva para el humano. El agente no la usa. |

## Protocolo al arrancar una tarea

1. **¿El grafo está al día?** Si hubo commits/merges desde la última
   generación (o falta `graphify-out/`), actualizalo antes de usarlo:
   `graphify update .` (incremental). Si no se puede, avisá que el grafo puede
   estar desactualizado y verificá en el código todo lo que saques de él.
2. **Leé `graphify-out/GRAPH_REPORT.md`** (no `graph.json`). Ubicá la
   comunidad que corresponde a la tarea según su `Ref:` al plan.
3. **Consultá puntual** para bajar a archivos:
   - `graphify explain "<Clase o módulo>"` — qué es y con qué se conecta.
   - `graphify path "<A>" "<B>"` — cómo llega A a B (impacto de un cambio).
   - `graphify query "<pregunta>"` — búsqueda abierta.
   Códigos de salida: `0` respuesta · `3` nombre ambiguo (precisá) · `4` no existe.
4. **Abrí solo los archivos señalados** y leelos antes de modificarlos.
5. **Cambios transversales:** antes de tocar un módulo fuera del foco de la
   tarea, `graphify path` desde lo que cambiás hasta los consumidores para
   saber qué tests correr.

## Cuándo NO usarlo

- Repo chico (pocos archivos): leer directo es más barato.
- La tarea ya nombra los archivos exactos (`Archivos a modificar:`).
- El grafo está desactualizado y no se puede regenerar: grep y lectura directa.
- Aristas marcadas `INFERRED` o `AMBIGUOUS`: son pistas, no hechos; confirmá en
  el código antes de basar una decisión en ellas.

## Reglas duras

- El grafo orienta; el código manda. Nada sacado del grafo se escribe en un
  plan o troubleshooting como hecho sin verificarlo en el código.
- No commitear `graphify-out/` salvo que el proyecto lo decida (si no está en
  `.gitignore`, preguntá).
- No instalar, desinstalar ni agregar hooks sin confirmación del usuario.
- No sumar dos bloques de instrucciones de graphify al AGENTS.md (CLI y MCP):
  una sola vía de consulta.
