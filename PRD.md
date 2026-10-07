# PRD-001: Iguapé Aparts — Motor de Reservas y Sistema de Gestión (PMS)

## Contexto y Problema

La web institucional de Iguapé Aparts presenta el complejo, sus servicios y el detalle visual de cada categoría de alojamiento. Sin embargo, carece de un motor de reservas transaccional desacoplado y de un panel administrativo centralizado. Esto provoca pérdidas de conversión por fricción en la reserva manual, riesgo de *overbooking* por reservas simultáneas o canales externos (Booking, Airbnb), y desaprovechamiento de datos de huéspedes (como fechas de cumpleaños) para acciones de fidelización y promociones.

## Objetivos

Desarrollar una aplicación web unificada compuesta por:

1. Un motor de reservas público y ligero en subdominio (`reservas.iguapeaparts.com`), optimizado para conversión, con selector de fechas tipo rango, cálculo dinámico de tarifas/descuentos y formulario de huéspedes.
2. Un panel privado de administración (back-office) para la gestión del inventario (categorías y unidades físicas), control de ocupación, configuración de reglas de descuento por estadía, seguimiento de pagos y CRM de clientes.

## Requerimientos Funcionales

### Portal Público (Motor de Reservas - Subdominio)

- **RF-01:** El sistema debe permitir seleccionar las fechas de *Check-in* y *Check-out* mediante un selector de rango interactivo.
- **RF-02:** El sistema debe permitir seleccionar la cantidad de huéspedes adultos y niños.
- **RF-03:** El sistema debe preseleccionar categoría y fechas a partir de parámetros en la URL (*deep linking*: `?categoria=<slug>&checkin=AAAA-MM-DD&checkout=AAAA-MM-DD`), para enlazar directamente desde la web principal.
- **RF-04:** El sistema debe listar únicamente las categorías con al menos una unidad disponible en el rango seleccionado.
- **RF-05:** El sistema debe mostrar, para cada categoría listada, la tarifa por noche, la cantidad de noches y el monto final calculado.
- **RF-06:** El sistema debe aplicar automáticamente los descuentos por cantidad de noches según las reglas activas configuradas en el panel admin (RF-13).
- **RF-07:** El sistema debe exigir al cliente titular los campos obligatorios: Nombre, Apellido, Email, Teléfono, Tipo/Nro de Documento y Fecha de Nacimiento.
- **RF-08:** El sistema debe permitir añadir dinámicamente, de manera opcional, datos de acompañantes (Nombre, Apellido, Documento, Fecha de Nacimiento).
- **RF-09:** El sistema debe bloquear temporalmente (*soft lock*) una unidad de la categoría elegida durante 15 minutos desde que el usuario ingresa al formulario de huéspedes, y liberarla automáticamente si la reserva no se confirma en ese plazo.

### Portal Privado (Panel de Administración)

- **RF-10:** El sistema debe requerir autenticación con email y contraseña para acceder al panel privado.
- **RF-11:** El administrador debe poder crear, editar y eliminar **Categorías** (nombre, descripción breve, capacidad máxima, precio base por noche).
- **RF-12:** El administrador debe poder crear, editar y eliminar **Aparts / Unidades Físicas**, cada una asignada a una categoría.
- **RF-13:** El administrador debe poder configurar **Reglas de Descuento** (ej. a partir de X noches, aplicar Y% de descuento en el total).
- **RF-14:** El administrador debe poder crear **Temporadas / Tarifas Especiales** con fechas de inicio/fin, precio diferencial por noche y estadía mínima obligatoria.
- **RF-15:** El administrador debe poder visualizar un calendario general de ocupación por unidad física.
- **RF-16:** El administrador debe poder cambiar el estado de una reserva entre *Pendiente*, *Confirmada*, *Cancelada* y *Finalizada*.
- **RF-17:** El administrador debe poder asignar una unidad física a una reserva.
- **RF-18:** El administrador debe poder registrar bloqueos manuales de una unidad por mantenimiento o uso de propietarios.
- **RF-19:** El sistema debe registrar el origen de cada reserva (*Web Directa*, *WhatsApp*, *Booking.com*, *Airbnb*, *Mostrador*).
- **RF-20:** El administrador debe poder registrar cobros manuales (señas o totales) asociados a una reserva, indicando monto, método de pago y comprobante.
- **RF-21:** El sistema debe incluir en el CRM una base de datos de clientes con los datos del titular de cada reserva.
- **RF-22:** El sistema debe mostrar el historial de visitas de cada cliente.
- **RF-23:** El sistema debe mostrar un widget de "Próximos Cumpleañeros" con los clientes que cumplen años en los próximos 30 días, para campañas de fidelización.
- **RF-24:** El sistema debe exponer una URL de exportación iCal por cada unidad física con sus fechas ocupadas o bloqueadas.
- **RF-25:** El administrador debe poder configurar, por cada unidad física, URLs de importación iCal de OTAs externas (Booking/Airbnb), cuyos eventos el sistema debe registrar como bloqueos de esa unidad.

