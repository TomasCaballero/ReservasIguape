# Plan de Implementación v1.0.0 — ReservasIguape (Fases 8 a 10: CRM, iCal/cron y cierre)

> **Versión:** 1.0.0
> **Fecha:** 2026-10-15
> **Stack:** Next.js 16.4.1 (App Router) · React 19 · Node 22 · PostgreSQL 17 · Prisma 7.10.0 · Vitest 5 · Playwright
> **Documentos de referencia:**
> - [PRD](../PRD.md) — **fuente canónica de esta versión** (RF-01..67, RNF-01..09, AC-01..108)
> - [AGENTS.md](../AGENTS.md) — reglas inmutables, comandos y flujo de trabajo
> - [FASES.md](../FASES.md) — historial de las Fases 0–7 (hechas, commiteadas) y decisiones de la Fase 7

---

## Cómo usar este plan (leer antes de codear)

1. Este plan detalla las **Fases 8, 9 y 10**. Las Fases 0–7 están cerradas y commiteadas (ver `FASES.md`); no se rehacen. La numeración de fases continúa la de `FASES.md`.
2. Los fragmentos de código son guías de diseño y firmas, no copias exactas: **antes de tocar un archivo, abrirlo**. Antes de escribir rutas, acciones o caché de Next.js, leer la guía correspondiente en `node_modules/next/dist/docs/`.
3. **Precedencia:** PRD > este plan > tareas (`tareas_v1.0.0.md`) > AGENTS.md para alcance. Si el plan contradice al PRD, **parar y avisar**.
4. **Puntos abiertos (`P-xx`):** huecos del PRD o decisiones del usuario. Los marcados **"Confirmar antes de X.Y"** se preguntan antes de escribir código de ese paso; los **"Aplicar"** se implementan con el default indicado. Nunca se resuelven en silencio.
5. **Reglas inmutables (AGENTS.md §6):** anti-superposición solo con la exclusion constraint de Postgres (RNF-03); sin datos personales en endpoints públicos ni en el feed iCal (AC-107, AC-108); `/adminpanel` no se enlaza desde el portal; nada de lo que el PRD deja fuera de alcance; solo colores y tipografías de la web principal (RNF-02); no loguear datos personales.
6. **Ponytail:** cada paso usa la solución más chica que cumple el RF/AC; una dependencia nueva solo entra aprobada como `D-xx`.
7. Cada fase cierra con `npm test`, `npx playwright test`, `npx tsc --noEmit` y `npx eslint .` en verde, y con la base de desarrollo limpia: 6 categorías, 20 unidades, 0 reglas, temporadas, reservas, clientes, locks, bloqueos, cobros ni throttles, y `pendingExpiryDays = 5`. Las fases 8 y 9 agregan a esa lista **0 solicitudes de anonimización, 0 fuentes iCal y 0 corridas de sincronización**.

---

## Precisiones sobre el PRD (hechos verificados en el código)

Ubican *dónde* está cada punto de cambio. No cambian el alcance.

1. **RF-57/58 ya están implementados a nivel de datos.** `lib/booking/create-booking.ts:135-152` hace `customer.upsert` por `(documentType, documentNumber)` y en `update` pisa solo `email` y `phone`. AC-89 ya tiene test (`tests/db/create-booking.test.ts:95`). Falta toda la superficie del CRM (listado, ficha, widget, anonimización).
2. **Esquema ya presente:** `Customer.anonymizedAt` y `AnonymizationRequest` (`prisma/schema.prisma:191-217`), `IcalSource`, `IcalSyncRun`, `UnitBlock.kind = ICAL` con `@@unique([icalSourceId, externalUid])` (`schema.prisma:135-175`), `Unit.icalToken` de 128 bits (`lib/admin/catalog.ts:120`) y `SystemSettings.anonymizationDays` (RF-46, editable en `app/adminpanel/parametros`). **Ninguna fase necesita migración de tablas nuevas**; la Fase 8 puede necesitar una (ver D-04).
3. **No hay código de CRM ni de anonimización** fuera del esquema: `grep` de `anonymiz` solo encuentra `parametros/page.tsx` y `validation.ts`. `AdminShell` (`components/admin/AdminShell.tsx:5-14`) no tiene entrada de Clientes y el detalle de reserva (`app/adminpanel/reservas/[id]/page.tsx:99-111`) muestra al titular sin enlace a su ficha.
4. **`documentNumber` es único con `documentType`** (`@@unique` en `schema.prisma:207`): el "valor fijo" de AC-96 no puede ser literalmente el mismo para todos los clientes anonimizados (ver D-03).
5. **No hay rutas de cron ni de iCal.** `app/api/` solo tiene `admin/`, `availability`, `bookings` y `soft-lock`. `CRON_SECRET` está declarado en `.env.example` pero nadie lo usa. `proxy.ts` solo protege `/api/admin/*` y `/adminpanel/*`, así que `/api/ical/*` y `/api/cron/*` quedan públicos y deben validarse a sí mismos.
6. **El calendario ya dibuja bloqueos `ICAL`** (`lib/admin/calendar.ts:20-26,98-106`) y `deleteBlock` los rechaza (`lib/admin/blocks.ts:67`): su gestión es de la sincronización.
7. **El panel de unidades no muestra el token ni la URL del feed** (`app/adminpanel/unidades/page.tsx`).
8. **RF-54 no existe:** `changeBookingStatus` solo *limpia* `cancelledByExpiry` (`lib/admin/bookings.ts:66-70`); nada la pone en `true`. `findUncontactedBookings` (RF-53) sí existe (`bookings.ts:193`) y no se toca.
9. **RF-56:** `Payment.receiptPath` / `receiptUploadedAt` existen y `ReceiptStorage.remove` es idempotente (`rm force`) (`lib/storage/receipts.ts:36-38`). Falta el proceso de limpieza y mostrar "comprobante eliminado" en el detalle.
10. **`LoginThrottle`:** un email desconocido deja una fila con `failures = 1` y `lockedUntil = NULL` que nunca se reinicia por sí sola (`lib/auth/login.ts:20-36`); la tabla crece. Una fila solo se borra al login correcto del email (`login.ts:40`).
11. **Soft locks vencidos** solo se borran por unidad al ocuparla (`lib/booking/claim.ts:34-39`); no hay limpieza general. Ya no cuentan en la disponibilidad (RF-26), así que es solo higiene.
12. **RNF-03 ya tiene dos tests de 20 solicitudes concurrentes** (`tests/db/create-booking.test.ts:168`, `tests/db/bookings-api.test.ts:45`). La Fase 10 los vuelve a correr; no los reescribe.
13. **AC-49:** el panel ya sirve `<meta name="robots" content="noindex">` (`app/adminpanel/layout.tsx:6`) y el header `X-Robots-Tag` (`next.config.ts`); lo cubre `tests/e2e/admin.spec.ts:93`.
14. **Las fechas de estadía se manejan como `ISODate` (string)** con `lib/booking/dates.ts` (`addDays`, `nightsBetween`, `todayInBuenosAires`, `formatDMY`); los instantes se miden con `now()` de la base (RNF-07). Los helpers de acciones del panel son `requireAdmin` + `revalidatePath` (`app/adminpanel/booking-actions.ts`).

---

## Índice de Fases

