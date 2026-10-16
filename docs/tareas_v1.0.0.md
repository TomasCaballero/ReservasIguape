# Control de Tareas y Progreso — ReservasIguape v1.0.0 (Fases 8 a 10: CRM, iCal/cron y cierre)

> **⚠️ LEE ESTE BLOQUE COMPLETO ANTES DE HACER NADA. Aplica también si acabás de recibir el contexto limpio.**

---

## 0. Protocolo de trabajo (obligatorio)

1. Este archivo es la **única fuente de verdad del progreso**: el estado real es el de las casillas `[ ]` sin iniciar · `[/]` en progreso · `[x]` hecha. Las Fases 0–7 están cerradas y commiteadas; su historial está en [`FASES.md`](../FASES.md) y no hay `tareas_v*.md` anteriores.
2. **Una tarea por vez:** completar, verificar, marcar, informar y **PARAR** hasta que el usuario confirme.
3. Al empezar una tarea, marcarla `[ ]` → `[/]`. Antes de ejecutar, **leer lo que cita el `Ref:`** y abrir los archivos existentes antes de modificarlos (los fragmentos del plan son guías y firmas, no copias del código real). Antes de escribir rutas, Server Actions o caché de Next.js, leer la guía correspondiente en `node_modules/next/dist/docs/`.
4. Si la tarea tiene `⚠️ Confirmar P-xx`, preguntar **antes** de escribir código y anotar la respuesta en §5.
5. Al terminar: correr la `Verificación`; si pasa, `[/]` → `[x]`, agregar una línea `**Hecho (fecha):**` (desvíos, nombres reales, conteo de tests), actualizar `Resumen de Progreso` y `1. Estado Actual`, informar (qué se hizo, archivos tocados, resultado, próxima tarea) y **PARAR**.
6. Si falla o hay bloqueo: **no marcar `[x]`** (queda en `[/]`), anotar en "Bloqueos activos" de §1, explicar y esperar instrucciones.
7. Al cerrar la última tarea de una fase, verificar su `✅ Definition of Done`. Después se muestra el resumen de la fase y se pregunta **"¿commiteo y pusheo?"**: **no se commitea ni se pushea sin esa aprobación**. Los commits usan la skill `conventional-commit`.
8. No adelantar trabajo de tareas futuras (las dependencias van en `Depende de:` o en §4.3).
9. Cada tarea deja **el build y la suite existente en verde**: `npm test`, `npx tsc --noEmit` y `npx eslint .` (más `npx playwright test` cuando la tarea toca pantallas o rutas), salvo que la tarea diga qué tests viejos reemplaza. La base de desarrollo debe quedar limpia tras los tests (ver §3, "Estado de la base").
10. Reglas propias de esta versión: **no loguear datos personales** (documento, fecha de nacimiento, email, teléfono, nombres de huéspedes ni el `SUMMARY` de los eventos iCal); **no exponer datos personales** en endpoints públicos ni en el feed iCal; **no resolver por tu cuenta** los `[A CONFIRMAR]` del PRD ni los `P-xx` pendientes; **no agregar dependencias** sin aprobarlas como `D-xx` (Escalera de Ponytail, `AGENTS.md` §3.3).

---

## 1. Estado Actual

> Esta sección la actualiza el modelo de IA al terminar cada tarea. Es lo primero que debe leer quien retoma el trabajo.

- **Fase en curso:** Fase 9 — iCal y cron cerrada (11/11); falta la aprobación del usuario para commitear y pushear.
- **Próxima tarea:** **10.1** (Fase 10), tras el commit de la Fase 9.
- **Última tarea completada:** 9.11 (tests de la Fase 9).
- **Rama de trabajo:** `main`. Hay cambios sin commitear: `AGENTS.md` (regenerado con la skill `create-agents-md`), `docs/` (plan y tareas), `FASES.md` y las skills nuevas de `skills/`. No commitear sin aprobación.
- **Documentos creados:** [`AGENTS.md`](../AGENTS.md), [`plan_implementacion_v1.0.0.md`](./plan_implementacion_v1.0.0.md), este archivo.
- **Puntos abiertos pendientes de confirmar:** ninguno. El usuario delegó `P-01`..`P-09` y `D-04` al criterio del agente (2026-10-15); se aplican los defaults del plan, incluida la migración del índice único parcial de `D-04`. Antes de 10.8 hay que coordinar con el usuario la configuración real del scheduler (`P-03`).
- **Coordinación:** ninguna.
- **Bloqueos activos:** ninguno.
- **Notas:** Windows 11, PowerShell/Git Bash. No hay navegador manual disponible para el modelo: las verificaciones manuales se las pide al usuario o se cubren con Playwright. `graphify` está instalado (agregar `%USERPROFILE%\.localin` al PATH en cada shell) y `graphify-out/` existe (gitignored): usar `graphify query` antes de grep y `graphify update .` tras cambiar código. `prisma migrate dev` es interactivo y no sirve: usar el flujo de `AGENTS.md` §5. Los heredocs largos de Bash fallan a veces: usar la herramienta Write.

---

## 2. Cómo retomar el trabajo con el contexto limpio

1. Leer **§1 Estado Actual**.
2. Leer **§3 Contexto** y **§4 Decisiones** de este archivo, y [`AGENTS.md`](../AGENTS.md).
3. Buscar la primera casilla `[/]` (tarea a medio hacer: revisar qué quedó hecho antes de seguir) o, si no hay, la primera `[ ]`. Si no coincide con §1, preguntar.
4. Leer su `Ref:` (plan, PRD, decisiones, puntos abiertos).
5. Si tiene `⚠️ Confirmar P-xx` sin confirmar en §5, preguntar antes de escribir código.
6. Ejecutar **solo esa tarea**, correr su `Verificación`, marcarla, actualizar §1 y el Resumen de Progreso, informar y **PARAR**.

---

## 3. Contexto del Proyecto (leer siempre)

### Qué es esto
Motor de reservas público (`/`) + panel admin (`/adminpanel`) de Iguapé Aparts, en una sola app. V1 sin pagos online: los cobros se registran a mano. Las Fases 0–7 ya están hechas (portal, formulario de huéspedes con soft lock, login, catálogo, tarifas, reservas, calendario, bloqueos y cobros). Esta versión agrega:

| Módulo | Qué agrega | Fase |
|---|---|---|
| CRM | Listado y ficha de clientes con historial, widget de cumpleañeros, solicitud y ejecución de anonimización, plazo vencido | 8 |
| iCal | Feed por unidad con token, fuentes de importación, motor de sincronización (cron y manual) | 9 |
| Procesos programados | Vencimiento de Pendientes, limpieza de comprobantes, soft locks y throttles, endpoint de cron | 9 |
| Cierre | E2E completo, anchos y teclado, auditoría de estilo, carga p95, seguridad, documentación | 10 |

**No cambia:** disponibilidad, tarifas, soft lock, ciclo de vida de reservas, login y catálogo. **No es de este repo:** la web institucional (`C:\Users\tomas\MisProyectos\IguapeKimi\Iguape2026`), solo se toman de ahí colores y tipografías.

### Precisiones sobre el PRD (hechos verificados en el código)
1. RF-57/58 ya están a nivel de datos: `lib/booking/create-booking.ts:135-152` hace `upsert` por documento y pisa solo `email` y `phone`; AC-89 ya tiene test.
2. El esquema ya tiene `Customer.anonymizedAt`, `AnonymizationRequest`, `IcalSource`, `IcalSyncRun`, `UnitBlock.kind = ICAL` con unique `[icalSourceId, externalUid]` y `Unit.icalToken` (128 bits).
3. No hay código de CRM ni de anonimización; `AdminShell` no tiene "Clientes" y el detalle de reserva no enlaza al titular.
4. `(documentType, documentNumber)` es único: la anonimización no puede usar el mismo `documentNumber` para todos (`D-03`).
5. No hay rutas `/api/ical/*` ni `/api/cron/*`; `CRON_SECRET` no se usa. `proxy.ts` solo cubre `/api/admin/*` y `/adminpanel/*`.
6. El calendario ya dibuja bloqueos `ICAL`; `deleteBlock` los rechaza.
7. RF-54 no existe (nada pone `cancelledByExpiry = true`); RF-53 sí (`findUncontactedBookings`).
8. `ReceiptStorage.remove` es idempotente; faltan la limpieza (RF-56) y el mensaje "comprobante eliminado".
9. `LoginThrottle` crece con emails desconocidos (fila con `failures = 1` que nunca se reinicia sola).
10. Los soft locks vencidos solo se borran por unidad al ocuparla.
11. RNF-03 ya tiene dos tests de 20 concurrentes; AC-49 ya está cubierto por `tests/e2e/admin.spec.ts:93`.

### Actores del sistema
| Actor | Rol en v1.0.0 |
|---|---|
| Huésped | Reserva como invitado desde el portal; su documento lo identifica como cliente (CRM) |
| Administrador | Único rol: opera el panel, el CRM, las fuentes iCal y la sincronización manual |
| Scheduler externo | Llama a `POST /api/cron/tick` con `CRON_SECRET` cada ≤ 15 min (`P-03`) |
| OTAs (Booking, Airbnb) | Publican feeds `.ics` que se importan, y consumen el feed `.ics` de cada unidad |