## Requerimientos No Funcionales

- **RNF-01:** El motor de reservas debe poder completarse sin scroll horizontal y con todos sus controles operables en anchos de pantalla de 360 px a 1920 px.
- **RNF-02:** El motor de reservas debe usar exclusivamente la paleta de colores y las familias tipográficas de la guía de estilo de la web principal.
- **RNF-03:** Ante 20 solicitudes concurrentes de confirmación sobre la última unidad disponible para las mismas fechas, el sistema debe crear exactamente 1 reserva (0 reservas duplicadas). *Enfoque previsto: transacciones con aislamiento estricto y bloqueo pesimista / restricción de exclusión de rangos en PostgreSQL.*
- **RNF-04:** La verificación de disponibilidad y el cálculo de tarifas deben responder en p95 < 1.5 s, medido en servidor, con 20 usuarios concurrentes.
- **RNF-05:** Las contraseñas de los administradores deben almacenarse con bcrypt (cost ≥ 12) o Argon2id (memoria ≥ 19 MiB, iteraciones ≥ 2).
- **RNF-06:** Las URLs de exportación iCal (RF-24) deben incluir un token aleatorio de al menos 128 bits; sin un token válido, el feed no se entrega.

## Criterios de Aceptación

> Escenarios de referencia: categoría **Deluxe** con precio base $40.000/noche; fechas en formato DD/MM/AAAA.

### Portal Público

- **AC-01 (RF-01):**
  - **Dado** que el usuario eligió *Check-in* el 10/11/2026 en el selector,
  - **Cuando** intenta elegir como *Check-out* el 08/11/2026,
  - **Entonces** el selector no permite esa fecha y mantiene solo el *Check-in* seleccionado.
- **AC-02 (RF-02):**
  - **Dado** el paso de búsqueda del portal,
  - **Cuando** el usuario selecciona 2 adultos y 1 niño y continúa,
  - **Entonces** el resumen de la reserva muestra "2 adultos, 1 niño".
- **AC-03 (RF-03):**
  - **Dado** un enlace `reservas.iguapeaparts.com/?categoria=deluxe&checkin=2026-11-10&checkout=2026-11-14`,
  - **Cuando** el usuario lo abre,
  - **Entonces** el selector muestra 10/11/2026 – 14/11/2026 y la categoría Deluxe está preseleccionada.
- **AC-04 (RF-04):**
  - **Dado** que todas las unidades de Deluxe tienen reservas confirmadas del 10/11/2026 al 14/11/2026 y la categoría Estándar tiene una unidad libre,
  - **Cuando** un usuario busca del 11/11/2026 al 13/11/2026,
  - **Entonces** el listado muestra Estándar y no muestra Deluxe.
- **AC-05 (RF-05):**
  - **Dado** Deluxe sin temporada activa ni regla de descuento aplicable,
  - **Cuando** un usuario busca 3 noches,
  - **Entonces** la tarjeta de Deluxe muestra "$40.000/noche", "3 noches" y "Total: $120.000".
- **AC-06 (RF-06, RF-13):**
  - **Dado** una regla activa de "15% de descuento a partir de 5 noches" y Deluxe sin temporada activa,
  - **Cuando** un usuario selecciona 5 noches en Deluxe,
  - **Entonces** el resumen muestra Subtotal: $200.000, Descuento (15%): -$30.000 y Total: $170.000.