| Fase | Nombre | RF/RNF/AC cubiertos | Descripción |
|---|---|---|---|
| **8** | CRM: clientes, cumpleañeros y anonimización | RF-57..62 · RNF-08 · AC-88..97 | Listado y ficha de clientes con historial, widget de cumpleañeros, solicitud y ejecución de anonimización, y marca de plazo vencido. Incluye instalar graphify. |
| **9** | iCal y procesos programados | RF-54, 56, 63..67 · RNF-06, 07 · AC-79..81, 87, 98..101, 108 | Feed iCal por unidad con token, fuentes de importación, motor de sincronización (cron y manual), vencimiento de Pendientes, limpieza de comprobantes, throttles y soft locks. |
| **10** | Cierre: calidad, rendimiento y documentación | RNF-01..04 · AC-102..107 y auditoría de trazabilidad | E2E de punta a punta, anchos y teclado, auditoría de estilo, carga p95, `npm audit`, revisión de seguridad y actualización de documentos. |

**Orden:** 8 → 9 → 10, secuencial. La Fase 8 es independiente de la 9 (no comparten tablas ni rutas), pero se hace primero porque el usuario está por comenzarla y porque la 9 depende de decisiones del usuario (`P-01`, `P-02`, `P-04`). La Fase 10 va última porque audita el sistema completo. Dentro de la Fase 9, el feed de exportación (9.1–9.2) y el motor de importación (9.3–9.6) se pueden mergear por separado; el vencimiento (9.7) y la limpieza de comprobantes (9.8) son independientes; el endpoint de cron (9.9) los reúne con el motor de sincronización, y 9.10 agrega las dos limpiezas restantes.

---

## Punto de partida: qué se conserva, qué cambia y qué se retira

### Se conserva intacto
| Área | Archivos | Nota |
|---|---|---|
| Disponibilidad, tarifas y soft lock | `lib/booking/*` | Salvo lo indicado, no se tocan. `create-booking.ts` ya cumple RF-57/58. |
| Ciclo de vida de reservas | `lib/admin/bookings.ts`, `lib/admin/blocks.ts`, `lib/admin/payments.ts` | Solo se *agrega* `expirePendingBookings` (Fase 9) en un archivo nuevo. |
| Login y sesión | `lib/auth/*`, `proxy.ts` | La limpieza de throttles (Fase 9) no cambia la lógica de login. |
| Catálogo, tarifas, parámetros | `lib/admin/catalog.ts`, `app/adminpanel/{categorias,unidades,descuentos,temporadas,parametros}` | — |
| Esquema de tablas | `prisma/schema.prisma` | Sin cambios salvo lo que decida `D-04`. |

### Se modifica / se crea
| Archivo | Cambio | Fase |
|---|---|---|
| `components/admin/AdminShell.tsx` | MOD: entradas "Clientes" y "iCal" en `SECTIONS` | 8, 9 |
| `app/adminpanel/page.tsx` | MOD: widget de próximos cumpleañeros | 8 |
| `app/adminpanel/reservas/[id]/page.tsx` | MOD: enlace del titular a su ficha; "comprobante eliminado" | 8, 9 |
| `lib/admin/birthdays.ts` | **NEW** | 8 |
| `lib/admin/customers.ts` | **NEW**: listado, ficha, solicitudes, anonimización | 8 |
| `app/adminpanel/clientes/page.tsx`, `clientes/[id]/page.tsx`, `customer-actions.ts` | **NEW** | 8 |
| `components/admin/AnonymizeActions.tsx`, `components/admin/BirthdaysWidget.tsx` | **NEW** | 8 |
| `lib/ical/export.ts`, `lib/ical/parse.ts`, `lib/ical/sync.ts` | **NEW** | 9 |
| `lib/admin/ical-sources.ts` | **NEW**: alta y baja de fuentes | 9 |
| `app/api/ical/[token]/route.ts` | **NEW**: feed por unidad | 9 |
| `app/adminpanel/ical/page.tsx`, `ical-actions.ts`, `components/admin/IcalSourceForm.tsx`, `components/admin/SyncNowButton.tsx` | **NEW** | 9 |
| `lib/cron/auth.ts`, `lib/cron/jobs.ts`, `app/api/cron/tick/route.ts` | **NEW** | 9 |
| `lib/admin/expiry.ts` | **NEW**: vencimiento de Pendientes | 9 |
| `tests/db/*.test.ts`, `tests/unit/*.test.ts`, `tests/e2e/*.spec.ts` | **NEW** por fase | 8–10 |
| `scripts/load-availability.ts` | **NEW**: carga p95 | 10 |
| `AGENTS.md`, `FASES.md`, `.env.example` | MOD | 10 |

### Se retira
Nada.

---

## Decisiones de arquitectura (D-01 en adelante)

