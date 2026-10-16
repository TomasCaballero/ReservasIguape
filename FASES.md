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

### Decisiones de la Fase 7 (a recordar)
- Confirmada → Pendiente se rechaza ("Transición no permitida", RF-48/AC-70).
- Comprobantes en `storage/receipts/` (gitignored, `RECEIPTS_DIR` opcional) tras la interfaz `ReceiptStorage`; se sirven solo por `/api/admin/payments/[id]/receipt` con sesión. Intercambiable por Supabase Storage.
- Al volver a Pendiente se limpian `paymentInfoSentAt` y `cancelledByExpiry`. Reactivar prefiere la unidad anterior.
- Métodos de pago: Transferencia, Efectivo, Tarjeta, Depósito, Otro. Archivos PDF/JPG/JPEG/PNG de hasta 10 MB (10.485.760 bytes), validados por extensión y firma.
- El calendario muestra las reservas sin asignar en su unidad provisoria, con la marca "sin asignar".
- Cada reserva activa ocupa una unidad concreta (provisoria, `unitAssigned=false`) vía `UnitOccupancy`.

---

## Fases pendientes

### Fase 8 — CRM (RF-57..62 aprox.; confirmar numeración en el PRD)
- Clientes identificados por tipo + número de documento (DA-06 / RF-57).
- Listado y ficha de cliente con historial de reservas.
- Widget de cumpleañeros de los próximos 30 días (29/02 se celebra el 28/02 en años no bisiestos).
- Solicitud de anonimización (`AnonymizationRequest`) y acción de anonimizar; marcar solicitudes con plazo vencido (parámetro `anonymizationDays`, 30 por defecto).
- Riesgo del PRD no mitigado: pisar email/teléfono de un cliente existente al reservar con el mismo documento (RF-58).
- No loguear datos personales.

### Fase 9 — iCal y cron
- Feed iCal por unidad con token de ≥128 bits; token inválido → 404; sin datos personales (AC-31, 38, 39).
- Importación de URLs iCal de OTAs como bloqueos (`UnitBlock` kind ICAL, `IcalSource`, `IcalSyncRun`); sincronización cada 15 min y manual desde el panel.
- **Decisión pendiente del usuario:** qué hacer con eventos iCal que chocan con reservas existentes.
- Vencimiento automático de reservas Pendiente (RF-54): cancelar con `cancelledByExpiry=true` tras `pendingExpiryDays`.
- Limpieza de comprobantes a los 3 meses (RF-56), de `LoginThrottle` (crece con emails desconocidos) y de soft locks vencidos.
- Endpoints cron protegidos con `CRON_SECRET`.

### Fase 10 — Cierre
- Pruebas e2e completas del flujo, AC-102 (navegación por teclado en todo el flujo), AC-103 (auditoría de estilo), RNF-04 (p95 < 1,5 s con 20 usuarios concurrentes), RNF-03 (20 confirmaciones sobre la última unidad → 1 reserva y 19 × 409).
- `npm audit`, revisión de seguridad (IP desde `X-Forwarded-For` requiere proxy de confianza en producción; la sesión del admin no tiene revocación en el servidor).
- Actualizar `AGENTS.md`. Regenerar el grafo con graphify solo si existe `graphify-out`.
- Pendiente de producto: logo (la web principal solo tiene texto en el header).

## Otros pendientes
- Pasar a Supabase (DATABASE_URL = pooler, DIRECT_URL = conexión directa) y los comprobantes a Supabase Storage.
- Países del teléfono: lista de 17 en `lib/booking/countries.ts`.
- Acompañantes: 4 datos obligatorios si se agrega uno; máximo adultos + niños − 1.