### Stack obligatorio
- Next.js 16.4.1 (App Router, `proxy.ts`, `PageProps<>` / `RouteContext<>` globales — correr `npx next typegen` tras crear rutas), React 19.3, Node 22 LTS, npm, Tailwind 4.
- PostgreSQL 17 (`btree_gist`) + Prisma 7.10.0 (cliente en `app/generated/prisma`); la sesión se fuerza a UTC.
- Argon2id (`argon2`), `react-day-picker` + `date-fns`.
- Tests: Vitest 5 (`tests/unit`, `tests/db`; `fileParallelism: false`) y Playwright (`tests/e2e`, `workers: 1`). Los e2e usan `pg` directo (`tests/e2e/db.ts`) y no pueden importar el cliente Prisma generado. Prefijos de documentos de prueba: `97xxxxxx` (portal), `96xxxxxx` (panel); para esta versión se agrega `95xxxxxx` (CRM e iCal).

### Reglas inmutables
- ❌ **NO** agregar dependencias externas ni escribir código nuevo sin pasar por la Escalera de 6 Peldaños de Ponytail (`AGENTS.md` §3.3); una dependencia o refactor nuevo solo entra aprobado como D-xx.
- ❌ **NO** verificar disponibilidad solo en la app: la anti-superposición va con exclusion constraint de Postgres, en SQL dentro de una migración (RNF-03, AC-41).
- ❌ **NO** resolver por tu cuenta los **[A CONFIRMAR]** del PRD ni ninguna ambigüedad: parar y preguntar.
- ❌ **NO** construir lo que el PRD deja fuera de alcance: pagos online, emails o WhatsApp automáticos, login de clientes, múltiples roles, alta manual de reservas, otros orígenes que *Web Directa*, conversión ARS/USD.
- ❌ **NO** exponer datos personales de huéspedes en endpoints públicos ni en el feed iCal; el iCal sin token válido responde 404 (RNF-06, AC-107, AC-108).
- ❌ **NO** exponer ni enlazar `/adminpanel` desde el portal público; el panel lleva `noindex` (RF-33, AC-49).
- ❌ **NO** usar colores ni familias tipográficas fuera de la guía de estilo de la web principal (RNF-02, AC-103).
- ❌ **NO** loguear datos personales ni contraseñas (`AGENTS.md` §8).

### Ubicación física de los archivos
```
ReservasIguape/
├── PRD.md                              # fuente canónica
├── AGENTS.md                           # reglas y comandos
├── FASES.md                            # historial Fases 0–7
├── docs/
│   ├── plan_implementacion_v1.0.0.md   # referencia técnica de cada tarea
│   └── tareas_v1.0.0.md                # ESTE archivo
├── walkthroughs/                       # troubleshooting_<tema>.md (se crea al primer error no trivial)
├── app/ · components/ · lib/ · prisma/ · scripts/ · tests/
└── storage/receipts/                   # comprobantes (gitignored)
```

Comandos de uso frecuente (de `AGENTS.md` §5):
```
npm run dev                                   # http://localhost:7777
npm test                                      # Vitest: unit + db
npx vitest run tests/db/customers.test.ts     # test filtrado
npx playwright test                           # e2e (el webServer reutiliza el dev server)
npx playwright test tests/e2e/admin-ical.spec.ts
npx tsc --noEmit && npx eslint .
npm run build
npx next typegen                              # tras crear rutas nuevas
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script
npx prisma migrate deploy && npx prisma generate
```

**Estado de la base tras los tests:** 6 categorías, 20 unidades, 0 reglas, temporadas, reservas, clientes, locks, bloqueos, cobros ni throttles, `pendingExpiryDays = 5`, y desde esta versión también 0 solicitudes de anonimización, 0 fuentes iCal y 0 corridas de sincronización.

### Documentos de referencia
| Documento | Para qué sirve |
|---|---|
| [Plan v1.0.0](./plan_implementacion_v1.0.0.md) | Referencia principal de cada tarea (pasos `N.k`, decisiones, firmas) |
| [PRD](../PRD.md) | Gana sobre el plan; si hay contradicción, parar y avisar |
| [AGENTS.md](../AGENTS.md) | Reglas inmutables, comandos y flujo de trabajo |
| [FASES.md](../FASES.md) | Historial de las Fases 0–7 y decisiones de la Fase 7 |

---

## 4. Decisiones de arquitectura (NO re-discutir)

> Una decisión zanja un criterio o tradeoff, no un hecho. Si una decisión contradice una fuente canónica (PRD), **parar y avisar**.

### 4.1 Decisiones de fases previas que siguen vigentes
(De `FASES.md`; no tenían numeración `D-xx` porque no hubo plan previo.)

| # | Estado en v1.0.0 |
|---|---|
| F7-1 | Confirmada → Pendiente se rechaza ("Transición no permitida"). No se toca. |
| F7-2 | Comprobantes en `storage/receipts/` tras la interfaz `ReceiptStorage`, servidos solo por `/api/admin/payments/[id]/receipt` con sesión. La limpieza de RF-56 (9.8) usa `ReceiptStorage.remove`. |
| F7-3 | Al volver a Pendiente se limpian `paymentInfoSentAt` y `cancelledByExpiry`. El vencimiento (9.7) **no** usa `changeBookingStatus` por eso mismo. |
| F7-4 | Cada reserva activa ocupa una unidad concreta (provisoria, `unitAssigned=false`) vía `UnitOccupancy`. |
| F7-5 | Métodos de pago fijos y archivos PDF/JPG/JPEG/PNG de hasta 10.485.760 bytes. No se tocan. |

### 4.2 Decisiones v1.0.0
| # | Tema | Resumen |
|---|---|---|
| D-01 | Superficie del CRM | `/adminpanel/clientes` (listado + solicitudes) y `/adminpanel/clientes/[id]` (ficha + historial); widget en Inicio. |
| D-02 | Cumpleañeros | Función pura `upcomingBirthdays`, ventana de offsets 0..30, 29/02 → 28/02 en años no bisiestos, excluye anonimizados. |
| D-03 | Anonimización | `documentNumber = ANON-<customerId>`, nombre/apellido `Anonimizado`, email `anonimizado@anonimizado.invalid`, teléfono `-`, nacimiento `1900-01-01`; también acompañantes; `anonymizedAt = now()`; una transacción. |
| D-04 | Idempotencia | Anonimizar dos veces → 409. Una sola solicitud pendiente por cliente (índice único parcial por migración SQL, **a confirmar**). |
| D-05 | Alcance de la anonimización | Se conservan fechas, categoría, montos y cobros; los comprobantes los borra RF-56. |
| D-06 | Plazo vencido | Se calcula en SQL con `now()` de la base. |
| D-07 | Parser iCal | Propio y mínimo; ignora `SUMMARY`/`DESCRIPTION`; sin dependencia nueva. Si un feed real lo supera, proponer `node-ical` como `D-xx`. |
| D-08 | Feed de exportación | `GET /api/ical/<token>.ics`; token `^[0-9a-f]{32}$`; cualquier otro caso → 404 sin cuerpo; exporta reservas Pendiente/Confirmada y bloqueos manuales; eventos de día completo, `SUMMARY:Ocupado`. |
| D-09 | Motor de sincronización | `syncAll(db, trigger)`; alta/cambio/baja por `UID`; un feed caído no libera fechas; una fila de `IcalSyncRun` por corrida; `P2002` = ya sincronizado. |
| D-10 | Conflictos | El evento que choca no se importa, la reserva no se toca, el conflicto se cuenta y se muestra (**a confirmar**, `P-01`). |
| D-11 | Cron | Un solo `POST /api/cron/tick` con `Bearer CRON_SECRET` (`timingSafeEqual`); cada tarea con su `try/catch`. |
| D-12 | Vencimiento | Un `UPDATE … RETURNING` transaccional, sin ningún cobro, con `now()` de la base. |
| D-13 | Comprobantes | Borrar el archivo primero y dejar `receiptPath = NULL` después; si falla, reintenta en el próximo tick. |
| D-14 | Estilo | Test e2e de estilos computados contra los tokens de `app/globals.css`. |
| D-15 | Carga | `scripts/load-availability.ts`, 20 workers × 5 min, falla si p95 ≥ 1,5 s. |
| D-16 | graphify | Se instala en 8.1 solo con confirmación; `graphify-out/` a `.gitignore` salvo que el usuario decida versionarlo. |

### 4.3 Ajustes de secuencia respecto del plan
**Este archivo manda en el *cuándo*; el *qué* sigue siendo el del plan.**

| # | Plan dice | Este archivo lo hace | Motivo |
|---|---|---|---|
| A-V1-01 | §8.5 pantallas y widget en un paso | **8.5** (clientes, ficha y acciones) y **8.6** (widget en Inicio); los tests pasan de 8.6 a **8.7** | Tareas atómicas, cada una verificable y commiteable sola |
| A-V1-02 | §9.9 el tick corre las cinco tareas | **9.9** crea el endpoint con sync, vencimiento y comprobantes; **9.10** agrega soft locks y throttles a `runJobs` | El build queda verde en cada tarea y `P-04` se confirma justo antes de lo que afecta |
| A-V1-03 | §10.10 tests de la fase | 10.1–10.4 ya *son* tests; **10.10** es la corrida final de la suite y el build de release | Evitar duplicar trabajo |

---

## 5. Puntos abiertos del PRD

> Actualizar la columna Estado al confirmarlo (`Confirmado (fecha)` o `Cambiado (fecha): …`).