| # | Tema | Decisión |
|---|---|---|
| D-01 | Superficie del CRM | Páginas nuevas `/adminpanel/clientes` (listado + solicitudes de anonimización) y `/adminpanel/clientes/[id]` (ficha + historial). El widget de cumpleañeros va en `/adminpanel` (Inicio), junto al aviso de RF-53. Descartado: una sola pantalla con pestañas (más estado de cliente sin que ningún RF lo pida). |
| D-02 | Cumpleañeros como función pura | `upcomingBirthdays(customers, today, days = 30)` en `lib/admin/birthdays.ts`, sin acceso a datos: se prueba con unit tests de las fronteras de AC-91..94. Ventana de offsets **0..30** (AC-93: el día 30 entra y el 31 no). El 29/02 se celebra el 28/02 en años no bisiestos (AC-94, `P-05`). Excluye clientes anonimizados. |
| D-03 | Valor "fijo" de la anonimización | Como `(documentType, documentNumber)` es único (hecho 4), `documentNumber` pasa a `ANON-<customerId>` (no es dato personal ni colisiona); nombre y apellido a `Anonimizado`, email a `anonimizado@anonimizado.invalid`, teléfono a `-` y `birthDate` a `1900-01-01`. Lo mismo para los acompañantes (sin email ni teléfono). `anonymizedAt = now()`. Todo en **una transacción**, con la hora de la base. Descartado: poner `NULL` (las columnas son `NOT NULL`; relajarlas exigiría migración sin que ningún RF lo pida). |
| D-04 | Idempotencia de la anonimización | Anonimizar a un cliente ya anonimizado responde 409 sin tocar nada. Una solicitud solo se puede registrar si el cliente no está anonimizado y no tiene otra pendiente (índice único parcial `WHERE completedAt IS NULL` por `customerId`, en una migración SQL, igual que la exclusion constraint). *Si el usuario prefiere no migrar, se valida solo en la app y se acepta la carrera entre dos clics.* **Confirmar antes de 8.4** (`P-09`). |
| D-05 | Anonimización de reservas y comprobantes | Las reservas del cliente conservan fechas, categoría, montos y cobros (AC-96). Los archivos de comprobante **no** se tocan: los elimina RF-56 (`P-07`). La ficha y el detalle de reserva muestran "Cliente anonimizado". |
| D-06 | Plazo vencido | `isOverdue = requestedAt <= now() - anonymizationDays` se calcula **en SQL** con la hora de la base (RNF-08, AC-97): una solicitud de exactamente 30 d 0 h figura vencida; de 29 d 23 h, no. |
| D-07 | Parser iCal propio y mínimo | `lib/ical/parse.ts` (~60 líneas): desdobla líneas, lee `VEVENT` con `UID`, `DTSTART`, `DTEND`, `STATUS` y soporta `VALUE=DATE` y `DATE-TIME` (a fecha de Buenos Aires). Sin dependencia nueva (peldaño 6 de Ponytail; Booking y Airbnb publican eventos de día completo). Se **ignoran** `SUMMARY` y `DESCRIPTION`: pueden traer nombres de huéspedes y no se persisten ni se loguean. **Salida de emergencia:** si un feed real usa `RRULE` o zonas que el parser no resuelve, se propone `node-ical` como `D-xx` aprobado. |
| D-08 | Feed de exportación | `GET /api/ical/<token>.ics`. El token se valida con `^[0-9a-f]{32}$` y se busca en `Unit.icalToken`; cualquier otro caso responde **404 sin cuerpo** (RNF-06, AC-108). Exporta las reservas **Pendiente y Confirmada** de la unidad (ambas ocupan, AC-15) y los bloqueos manuales; **no** exporta soft locks ni (por defecto) bloqueos `ICAL` (`P-02`). Eventos de día completo `DTSTART;VALUE=DATE` / `DTEND;VALUE=DATE` (fin exclusivo = `[start, end)`), `SUMMARY:Ocupado` y `UID:<id de ocupación>@iguape`. Cero datos del huésped (AC-98). `Cache-Control: no-store`. |
| D-09 | Motor de sincronización | `syncAll(db, trigger)` en `lib/ical/sync.ts`, usado por el cron y por la acción manual (RF-67). Por cada fuente: `fetch` (timeout 10 s, máximo 2 MB, solo `http`/`https`) → parse → por cada evento futuro una transacción propia que ocupa la unidad (`releaseExpiredLocks` + `UnitBlock` + `UnitOccupancy`). **Alta** si el `UID` es nuevo, **cambio de fechas** si cambió, **baja** si el `UID` ya no está en el feed. Si el fetch o el parseo fallan: se guarda `lastError` y **no se borra nada** (un feed caído no libera fechas). Eventos pasados o `STATUS:CANCELLED` se ignoran. Una corrida = una fila de `IcalSyncRun` con `trigger`, `ok` y `summary` sin datos personales (AC-100). Un `P2002` por la unique `[icalSourceId, externalUid]` (cron y manual a la vez) se trata como "ya sincronizado". |
| D-10 | Conflictos con reservas existentes | Un evento que se superpone con una reserva, un bloqueo o un soft lock vigente lo rechaza la exclusion constraint (`isOverlapError`). El evento **no** se importa, la reserva existente **no** se toca, y el conflicto se cuenta en `summary` y se lista en la pantalla iCal. **Confirmar antes de 9.4** (`P-01`). |
| D-11 | Procesos programados | Un solo endpoint `POST /api/cron/tick` protegido con `Authorization: Bearer <CRON_SECRET>` (comparación con `timingSafeEqual`; sin `CRON_SECRET` configurado, siempre 401). Ejecuta cada tarea de `lib/cron/jobs.ts` con `try/catch` propio, para que una falla no frene a las demás: sincronización iCal (RF-66), vencimiento de Pendientes (RF-54), limpieza de comprobantes (RF-56), soft locks vencidos y throttles viejos. Una sola frecuencia (≤ 15 min) cubre AC-100. Quién dispara el endpoint es `P-03`. Descartado: un endpoint por tarea (más superficie y más secretos que ningún RF pide). |
| D-12 | Vencimiento de Pendientes | `expirePendingBookings(db)` en `lib/admin/expiry.ts`: **un solo `UPDATE … RETURNING`** dentro de una transacción que pasa a `CANCELLED` con `cancelledByExpiry = true` las reservas `PENDING` con `paymentInfoSentAt <= now() - pendingExpiryDays` y **sin ningún cobro** (`NOT EXISTS payment`, AC-81), y borra su `UnitOccupancy`. Mide con `now()` de la base (AC-79: 5 d 0 h vence, 4 d 23 h 59 min no). Una reserva sin envío registrado no vence sola (PRD, Riesgos). No reutiliza `changeBookingStatus` porque este *limpia* la marca. |
| D-13 | Limpieza de comprobantes | `cleanupReceipts(db, storage)`: para cada `Payment` con `receiptPath` y `receiptUploadedAt <= now() - interval '3 months'` borra el archivo (`storage.remove`) y recién después deja `receiptPath = NULL`; monto, moneda, método y referencia permanecen (AC-87). Si `remove` falla, la fila queda para el próximo tick. |
| D-14 | Auditoría de estilo | Un test e2e recorre el portal, toma `getComputedStyle` de cada elemento visible y compara colores y `font-family` con los tokens de `app/globals.css`. Depende de `P-06`. |
| D-15 | Prueba de carga | `scripts/load-availability.ts` (tsx, sin dependencia nueva): 20 workers contra `/api/availability` durante 5 minutos sobre el catálogo base y reporta p50/p95/p99. Depende de `P-08`. |
| D-16 | graphify | Se instala en la Fase 8 (tarea 8.1) **solo con confirmación del usuario**, según la skill `use-graphify`: `uv tool install graphifyy` o `pip install graphifyy`, `graphify install --project` y primera construcción. `graphify-out/` se agrega a `.gitignore` salvo que el usuario decida versionarlo. |

---

## Puntos abiertos del PRD (defaults tomados)

| # | Hueco / decisión delegada por el PRD | Default de este plan | Estado |
|---|---|---|---|
| P-01 | Qué hacer con eventos iCal que chocan con reservas existentes (pendiente del usuario, `FASES.md`) | No se importa el evento, la reserva se conserva y el conflicto queda visible en la pantalla iCal y en `summary` (D-10). | **Confirmar antes de 9.4** |
| P-02 | ¿El feed exportado incluye los bloqueos importados de otras OTAs? (RF-63 dice "ocupadas o bloqueadas") | **No**: se exportan solo reservas y bloqueos manuales, para evitar que Booking reciba de vuelta sus propios eventos (eco). Contra: un evento de Airbnb no bloquea Booking. | **Confirmar antes de 9.1** |
| P-03 | Quién dispara `/api/cron/tick` cada ≤ 15 min (el PRD solo pide "proceso programado") | El endpoint es agnóstico: se documenta cómo llamarlo con `curl` y `Authorization`. Local: Programador de tareas de Windows. Producción: se decide al elegir hosting (p. ej. Vercel Cron, que usa `GET`: habría que aceptarlo). | **Confirmar antes de 10.8** |
| P-04 | Limpieza de `LoginThrottle` sin cambiar RF-32 (hecho 10) | Borrar filas con `updatedAt < now() - 24 h` y sin bloqueo vigente. Efecto lateral: los intentos fallidos sueltos (1–2) se "olvidan" a las 24 h. | **Confirmar antes de 9.10** |
| P-05 | AC-94 [A CONFIRMAR]: el 29/02 se celebra el 28/02 en años no bisiestos | Sí, el 28/02. | Aplicar |
| P-06 | RNF-02 [A CONFIRMAR]: ubicación de la guía de estilo | La guía son los tokens de `app/globals.css`, copiados de la web principal (`IguapeKimi/Iguape2026`) según `FASES.md`. Se aceptan como `font-family` las dos tipografías y sus genéricos (`serif`, `sans-serif`). | **Confirmar antes de 10.3** |
| P-07 | AC-96 [A CONFIRMAR]: qué se conserva al anonimizar | Se conservan fechas de estadía, categoría, montos y cobros; se reemplazan los datos personales del titular y de los acompañantes (D-03). Los comprobantes se conservan hasta que RF-56 los elimine. | **Confirmar antes de 8.4** |
| P-08 | RNF-04 / AC-104: "medido en servidor", en staging | Se mide la latencia desde el cliente de carga contra `localhost` (la red local es despreciable) sobre el catálogo base de la base de desarrollo, sin staging. | **Confirmar antes de 10.5** |
| P-09 | RF-61 [A CONFIRMAR] y reglas no dichas: fecha de la solicitud, solicitud previa y duplicados | `requestedAt = now()` de la base (no editable); se puede anonimizar **sin** solicitud previa (RF-62 no la exige) y, si había una pendiente, se completa (`completedAt = now()`); una sola solicitud pendiente por cliente (D-04); si el cliente tiene reservas Pendiente/Confirmada futuras, el diálogo lo advierte pero no lo impide. | **Confirmar antes de 8.4** |
| P-10 | Riesgo del PRD no mitigado: pisar email/teléfono de un cliente al reservar con su documento (RF-58) | Sin mitigación: se implementa RF-58 tal cual (hecho 1). La ficha muestra la fecha de última actualización para que el administrador pueda detectarlo. | Aplicar |
| P-11 | RF-59: qué reservas lista el historial | Todas (cualquier estado), con su estado y fechas, más recientes primero. | Aplicar |
| P-12 | RF-60: ¿entra el cumpleaños de hoy? | Sí (offset 0). | Aplicar |
| P-13 | RF-64: validación de la URL de importación | Solo `http`/`https` y hasta 500 caracteres; no se bloquean hosts internos (el único usuario es el administrador). | Aplicar |
| P-14 | RF-63: URL absoluta que se muestra en el panel | Se arma con el host de la solicitud (`headers()`); no se agrega una variable de entorno nueva. | Aplicar |
| P-15 | RF-56 [A CONFIRMAR]: el plazo de 3 meses se cuenta desde la carga | Sí, desde `receiptUploadedAt`. | Aplicar |