- **AC-07 (RF-07):** *(se ejecuta una vez por cada uno de los 6 campos obligatorios)*
  - **Dado** un formulario de titular con todos los campos completos excepto uno,
  - **Cuando** el usuario intenta confirmar,
  - **Entonces** el envío se bloquea, no se crea la reserva y el campo faltante queda resaltado.
- **AC-08 (RF-08):**
  - **Dado** un formulario de titular completo sin acompañantes cargados,
  - **Cuando** el usuario confirma,
  - **Entonces** la reserva se crea correctamente.
- **AC-09 (RF-08):**
  - **Dado** un formulario de titular completo en el que el usuario agregó 2 acompañantes con sus datos,
  - **Cuando** confirma la reserva,
  - **Entonces** la reserva queda registrada con los 2 acompañantes asociados, visibles en el panel admin.
- **AC-10 (RF-09):**
  - **Dado** que Deluxe tiene 1 sola unidad libre del 10/11/2026 al 12/11/2026 y el usuario A ingresó al formulario de huéspedes hace 5 minutos sin confirmar,
  - **Cuando** el usuario B busca esas mismas fechas,
  - **Entonces** Deluxe no aparece en el listado de B.
- **AC-11 (RF-09):**
  - **Dado** el mismo escenario, pero el usuario A ingresó al formulario hace más de 15 minutos sin confirmar,
  - **Cuando** el usuario B busca esas mismas fechas,
  - **Entonces** Deluxe aparece en el listado de B.
- **AC-12 (RNF-03):**
  - **Dado** que Deluxe tiene 1 sola unidad libre del 10/11/2026 al 12/11/2026,
  - **Cuando** se envían 20 solicitudes concurrentes de confirmación para esas fechas,
  - **Entonces** exactamente 1 solicitud tiene éxito, las otras 19 reciben HTTP 409 (Conflicto) con el mensaje de fechas no disponibles, y existe 1 sola reserva en la base.

### Panel de Administración

- **AC-13 (RF-10):**
  - **Dado** un administrador registrado,
  - **Cuando** ingresa su email y su contraseña correcta,
  - **Entonces** accede al panel.
- **AC-14 (RF-10):**
  - **Dado** un administrador registrado,
  - **Cuando** ingresa su email con una contraseña incorrecta,
  - **Entonces** el acceso se rechaza y permanece en la pantalla de login.
- **AC-15 (RF-11):**
  - **Dado** un administrador autenticado,
  - **Cuando** crea la categoría "Suite" con descripción, capacidad máxima 4 y precio base $60.000,
  - **Entonces** "Suite" aparece en el catálogo del panel con esos datos.
- **AC-16 (RF-12):**
  - **Dada** la categoría Deluxe con 2 unidades,
  - **Cuando** el administrador crea la unidad "Apart 7" asignada a Deluxe,
  - **Entonces** Deluxe pasa a tener 3 unidades y "Apart 7" aparece en el calendario de ocupación.
- **AC-17 (RF-14):**
  - **Dada** una temporada alta del 20/12/2026 al 28/02/2027 con estadía mínima de 4 noches,
  - **Cuando** un cliente intenta reservar 2 noches dentro de ese rango,
  - **Entonces** el sistema muestra un mensaje indicando el mínimo de 4 noches y no permite continuar.
- **AC-18 (RF-14):**
  - **Dada** esa temporada con precio diferencial de $55.000/noche para Deluxe y sin reglas de descuento activas,
  - **Cuando** un cliente busca 4 noches dentro del rango,
  - **Entonces** Deluxe muestra "$55.000/noche" y "Total: $220.000".
- **AC-19 (RF-15):**
  - **Dada** una reserva confirmada en Apart 3 del 10/11/2026 al 14/11/2026,
  - **Cuando** el administrador abre el calendario de noviembre,
  - **Entonces** Apart 3 figura ocupado las noches del 10 al 13 y libre el 14.
- **AC-20 (RF-16):**
  - **Dada** una reserva *Pendiente*,
  - **Cuando** el administrador la cambia a *Confirmada*,
  - **Entonces** la reserva queda en estado *Confirmada* en el listado y en el calendario.
- **AC-21 (RF-16, RF-04):**
  - **Dada** una reserva *Confirmada* sobre la última unidad libre de Deluxe del 10/11/2026 al 12/11/2026,
  - **Cuando** el administrador la cambia a *Cancelada*,
  - **Entonces** Deluxe vuelve a aparecer disponible para esas fechas en el portal público.