| # | Tema | Default | Confirmar antes de | Estado |
|---|---|---|---|---|
| P-01 | Eventos iCal que chocan con reservas existentes | No se importa; la reserva se conserva; el conflicto se muestra (D-10) | 9.4 | Confirmado (2026-10-15): default, delegado por el usuario |
| P-02 | ¿El feed exportado incluye bloqueos importados de otras OTAs? | No (evita eco) | 9.1 | Confirmado (2026-10-15): default, delegado por el usuario |
| P-03 | Quién dispara `/api/cron/tick` cada ≤ 15 min | Endpoint agnóstico; local: Programador de tareas de Windows | 10.8 | Confirmado (2026-10-15): default, delegado por el usuario |
| P-04 | Limpieza de `LoginThrottle` | Borrar filas de más de 24 h sin bloqueo vigente | 9.10 | Confirmado (2026-10-15): default, delegado por el usuario |
| P-05 | AC-94: 29/02 → 28/02 en años no bisiestos | Sí | — | Aplicar |
| P-06 | RNF-02: ubicación de la guía de estilo | Tokens de `app/globals.css` + las dos tipografías y sus genéricos | 10.3 | Confirmado (2026-10-15): default, delegado por el usuario |
| P-07 | AC-96: qué se conserva al anonimizar | Fechas, categoría, montos y cobros; comprobantes hasta RF-56 | 8.4 | Confirmado (2026-10-15): default, delegado por el usuario |
| P-08 | RNF-04: medir "en servidor", sin staging | Latencia medida desde el cliente de carga contra `localhost` | 10.5 | Confirmado (2026-10-15): default, delegado por el usuario |
| P-09 | RF-61/62: fecha de solicitud, solicitud previa, duplicados | `requestedAt = now()`; se puede anonimizar sin solicitud; una pendiente por cliente; advertir si hay reservas futuras | 8.4 | Confirmado (2026-10-15): default, delegado por el usuario |
| P-10 | Pisado de email/teléfono al reservar con el mismo documento (RF-58) | Sin mitigación; la ficha muestra la última actualización | — | Aplicar |
| P-11 | RF-59: qué reservas lista el historial | Todas, recientes primero | — | Aplicar |
| P-12 | RF-60: ¿entra el cumpleaños de hoy? | Sí | — | Aplicar |
| P-13 | RF-64: validación de la URL de importación | Solo `http`/`https`, hasta 500 caracteres | — | Aplicar |
| P-14 | RF-63: URL absoluta mostrada en el panel | Host de la solicitud (`headers()`) | — | Aplicar |
| P-15 | RF-56: el plazo se cuenta desde la carga | Sí, desde `receiptUploadedAt` | — | Aplicar |

---

## Resumen de Progreso por Fase

- [x] Fase 8 — CRM (7/7)
- [x] Fase 9 — iCal y procesos programados (11/11)
- [ ] Fase 10 — Cierre (0/10)
- [ ] Checklist de Verificación Pre-Release (0/22)

**Total: 18/50** (28 tareas de desarrollo + 22 verificaciones pre-release)

---

# Fase 8 — CRM: clientes, cumpleañeros y anonimización

> **Objetivo de la fase:** el administrador ve los clientes con su historial, los cumpleaños de los próximos 30 días en Inicio, y puede registrar y ejecutar la anonimización con las solicitudes vencidas marcadas.
> **Regla de la fase:** RF-57 y RF-58 ya están implementados (`create-booking.ts`): no se reescriben, solo se verifican. No se loguean datos personales.
> **Cobertura PRD:** RF-57, RF-58, RF-59, RF-60, RF-61, RF-62 · RNF-08 · AC-88, AC-89, AC-90, AC-91, AC-92, AC-93, AC-94, AC-95, AC-96, AC-97

- [x] **8.1 Instalar graphify**
  - **Objetivo:** dejar el grafo del repo disponible para las tareas siguientes (o registrar que se omite).
  - **Depende de:** —
  - **⚠️ Confirmación del usuario** antes de instalar (skill `use-graphify`: no instalar sin confirmación).
  - **Archivos a crear:** `graphify-out/` (generado).
  - **Archivos a modificar:** `.gitignore` (agregar `graphify-out/`, salvo que el usuario decida versionarlo).
  - **Pasos:**
    1. Preguntar al usuario si instala; si dice que no, anotar "omitida" en `Hecho` y seguir.
    2. `uv tool install graphifyy` (o `pip install graphifyy`; el paquete es `graphifyy`, con doble y) y `graphify install --project`.
    3. Primera construcción: `graphify . --code-only` y `graphify cluster-only`.
    4. No instalar hooks (`graphify hook install`) sin otra confirmación.
  - **Verificación:** `graphify --help` responde y existe `graphify-out/GRAPH_REPORT.md` · `npm test` sigue en verde.
  - **Ref:** [plan §8.1](./plan_implementacion_v1.0.0.md) | `AGENTS.md` §3.1 | D-16
  - **Hecho (2026-10-15):** `uv tool install graphifyy` (ejecutables en `~/.local/bin`, agregar al PATH) y `graphify install --project`, que además creó `.claude/` (skill + hooks `PreToolUse` `graphify hook-guard`) y agregó un bloque `## graphify` a `CLAUDE.md`. Grafo: 594 nodos, 1651 aristas, 22 comunidades (`graphify . --code-only` + `graphify cluster-only`). `/graphify-out/` en `.gitignore`. No se instaló el hook de git. `npx tsc --noEmit` OK y `npm test` 150/150.

- [x] **8.2 Cumpleañeros: función pura**
  - **Objetivo:** `upcomingBirthdays` resuelve las fronteras de AC-91..94.
  - **Depende de:** —
  - **Archivos a crear:** `lib/admin/birthdays.ts`.
  - **Archivos a modificar:** —
  - **Pasos:**
    1. Abrir `lib/booking/dates.ts` y reusar `addDays`, `nightsBetween` y `ISODate`.
    2. Implementar `upcomingBirthdays(customers, today, days = 30)` con offsets 0..30, próxima ocurrencia en el año actual o el siguiente (cruza el fin de año), 29/02 → 28/02 en año no bisiesto, excluyendo `anonymized`, ordenado por `inDays` y luego apellido (plan §8.2).
    3. No acceder a la base desde esta función. (Tests en 8.7.)
  - **Verificación:** `npx tsc --noEmit` → 0 errores · `npx eslint .` limpio · `npm test` → sin regresiones.
  - **Ref:** [plan §8.2](./plan_implementacion_v1.0.0.md) | RF-60 · AC-91..94 | D-02 | P-05, P-12
  - **Hecho (2026-10-15):** `lib/admin/birthdays.ts`: `upcomingBirthdays` prueba el año de `today` y el siguiente; el tipo `BirthdayCustomer` suma `lastName` (necesario para el orden por apellido). Reusa `nightsBetween`.

- [x] **8.3 Consultas del CRM**
  - **Objetivo:** listar clientes, leer una ficha con su historial y listar solicitudes con el plazo vencido calculado en SQL.
  - **Depende de:** —
  - **Archivos a crear:** `lib/admin/customers.ts`.
  - **Archivos a modificar:** —
  - **Pasos:**
    1. Abrir `lib/admin/bookings.ts` y `lib/admin/catalog.ts` para seguir sus convenciones (`Db`, `ActionResult`, SQL crudo con `now()`).
    2. `listCustomers(db, q?)`: busca por nombre, apellido o documento; devuelve los seis campos de AC-88.
    3. `getCustomer(db, id)`: datos + todas las reservas (cualquier estado, recientes primero, P-11) + `updatedAt` (P-10) + solicitud con su fecha y estado.
    4. `listAnonymizationRequests(db)`: pendientes primero, con `overdue = requestedAt <= now() - make_interval(days => anonymizationDays) AND completedAt IS NULL` en SQL (D-06).
    5. No exponer estas funciones a rutas sin `requireAdmin`. (Tests en 8.7.)
  - **Verificación:** `npx tsc --noEmit` → 0 errores · `npx eslint .` limpio · `npm test` → sin regresiones.
  - **Ref:** [plan §8.3](./plan_implementacion_v1.0.0.md) | RF-57, RF-59, RF-61 · RNF-08 · AC-88, 90, 97 | D-01, D-06 | P-10, P-11
  - **Hecho (2026-10-15):** `lib/admin/customers.ts`: `listCustomers` (límite 200), `getCustomer(db, id, today)` (recibe `today` para contar reservas activas futuras, P-09) y `listAnonymizationRequests` con `overdue` en SQL (pendientes primero).