---

## Estructura del Proyecto (solo cambios v1.0.0)

```
app/
  adminpanel/
    page.tsx                       # (MOD: widget de cumpleañeros — 8.5)
    clientes/
      page.tsx                     # (NEW — D-01) listado + solicitudes de anonimización
      [id]/page.tsx                # (NEW — D-01) ficha + historial
    customer-actions.ts            # (NEW) solicitar / anonimizar (requireAdmin)
    ical/page.tsx                  # (NEW) URL del feed, fuentes, corridas, "Sincronizar ahora"
    ical-actions.ts                # (NEW) alta/baja de fuente, sincronización manual
    reservas/[id]/page.tsx         # (MOD: enlace a la ficha; comprobante eliminado)
  api/
    ical/[token]/route.ts          # (NEW — D-08) feed .ics público con token
    cron/tick/route.ts             # (NEW — D-11) POST con CRON_SECRET
components/admin/
  AdminShell.tsx                   # (MOD: Clientes, iCal)
  BirthdaysWidget.tsx              # (NEW)
  AnonymizeActions.tsx             # (NEW)
  IcalSourceForm.tsx               # (NEW)
  SyncNowButton.tsx                # (NEW)
lib/
  admin/
    birthdays.ts                   # (NEW — D-02) función pura
    customers.ts                   # (NEW) listado, ficha, solicitudes, anonimización
    ical-sources.ts                # (NEW) alta/baja de fuentes
    expiry.ts                      # (NEW — D-12) vencimiento de Pendientes
  ical/
    export.ts                      # (NEW — D-08) arma el .ics
    parse.ts                       # (NEW — D-07) parser mínimo
    sync.ts                        # (NEW — D-09, D-10) motor de sincronización
  cron/
    auth.ts                        # (NEW — D-11) verificación del Bearer
    jobs.ts                        # (NEW — D-11, D-13) tareas del tick
prisma/migrations/
  <fecha>_anonymization_pending_unique/   # (NEW — D-04, si se confirma)
scripts/load-availability.ts       # (NEW — D-15)
tests/
  unit/{birthdays,ical-parse,ical-export,cron-auth}.test.ts   # (NEW)
  db/{customers,anonymization,ical-sync,ical-feed,expiry,cleanup,cron-tick}.test.ts   # (NEW)
  e2e/{admin-customers,admin-ical,full-flow,responsive-keyboard,style-audit}.spec.ts   # (NEW)
```

---

## Fase 8 — CRM: clientes, cumpleañeros y anonimización

### Objetivo
El administrador ve todos los clientes con su historial, los cumpleaños de los próximos 30 días en Inicio, y puede registrar y ejecutar la anonimización de un cliente, con las solicitudes vencidas marcadas.

### Cobertura PRD
- RF-57 (registro del titular por documento: ya hecho; se verifica y se muestra), RF-58 (pisar contacto: ya hecho; se verifica)
- RF-59 (historial) · RF-60 (cumpleañeros) · RF-61 (solicitud) · RF-62 (anonimizar) · RNF-08 (plazo vencido)
- AC-88, AC-89, AC-90, AC-91, AC-92, AC-93, AC-94, AC-95, AC-96, AC-97

### 8.1 Instalar graphify (D-16)
Con confirmación del usuario: `uv tool install graphifyy` (o `pip install graphifyy`), `graphify install --project`, primera construcción con `/graphify .`, y agregar `graphify-out/` a `.gitignore`. Si el usuario no confirma, se omite y §3.1 de `AGENTS.md` sigue condicionado.

### 8.2 Cumpleañeros: función pura (RF-60 · D-02 · AC-91..94)
```ts
// lib/admin/birthdays.ts — tarea 8.2
export type BirthdayCustomer = { id: string; birthDate: ISODate; anonymized: boolean };
export type Birthday<T extends BirthdayCustomer> = { customer: T; date: ISODate; inDays: number };

/** RF-60: clientes que cumplen años en los próximos `days` (offsets 0..days, AC-93). */
export function upcomingBirthdays<T extends BirthdayCustomer>(
  customers: T[], today: ISODate, days = 30,
): Birthday<T>[];
// Próxima ocurrencia: año de `today` o el siguiente; 29/02 en año no bisiesto → 28/02 (AC-94).
// Cruza fin de año (AC-92). Excluye anonymized. Orden: inDays asc, luego apellido.
```

### 8.3 Consultas del CRM (RF-57, RF-59, RF-61 · D-01, D-06, P-10, P-11)
```ts
// lib/admin/customers.ts — tarea 8.3
export async function listCustomers(db, q?: string): Promise<CustomerRow[]>;      // busca por nombre o documento
export async function getCustomer(db, id): Promise<CustomerDetail | null>;        // + historial: todas las reservas, recientes primero (P-11)
export async function listAnonymizationRequests(db): Promise<RequestRow[]>;       // pendientes primero; `overdue` calculado en SQL (D-06)
// overdue: requestedAt <= now() - make_interval(days => anonymizationDays) AND completedAt IS NULL
```