- **AC-22 (RF-17):**
  - **Dada** una reserva *Confirmada* en Deluxe sin unidad asignada,
  - **Cuando** el administrador le asigna Apart 3,
  - **Entonces** la reserva aparece en la fila de Apart 3 del calendario.
- **AC-23 (RF-17):**
  - **Dado** que Apart 3 ya tiene otra reserva confirmada en fechas superpuestas,
  - **Cuando** el administrador intenta asignarle una segunda reserva,
  - **Entonces** el sistema rechaza la asignación con un mensaje de superposición.
- **AC-24 (RF-18):**
  - **Dado** que Apart 5 está libre del 01/12/2026 al 05/12/2026,
  - **Cuando** el administrador registra un bloqueo por mantenimiento para esas fechas,
  - **Entonces** Apart 5 figura bloqueado en el calendario y la disponibilidad de su categoría para esas fechas se reduce en 1 unidad.
- **AC-25 (RF-19):**
  - **Dada** una reserva confirmada desde el portal público,
  - **Cuando** el administrador abre su detalle,
  - **Entonces** el origen figura como *Web Directa*.
- **AC-26 (RF-20):**
  - **Dada** una reserva con total de $170.000,
  - **Cuando** el administrador registra una seña de $50.000 por transferencia con su comprobante,
  - **Entonces** el detalle de la reserva lista ese cobro con monto, método de pago y comprobante.
- **AC-27 (RF-21):**
  - **Dada** una reserva confirmada cuyo titular es un cliente nuevo,
  - **Cuando** el administrador abre el CRM,
  - **Entonces** el cliente aparece con nombre, apellido, email, teléfono, documento y fecha de nacimiento.
- **AC-28 (RF-22):**
  - **Dado** un cliente con 2 reservas *Finalizadas* registradas con el mismo documento,
  - **Cuando** el administrador abre su ficha en el CRM,
  - **Entonces** el historial lista ambas estadías con sus fechas.
- **AC-29 (RF-23):**
  - **Dado** que hoy es 01/10/2026, el cliente A cumple años el 15/10 y el cliente B el 15/11,
  - **Cuando** el administrador abre el widget "Próximos Cumpleañeros",
  - **Entonces** A aparece con su email y teléfono, y B no aparece.
- **AC-30 (RF-23):**
  - **Dado** que hoy es 20/12/2026 y un cliente cumple años el 05/01,
  - **Cuando** el administrador abre el widget,
  - **Entonces** ese cliente aparece en el listado.
- **AC-31 (RF-24, RNF-06):**
  - **Dada** una reserva confirmada en Apart 3 del 10/11/2026 al 14/11/2026,
  - **Cuando** se consulta la URL de exportación iCal de Apart 3 con su token válido,
  - **Entonces** el feed contiene un evento del 10/11/2026 al 14/11/2026 y no incluye nombre ni datos personales del huésped.
- **AC-32 (RF-25):**
  - **Dada** una URL de importación de Booking configurada para Apart 3 cuyo feed contiene un evento del 20/11/2026 al 22/11/2026,
  - **Cuando** se ejecuta la sincronización,
  - **Entonces** Apart 3 figura bloqueado esas fechas y la disponibilidad de su categoría se reduce en 1 unidad.

### No Funcionales

- **AC-33 (RNF-01):**
  - **Dado** el portal público,
  - **Cuando** se completa el flujo de reserva en anchos de 360 px, 768 px y 1920 px,
  - **Entonces** en ninguno aparece scroll horizontal y todos los controles son operables.
- **AC-34 (RNF-02):**
  - **Dada** la guía de estilo de la web principal,
  - **Cuando** se auditan los estilos computados del portal,
  - **Entonces** todos los colores y familias tipográficas usados pertenecen a esa guía.
- **AC-35 (RNF-04):**
  - **Dado** un entorno de staging con el catálogo cargado,
  - **Cuando** 20 usuarios concurrentes consultan disponibilidad y tarifas durante 5 minutos,
  - **Entonces** el p95 del tiempo de respuesta medido en servidor es menor a 1.5 s.
