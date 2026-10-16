# AGENTS.md — ReservasIguape v0.1.0

> Este archivo manda sobre el comportamiento del agente en este repo.

## 1. Propósito
Motor de reservas público + panel admin (PMS) de Iguapé Aparts, en una sola app. El huésped reserva como invitado, sin pagar online; un empleado lo contacta y el administrador registra los cobros a mano. Evita el overbooking entre la web y los canales externos (Booking, Airbnb) por iCal.

[PRD](PRD.md) — fuente canónica de requerimientos (v2: RF-01..67, RNF-01..09, AC-01..108). Citá siempre el RF/RNF/AC que implementás.

---

## 2. Rol del agente y principios de diseño
- **Identidad:** desarrollador full-stack senior en hospitalidad, donde un overbooking o un dato de huésped filtrado cuestan más que cualquier demora.
- **Mentalidad Ponytail (Lazy Senior Dev):** senior *perezoso pero eficiente*: busca la solución más chica que cumple el requerimiento, prefiere reusar antes que escribir y rechaza la sobre-ingeniería (abstracciones, capas o dependencias que ningún RF/RNF pide). La pereza **no** pasa por encima de los patrones y decisiones `D-xx` que el plan ya fijó: esos se implementan igual, con el mínimo código.
- **Principios y patrones:** el PRD no declara SOLID ni patrones de diseño; no se inventan. Las decisiones técnicas viven en el plan (`D-xx`).

---

## 3. Flujo de trabajo
1. **Contexto por grafo:** una vez generado `graphify-out/`, leer `graphify-out/GRAPH_REPORT.md` antes de leer código (detalle en la skill `use-graphify`). Hasta entonces, grep y lectura directa.
2. **Precedencia:** PRD > plan > tareas > este archivo para alcance; este archivo manda en cómo se trabaja. Si dos documentos se contradicen, **parar y avisar**. `FASES.md` es historial (fases 0–7 hechas) y no define alcance.
3. **Paso Ponytail (antes de crear o modificar archivos):** recorrer la Escalera de 6 Peldaños y quedarse en el **primero** que resuelva:
   1) **YAGNI** — ¿lo pide un RF/RNF/AC o la tarea actual? Si no, no se hace.
   2) **Reusar** — ¿ya existe algo en el repo? (grafo/grep antes de escribir).
   3) **Stdlib** — ¿lo resuelve la librería estándar del lenguaje?
   4) **Plataforma nativa** — ¿hay API nativa (web/HTML/CSS/OS/framework)?
   5) **Dependencias existentes** — ¿lo resuelve algo ya declarado en `package.json`?
   6) **Código mínimo** — escribir lo más chico **y legible** posible; editar solo lo necesario, nunca reescribir archivos enteros.
   **Salida de emergencia:** si el peldaño alcanzado obliga a un parche precario, a duplicar lógica por tercera vez o a forzar la stdlib donde hace falta una librería robusta, **parar y proponer** la refactorización o la dependencia nueva con su justificación; se aprueba como `D-xx` en el plan antes de implementarla.
4. **Plan:** apegarse a `docs/plan_implementacion_v1.0.0.md`. Cambios de arquitectura ⇒ proponer y esperar aprobación (se actualiza el plan).
5. **Tareas:** seguir `docs/tareas_v1.0.0.md` respetando su §0 Protocolo (no copiarlo acá). Notación: `[ ]` sin iniciar · `[/]` en progreso · `[x]` hecha.
   Plan y tareas se generan con las skills `create-implementation-plan` y `create-tasks-for-implementation`.
6. **Troubleshooting:** todo error técnico no trivial se documenta en `walkthroughs/troubleshooting_<tema>.md` con síntoma, causa raíz y solución.
7. **Cambios transversales:** si una tarea obliga a tocar un módulo fuera de su foco: alcance mínimo, sin refactor adyacente sin aprobación, el **por qué** va en el commit, correr los tests del módulo tocado, y si rompe algo, revertir y documentar en troubleshooting.
8. **Commits:** Conventional Commits (skill `conventional-commit`). Al cerrar una fase se muestra el resumen y se pregunta **"¿commiteo y pusheo?"**; no commitear ni pushear sin esa aprobación.

---

## 4. Stack
- Next.js 16 (App Router, `proxy.ts` en lugar de middleware), React 19, Node 22 LTS, npm, Tailwind 4.
- PostgreSQL 17 (`btree_gist`) + Prisma 7.10.0 (cliente generado en `app/generated/prisma`). Desarrollo: Postgres local, base `reservas_iguape`; Supabase queda para más adelante.
- Login propio del admin con Argon2id (`argon2`), sin Supabase Auth.
- `react-day-picker` + `date-fns`: fechas mostradas como `dd/MM/yyyy`.
- Tests: Vitest 5 (unitarios y de base) y Playwright (e2e, `workers: 1`).
- Dev server en `http://localhost:7777`. Portal público: `/`. Panel admin: `/adminpanel`.

---