### 8.4 Solicitud y ejecución de la anonimización (RF-61, RF-62 · D-03, D-04, D-05 · P-07, P-09)
⚠️ Confirmar `P-07`, `P-09` y `D-04` (migración del índice único parcial) antes de escribir código.
```ts
// lib/admin/customers.ts — tarea 8.4
export async function requestAnonymization(db, customerId): Promise<ActionResult>; // requestedAt = now() (hora de la base); 409 si ya está anonimizado o ya hay una pendiente
export async function anonymizeCustomer(db, customerId): Promise<ActionResult>;   // una transacción (D-03): Customer + Guests de todas sus reservas + solicitud pendiente → completedAt; 409 si ya estaba anonimizado
```
Migración (solo si se confirma D-04): `CREATE UNIQUE INDEX "AnonymizationRequest_one_pending" ON "AnonymizationRequest"("customerId") WHERE "completedAt" IS NULL;`, creada a mano con `prisma migrate diff` + `migrate deploy` (flujo de `AGENTS.md` §5).

### 8.5 Pantallas y widget (RF-57, RF-59, RF-60, RF-61, RF-62, RNF-08 · D-01)
- `clientes/page.tsx`: tabla con nombre, apellido, email, teléfono, documento y fecha de nacimiento (AC-88), buscador y sección "Solicitudes de anonimización" con "plazo vencido" (AC-97).
- `clientes/[id]/page.tsx`: datos, historial (AC-90), última actualización (P-10), estado de la solicitud con su fecha (AC-95) y acciones *Solicitar anonimización* / *Anonimizar* con confirmación en dos pasos y sin diálogos del navegador (patrón de `DeleteButton`/`useSubmit`).
- `BirthdaysWidget` en `app/adminpanel/page.tsx`: nombre, fecha de cumpleaños, email y teléfono (AC-91).
- `AdminShell`: entrada "Clientes". `reservas/[id]/page.tsx`: el titular enlaza a su ficha. Todas las acciones de `customer-actions.ts` hacen `requireAdmin()` (AC-106) y `revalidatePath`.
- Estilos: solo clases y tokens existentes (RNF-02). Sin scroll horizontal de 360 a 1920 px (RNF-01). No loguear datos personales.

### 8.6 Tests de la Fase 8
**`tests/unit/birthdays.test.ts` (NEW)**
- `incluye al que cumple el 15/10 y excluye al del 15/11 con hoy 01/10` ← **AC-91**
- `cruza el fin de año: hoy 20/12, cumple 05/01` ← **AC-92**
- `31/10 entra (día 30) y 01/11 no (día 31)` ← **AC-93**
- `29/02 se celebra el 28/02 en año no bisiesto, y el 29/02 en bisiesto` ← **AC-94**
- `incluye el cumpleaños de hoy (offset 0)` ← **P-12**
- `excluye clientes anonimizados`

**`tests/db/customers.test.ts` (NEW)**
- `un cliente nuevo aparece en el listado con todos sus datos` ← **AC-88**
- `el mismo documento con otro email deja 1 solo cliente` ← **AC-89** (ya cubierto en `create-booking.test.ts:95`; acá se verifica desde el listado)
- `el historial lista las dos estadías Finalizadas con sus fechas` ← **AC-90**
- `la solicitud de 30 d 0 h figura vencida y la de 29 d 23 h no` ← **AC-97 / RNF-08**

**`tests/db/anonymization.test.ts` (NEW)**
- `registrar la solicitud guarda la fecha y queda pendiente` ← **AC-95**
- `anonimizar reemplaza titular y acompañantes y conserva las fechas de estadía` ← **AC-96**
- `anonimizar dos clientes no choca con la unicidad del documento` ← **D-03**
- `anonimizar dos veces responde 409 sin cambios` ← **D-04**
- `una segunda solicitud pendiente del mismo cliente se rechaza` ← **D-04**

**`tests/e2e/admin-customers.spec.ts` (NEW)**
- `el widget de Inicio lista al cumpleañero con email y teléfono` ← **AC-91**
- `desde una reserva se llega a la ficha, se solicita y se anonimiza` ← **AC-95, AC-96**
- `sin sesión, /adminpanel/clientes redirige al login` ← **AC-106**

**Verificación:** `npx vitest run tests/unit/birthdays.test.ts tests/db/customers.test.ts tests/db/anonymization.test.ts` · `npx playwright test tests/e2e/admin-customers.spec.ts` · suite completa, `npx tsc --noEmit`, `npx eslint .`. Manual: abrir `/adminpanel/clientes` a 360 px y a 1920 px sin scroll horizontal (RNF-01).

---

## Fase 9 — iCal y procesos programados

### Objetivo
Cada unidad publica su feed iCal con token, el administrador carga las URLs de las OTAs y sincroniza a mano o cada ≤ 15 min, y un único endpoint de cron vence las Pendientes, borra comprobantes viejos y limpia soft locks y throttles.

### Cobertura PRD
- RF-63 (feed) · RF-64 (fuentes) · RF-65 (eventos → bloqueos) · RF-66 (cada 15 min) · RF-67 (manual)
- RF-54 (vencimiento de Pendiente) · RF-56 (limpieza de comprobantes) · RNF-06 (token ≥ 128 bits) · RNF-07 (soft lock con hora de la base)
- AC-79, AC-80, AC-81, AC-87, AC-98, AC-99, AC-100, AC-101, AC-108

### 9.1 Exportación `.ics` (RF-63, RNF-06 · D-08 · P-02)
⚠️ Confirmar `P-02` antes de escribir código.
```ts
// lib/ical/export.ts — tarea 9.1
export type FeedEvent = { uid: string; start: ISODate; end: ISODate };
export function buildFeed(unitName: string, events: FeedEvent[]): string;
// VCALENDAR + VEVENT por evento: UID, DTSTAMP, DTSTART;VALUE=DATE, DTEND;VALUE=DATE (fin exclusivo), SUMMARY:Ocupado.
// Líneas con CRLF. Ningún campo viene de Customer ni de Guest (AC-98).
export async function loadFeedEvents(db, unitId): Promise<FeedEvent[]>; // ocupaciones de reservas activas y bloqueos manuales (D-08, P-02)
```

### 9.2 Ruta pública del feed (RF-63, RNF-06, AC-108 · D-08)
```ts
// app/api/ical/[token]/route.ts — tarea 9.2
export async function GET(_req: Request, ctx: RouteContext<"/api/ical/[token]">) {
  // token = param sin el sufijo ".ics"; si no cumple /^[0-9a-f]{32}$/ o no existe → new Response(null, { status: 404 })
  // 200: text/calendar; charset=utf-8, Cache-Control: no-store
}
```
Hay que correr `npx next typegen` tras crear la ruta.

### 9.3 Parser iCal mínimo (RF-65 · D-07)
```ts
// lib/ical/parse.ts — tarea 9.3
export type ImportedEvent = { uid: string; start: ISODate; end: ISODate }; // fin exclusivo
export function parseIcal(text: string, today: ISODate): ImportedEvent[];
// desdobla líneas; solo VEVENT con UID + DTSTART; DTEND ausente → start + 1 día (DATE);
// descarta STATUS:CANCELLED, fin <= inicio y eventos con fin <= today; ignora SUMMARY/DESCRIPTION.
```

### 9.4 Motor de sincronización (RF-65, RF-66, RF-67 · D-09, D-10 · P-01)
⚠️ Confirmar `P-01` antes de escribir código.
```ts
// lib/ical/sync.ts — tarea 9.4
export type SyncSummary = { sources: number; added: number; updated: number; removed: number; conflicts: number; failed: number };
export async function syncAll(db, trigger: "CRON" | "MANUAL", fetchText = defaultFetch): Promise<{ ok: boolean; summary: SyncSummary }>;
// 1) crea IcalSyncRun; 2) por fuente: fetch con timeout/tope → parse → alta / cambio / baja (D-09);
// 3) un overlap (isOverlapError) cuenta como conflicto y no importa el evento (D-10);
// 4) error de red o de parseo → source.lastError, sin borrar bloqueos; 5) cierra el run con ok y summary.
```
`fetchText` es inyectable para testear sin red.