- **AC-36 (RNF-05):**
  - **Dado** un administrador recién creado,
  - **Cuando** se inspecciona su registro en la base de datos,
  - **Entonces** el campo de contraseña empieza con `$2b$12$` (o un cost mayor) o con `$argon2id$`, y no contiene la contraseña en claro.

### Control de Acceso

- **AC-37 (RF-10):**
  - **Dado** un usuario sin sesión iniciada,
  - **Cuando** solicita cualquier ruta del panel o cualquier endpoint de la API administrativa,
  - **Entonces** recibe HTTP 401 (API) o es redirigido al login (UI), y la respuesta no contiene datos.
- **AC-38 (RF-07, RF-08):**
  - **Dado** que existen reservas de otros huéspedes,
  - **Cuando** un visitante del portal público consulta cualquier endpoint público, con o sin identificadores de reserva o cliente en la solicitud,
  - **Entonces** ninguna respuesta incluye nombre, documento, fecha de nacimiento, email ni teléfono de otros huéspedes.
- **AC-39 (RNF-06):**
  - **Dada** la URL de exportación iCal de Apart 3,
  - **Cuando** se solicita sin token o con un token inválido,
  - **Entonces** el sistema responde HTTP 404 y no entrega el feed.

## Fuera de Alcance

- Procesamiento automatizado de cobros mediante pasarelas de pago con webhooks en tiempo real (MercadoPago/Stripe) en esta primera versión; las señas se registran manualmente tras recibir el comprobante.
- Integración vía API directa bidireccional de Channel Manager oficial (la sincronización con Booking/Airbnb se gestiona mediante feeds de iCal y carga manual).
- Sistema de login y contraseñas para clientes finales (reservan siempre en modalidad de usuario invitado).
- Gestión de inventario de consumos internos (frigobar, amenities de pago en el complejo).
- Múltiples roles o permisos diferenciados en el panel: la V1 tiene un único rol de administrador.
- Envío de emails automáticos al huésped (confirmación, recordatorios).
- Cancelación de reservas por parte del huésped: las cancelaciones las realiza el administrador (RF-16).

## Riesgos y Dependencias

### Riesgos

- **Riesgo:** Desfase temporal en la actualización de calendarios vía iCal con plataformas externas.
  **Mitigación:** Ejecución frecuente de la tarea de sincronización (cada 15 minutos) y posibilidad de forzar sincronización manual desde el panel admin.
- **Riesgo:** Bloqueos temporales abandonados que reducen el inventario visible.
  **Mitigación:** Expiración automática estricta del *soft lock* a los 15 minutos exactos mediante tareas programadas o validación *on-the-fly*.

### Dependencias

- Servicio de base de datos relacional (PostgreSQL) con soporte para exclusión de rangos de fechas.
- Servidor de tareas en segundo plano (*cron jobs*) para la sincronización de calendarios externos iCal.

### Decisiones Abiertas

- **DA-01 (RF-16):** ¿Qué transiciones de estado se permiten? (ej. ¿se puede pasar de *Cancelada* a *Confirmada*?).
- **DA-02 (RF-14):** ¿Qué precio y qué estadía mínima aplican cuando una estadía cruza el borde de una temporada?
- **DA-03 (RF-09):** ¿Qué ve el usuario si su *soft lock* vence mientras completa el formulario? ¿Conserva los datos cargados?
- **DA-04 (RF-02, RF-04):** ¿El listado filtra las categorías cuya capacidad máxima es menor a la cantidad de huéspedes seleccionada?
- **DA-05 (RF-19):** Los orígenes *WhatsApp*, *Mostrador*, *Booking.com* y *Airbnb* suponen reservas creadas fuera del portal, pero ningún RF permite al administrador dar de alta una reserva desde el panel; y las reservas de OTAs ingresan por iCal como bloqueos (RF-25), no como reservas.
- **DA-06 (RF-21, RF-22):** ¿Con qué dato se identifica a un mismo cliente entre reservas? (supuesto actual: Tipo/Nro de Documento).
- **DA-07 (RF-11, RF-12):** ¿Qué ocurre al eliminar una categoría o unidad con reservas futuras?
- **DA-08 (RF-20):** ¿El "comprobante" es un archivo adjunto o un número de referencia?
