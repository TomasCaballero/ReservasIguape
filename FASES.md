# Plan por fases — ReservasIguape

Documento para retomar el trabajo en otro chat. Fuente de verdad de requisitos: `PRD.md` (v2: RF-01..67, RNF-01..09, AC-01..108). Reglas del repo: `AGENTS.md`. Citar siempre el RF/AC que se implementa.

## Cómo trabajamos
- Una fase por vez; al terminar se muestra el resumen y se pregunta **"¿commiteo y pusheo?"**. No commitear ni pushear sin esa aprobación.
- Commits con la skill `conventional-commit`: `tipo(scope): descripción`, imperativo, ≤72 caracteres, en español, con el trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- No resolver por cuenta propia las decisiones abiertas DA-01..08 del PRD: parar y preguntar.
- Antes de cerrar cada fase: `npm test`, `npx playwright test`, `npx tsc --noEmit`, `npx eslint .`. La base de dev debe quedar limpia tras los tests (6 categorías, 20 unidades, 0 reglas/temporadas/reservas/clientes/locks/bloqueos/cobros/throttles; `pendingExpiryDays = 5`).
- Idioma: español rioplatense (voseo). Pronombres: they/them si no se conocen.

## Entorno y datos técnicos
- Next.js 16.4.1 (App Router, `proxy.ts` en lugar de middleware, `PageProps<>`/`LayoutProps<>`/`RouteContext<>` globales — correr `npx next typegen` tras crear rutas nuevas), React 19, Prisma 7.10.0 (cliente en `app/generated/prisma`), Vitest 5, Playwright (`workers: 1`).
- Postgres 17 local (DB `reservas_iguape`). La sesión se fuerza a UTC (`options: "-c timezone=UTC"`) en `lib/prisma.ts`, seed y scripts.
- `prisma migrate dev` es interactivo y no sirve acá: usar `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script`, crear la carpeta de migración a mano, `prisma migrate deploy` y `prisma generate`.
- Dev server: `npm run dev` → http://localhost:7777. Para liberarlo: matar el proceso del puerto 7777 con PowerShell (`Get-NetTCPConnection -LocalPort 7777`).
- Los e2e usan `pg` directo (`tests/e2e/db.ts`); no pueden importar el cliente Prisma generado. Prefijos de documentos de prueba: `97xxxxxx` (portal), `96xxxxxx` (panel).
- Heredocs largos en Bash fallan a veces ("unexpected EOF"): usar la herramienta Write para archivos grandes.
- `.env` tiene `DATABASE_URL`, `DIRECT_URL`, `SESSION_SECRET`, `CRON_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`. Nunca mostrar sus valores.

## Diseño
Solo colores y tipografías de la web principal (`C:\Users\tomas\MisProyectos\IguapeKimi\Iguape2026`): fondo `#2B3D24`, texto `#E4E2C5`, lima `#E6EF73` (hover `#D4DD68`, active `#C2CB5D`), card `#3F5934`, marrón `#AD9C78` (solo bordes/detalles), texto oscuro `#1E2B18`; DM Serif Display + Source Sans 3; esquinas rectas; clases `.btn-filled`, `.btn-outlined`, `.caption-text`. Fechas `dd/MM/yyyy`; "hoy" en `America/Argentina/Buenos_Aires`.

---

## Fases completadas (commiteadas y pusheadas)

| # | Fase | Commit |
|---|---|---|
| 0 | Base del proyecto | `d3d174b` |
| 1 | Esquema, migración y seed (exclusion constraint anti-superposición) | `b58f23e` |
| 2 | Motor de disponibilidad y tarifas | `e81c2da` |
| — | Estilo de la web principal | `7aa1991` |
| 3 | Portal público: búsqueda de disponibilidad y precios | `9561e75` |
| 4 | Formulario de huéspedes, soft lock (15 min) y creación de reserva | `1659436` |
| 5 | Login del administrador con bloqueo por intentos | `4c2d125` |
| 6 | Admin: catálogo, tarifas, temporadas, descuentos y parámetros | `3b52a90` |
| 7 | Admin: reservas, calendario, bloqueos, método de pago y cobros | `ef9a4b4` |
| 8 | CRM: clientes, cumpleañeros y anonimización | `9f550ea` |
| 9 | iCal (feed e importación), sincronización y tareas programadas | `5ab2536` |
| 10 | Cierre: e2e completo, anchos y teclado, estilo, carga, seguridad y documentación | pendiente de commit |

### Decisiones de la Fase 7 (a recordar)
- Confirmada → Pendiente se rechaza ("Transición no permitida", RF-48/AC-70).
- Comprobantes en `storage/receipts/` (gitignored, `RECEIPTS_DIR` opcional) tras la interfaz `ReceiptStorage`; se sirven solo por `/api/admin/payments/[id]/receipt` con sesión. Intercambiable por Supabase Storage.
- Al volver a Pendiente se limpian `paymentInfoSentAt` y `cancelledByExpiry`. Reactivar prefiere la unidad anterior.
- Métodos de pago: Transferencia, Efectivo, Tarjeta, Depósito, Otro. Archivos PDF/JPG/JPEG/PNG de hasta 10 MB (10.485.760 bytes), validados por extensión y firma.
- El calendario muestra las reservas sin asignar en su unidad provisoria, con la marca "sin asignar".
- Cada reserva activa ocupa una unidad concreta (provisoria, `unitAssigned=false`) vía `UnitOccupancy`.

---

### Decisiones de las Fases 8 a 10 (a recordar)
- Anonimización: reemplaza titular y acompañantes y conserva fechas, categoría, montos y cobros; anonimizar dos veces responde 409 (índice único parcial por cliente, D-04). El `documentNumber` anonimizado es único por cliente (D-03).
- iCal: el feed (`/api/ical/<token>.ics`, token de 128 bits, 404 sin token válido) trae solo fechas, sin datos personales. `SUMMARY` de los eventos importados no se persiste ni se loguea.
- Cron: `POST /api/cron/tick` con `Authorization: Bearer <CRON_SECRET>` (401 sin credencial); lo dispara un scheduler externo cada ≤ 15 min (P-03). Hace sincronización iCal, vencimiento de Pendientes (RF-54), limpieza de comprobantes (RF-56), `LoginThrottle` y soft locks.
- Fase 10: `tests/e2e/full-flow.spec.ts` (portal → panel → CRM → feed), `responsive-keyboard.spec.ts` (360/768/1920 px y teclado), `style-audit.spec.ts` (colores y tipografías contra `app/globals.css`), `tests/db/public-endpoints.test.ts` (sin datos personales públicos) y `scripts/load-availability.ts` (p95 de `/api/availability`, contra `npm run build && npm start`).
- `npm audit`: los hallazgos altos están solo en herramientas de desarrollo (`eslint-config-next`, CLI de `prisma`), no en el código que corre en producción.

---

## Pendientes de producto
- Logo (la web principal solo tiene texto en el header).
- Pasar a Supabase (DATABASE_URL = pooler, DIRECT_URL = conexión directa) y los comprobantes a Supabase Storage.
- Configurar el scheduler real del cron en el hosting elegido (P-03) y comprobar ≥ 4 corridas en 60 min.
- IP del login desde `X-Forwarded-For`: en producción requiere un proxy de confianza; la sesión del admin no tiene revocación en el servidor.

## Otros datos
- Países del teléfono: lista de 17 en `lib/booking/countries.ts`.
- Acompañantes: 4 datos obligatorios si se agrega uno; máximo adultos + niños − 1.