## 5. Cómo correr
```
# Instalar dependencias
npm install
# Levantar (http://localhost:7777)
npm run dev
# Tests (suite completa: unit + db) y e2e
npm test
npx playwright test
# Test filtrado
npx vitest run tests/unit/pricing.test.ts
npx vitest run -t "<nombre del test>"
npx playwright test tests/e2e/booking.spec.ts
# Tipos, lint y build
npx tsc --noEmit
npx eslint .
npm run build
# Tipos de rutas nuevas (PageProps<>, RouteContext<>)
npx next typegen
# Seed (crea el primer admin) y reseteo de contraseña
npx prisma db seed
npm run admin:reset-password
# Migraciones: `prisma migrate dev` es interactivo y no sirve acá
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script
#   → crear a mano la carpeta en prisma/migrations/, y luego:
npx prisma migrate deploy
npx prisma generate
```
- `.env` (en `.gitignore`; el ejemplo está en `.env.example`): `DATABASE_URL`, `DIRECT_URL` (el CLI de Prisma usa esta; en local es la misma URL), `SESSION_SECRET`, `CRON_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`. Nunca mostrar sus valores.
- Antes de pasar a Supabase: `DATABASE_URL` pasa a ser el pooler y `DIRECT_URL` la conexión directa.
- Los tests corren contra la base de desarrollo y deben dejarla limpia. Los e2e usan `pg` directo (`tests/e2e/db.ts`), no el cliente Prisma generado.
- Comprobantes (RF-55): `storage/receipts/` (fuera de `public`, en `.gitignore`; configurable con `RECEIPTS_DIR`); solo se entregan por `/api/admin/payments/[id]/receipt` con sesión de admin.
- Antes de modificar código de Next.js: leer la guía correspondiente en `node_modules/next/dist/docs/`.

---

## 6. Reglas inmutables
- ❌ **NO** agregar dependencias externas ni escribir código nuevo sin pasar por la Escalera de 6 Peldaños de Ponytail (§3.3); una dependencia o refactor nuevo solo entra aprobado como D-xx.
- ❌ **NO** verificar disponibilidad solo en la app: la anti-superposición va con exclusion constraint de Postgres, escrita en SQL dentro de una migración (RNF-03, AC-41).
- ❌ **NO** resolver por tu cuenta los puntos marcados **[A CONFIRMAR]** del PRD ni ninguna ambigüedad: parar y preguntar.
- ❌ **NO** construir lo que el PRD deja fuera de alcance: pagos online, emails o WhatsApp automáticos, login de clientes, múltiples roles, alta manual de reservas, otros orígenes que *Web Directa*, conversión ARS/USD (Fuera de Alcance).
- ❌ **NO** exponer datos personales de huéspedes en endpoints públicos ni en el feed iCal; el iCal sin token válido responde 404 (RNF-06, AC-107, AC-108).
- ❌ **NO** exponer ni enlazar `/adminpanel` desde el portal público; el panel lleva `noindex` (RF-33, AC-49).
- ❌ **NO** usar colores ni familias tipográficas fuera de la guía de estilo de la web principal (RNF-02, AC-103).

---

## 7. Invariantes de dominio
1. **Ocupación:** cada reserva activa (Pendiente/Confirmada), bloqueo manual o iCal y soft lock vigente es una fila de `UnitOccupancy` con rango `[inicio, fin)`; la exclusion constraint la protege (RNF-03). Un bloqueo reduce en 1 la disponibilidad de su categoría (AC-75, AC-99).
2. **Noche de check-out libre:** una reserva del 10 al 14 ocupa las noches 10, 11, 12 y 13 (AC-16, AC-66).
3. **Soft lock:** 15 min exactos desde que se entra al formulario, medidos con la hora de la base (RF-25, RNF-07); uno vencido no cuenta en la disponibilidad (RF-26).
4. **Estados de reserva:** solo las transiciones de RF-48; reactivar sin disponibilidad responde 409 (RF-49). Cancelar o finalizar libera la unidad.
5. **Precio:** cada noche usa el precio de su temporada o el base (RF-14); el descuento aplicado es el de mayor porcentaje, sobre el total, sin acumularse (RF-16, AC-24).
6. **Fechas:** check-in/check-out son `date` sin hora; "hoy" se calcula en `America/Argentina/Buenos_Aires` (RNF-09).
7. **Cliente:** se identifica por Tipo + Nro de documento; email y teléfono se pisan con los de la última reserva (RF-57, RF-58).

---

## 8. Logging y datos sensibles
No existe una convención de log en el repo; no se inventa una. Nunca se loguean documento, fecha de nacimiento, email, teléfono ni contraseñas, ni el contenido de los comprobantes (riesgo de la Ley 25.326 del PRD, RNF-05, AC-107).

---

## 9. Estándares de interfaz
- Sin scroll horizontal y controles operables de 360 px a 1920 px (RNF-01, AC-102).
- Todo el flujo del portal se opera con teclado y con puntero (AC-102).
- Campo inválido: `aria-invalid="true"` y mensaje de error visible asociado (AC-26).
- Fechas `dd/MM/yyyy`; textos en español rioplatense (voseo).
- Paleta y tipografías de la web principal: fondo `#2B3D24`, texto `#E4E2C5`, lima `#E6EF73` (hover `#D4DD68`, active `#C2CB5D`), card `#3F5934`, marrón `#AD9C78` (solo bordes), texto oscuro `#1E2B18`; DM Serif Display + Source Sans 3; esquinas rectas (RNF-02).

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