- [x] **8.4 Solicitud y ejecución de la anonimización**
  - **Objetivo:** registrar la solicitud y anonimizar al cliente y a sus acompañantes en una transacción.
  - **Depende de:** 8.3
  - **⚠️ Confirmar P-07, P-09 y D-04** (migración del índice único parcial) antes de escribir código.
  - **Archivos a crear:** `prisma/migrations/<fecha>_anonymization_pending_unique/migration.sql` (solo si se confirma D-04).
  - **Archivos a modificar:** `lib/admin/customers.ts`.
  - **Pasos:**
    1. Anotar las respuestas en §5.
    2. Si D-04 se confirma: `CREATE UNIQUE INDEX "AnonymizationRequest_one_pending" ON "AnonymizationRequest"("customerId") WHERE "completedAt" IS NULL;` — carpeta de migración a mano, `npx prisma migrate deploy` y `npx prisma generate` (`AGENTS.md` §5).
    3. `requestAnonymization(db, customerId)`: `requestedAt = now()` de la base; 409 si el cliente ya está anonimizado o ya hay una pendiente.
    4. `anonymizeCustomer(db, customerId)`: una transacción que aplica D-03 al cliente y a los acompañantes de todas sus reservas, completa la solicitud pendiente (`completedAt = now()`) y fija `anonymizedAt = now()`; 409 si ya estaba anonimizado. No tocar reservas, montos ni cobros (D-05).
    5. No loguear ningún dato personal. (Tests en 8.7.)
  - **Verificación:** `npx prisma migrate deploy` sin errores (si hay migración) · `npx tsc --noEmit` → 0 errores · `npm test` → sin regresiones.
  - **Ref:** [plan §8.4](./plan_implementacion_v1.0.0.md) | RF-61, RF-62 · AC-95, 96 | D-03, D-04, D-05 | P-07, P-09
  - **Hecho (2026-10-15):** Migración `20261015120000_anonymization_pending_unique` (índice único parcial, D-04) aplicada con `migrate deploy`. `requestAnonymization` (409 `ALREADY_PENDING` / `ALREADY_ANONYMIZED`) y `anonymizeCustomer` (una transacción, `UPDATE … WHERE anonymizedAt IS NULL` evita la carrera; acompañantes con `documentNumber = ANON-<guestId>`).

- [x] **8.5 Pantallas del CRM y acciones**
  - **Objetivo:** el administrador navega clientes, ve la ficha y solicita o ejecuta la anonimización con confirmación en dos pasos.
  - **Depende de:** 8.3, 8.4
  - **Archivos a crear:** `app/adminpanel/clientes/page.tsx`, `app/adminpanel/clientes/[id]/page.tsx`, `app/adminpanel/customer-actions.ts`, `components/admin/AnonymizeActions.tsx`.
  - **Archivos a modificar:** `components/admin/AdminShell.tsx` (entrada "Clientes"), `app/adminpanel/reservas/[id]/page.tsx` (el titular enlaza a su ficha; "Cliente anonimizado" si corresponde).
  - **Pasos:**
    1. Abrir `DeleteButton.tsx`, `use-submit.ts`, `app/adminpanel/booking-actions.ts` y una página existente (`unidades/page.tsx`) y seguir su patrón.
    2. Listado con las seis columnas de AC-88, buscador y sección "Solicitudes de anonimización" con la marca "plazo vencido" (AC-97).
    3. Ficha con datos, historial (AC-90), última actualización (P-10) y solicitud con fecha y estado (AC-95).
    4. `AnonymizeActions`: confirmación en dos pasos, sin diálogos del navegador; advertir si hay reservas Pendiente/Confirmada futuras (P-09).
    5. Cada acción de `customer-actions.ts` hace `requireAdmin()` y `revalidatePath`. Correr `npx next typegen`.
    6. Solo clases y tokens existentes (RNF-02); sin scroll horizontal de 360 a 1920 px.
  - **Verificación:** `npx next typegen && npx tsc --noEmit` → 0 errores · `npx eslint .` limpio · `npm test` y `npx playwright test` → sin regresiones · manual: abrir `/adminpanel/clientes` a 360 px y a 1920 px sin scroll horizontal. (Tests en 8.7.)
  - **Ref:** [plan §8.5](./plan_implementacion_v1.0.0.md) | RF-57, 59, 61, 62 · RNF-01, RNF-08 · AC-88, 90, 95, 96, 97, 106 | D-01 | P-09, P-10
  - **Hecho (2026-10-15):** `/adminpanel/clientes` (tarjetas en vez de tabla para no desbordar a 360 px, buscador GET, solicitudes con "Plazo vencido"), `clientes/[id]`, `customer-actions.ts`, `AnonymizeActions` (dos pasos para solicitar y para anonimizar, con aviso P-09), entrada "Clientes" y enlace del titular en la reserva. `next typegen`, `tsc` y `eslint` limpios.

- [x] **8.6 Widget de próximos cumpleañeros en Inicio**
  - **Objetivo:** Inicio lista a los clientes que cumplen años en los próximos 30 días.
  - **Depende de:** 8.2, 8.3
  - **Archivos a crear:** `components/admin/BirthdaysWidget.tsx`.
  - **Archivos a modificar:** `app/adminpanel/page.tsx`.
  - **Pasos:**
    1. Abrir `app/adminpanel/page.tsx` y mantener intacto el aviso de RF-53.
    2. Cargar los clientes no anonimizados, aplicar `upcomingBirthdays(…, todayInBuenosAires())` y mostrar nombre, fecha de cumpleaños (`dd/MM/yyyy`), email y teléfono (AC-91).
    3. Sin datos en el login (el widget va solo con sesión). Sin personas anonimizadas.
  - **Verificación:** `npx tsc --noEmit` → 0 errores · `npx eslint .` limpio · `npm test` y `npx playwright test` → sin regresiones. (Tests en 8.7.)
  - **Ref:** [plan §8.5](./plan_implementacion_v1.0.0.md) | RF-60 · AC-91..94 | D-01, D-02 | P-12
  - **Hecho (2026-10-15):** `BirthdaysWidget` en Inicio debajo del aviso RF-53 (nombre enlazado a la ficha, fecha, "hoy / en N días", email y teléfono).

- [x] **8.7 Tests de la Fase 8**
  - **Objetivo:** cubrir AC-88..97 con unit, db y e2e.
  - **Depende de:** 8.2, 8.3, 8.4, 8.5, 8.6
  - **Archivos a crear:** `tests/unit/birthdays.test.ts`, `tests/db/customers.test.ts`, `tests/db/anonymization.test.ts`, `tests/e2e/admin-customers.spec.ts`.
  - **Archivos a modificar:** `tests/e2e/db.ts` (helpers de cliente y solicitud, si hacen falta; limpieza de los documentos `95xxxxxx`).
  - **Pasos:**
    1. `birthdays.test.ts`: 15/10 sí y 15/11 no con hoy 01/10 (**AC-91**) · 20/12 → 05/01 (**AC-92**) · 31/10 entra y 01/11 no (**AC-93**) · 29/02 → 28/02 en año no bisiesto y 29/02 en bisiesto (**AC-94**) · incluye el cumpleaños de hoy (P-12) · excluye anonimizados.
    2. `customers.test.ts`: cliente nuevo con todos sus datos (**AC-88**) · mismo documento con otro email deja 1 cliente (**AC-89**) · historial con dos estadías Finalizadas (**AC-90**) · solicitud de 30 d 0 h vencida y de 29 d 23 h no (**AC-97 / RNF-08**).
    3. `anonymization.test.ts`: solicitud con fecha y estado pendiente (**AC-95**) · anonimizar titular y acompañantes conservando las fechas (**AC-96**) · dos anonimizaciones no chocan con la unicidad del documento (**D-03**) · anonimizar dos veces → 409 (**D-04**) · segunda solicitud pendiente rechazada (**D-04**).
    4. `admin-customers.spec.ts`: el widget lista al cumpleañero con email y teléfono (**AC-91**) · desde una reserva se llega a la ficha, se solicita y se anonimiza (**AC-95, AC-96**) · sin sesión `/adminpanel/clientes` redirige al login (**AC-106**).
    5. Cada test limpia lo que crea (la base queda como en §3).
  - **Verificación:** `npx vitest run tests/unit/birthdays.test.ts tests/db/customers.test.ts tests/db/anonymization.test.ts` → todos pasan · `npx playwright test tests/e2e/admin-customers.spec.ts` → todos pasan · `npm test`, `npx playwright test`, `npx tsc --noEmit`, `npx eslint .` en verde · consulta a la base: 0 solicitudes y 0 clientes de prueba.
  - **Ref:** [plan §8.6](./plan_implementacion_v1.0.0.md) | AC-88..97 · RNF-08 | D-02, D-03, D-04, D-06
  - **Hecho (2026-10-15):** 21 tests nuevos de Vitest (7 unit, 4 + 10 db) y 4 e2e; `tests/db/helpers.ts` suma `fx.customer()` y borra solicitudes en `cleanup`; `tests/e2e/db.ts` suma `seedCrmCustomer` y `cleanupCrmE2e` (por id, porque al anonimizarse el cliente pierde el prefijo 95). `npm test` 171/171, `npx playwright test` 68/68 (una corrida previa tuvo 3 fallos intermitentes de portal/CRM por carga que no se repitieron), `npm run build` OK, base limpia (0 clientes, 0 solicitudes).

> **✅ Definition of Done — Fase 8**
> - [x] Build de release limpio, `tsc` y `eslint` sin errores, suite Vitest y Playwright al 100 %.
> - [x] El listado muestra nombre, apellido, email, teléfono, documento y nacimiento (**AC-88**) y el mismo documento con otro email deja 1 solo cliente (**AC-89**).
> - [x] La ficha lista el historial (**AC-90**).
> - [x] El widget respeta las fronteras de 30 días, fin de año y 29/02 (**AC-91, 92, 93, 94**).
> - [x] La solicitud queda con fecha y "pendiente" (**AC-95**); anonimizar reemplaza titular y acompañantes y conserva las fechas (**AC-96**).
> - [x] El plazo vencido se marca con la hora de la base (**AC-97 / RNF-08**).
> - [x] Sin datos personales en logs; las acciones exigen sesión; `P-07`, `P-09` y `D-04` registrados en §5.
> - [x] La base de desarrollo quedó limpia (§3).

---

# Fase 9 — iCal y procesos programados

