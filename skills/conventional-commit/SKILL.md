---
name: conventional-commit
description: Escribe mensajes de commit en formato Conventional Commits a partir de los cambios staged. Se usa al crear un commit o cuando el usuario pide commitear o redactar un mensaje de commit.
---

# Commit con Conventional Commits

Antes de escribir cualquier mensaje, entendé qué está entrando realmente al commit:

1. Ejecutá `git diff --staged` (y si hace falta `git status`) para ver los cambios.
2. Identificá el cambio fundamental: la idea central del commit, no el detalle de cada archivo. Preguntate "¿qué lograría este commit si lo explico en una frase?".
3. Traducí esa idea al formato:

   `tipo(scope): descripción`

   - **tipo**: `feat` si agrega funcionalidad, `fix` si arregla algo roto, `docs` si solo toca documentación, `refactor` si reorganiza sin cambiar comportamiento, `test` si son pruebas, `chore` si es mantenimiento (deps, config, scripts).
   - **scope**: el módulo o área afectada (`auth`, `tickets`, `gastos`...). Opcional: si el commit toca varias partes sin un área clara, omitilo.
   - **descripción**: imperativo, en minúscula, sin punto final, máximo 72 caracteres. Debe decir el *qué* y el *para qué*, no el *cómo* (nada de "modificar archivo x.js").
4. Si los cambios staged son temas inconexos, avisá y sugerí partirlos en varios commits en vez de mezclarlos en uno.
5. Si el commit rompe compatibilidad con versiones anteriores, agregá una línea en blanco y `BREAKING CHANGE:` explicando el quiebre en el cuerpo.

Ejemplos buenos:

- `feat(gastos): agregar categoría en el alta`
- `fix(tickets): rechazar tickets con asunto vacío`
- `docs(readme): actualizar instrucciones de instalación`

Ejemplo malo: `update`, `cambios varios`, `Fixed some stuff in API` (pasa del imperativo y no tiene scope claro).