### 9.5 Fuentes de importación (RF-64 · P-13)
```ts
// lib/admin/ical-sources.ts — tarea 9.5
export async function addIcalSource(db, input: { unitId: string; label: string; url: string }): Promise<ActionResult>;
export async function removeIcalSource(db, id: string): Promise<ActionResult>; // borra también sus bloqueos (cascade en el esquema)
```

### 9.6 Pantalla iCal y sincronización manual (RF-63, RF-64, RF-67 · P-14)
`/adminpanel/ical`: por unidad, la URL del feed (`<host>/api/ical/<token>.ics`), sus fuentes con `lastSyncedAt` / `lastError`, el formulario de alta, los conflictos de la última corrida (D-10), las últimas corridas y el botón **Sincronizar ahora** (`syncAll(prisma, "MANUAL")`, AC-101). `AdminShell`: entrada "iCal". Las acciones de `ical-actions.ts` hacen `requireAdmin()` y `revalidatePath("/adminpanel/calendario")` y `revalidatePath("/")`.

### 9.7 Vencimiento de Pendientes (RF-54 · D-12)
```ts
// lib/admin/expiry.ts — tarea 9.7
export async function expirePendingBookings(db): Promise<number>; // cantidad vencidas
// UPDATE "Booking" SET status='CANCELLED', "cancelledByExpiry"=true ... WHERE status='PENDING'
//   AND "paymentInfoSentAt" <= now() - make_interval(days => <pendingExpiryDays>)
//   AND NOT EXISTS (SELECT 1 FROM "Payment" p WHERE p."bookingId" = "Booking"."id") RETURNING id
// + DELETE FROM "UnitOccupancy" WHERE "bookingId" IN (ids), todo en la misma transacción.
```

### 9.8 Limpieza de comprobantes (RF-56 · D-13 · P-15)
`cleanupReceipts(db, storage)` en `lib/cron/jobs.ts`. En el detalle de reserva, un cobro con `receiptUploadedAt` y sin `receiptPath` muestra "Comprobante eliminado (más de 3 meses)".

### 9.9 Endpoint de cron (RF-66 · D-11)
```ts
// lib/cron/auth.ts — tarea 9.9
export function isCronAuthorized(header: string | null, secret = process.env.CRON_SECRET): boolean; // timingSafeEqual; sin secret → false
// app/api/cron/tick/route.ts
export async function POST(request: Request) {
  // no autorizado → 401 sin datos; autorizado → runJobs(): sync (CRON), expiry, receipts, soft locks, throttles
  // cada tarea en su try/catch; responde el resumen sin datos personales
}
```

### 9.10 Limpieza de soft locks y throttles (RNF-07 · P-04)
⚠️ Confirmar `P-04` antes de escribir código.
En `lib/cron/jobs.ts`: `DELETE FROM "SoftLock" WHERE "expiresAt" <= now()` (la ocupación se borra en cascada) y `DELETE FROM "LoginThrottle" WHERE "updatedAt" < now() - interval '24 hours' AND ("lockedUntil" IS NULL OR "lockedUntil" <= now())`.

### 9.11 Tests de la Fase 9
**`tests/unit/ical-parse.test.ts` (NEW)**
- `lee eventos de día completo (VALUE=DATE) con fin exclusivo` ← **AC-99**
- `desdobla líneas largas y descarta CANCELLED, pasados y rangos inválidos`
- `ignora SUMMARY y DESCRIPTION` ← **D-07**

**`tests/unit/ical-export.test.ts` (NEW)**
- `el feed trae el evento del 10/11 al 14/11 y ningún nombre ni dato personal` ← **AC-98**
- `usa CRLF y fin exclusivo`

**`tests/unit/cron-auth.test.ts` (NEW)**
- `solo acepta "Bearer <CRON_SECRET>"; sin secreto configurado rechaza todo` ← **D-11**

**`tests/db/ical-feed.test.ts` (NEW)**
- `token válido → 200 con la reserva Confirmada; la Pendiente también; sin soft locks` ← **AC-98, AC-15**
- `sin token, token inválido o de otra forma → 404 sin cuerpo` ← **AC-108 / RNF-06**
- `el token generado tiene 32 caracteres hex (128 bits)` ← **RNF-06**

**`tests/db/ical-sync.test.ts` (NEW)**
- `un evento del 20/11 al 22/11 bloquea la unidad y baja 1 la disponibilidad de la categoría` ← **AC-99**
- `un segundo sync no duplica y un evento que desaparece libera las fechas`
- `un evento que choca con una reserva no se importa y cuenta como conflicto` ← **D-10 / P-01**
- `si el feed falla, los bloqueos existentes se conservan y queda lastError` ← **D-09**
- `la sincronización manual crea un run MANUAL y el bloqueo aparece sin esperar al cron` ← **AC-101**
- `cada corrida deja una fila en IcalSyncRun con trigger y ok` ← **AC-100**

**`tests/db/expiry.test.ts` (NEW)**
- `5 d 0 h vence con marca y libera la unidad; 4 d 23 h 59 min sigue Pendiente` ← **AC-79**
- `la cancelación manual no lleva la marca de vencimiento` ← **AC-80**
- `con 1 cobro registrado no vence aunque hayan pasado 6 días` ← **AC-81**
- `sin envío del método de pago registrado no vence`

**`tests/db/cleanup.test.ts` (NEW)**
- `a los 3 meses y 1 día borra el archivo y conserva monto, moneda, método y referencia` ← **AC-87**
- `a menos de 3 meses no borra`
- `borra soft locks vencidos y no los vigentes` ← **RNF-07**
- `borra throttles viejos sin bloqueo vigente y conserva los bloqueados` ← **P-04**

**`tests/db/cron-tick.test.ts` (NEW)**
- `POST sin Bearer o con Bearer inválido → 401 sin datos; con Bearer válido corre todas las tareas` ← **D-11**
- `si una tarea falla, las demás igual corren`

**`tests/e2e/admin-ical.spec.ts` (NEW)**
- `se muestra la URL del feed de la unidad y al abrirla devuelve text/calendar` ← **AC-98**
- `se carga una fuente, se pulsa "Sincronizar ahora" (feed local de prueba) y el bloqueo aparece en el calendario` ← **AC-99, AC-101**

**Verificación:** `npx vitest run tests/unit/ical-parse.test.ts tests/unit/ical-export.test.ts tests/unit/cron-auth.test.ts tests/db/ical-feed.test.ts tests/db/ical-sync.test.ts tests/db/expiry.test.ts tests/db/cleanup.test.ts tests/db/cron-tick.test.ts` · `npx playwright test tests/e2e/admin-ical.spec.ts` · suite completa. Manual: `curl -X POST http://localhost:7777/api/cron/tick` → 401; con `-H "Authorization: Bearer <CRON_SECRET>"` → 200 (sin mostrar el secreto).

---

## Fase 10 — Cierre: calidad, rendimiento y documentación

### Objetivo
Todo el flujo está verificado de punta a punta, en los anchos exigidos y con teclado, con estilo auditado, rendimiento medido, seguridad revisada y documentación al día.