> **Objetivo de la fase:** cada unidad publica su feed iCal con token, el administrador carga las URLs de las OTAs y sincroniza a mano o cada ≤ 15 min, y un único endpoint de cron vence Pendientes, borra comprobantes viejos y limpia soft locks y throttles.
> **Regla de la fase:** el feed y los logs no llevan datos de huéspedes; un feed externo caído **nunca** libera fechas; los `SUMMARY` importados no se guardan. Los endpoints `/api/ical/*` y `/api/cron/*` están fuera de `proxy.ts`: se validan a sí mismos.
> **Cobertura PRD:** RF-54, RF-56, RF-63, RF-64, RF-65, RF-66, RF-67 · RNF-06, RNF-07 · AC-79, AC-80, AC-81, AC-87, AC-98, AC-99, AC-100, AC-101, AC-108

- [x] **9.1 Exportación `.ics`**
  - **Objetivo:** construir el feed de una unidad con solo fechas ocupadas.
  - **Depende de:** —
  - **⚠️ Confirmar P-02** antes de escribir código.
  - **Archivos a crear:** `lib/ical/export.ts`.
  - **Archivos a modificar:** —
  - **Pasos:**
    1. Anotar la respuesta de `P-02` en §5.
    2. `buildFeed(unitName, events)`: `VCALENDAR` con un `VEVENT` por evento (`UID`, `DTSTAMP`, `DTSTART;VALUE=DATE`, `DTEND;VALUE=DATE` exclusivo, `SUMMARY:Ocupado`), líneas con CRLF.
    3. `loadFeedEvents(db, unitId)`: ocupaciones de reservas Pendiente/Confirmada y bloqueos manuales; sin soft locks; los bloqueos `ICAL` según `P-02`. `UID = <id de ocupación>@iguape`.
    4. Ningún campo sale de `Customer` ni de `Guest`. (Tests en 9.11.)
  - **Verificación:** `npx tsc --noEmit` → 0 errores · `npx eslint .` limpio · `npm test` → sin regresiones.
  - **Ref:** [plan §9.1](./plan_implementacion_v1.0.0.md) | RF-63 · AC-98 | D-08 | P-02
  - **Hecho (2026-10-15):** `lib/ical/export.ts` (`buildFeed`, `loadFeedEvents`); P-02: sin bloqueos `ICAL`.

- [x] **9.2 Ruta pública del feed**
  - **Objetivo:** `GET /api/ical/<token>.ics` entrega el feed o responde 404.
  - **Depende de:** 9.1
  - **Archivos a crear:** `app/api/ical/[token]/route.ts`.
  - **Archivos a modificar:** —
  - **Pasos:**
    1. Leer en `node_modules/next/dist/docs/` la guía de route handlers y de `RouteContext`.
    2. Quitar el sufijo `.ics`; si el token no cumple `^[0-9a-f]{32}$` o no existe en `Unit.icalToken` → `new Response(null, { status: 404 })`.
    3. Con token válido: `text/calendar; charset=utf-8` y `Cache-Control: no-store`.
    4. Correr `npx next typegen`. No tocar `proxy.ts`.
  - **Verificación:** `npx next typegen && npx tsc --noEmit` → 0 errores · manual con el dev server: `curl -i http://localhost:7777/api/ical/xxx.ics` → 404 · `npm test` → sin regresiones. (Tests en 9.11.)
  - **Ref:** [plan §9.2](./plan_implementacion_v1.0.0.md) | RF-63 · RNF-06 · AC-98, AC-108 | D-08
  - **Hecho (2026-10-15):** `app/api/ical/[token]/route.ts`; typegen y `tsc` en 0 errores.

- [x] **9.3 Parser iCal mínimo**
  - **Objetivo:** convertir el texto de un feed en eventos `{ uid, start, end }`.
  - **Depende de:** —
  - **Archivos a crear:** `lib/ical/parse.ts`.
  - **Archivos a modificar:** —
  - **Pasos:**
    1. Reusar `ISODate`, `addDays` y `todayInBuenosAires` de `lib/booking/dates.ts`.
    2. `parseIcal(text, today)`: desdobla líneas; solo `VEVENT` con `UID` y `DTSTART`; soporta `VALUE=DATE` y `DATE-TIME` (a fecha de Buenos Aires); `DTEND` ausente → `start + 1`; descarta `STATUS:CANCELLED`, rangos con fin ≤ inicio y eventos con fin ≤ `today`.
    3. Ignorar `SUMMARY` y `DESCRIPTION` (D-07). Sin dependencias nuevas. (Tests en 9.11.)
  - **Verificación:** `npx tsc --noEmit` → 0 errores · `npx eslint .` limpio · `npm test` → sin regresiones.
  - **Ref:** [plan §9.3](./plan_implementacion_v1.0.0.md) | RF-65 · AC-99 | D-07
  - **Hecho (2026-10-15):** `lib/ical/parse.ts`; DATE-TIME en UTC pasa a fecha de Buenos Aires, flotante/TZID usa su propia fecha.

- [x] **9.4 Motor de sincronización**
  - **Objetivo:** `syncAll` importa, actualiza y borra bloqueos iCal por `UID` y registra cada corrida.
  - **Depende de:** 9.3
  - **⚠️ Confirmar P-01** antes de escribir código.
  - **Archivos a crear:** `lib/ical/sync.ts`.
  - **Archivos a modificar:** —
  - **Pasos:**
    1. Anotar la respuesta de `P-01` en §5 y ajustar el tratamiento de conflictos si cambió.
    2. Abrir `lib/admin/blocks.ts` y `lib/booking/claim.ts` y reusar `releaseExpiredLocks` e `isOverlapError`.
    3. `syncAll(db, trigger, fetchText = defaultFetch)`: crea `IcalSyncRun`; por fuente, fetch con timeout de 10 s, tope de 2 MB y solo `http`/`https` → `parseIcal` → alta, cambio de fechas o baja por `UID`, cada evento en su transacción (`UnitBlock` kind `ICAL` + `UnitOccupancy`); cierra el run con `ok` y `summary` sin datos personales.
    4. Un overlap cuenta como conflicto y no importa el evento (D-10); un `P2002` de `[icalSourceId, externalUid]` se trata como ya sincronizado.
    5. Error de red o de parseo → `lastError` en la fuente y **no se borra ningún bloqueo**; éxito → `lastSyncedAt`.
    6. `fetchText` inyectable. Eventos pasados o cancelados se ignoran. No guardar `SUMMARY`. (Tests en 9.11.)
  - **Verificación:** `npx tsc --noEmit` → 0 errores · `npx eslint .` limpio · `npm test` → sin regresiones.
  - **Ref:** [plan §9.4](./plan_implementacion_v1.0.0.md) | RF-65, 66, 67 · RNF-03 · AC-99, 100, 101 | D-09, D-10 | P-01
  - **Hecho (2026-10-15):** `lib/ical/sync.ts` (`syncAll`, `defaultFetch`); P-01 default; el resumen de la corrida lleva solo conteos.

- [x] **9.5 Fuentes de importación**
  - **Objetivo:** alta y baja de las URLs iCal de cada unidad.
  - **Depende de:** —
  - **Archivos a crear:** `lib/admin/ical-sources.ts`.
  - **Archivos a modificar:** `lib/admin/validation.ts` (si conviene agregar el parseo del formulario, siguiendo sus funciones `parse*`).
  - **Pasos:**
    1. Abrir `lib/admin/validation.ts` y `lib/admin/catalog.ts` y seguir su patrón de validación y resultado.
    2. `addIcalSource(db, { unitId, label, url })`: etiqueta obligatoria, URL `http`/`https` de hasta 500 caracteres, unidad existente (P-13).
    3. `removeIcalSource(db, id)`: borra la fuente y, por cascada, sus bloqueos. (Tests en 9.11.)
  - **Verificación:** `npx tsc --noEmit` → 0 errores · `npx eslint .` limpio · `npm test` → sin regresiones.
  - **Ref:** [plan §9.5](./plan_implementacion_v1.0.0.md) | RF-64 | D-09 | P-13
  - **Hecho (2026-10-15):** `lib/admin/ical-sources.ts` y `parseIcalSource` en `validation.ts` (etiqueta ≤ 40, URL http/https ≤ 500).

- [x] **9.6 Pantalla iCal y sincronización manual**
  - **Objetivo:** el administrador ve la URL del feed por unidad, gestiona fuentes y pulsa "Sincronizar ahora".
  - **Depende de:** 9.2, 9.4, 9.5
  - **Archivos a crear:** `app/adminpanel/ical/page.tsx`, `app/adminpanel/ical-actions.ts`, `components/admin/IcalSourceForm.tsx`, `components/admin/SyncNowButton.tsx`.
  - **Archivos a modificar:** `components/admin/AdminShell.tsx` (entrada "iCal").
  - **Pasos:**
    1. Abrir `unidades/page.tsx`, `booking-actions.ts`, `use-submit.ts` y seguir su patrón.
    2. Por unidad: URL absoluta `<host>/api/ical/<token>.ics` (host de `headers()`, P-14), fuentes con `lastSyncedAt` y `lastError`, formulario de alta y baja.
    3. Conflictos de la última corrida (D-10) y las últimas corridas de `IcalSyncRun`.
    4. `SyncNowButton` → acción que llama a `syncAll(prisma, "MANUAL")`; todas las acciones con `requireAdmin()` y `revalidatePath("/adminpanel/calendario")` y `revalidatePath("/")`. Correr `npx next typegen`.
    5. Sin scroll horizontal de 360 a 1920 px; solo tokens existentes.
  - **Verificación:** `npx next typegen && npx tsc --noEmit` → 0 errores · `npx eslint .` limpio · `npm test` y `npx playwright test` → sin regresiones · manual: abrir `/adminpanel/ical` a 360 px y 1920 px sin scroll horizontal. (Tests en 9.11.)
  - **Ref:** [plan §9.6](./plan_implementacion_v1.0.0.md) | RF-63, 64, 67 · RNF-01 · AC-101, AC-106 | D-09, D-10 | P-14
  - **Hecho (2026-10-15):** `/adminpanel/ical`, `ical-actions.ts`, `IcalSourceForm`, `SyncNowButton`, entrada "iCal" en `AdminShell`; sin scroll horizontal a 360 y 1920 px (cubierto en e2e).

