# AGENTS.md

## Propósito
Motor de reservas público + panel admin (PMS) de Iguapé Aparts, en una sola app.
V1 sin pagos online: los cobros se registran manualmente.

Fuente de verdad: `PRD.md` (RF-01..25, RNF-01..06, AC-01..39). Citá siempre el RF/AC que implementás.
Si algo contradice el PRD, o el PRD no lo define: parar y avisar antes de implementar.

## Stack
- Next.js 16 (App Router), Node 22 LTS, npm
- PostgreSQL 17 (extensión `btree_gist`) + Prisma 7.10.0. Desarrollo: Postgres local (base creada en pgAdmin). Supabase queda para más adelante
- Login propio del admin con Argon2id (sin Supabase Auth)
- react-day-picker + date-fns (fechas mostradas como `dd/MM/yyyy`)
- Tests: Vitest (unitarios y concurrencia), Playwright (e2e)
- Fechas de estadía (check-in/check-out): tipo `date` sin hora. "Hoy" se calcula en `America/Argentina/Buenos_Aires`.

## Cómo correr
- Desarrollo con Postgres local (sin Docker); Supabase se incorpora más adelante. Antes de migrar a Supabase, `DATABASE_URL` pasa a ser el pooler y `DIRECT_URL` la conexión directa.
- `.env` (en `.gitignore`): `DATABASE_URL` (runtime), `DIRECT_URL` (migraciones; en local es la misma URL), `SESSION_SECRET`, `CRON_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`
- Instalar: `npm install`
- Migrar: `npx prisma migrate dev`
- Seed (crea el primer admin): `npx prisma db seed`
- Levantar: `npm run dev` → http://localhost:7777 (script: `next dev -p 7777`)
  - Portal público: `/`
  - Panel admin: `/adminpanel`
- Tests: `npm test` (Vitest) y `npx playwright test` (e2e); corren contra la base de desarrollo
- Resetear contraseña del admin: `npm run admin:reset-password`
- Comprobantes de cobros (RF-55): se guardan en `storage/receipts/` (fuera de `public`, en `.gitignore`; configurable con `RECEIPTS_DIR`) y solo se entregan por `/api/admin/payments/[id]/receipt` con sesión de admin

## Valores y reglas que importan
| Qué | Valor |
|---|---|
| Soft lock de unidad (RF-09) | 15 min exactos desde que entra al formulario de huéspedes |
| Sync iCal con OTAs (RF-25) | cada 15 min + sincronización manual desde el panel |
| Concurrencia (RNF-03) | 20 confirmaciones sobre la última unidad → 1 reserva y 19 respuestas HTTP 409 |
| Disponibilidad y tarifas (RNF-04) | p95 < 1,5 s con 20 usuarios concurrentes |
| Argon2id (RNF-05) | memoria ≥ 19 MiB, iteraciones ≥ 2 |
| Token del feed iCal (RNF-06) | ≥ 128 bits aleatorios; token inválido → 404 |
| Anchos soportados (RNF-01) | 360 px a 1920 px sin scroll horizontal |
| Login admin | 3 fallos → bloqueo de 15 min, por IP y por email |

- La noche del check-out queda libre: una reserva del 10 al 14 ocupa las noches 10, 11, 12 y 13 (AC-19).
- El descuento por estadía se aplica sobre el total de la estadía (AC-06).
- Un bloqueo manual o un evento iCal importado reduce en 1 la disponibilidad de la categoría (AC-24, AC-32).
- El feed iCal exporta solo fechas ocupadas, sin datos del huésped (AC-31).
- Un cliente se identifica por Tipo/Nro de documento (supuesto del PRD, ver DA-06).

## Acceso y rutas
- Los visitantes comunes solo usan `/`. Cualquier ruta inexistente redirige a `/`.
- `/adminpanel` muestra el login. Sin sesión: las pantallas del panel redirigen al login y la API admin responde 401 sin datos (AC-37).
- El panel lleva `noindex` y no se enlaza desde el portal público.

## Decisiones abiertas del PRD
DA-01 transiciones de estado de reserva · DA-02 temporada que cruza el borde de una estadía · DA-03 soft lock vencido mientras se completa el formulario · DA-04 filtrar categorías por capacidad máxima · DA-05 alta de reservas desde el panel (WhatsApp/Mostrador) · DA-06 identificación de clientes · DA-07 borrar categorías o unidades con reservas futuras · DA-08 comprobante: archivo o referencia.

## Metodología
- Antes de tocar código, si existe `graphify-out/GRAPH_REPORT.md`, leelo.
- Después de un cambio aprobado, regenerar el grafo:
  - `graphify . --code-only`
  - `graphify cluster-only`
  - Ruta del ejecutable: `%APPDATA%\Python\Python313\Scripts\graphify.exe`

## Qué NO hacer
- No resolver por tu cuenta las Decisiones Abiertas DA-01..DA-08: parar y preguntar.
- No verificar disponibilidad solo en la app: la anti-superposición va con exclusion constraint en Postgres (RNF-03), escrita en SQL dentro de una migración.
- No sumar pagos online, emails automáticos, login de clientes ni múltiples roles (fuera de alcance V1).
- No exponer datos personales de huéspedes en endpoints públicos ni en el feed iCal; iCal sin token válido responde 404 (AC-38, AC-39).
- No loguear datos personales (documento, fecha de nacimiento, email, teléfono) ni contraseñas.
- No usar colores ni tipografías fuera de la guía de estilo de la web principal (RNF-02).
- No exponer ni enlazar `/adminpanel` desde el portal público.

## Documentación de referencia
- `PRD.md`: requerimientos, criterios de aceptación, fuera de alcance y decisiones abiertas.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