### Cobertura PRD
- RNF-01 (anchos) · RNF-02 (estilo) · RNF-03 (concurrencia: re-verificación) · RNF-04 (rendimiento) · RNF-05 (Argon2id: re-verificación)
- AC-100 (60 min de cron), AC-102, AC-103, AC-104, AC-105, AC-106, AC-107, y la auditoría de trazabilidad de AC-01..108

### 10.1 E2E de punta a punta
`tests/e2e/full-flow.spec.ts`: el huésped busca, reserva y confirma en el portal → el administrador lo ve Pendiente, sin unidad y Web Directa → asigna unidad, registra el envío del método de pago, registra un cobro y confirma → el cliente aparece en el CRM → el feed iCal de la unidad contiene el evento sin datos personales. (AC-33, 42, 43, 66, 73, 76, 82, 88, 98).

### 10.2 Anchos y teclado (RNF-01 · AC-102)
`tests/e2e/responsive-keyboard.spec.ts`: recorre el flujo del portal a 360, 768 y 1920 px y, en cada paso, comprueba `document.documentElement.scrollWidth <= window.innerWidth` y que cada control se accione con teclado (Tab/Enter/Espacio) y con puntero.

### 10.3 Auditoría de estilo (RNF-02 · AC-103 · D-14 · P-06)
⚠️ Confirmar `P-06` antes de escribir código.
`tests/e2e/style-audit.spec.ts`: recorre el portal (y el panel, por consistencia) y verifica que 0 colores (`color`, `background-color`, `border-color`) y 0 `font-family` computados queden fuera de los tokens de `app/globals.css`.

### 10.4 Re-verificación de requisitos transversales
- RNF-03: correr `tests/db/create-booking.test.ts` y `tests/db/bookings-api.test.ts` (20 concurrentes → 1 × 201 y 19 × 409), sin reescribirlos.
- RNF-05 / AC-105: test que verifica que el `passwordHash` del admin empieza con `$argon2id$` y que los parámetros son memoria ≥ 19 MiB e iteraciones ≥ 2 (si no existe ya en `tests/unit/password.test.ts`, se agrega).
- AC-106: test e2e que recorre todas las rutas del panel y de `/api/admin/*` sin sesión (login o 401, sin datos).
- AC-107: test de los endpoints públicos (`/api/availability`, `/api/bookings`, `/api/soft-lock`, `/api/ical/*`) con y sin identificadores: ninguna respuesta incluye datos de huéspedes.

### 10.5 Prueba de carga (RNF-04 · AC-104 · D-15 · P-08)
⚠️ Confirmar `P-08` antes de escribir código.
`scripts/load-availability.ts`: 20 workers, 5 minutos, consultas de disponibilidad y tarifas con fechas variadas; imprime p50/p95/p99 y falla (exit 1) si p95 ≥ 1,5 s. Se corre con `npx tsx scripts/load-availability.ts` contra `npm run build && npm start` (no contra `next dev`).

### 10.6 Auditoría de trazabilidad
Listar los AC de la matriz que no aparezcan en ningún test (`grep -rhoE "AC-[0-9]+" tests | sort -u` contra AC-01..108), y para cada faltante agregar el test o registrar la verificación manual. Cualquier hueco se informa al usuario antes de cerrar.

### 10.7 `npm audit` y revisión de seguridad
`npm audit` sin vulnerabilidades altas o críticas sin resolver. Revisión (informe, sin cambiar alcance): la IP desde `X-Forwarded-For` solo es confiable detrás de un proxy de confianza; la sesión del admin no tiene revocación en el servidor; `CRON_SECRET` y `SESSION_SECRET` son largos y no están en el repo; los logs no contienen datos personales; el fetch de iCal solo acepta `http`/`https`.

### 10.8 Cron real durante 60 minutos (RF-66 · AC-100 · P-03)
Verificación manual: con el scheduler elegido (`P-03`) llamando al tick cada 15 min durante 60 min, `SELECT "startedAt" FROM "IcalSyncRun" ORDER BY 1` muestra ≥ 4 corridas con ≤ 15 min entre dos consecutivas.

### 10.9 Documentación
- `AGENTS.md`: actualizar comandos (script de carga, cron) y estructura si cambió; con diff aprobado por el usuario.
- `FASES.md`: marcar las Fases 8–10 como completadas con sus commits y las decisiones a recordar.
- `.env.example`: comentar el uso de `CRON_SECRET`.
- Regenerar el grafo (`graphify . --code-only`, `graphify cluster-only`) solo si existe `graphify-out/`.
- Pendientes de producto que quedan fuera de este plan: logo, paso a Supabase (pooler/directa, comprobantes a Supabase Storage).

### 10.10 Tests de la Fase 10
**`tests/e2e/full-flow.spec.ts` (NEW)** — `el flujo completo del huésped al administrador y al feed iCal` ← **AC-33, 42, 43, 66, 73, 76, 82, 88, 98**
**`tests/e2e/responsive-keyboard.spec.ts` (NEW)** — `sin scroll horizontal a 360/768/1920 px y controles operables por teclado` ← **AC-102 / RNF-01**
**`tests/e2e/style-audit.spec.ts` (NEW)** — `0 colores y 0 familias fuera de la guía` ← **AC-103 / RNF-02**
**`tests/unit/password.test.ts` (MOD, si falta)** — `Argon2id con memoria ≥ 19 MiB e iteraciones ≥ 2 y hash `$argon2id$`` ← **AC-105 / RNF-05**
**`tests/e2e/admin.spec.ts` (MOD)** — `sin sesión, todo el panel y /api/admin/* devuelven login o 401 sin datos` ← **AC-106**
**`tests/db/public-endpoints.test.ts` (NEW)** — `los endpoints públicos no devuelven datos de huéspedes` ← **AC-107**

**Verificación:** suite completa (`npm test`, `npx playwright test`, `npx tsc --noEmit`, `npx eslint .`, `npm run build`) · `npx tsx scripts/load-availability.ts` (p95 < 1,5 s, AC-104) · `npm audit` · manual de 10.8 (AC-100).

---

## Matriz de Trazabilidad: Criterio ↔ Fase ↔ Test

Las filas de las Fases 0–7 están **cerradas** (ver `FASES.md`); su cobertura se confirma en 10.6 con un `grep` de AC contra `tests/`. Los archivos de test citados para ellas son los candidatos según sus nombres; no se verificó AC por AC, y eso lo cierra 10.6.