- [x] **9.7 Vencimiento de Pendientes**
  - **Objetivo:** cancelar por vencimiento las Pendientes sin cobros cuyo plazo corrió desde el envío del método de pago.
  - **Depende de:** —
  - **Archivos a crear:** `lib/admin/expiry.ts`.
  - **Archivos a modificar:** —
  - **Pasos:**
    1. Abrir `lib/admin/bookings.ts` y entender por qué `changeBookingStatus` no sirve acá (limpia la marca, F7-3).
    2. `expirePendingBookings(db)`: una transacción con un `UPDATE … RETURNING` a `CANCELLED` con `cancelledByExpiry = true` donde `status = 'PENDING'`, `paymentInfoSentAt <= now() - pendingExpiryDays` y `NOT EXISTS` ningún cobro; luego `DELETE` de la `UnitOccupancy` de las ids devueltas.
    3. Una reserva sin envío registrado no vence. Devolver la cantidad. (Tests en 9.11.)
  - **Verificación:** `npx tsc --noEmit` → 0 errores · `npx eslint .` limpio · `npm test` → sin regresiones.
  - **Ref:** [plan §9.7](./plan_implementacion_v1.0.0.md) | RF-54 · AC-79, 80, 81 | D-12 | F7-3
  - **Hecho (2026-10-15):** `lib/admin/expiry.ts`: un `UPDATE … RETURNING` con el plazo de `SystemSettings` y `now()` de la base.

- [x] **9.8 Limpieza de comprobantes**
  - **Objetivo:** borrar los archivos de comprobante de más de 3 meses conservando los datos del cobro, y avisarlo en el detalle.
  - **Depende de:** —
  - **Archivos a crear:** `lib/cron/jobs.ts` (con `cleanupReceipts`).
  - **Archivos a modificar:** `app/adminpanel/reservas/[id]/page.tsx`.
  - **Pasos:**
    1. Abrir `lib/storage/receipts.ts` y `lib/admin/payments.ts`.
    2. `cleanupReceipts(db, storage)`: por cada `Payment` con `receiptPath` y `receiptUploadedAt <= now() - interval '3 months'` (hora de la base), `storage.remove(key)` y **después** `receiptPath = NULL`; si `remove` falla, la fila queda para el próximo tick (D-13, P-15).
    3. En el detalle de reserva, un cobro con `receiptUploadedAt` y sin `receiptPath` muestra "Comprobante eliminado (más de 3 meses)". (Tests en 9.11.)
  - **Verificación:** `npx tsc --noEmit` → 0 errores · `npx eslint .` limpio · `npm test` y `npx playwright test` → sin regresiones.
  - **Ref:** [plan §9.8](./plan_implementacion_v1.0.0.md) | RF-56 · AC-87 | D-13 | P-15
  - **Hecho (2026-10-15):** `cleanupReceipts` en `lib/cron/jobs.ts`; el detalle de reserva muestra "Comprobante eliminado (más de 3 meses)".

- [x] **9.9 Endpoint de cron**
  - **Objetivo:** `POST /api/cron/tick` autenticado con `CRON_SECRET` ejecuta las tareas programadas.
  - **Depende de:** 9.4, 9.7, 9.8
  - **Archivos a crear:** `lib/cron/auth.ts`, `app/api/cron/tick/route.ts`.
  - **Archivos a modificar:** `lib/cron/jobs.ts` (agregar `runJobs`), `.env.example` (comentario del uso de `CRON_SECRET`).
  - **Pasos:**
    1. Leer en `node_modules/next/dist/docs/` la guía de route handlers.
    2. `isCronAuthorized(header, secret)`: `Authorization: Bearer <secret>` con `timingSafeEqual`; sin secreto configurado → `false`.
    3. `runJobs(db)`: `syncAll(db, "CRON")`, `expirePendingBookings(db)` y `cleanupReceipts(...)`, cada una con su `try/catch`, devolviendo un resumen sin datos personales (A-V1-02: 9.10 agrega las dos restantes).
    4. `POST`: no autorizado → 401 sin datos; autorizado → resumen. No tocar `proxy.ts`. Correr `npx next typegen`.
  - **Verificación:** `npx next typegen && npx tsc --noEmit` → 0 errores · manual: `curl -i -X POST http://localhost:7777/api/cron/tick` → 401 y, con el `Authorization: Bearer` correcto (sin mostrar el secreto), 200 · `npm test` → sin regresiones. (Tests en 9.11.)
  - **Ref:** [plan §9.9](./plan_implementacion_v1.0.0.md) | RF-66 · AC-100 | D-11 | P-03 | A-V1-02
  - **Hecho (2026-10-15):** `lib/cron/auth.ts`, `POST /api/cron/tick` (401 sin cuerpo si no autoriza); `runJobs(db, storage)` devuelve solo estados `ok`/detalle de conteos, sin mensajes de error.

- [x] **9.10 Limpieza de soft locks y throttles**
  - **Objetivo:** sacar soft locks vencidos y throttles viejos en cada tick.
  - **Depende de:** 9.9
  - **⚠️ Confirmar P-04** antes de escribir código.
  - **Archivos a crear:** —
  - **Archivos a modificar:** `lib/cron/jobs.ts`.
  - **Pasos:**
    1. Anotar la respuesta de `P-04` en §5.
    2. `DELETE FROM "SoftLock" WHERE "expiresAt" <= now()` (la ocupación se borra en cascada).
    3. `DELETE FROM "LoginThrottle" WHERE "updatedAt" < now() - interval '24 hours' AND ("lockedUntil" IS NULL OR "lockedUntil" <= now())`, ajustado a lo que se confirme.
    4. Sumarlas a `runJobs` con su `try/catch`. No tocar `lib/auth/login.ts`. (Tests en 9.11.)
  - **Verificación:** `npx tsc --noEmit` → 0 errores · `npx eslint .` limpio · `npm test` → sin regresiones (los tests de login siguen en verde).
  - **Ref:** [plan §9.10](./plan_implementacion_v1.0.0.md) | RNF-07 · RF-32 | D-11 | P-04 | A-V1-02
  - **Hecho (2026-10-15):** `cleanupSoftLocks` y `cleanupThrottles` (P-04) sumadas a `runJobs`.

- [x] **9.11 Tests de la Fase 9**
  - **Objetivo:** cubrir AC-79..81, 87, 98..101 y 108 con unit, db y e2e.
  - **Depende de:** 9.1–9.10
  - **Archivos a crear:** `tests/unit/ical-parse.test.ts`, `tests/unit/ical-export.test.ts`, `tests/unit/cron-auth.test.ts`, `tests/db/ical-feed.test.ts`, `tests/db/ical-sync.test.ts`, `tests/db/expiry.test.ts`, `tests/db/cleanup.test.ts`, `tests/db/cron-tick.test.ts`, `tests/e2e/admin-ical.spec.ts`.
  - **Archivos a modificar:** `tests/db/helpers.ts` y `tests/e2e/db.ts` (helpers de fuente y de cobro con fecha de carga; limpieza).
  - **Pasos:**
    1. `ical-parse`: día completo con fin exclusivo (**AC-99**) · descarta CANCELLED, pasados y rangos inválidos · ignora `SUMMARY`/`DESCRIPTION`.
    2. `ical-export`: evento del 10/11 al 14/11 sin ningún dato personal (**AC-98**) · CRLF y fin exclusivo.
    3. `cron-auth`: solo `Bearer <CRON_SECRET>`; sin secreto rechaza todo.
    4. `ical-feed`: token válido → 200 con la reserva Confirmada (y la Pendiente) y sin soft locks (**AC-98**) · sin token, inválido o de otra forma → 404 sin cuerpo (**AC-108**) · token de 32 hex (**RNF-06**).
    5. `ical-sync` (con `fetchText` falso, sin red): evento 20/11–22/11 bloquea la unidad y baja 1 la disponibilidad (**AC-99**) · segundo sync sin duplicar y baja libera fechas · conflicto con reserva no se importa (**D-10 / P-01**) · feed caído conserva bloqueos y deja `lastError` · sync manual crea run `MANUAL` (**AC-101**) · cada corrida deja una fila (**AC-100**).
    6. `expiry`: 5 d 0 h vence con marca y libera, 4 d 23 h 59 min no (**AC-79**) · cancelación manual sin marca (**AC-80**) · con 1 cobro no vence (**AC-81**) · sin envío no vence.
    7. `cleanup`: 3 meses y 1 día borra archivo y conserva datos (**AC-87**) · menos de 3 meses no · soft locks vencidos sí y vigentes no (**RNF-07**) · throttles según `P-04`.
    8. `cron-tick`: sin Bearer o inválido → 401 sin datos; válido corre todo · si una tarea falla las demás corren.
    9. `admin-ical.spec.ts`: la URL del feed se muestra y al abrirla devuelve `text/calendar` (**AC-98**) · alta de fuente con feed local de prueba, "Sincronizar ahora" y el bloqueo aparece en el calendario (**AC-99, AC-101**).
    10. Cada test limpia lo que crea.
  - **Verificación:** `npx vitest run tests/unit/ical-parse.test.ts tests/unit/ical-export.test.ts tests/unit/cron-auth.test.ts tests/db/ical-feed.test.ts tests/db/ical-sync.test.ts tests/db/expiry.test.ts tests/db/cleanup.test.ts tests/db/cron-tick.test.ts` → todos pasan · `npx playwright test tests/e2e/admin-ical.spec.ts` → todos pasan · `npm test`, `npx playwright test`, `npx tsc --noEmit`, `npx eslint .` en verde · consulta a la base: 0 fuentes, 0 corridas, 0 solicitudes y el resto como en §3.
  - **Ref:** [plan §9.11](./plan_implementacion_v1.0.0.md) | AC-79..81, 87, 98..101, 108 · RNF-06, RNF-07 | D-07..D-13
  - **Hecho (2026-10-15):** 9 archivos de test nuevos (11 unit, 20 db, 4 e2e) + helper `icalSource`; `npm test` 206 pasan, `npx playwright test` 72 pasan; la base quedó en 0 fuentes, 0 corridas y 0 bloqueos. Sin cambios en `tests/e2e/db.ts` (no hicieron falta).

> **✅ Definition of Done — Fase 9**
> - [x] Build de release limpio, `tsc` y `eslint` sin errores, suite Vitest y Playwright al 100 %.
> - [x] El feed trae las fechas sin datos personales (**AC-98**) y sin token válido responde 404 (**AC-108**); token de 128 bits (**RNF-06**).
> - [x] La importación bloquea la unidad y baja 1 la disponibilidad (**AC-99**); "Sincronizar ahora" funciona (**AC-101**); cada corrida queda registrada (**AC-100**).
> - [x] El vencimiento respeta el borde de 5 d (**AC-79**), la cancelación manual no lleva la marca (**AC-80**) y con cobro no vence (**AC-81**).
> - [x] La limpieza de comprobantes conserva los datos del cobro (**AC-87**).
> - [x] `/api/cron/tick` sin credencial responde 401 sin datos.
> - [x] Un feed caído no libera fechas; `SUMMARY` no se persiste ni se loguea; `P-01`, `P-02` y `P-04` registrados en §5.
> - [x] La base de desarrollo quedó limpia (§3).

---

# Fase 10 — Cierre: calidad, rendimiento y documentación

> **Objetivo de la fase:** el flujo completo está verificado de punta a punta, en los anchos exigidos y con teclado, con estilo auditado, rendimiento medido, seguridad revisada y documentación al día.
> **Regla de la fase:** esta fase no agrega funcionalidad. Si una auditoría descubre un hueco de una fase anterior, **parar y avisar** antes de arreglarlo. La actualización de `AGENTS.md` va con diff aprobado por el usuario.
> **Cobertura PRD:** RNF-01, RNF-02, RNF-03, RNF-04, RNF-05 · AC-100, AC-102, AC-103, AC-104, AC-105, AC-106, AC-107 y la trazabilidad de AC-01..108

- [ ] **10.1 E2E de punta a punta**
  - **Objetivo:** un solo test recorre portal → panel → CRM → feed iCal.
  - **Depende de:** Fase 9 completa
  - **Archivos a crear:** `tests/e2e/full-flow.spec.ts`.
  - **Archivos a modificar:** `tests/e2e/db.ts` (si hace falta limpieza adicional).
  - **Pasos:**
    1. Abrir `tests/e2e/booking.spec.ts`, `admin-bookings.spec.ts` y `fixtures.ts` y reusar sus helpers.
    2. El huésped busca, reserva y confirma (documento `95xxxxxx`) → el administrador ve la reserva Pendiente, sin unidad y Web Directa → asigna unidad, registra el envío del método de pago, registra un cobro y confirma → el cliente aparece en el CRM → el feed de la unidad contiene el evento sin datos personales.
    3. Limpiar todo lo creado.
  - **Verificación:** `npx playwright test tests/e2e/full-flow.spec.ts` → pasa · `npx playwright test` → sin regresiones · base limpia (§3).
  - **Ref:** [plan §10.1](./plan_implementacion_v1.0.0.md) | AC-33, 42, 43, 66, 73, 76, 82, 88, 98

- [ ] **10.2 Anchos y teclado**
  - **Objetivo:** el flujo del portal no tiene scroll horizontal y se opera con teclado y puntero.
  - **Depende de:** —
  - **Archivos a crear:** `tests/e2e/responsive-keyboard.spec.ts`.
  - **Archivos a modificar:** —
  - **Pasos:**
    1. Recorrer el flujo del portal (búsqueda, resultados, formulario, modal) a 360, 768 y 1920 px.
    2. En cada paso: `document.documentElement.scrollWidth <= window.innerWidth`.
    3. Repetir el recorrido solo con Tab/Enter/Espacio y comprobar que cada control se acciona.
    4. Si falla, **parar y avisar** el hueco.
  - **Verificación:** `npx playwright test tests/e2e/responsive-keyboard.spec.ts` → pasa · base limpia.
  - **Ref:** [plan §10.2](./plan_implementacion_v1.0.0.md) | RNF-01 · AC-102

- [ ] **10.3 Auditoría de estilo**
  - **Objetivo:** 0 colores y 0 familias tipográficas fuera de la guía.
  - **Depende de:** —
  - **⚠️ Confirmar P-06** antes de escribir código.
  - **Archivos a crear:** `tests/e2e/style-audit.spec.ts`.
  - **Archivos a modificar:** —
  - **Pasos:**
    1. Anotar la respuesta de `P-06` en §5.
    2. Abrir `app/globals.css` y armar el conjunto permitido de colores (tokens) y de `font-family`.
    3. Recorrer el portal (y el panel, por consistencia) tomando `getComputedStyle` de cada elemento visible: `color`, `background-color`, `border-color` y `font-family`; fallar listando los que queden fuera.
  - **Verificación:** `npx playwright test tests/e2e/style-audit.spec.ts` → pasa (0 fuera de la guía).
  - **Ref:** [plan §10.3](./plan_implementacion_v1.0.0.md) | RNF-02 · AC-103 | D-14 | P-06

- [ ] **10.4 Re-verificación de requisitos transversales**
  - **Objetivo:** confirmar RNF-03, RNF-05, AC-106 y AC-107 con tests que corren en la suite.
  - **Depende de:** —
  - **Archivos a crear:** `tests/db/public-endpoints.test.ts`.
  - **Archivos a modificar:** `tests/unit/password.test.ts` (solo si falta el caso), `tests/e2e/admin.spec.ts`.
  - **Pasos:**
    1. RNF-03: correr `tests/db/create-booking.test.ts` y `tests/db/bookings-api.test.ts` (20 concurrentes → 1 reserva y 19 × 409); no reescribirlos.
    2. AC-105 / RNF-05: verificar que existe un test del prefijo `$argon2id$` y de memoria ≥ 19 MiB e iteraciones ≥ 2; si falta, agregarlo.
    3. AC-106: ampliar `admin.spec.ts` para recorrer todas las rutas del panel, incluidas las nuevas (`clientes`, `ical`), y `/api/admin/*` sin sesión: login o 401, sin datos.
    4. AC-107: `public-endpoints.test.ts` consulta `/api/availability`, `/api/bookings`, `/api/soft-lock` e `/api/ical/*` con y sin identificadores y comprueba que ninguna respuesta trae nombre, documento, nacimiento, email ni teléfono de otros huéspedes.
  - **Verificación:** `npx vitest run tests/db/create-booking.test.ts tests/db/bookings-api.test.ts tests/unit/password.test.ts tests/db/public-endpoints.test.ts` → todos pasan · `npx playwright test tests/e2e/admin.spec.ts` → pasa.
  - **Ref:** [plan §10.4](./plan_implementacion_v1.0.0.md) | RNF-03, RNF-05 · AC-41, 105, 106, 107

- [ ] **10.5 Prueba de carga**
  - **Objetivo:** medir p95 de disponibilidad y tarifas con 20 usuarios durante 5 minutos.
  - **Depende de:** —
  - **⚠️ Confirmar P-08** antes de escribir código.
  - **Archivos a crear:** `scripts/load-availability.ts`.
  - **Archivos a modificar:** `package.json` (solo si el usuario quiere un script `load`).
  - **Pasos:**
    1. Anotar la respuesta de `P-08` en §5.
    2. 20 workers en paralelo, 5 minutos, `GET /api/availability` con fechas variadas, sin dependencias nuevas.
    3. Imprimir p50, p95 y p99 y terminar con exit 1 si p95 ≥ 1,5 s.
    4. Correr contra `npm run build && npm start`, no contra `next dev`; el catálogo es el base (6 categorías, 20 unidades).
  - **Verificación:** `npx tsx scripts/load-availability.ts` → p95 < 1,5 s y exit 0.
  - **Ref:** [plan §10.5](./plan_implementacion_v1.0.0.md) | RNF-04 · AC-104 | D-15 | P-08