| Criterio | Fase | Tests / verificación principal |
|---|---|---|
| AC-01..13 (selector, huéspedes, URL, reglas de fechas) | 3 (cerrada) | Suite existente; confirmar en 10.6 |
| AC-14..25 (disponibilidad, moneda, tarifas, temporadas, descuentos) | 2–3 (cerradas) | Suite existente; confirmar en 10.6 |
| AC-26..32 (validaciones del formulario) | 4 (cerrada) | `tests/db/create-booking.test.ts`; confirmar en 10.6 |
| AC-33..43 (reserva, soft lock, concurrencia, origen) | 4 (cerrada) | `tests/db/create-booking.test.ts`, `tests/db/bookings-api.test.ts`; re-verificación en 10.4 |
| AC-44 (ruta inexistente → `/`) | 3 (cerrada) | `tests/e2e/home.spec.ts` (confirmar en 10.6) |
| AC-45..48 (login y bloqueo) | 5 (cerrada) | `tests/db/login.test.ts`, `tests/e2e/admin.spec.ts` |
| AC-49 (noindex, sin enlaces) | 5 (cerrada) | `tests/e2e/admin.spec.ts:93`; el "sin enlaces desde el portal" se confirma en 10.6 |
| AC-50..65 (catálogo, descuentos, temporadas, parámetros) | 6 (cerrada) | `tests/db/catalog.test.ts`, `tests/e2e/admin-catalog.spec.ts` |
| AC-66..78 (calendario, estados, unidad, bloqueo, método de pago aviso) | 7 (cerrada) | `tests/db/bookings-admin.test.ts`, `tests/e2e/admin-bookings.spec.ts` |
| AC-79, 80, 81 (vencimiento de Pendiente) | **9** | `tests/db/expiry.test.ts` |
| AC-82..86 (cobros y comprobantes) | 7 (cerrada) | `tests/db/payments.test.ts`, `tests/unit/receipt-validation.test.ts` |
| AC-87 (limpieza de comprobantes) | **9** | `tests/db/cleanup.test.ts` |
| AC-88, 89 (CRM: alta y pisado de contacto) | **8** | `tests/db/customers.test.ts`; AC-89 también en `create-booking.test.ts:95` |
| AC-90 (historial) | **8** | `tests/db/customers.test.ts` |
| AC-91, 92, 93, 94 (cumpleañeros) | **8** | `tests/unit/birthdays.test.ts`, `tests/e2e/admin-customers.spec.ts` |
| AC-95, 96 (solicitud y anonimización) | **8** | `tests/db/anonymization.test.ts`, `tests/e2e/admin-customers.spec.ts` |
| AC-97 (plazo vencido) | **8** | `tests/db/customers.test.ts` |
| AC-98 (feed sin datos personales) | **9** | `tests/unit/ical-export.test.ts`, `tests/db/ical-feed.test.ts`, `tests/e2e/admin-ical.spec.ts` |
| AC-99 (importación) | **9** | `tests/unit/ical-parse.test.ts`, `tests/db/ical-sync.test.ts` |
| AC-100 (≥ 4 ejecuciones en 60 min) | **9 / 10** | `tests/db/ical-sync.test.ts` (fila por corrida) + manual 10.8 |
| AC-101 (sincronizar ahora) | **9** | `tests/db/ical-sync.test.ts`, `tests/e2e/admin-ical.spec.ts` |
| AC-102 (RNF-01) | **10** | `tests/e2e/responsive-keyboard.spec.ts` |
| AC-103 (RNF-02) | **10** | `tests/e2e/style-audit.spec.ts` |
| AC-104 (RNF-04) | **10** | `scripts/load-availability.ts` |
| AC-105 (RNF-05) | 5 (cerrada) / **10** | `tests/unit/password.test.ts` (verificar en 10.4) |
| AC-106 (acceso sin sesión) | 5 (cerrada) / **10** | `tests/e2e/admin.spec.ts` (ampliado en 10.4) |
| AC-107 (sin datos personales públicos) | 4 (cerrada) / **10** | `tests/db/public-endpoints.test.ts` |
| AC-108 (iCal sin token → 404) | **9** | `tests/db/ical-feed.test.ts` |
| RNF-03 | 4 (cerrada) / **10** | Los dos tests de concurrencia existentes (10.4) |
| RNF-06 | **9** | `tests/db/ical-feed.test.ts` |
| RNF-07 | 4 (cerrada) / **9** | `tests/db/clock.test.ts` + `tests/db/cleanup.test.ts` |
| RNF-08 | **8** | `tests/db/customers.test.ts` |
| RNF-09 | 2–3 (cerradas) | `tests/db/clock.test.ts`, `tests/unit/stay-rules.test.ts` |

---

## Diagrama general

```
 Huésped ──► Portal (/) ──► /api/availability · /api/soft-lock · /api/bookings
                                          │
                                          ▼
 Admin ──► /adminpanel ──► Server Actions ─────► lib/admin/*, lib/ical/*  ──►  PostgreSQL 17
            ├ reservas · calendario · catálogo      │                          ├ Booking · Customer · Payment
            ├ clientes (F8) ──► CRM, cumpleañeros,  │                          ├ UnitOccupancy  ◄── EXCLUDE gist (RNF-03)
            │                  anonimización        │                          ├ UnitBlock (MANTENIMIENTO/OWNER/ICAL)
            └ iCal (F9) ──► fuentes + "Sincronizar" │                          ├ IcalSource · IcalSyncRun
                                                    │                          └ AnonymizationRequest · LoginThrottle
 Booking.com / Airbnb ◄── GET /api/ical/<token>.ics (solo fechas, sin datos del huésped)
 Booking.com / Airbnb ──► feeds .ics ──► syncAll() ──► UnitBlock ICAL (conflicto ⇒ no se importa)
 Scheduler (P-03) ──► POST /api/cron/tick (Bearer CRON_SECRET)
                         ├ syncAll(CRON)            RF-66
                         ├ expirePendingBookings    RF-54
                         ├ cleanupReceipts (3 m)    RF-56
                         └ soft locks y throttles vencidos
 Archivos de comprobantes: storage/receipts/  (solo por /api/admin/payments/[id]/receipt)
```

---

## Checklist de Verificación Pre-Release

- [ ] `npm run build` sin errores ni warnings, `npx tsc --noEmit` y `npx eslint .` limpios.
- [ ] `npm test` y `npx playwright test` al 100 %, con la base de desarrollo limpia (incluye 0 solicitudes, fuentes y corridas).
- [ ] Widget: cumpleaños a 30 días entra y a 31 no; 29/02 → 28/02 (**AC-93, AC-94**).
- [ ] Anonimización reemplaza titular y acompañantes y conserva fechas (**AC-96**); plazo vencido marcado (**AC-97**).
- [ ] Feed iCal sin datos personales (**AC-98**) y sin token válido responde 404 (**AC-108**); token de 128 bits (**RNF-06**).
- [ ] Importación bloquea la unidad y baja 1 la disponibilidad (**AC-99**); "Sincronizar ahora" (**AC-101**).
- [ ] Vencimiento: 5 d vence, 4 d 23 h 59 min no, con cobro no vence (**AC-79, AC-81**); cancelación manual sin marca (**AC-80**).
- [ ] Limpieza de comprobantes a los 3 meses conserva los datos del cobro (**AC-87**).
- [ ] `POST /api/cron/tick` sin Bearer → 401 (verificado con `curl`).
- [ ] ≥ 4 corridas en 60 min con ≤ 15 min entre dos (**AC-100**).
- [ ] 360 / 768 / 1920 px sin scroll horizontal y operable por teclado (**AC-102**); 0 colores y 0 familias fuera de la guía (**AC-103**).
- [ ] p95 < 1,5 s con 20 usuarios durante 5 minutos (**AC-104**).
- [ ] 20 confirmaciones concurrentes → 1 reserva y 19 × 409 (**RNF-03**); hash `$argon2id$` (**AC-105**).
- [ ] Sin sesión: login o 401 sin datos (**AC-106**); endpoints públicos sin datos de huéspedes (**AC-107**).
- [ ] `grep` de datos personales en logs (`console.`/`logger`) sin resultados; ningún enlace a `/adminpanel` en el portal (**AC-49**).
- [ ] `npm audit` sin altas ni críticas pendientes.
- [ ] `AGENTS.md`, `FASES.md` y `.env.example` actualizados (con diff aprobado).