- [ ] **10.6 Auditoría de trazabilidad**
  - **Objetivo:** que ningún AC quede sin test o verificación manual.
  - **Depende de:** 10.1–10.4
  - **Archivos a crear:** —
  - **Archivos a modificar:** [`plan_implementacion_v1.0.0.md`](./plan_implementacion_v1.0.0.md) (matriz, con aprobación) y, si falta algún test, el archivo de test que corresponda.
  - **Pasos:**
    1. Listar los AC que aparecen en `tests/` (`grep -rhoE "AC-[0-9]+" tests | sort -u`) y compararlos con AC-01..108.
    2. Para cada AC faltante, agregar el test o registrar una verificación manual en el Checklist.
    3. Informar los huecos al usuario **antes** de agregar nada que cambie comportamiento.
  - **Verificación:** la lista de AC faltantes es vacía, o cada uno tiene una verificación manual anotada en el Checklist · `npm test` en verde.
  - **Ref:** [plan §10.6](./plan_implementacion_v1.0.0.md) | AC-01..108

- [ ] **10.7 `npm audit` y revisión de seguridad**
  - **Objetivo:** sin vulnerabilidades altas o críticas y con un informe de seguridad al usuario.
  - **Depende de:** —
  - **Archivos a crear:** —
  - **Archivos a modificar:** — (solo `package.json` y `package-lock.json` si se aprueba actualizar algo)
  - **Pasos:**
    1. `npm audit`; informar las altas y críticas y proponer el arreglo (una dependencia nueva o una actualización mayor se aprueba como `D-xx`).
    2. Revisar y reportar: `X-Forwarded-For` solo es confiable detrás de un proxy de confianza; la sesión del admin no tiene revocación en el servidor; `SESSION_SECRET` y `CRON_SECRET` largos y fuera del repo; `grep` de `console.` y `logger` sin datos personales; el fetch iCal solo acepta `http`/`https`.
    3. No cambiar alcance: los hallazgos son un informe.
  - **Verificación:** `npm audit --audit-level=high` → sin altas ni críticas sin resolver (o con la justificación aprobada) · informe entregado al usuario.
  - **Ref:** [plan §10.7](./plan_implementacion_v1.0.0.md) | RNF-05, RNF-06 · AC-107

- [ ] **10.8 Cron real durante 60 minutos**
  - **Objetivo:** comprobar que el scheduler ejecuta el tick cada ≤ 15 min.
  - **Depende de:** 9.9, 9.10
  - **⚠️ Confirmar P-03** antes de configurar nada.
  - **Archivos a crear:** — (si el usuario lo pide, un `.md` en `docs/` con los pasos del scheduler)
  - **Archivos a modificar:** —
  - **Pasos:**
    1. Anotar la respuesta de `P-03` en §5.
    2. Con el usuario, configurar el scheduler elegido para llamar a `POST /api/cron/tick` con `Authorization: Bearer` (sin mostrar `CRON_SECRET`) cada 15 min.
    3. Dejar correr 60 min.
  - **Verificación:** manual: `SELECT "startedAt" FROM "IcalSyncRun" ORDER BY 1` → ≥ 4 filas con ≤ 15 min entre dos consecutivas; después se limpian las filas de prueba.
  - **Ref:** [plan §10.8](./plan_implementacion_v1.0.0.md) | RF-66 · AC-100 | D-11 | P-03

- [ ] **10.9 Documentación**
  - **Objetivo:** `AGENTS.md`, `FASES.md` y `.env.example` reflejan el estado final.
  - **Depende de:** 10.1–10.8
  - **Archivos a crear:** —
  - **Archivos a modificar:** `AGENTS.md`, `FASES.md`, `.env.example`.
  - **Pasos:**
    1. `AGENTS.md`: agregar el comando de carga y el cron, y corregir lo que haya cambiado; **mostrar el diff al usuario y esperar su OK** antes de guardar.
    2. `FASES.md`: pasar las Fases 8–10 a completadas con sus commits y las decisiones a recordar.
    3. `.env.example`: comentar el uso de `CRON_SECRET`.
    4. Si existe `graphify-out/`: `graphify . --code-only` y `graphify cluster-only`.
    5. Dejar anotados los pendientes de producto: logo y paso a Supabase.
  - **Verificación:** diff aprobado por el usuario · `git status` muestra solo los archivos esperados · `npm test` en verde.
  - **Ref:** [plan §10.9](./plan_implementacion_v1.0.0.md) | `AGENTS.md` §3

- [ ] **10.10 Corrida final de la suite**
  - **Objetivo:** cerrar la fase con todo en verde sobre un build de release.
  - **Depende de:** 10.1–10.9
  - **Archivos a crear:** —
  - **Archivos a modificar:** —
  - **Pasos:**
    1. `npm run build`, `npx tsc --noEmit`, `npx eslint .`, `npm test`, `npx playwright test`.
    2. Confirmar que la base quedó como en §3 (incluye 0 solicitudes, fuentes y corridas).
    3. Informar el resultado (conteo de tests) y preguntar **"¿commiteo y pusheo?"**.
  - **Verificación:** los cinco comandos terminan sin errores · consulta a la base limpia.
  - **Ref:** [plan §10.10](./plan_implementacion_v1.0.0.md) | RNF-01..05 · A-V1-03

> **✅ Definition of Done — Fase 10**
> - [ ] Build de release limpio, `tsc` y `eslint` sin errores, suite Vitest y Playwright al 100 %.
> - [ ] Flujo completo de punta a punta verificado (**AC-33, 42, 43, 66, 73, 76, 82, 88, 98**).
> - [ ] 360 / 768 / 1920 px sin scroll horizontal y operable por teclado (**AC-102**); 0 fuera de la guía de estilo (**AC-103**).
> - [ ] p95 < 1,5 s con 20 usuarios durante 5 minutos (**AC-104**).
> - [ ] 20 confirmaciones concurrentes → 1 reserva y 19 × 409 (**RNF-03**); hash `$argon2id$` (**AC-105**); acceso sin sesión (**AC-106**); sin datos personales públicos (**AC-107**).
> - [ ] Ningún AC sin test ni verificación manual (10.6); `npm audit` resuelto o justificado.
> - [ ] Documentos actualizados con diff aprobado; `P-03`, `P-06` y `P-08` registrados en §5.

---

# Checklist de Verificación Pre-Release (v1.0.0)

> Se ejecuta **después de la última tarea de la Fase 10**, sobre un build de release (`npm run build && npm start`) con Postgres local corriendo, el `CRON_SECRET` configurado y la base de desarrollo limpia. **Complementa** (no reemplaza) lo que verificó cada fase; no hay checklists anteriores. Lo manual lo ejecuta o confirma el usuario.

### Compilación y tests
- [ ] `npm run build` sin errores ni warnings, `npx tsc --noEmit` y `npx eslint .` limpios.
- [ ] `npm test` y `npx playwright test` al 100 %, y la base queda como en §3.
- [ ] `npm audit --audit-level=high` sin altas ni críticas sin resolver.

### CRM (Fase 8)
- [ ] Widget: cumpleaños a 30 días entra y a 31 no; fin de año; 29/02 → 28/02 (**AC-91, AC-92, AC-93, AC-94**).
- [ ] Solicitud con fecha y "pendiente"; anonimizar reemplaza titular y acompañantes y conserva las fechas (**AC-95, AC-96**).
- [ ] Solicitud de 30 d 0 h marcada "plazo vencido" y la de 29 d 23 h no (**AC-97**).

### iCal y procesos programados (Fase 9)
- [ ] El feed trae las fechas sin ningún dato personal, con token de 128 bits, y sin token válido responde 404 (**AC-98, AC-108, RNF-06**).
- [ ] Un evento importado bloquea la unidad y baja 1 la disponibilidad; "Sincronizar ahora" lo muestra sin esperar al cron (**AC-99, AC-101**).
- [ ] Vencimiento: 5 d vence, 4 d 23 h 59 min no, con cobro no vence, cancelación manual sin marca (**AC-79, AC-80, AC-81**).
- [ ] Comprobantes de más de 3 meses borrados y datos del cobro conservados (**AC-87**).
- [ ] `curl -X POST /api/cron/tick` sin credencial → 401 sin datos.
- [ ] Manual: ≥ 4 corridas en 60 min con ≤ 15 min entre dos (**AC-100**).

### Calidad y rendimiento (Fase 10)
- [ ] 360 / 768 / 1920 px sin scroll horizontal y operable por teclado (**AC-102**).
- [ ] 0 colores y 0 familias fuera de la guía (**AC-103**).
- [ ] p95 < 1,5 s con 20 usuarios durante 5 minutos (**AC-104**).
- [ ] 20 confirmaciones sobre la última unidad → 1 reserva y 19 × 409 (**RNF-03**).
- [ ] Contraseña de admin con prefijo `$argon2id$` (**AC-105**).

### Seguridad / Transversal
- [ ] Sin sesión: toda ruta del panel y `/api/admin/*` → login o 401 sin datos (**AC-106**).
- [ ] Endpoints públicos sin datos de huéspedes (**AC-107**).
- [ ] `grep` de `console.` y `logger` sin datos personales ni contraseñas.
- [ ] Ninguna página del portal enlaza a `/adminpanel`, y el panel lleva `noindex` (**AC-49**).
- [ ] `AGENTS.md`, `FASES.md` y `.env.example` actualizados con diff aprobado.
