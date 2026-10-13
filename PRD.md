# PRD-001: Iguapé Aparts — Motor de Reservas y Sistema de Gestión (PMS)

> Versión 2 (borrador para auditoría). Deriva de `PRD.md`, que no se modifica. Los puntos marcados **[A CONFIRMAR]** son interpretaciones que requieren validación del autor antes de dar el documento por cerrado.

## Contexto y Problema

La web institucional de Iguapé Aparts presenta el complejo, sus servicios y el detalle visual de cada categoría de alojamiento. Sin embargo, carece de un motor de reservas transaccional desacoplado y de un panel administrativo centralizado. Esto provoca pérdidas de conversión por fricción en la reserva manual, riesgo de *overbooking* por reservas simultáneas o por canales externos (Booking, Airbnb), y desaprovechamiento de datos de huéspedes (como fechas de cumpleaños) para acciones de fidelización.

En V1 los cobros no se procesan online: un empleado contacta al huésped, le envía el método de pago y el administrador registra el cobro a mano.

### Personas

- **Huésped:** persona que reserva desde el portal público como invitado, sin login. Necesita ver disponibilidad y precio final en su moneda (ARS o USD) y reservar sin fricción.
- **Administrador:** opera el panel privado (inventario, tarifas, reservas, cobros, CRM). Es el único rol de V1.
- **Recepcionista / staff:** contacta a los huéspedes con reservas *Pendientes* y envía el método de pago. Necesita saber a qué reservas contactar y cuáles vencen. En V1 usa el rol de administrador.
- **Dueño / propietario:** consulta la ocupación y bloquea unidades por uso propio. En V1 usa el rol de administrador.

## Objetivos

Desarrollar una aplicación web unificada compuesta por:

1. Un motor de reservas público en subdominio (`reservas.iguapeaparts.com`) que permita al huésped elegir fechas, ver el precio final con descuentos en ARS o USD y dejar sus datos para que el complejo lo contacte.
2. Un panel privado (`/adminpanel`) que permita gestionar el inventario (categorías y unidades), las tarifas y descuentos, el ciclo de vida de cada reserva (de *Pendiente* a *Finalizada*), los cobros manuales y un CRM de clientes.
3. Eliminar el *overbooking* tanto entre reservas web como contra los canales externos sincronizados por iCal.

## Requerimientos Funcionales

### Portal Público (Motor de Reservas)

- **RF-01:** El sistema debe permitir seleccionar *Check-in* y *Check-out* mediante un selector de rango interactivo.
- **RF-02:** El sistema debe permitir seleccionar la cantidad de huéspedes adultos y niños.
- **RF-03:** El sistema debe exigir al menos 1 huésped adulto para continuar.
- **RF-04:** El sistema debe excluir del listado las categorías cuya capacidad máxima sea menor a la suma de adultos y niños seleccionados.
- **RF-05:** El sistema debe preseleccionar las fechas a partir de los parámetros de URL `checkin` y `checkout` (formato `AAAA-MM-DD`).
- **RF-06:** El sistema debe preseleccionar la categoría a partir del parámetro de URL `categoria=<slug>`.
- **RF-07:** El sistema debe ignorar, sin mostrar error, los parámetros de URL inválidos y dejar vacío el campo correspondiente. **[A CONFIRMAR]**
- **RF-08:** El sistema debe rechazar fechas que incumplan cualquiera de estas reglas: *Check-in* anterior a hoy, estadía menor a 1 noche, estadía mayor al máximo de noches configurado, o *Check-in* posterior al máximo de anticipación configurado.
- **RF-09:** El sistema debe listar únicamente las categorías con al menos una unidad disponible en el rango seleccionado.
- **RF-10:** El sistema debe permitir al huésped elegir la moneda de visualización (ARS o USD); todo el flujo se muestra en la moneda elegida.
- **RF-11:** El sistema debe mostrar, para cada categoría listada, la tarifa por noche. Si la estadía incluye noches con precios distintos, debe mostrar el precio de cada noche. **[A CONFIRMAR]**
- **RF-12:** El sistema debe mostrar, para cada categoría listada, la cantidad de noches.
- **RF-13:** El sistema debe mostrar, para cada categoría listada, el monto final de la estadía.
- **RF-14:** El sistema debe calcular el precio de cada noche con el precio de la temporada que contiene esa noche, o con el precio base si ninguna temporada la contiene.
- **RF-15:** El sistema debe exigir la estadía mínima de una temporada cuando al menos una noche de la estadía cae dentro de ella, y no permitir continuar si no se cumple.
- **RF-16:** El sistema debe aplicar al total de la estadía el descuento de mayor porcentaje entre las reglas activas cuyo mínimo de noches se cumple; los descuentos no se acumulan.
- **RF-17:** El sistema debe exigir al titular los campos Nombre, Apellido, Email, Teléfono, Tipo/Nro de Documento y Fecha de Nacimiento.
- **RF-18:** El sistema debe exigir que el titular tenga 18 años cumplidos o más a la fecha de hoy.
- **RF-19:** El sistema debe validar que el email del titular tenga formato `usuario@dominio.tld`.
- **RF-20:** El sistema debe permitir elegir el país del teléfono y anteponer automáticamente su prefijo (`+XX`) al número.
- **RF-21:** El sistema debe exigir que el número de teléfono (sin prefijo) tenga solo dígitos, entre 6 y 12.
- **RF-22:** El sistema debe validar el documento según su tipo: DNI con 7 u 8 dígitos; Pasaporte alfanumérico de 6 a 9 caracteres.
- **RF-23:** El sistema debe permitir añadir, de forma opcional, acompañantes (Nombre, Apellido, Documento, Fecha de Nacimiento).
- **RF-24:** El sistema debe mostrar, al completar el formulario, un modal con el número de teléfono completo y un aviso de contacto por WhatsApp, con los botones *Confirmar* y *Volver*.
- **RF-25:** El sistema debe bloquear temporalmente (*soft lock*) una unidad de la categoría elegida durante 15 minutos desde que el usuario ingresa al formulario de huéspedes.
- **RF-26:** El sistema debe ignorar, en el cálculo de disponibilidad, todo *soft lock* cuyo plazo de 15 minutos venció.
- **RF-27:** El sistema debe intentar renovar el *soft lock* vencido al confirmar, conservando los datos cargados; si la unidad ya fue tomada, debe informarlo sin borrar esos datos.
- **RF-28:** El sistema debe crear la reserva en estado *Pendiente* al confirmar el huésped en el modal.
- **RF-29:** El sistema debe registrar *Web Directa* como origen de toda reserva creada desde el portal.
- **RF-30:** El sistema debe redirigir a `/` cualquier ruta inexistente.

### Portal Privado (Panel de Administración)

- **RF-31:** El sistema debe requerir autenticación con email y contraseña para acceder al panel.
- **RF-32:** El sistema debe bloquear el login por 15 minutos tras 3 intentos fallidos, de forma independiente por IP y por email.
- **RF-33:** El sistema debe servir el panel con `noindex` y sin enlaces hacia él desde el portal público.
- **RF-34:** El administrador debe poder crear categorías (nombre, descripción breve, capacidad máxima, precio base por noche en ARS y en USD).
- **RF-35:** El administrador debe poder editar categorías.
- **RF-36:** El administrador debe poder eliminar categorías sin reservas *Pendiente* o *Confirmada* futuras.
- **RF-37:** El administrador debe poder crear unidades físicas, cada una asignada a una categoría.
- **RF-38:** El administrador debe poder editar unidades físicas.
- **RF-39:** El administrador debe poder eliminar unidades físicas sin reservas *Pendiente* o *Confirmada* futuras.
- **RF-40:** El administrador debe poder crear reglas de descuento (a partir de X noches, Y% sobre el total).
- **RF-41:** El administrador debe poder editar reglas de descuento.
- **RF-42:** El administrador debe poder activar y desactivar reglas de descuento.
- **RF-43:** El administrador debe poder crear temporadas (fechas de inicio y fin, precio por noche en ARS y en USD por categoría, estadía mínima).
- **RF-44:** El administrador debe poder editar temporadas.
- **RF-45:** El administrador debe poder eliminar temporadas.
- **RF-46:** El administrador debe poder modificar los parámetros del sistema, persistidos en la base de datos: plazo de aviso sin contacto (24 h), plazo de vencimiento de *Pendiente* (5 días), máximo de noches por reserva (30), máximo de anticipación (12 meses) y plazo de anonimización (30 días).
- **RF-47:** El administrador debe poder visualizar un calendario de ocupación por unidad física.
- **RF-48:** El administrador debe poder cambiar el estado de una reserva solo mediante estas transiciones: *Pendiente*→*Confirmada*, *Pendiente*→*Cancelada*, *Confirmada*→*Cancelada*, *Confirmada*→*Finalizada*, *Cancelada*→*Pendiente* o *Confirmada*, y *Finalizada*→cualquier otro estado.
- **RF-49:** El sistema debe rechazar con HTTP 409 un cambio de estado que deje a *Pendiente* o *Confirmada* una reserva sin disponibilidad, dejando la reserva en su estado anterior.
- **RF-50:** El administrador debe poder asignar una unidad física a una reserva.
- **RF-51:** El administrador debe poder registrar bloqueos manuales de una unidad por mantenimiento o uso de propietarios.
- **RF-52:** El administrador debe poder registrar en una reserva *Pendiente* que ya se envió el método de pago al huésped.
- **RF-53:** El sistema debe mostrar al administrador, al iniciar sesión, las reservas *Pendiente* sin envío de método de pago registrado transcurrido el plazo de aviso.
- **RF-54:** El sistema debe cancelar automáticamente la reserva *Pendiente* sin cobros cuando transcurre el plazo de vencimiento desde el registro del envío del método de pago, y debe marcarla como "cancelada por vencimiento".
- **RF-55:** El administrador debe poder registrar cobros manuales asociados a una reserva, indicando monto, moneda (ARS o USD), método de pago y comprobante (referencia y/o archivo PDF, JPG, JPEG o PNG de hasta 10 MB; al menos uno de los dos).
- **RF-56:** El sistema debe eliminar automáticamente los archivos de comprobante a los 3 meses de su carga. **[A CONFIRMAR: el plazo se cuenta desde la carga]**
- **RF-57:** El sistema debe registrar en el CRM al titular de cada reserva, identificado por Tipo y Nro de Documento.
- **RF-58:** El sistema debe actualizar los datos de contacto de un cliente existente con los de su última reserva.
- **RF-59:** El sistema debe mostrar el historial de visitas de cada cliente.
- **RF-60:** El sistema debe mostrar un widget de "Próximos Cumpleañeros" con los clientes que cumplen años en los próximos 30 días.
- **RF-61:** El administrador debe poder registrar la solicitud de anonimización de un cliente con su fecha. **[A CONFIRMAR]**
- **RF-62:** El administrador debe poder anonimizar los datos personales de un cliente.
- **RF-63:** El sistema debe exponer una URL de exportación iCal por unidad física con sus fechas ocupadas o bloqueadas.
- **RF-64:** El administrador debe poder configurar, por unidad física, URLs de importación iCal de OTAs.
- **RF-65:** El sistema debe registrar los eventos importados por iCal como bloqueos de la unidad.
- **RF-66:** El sistema debe ejecutar la sincronización iCal automáticamente cada 15 minutos.
- **RF-67:** El administrador debe poder ejecutar la sincronización iCal manualmente desde el panel.

## Requerimientos No Funcionales

- **RNF-01:** El motor de reservas debe completarse con 0 px de scroll horizontal y todos sus controles operables en anchos de 360 px a 1920 px.
- **RNF-02:** El 100% de los colores y familias tipográficas del portal debe pertenecer a la guía de estilo de la web principal. **[A CONFIRMAR: ubicación del documento de la guía]**
- **RNF-03:** Ante 20 solicitudes concurrentes de confirmación sobre la última unidad disponible para las mismas fechas, el sistema debe crear exactamente 1 reserva y responder HTTP 409 a las otras 19.
- **RNF-04:** La verificación de disponibilidad y el cálculo de tarifas deben responder con p95 < 1,5 s, medido en servidor, con 20 usuarios concurrentes durante 5 minutos, sobre un catálogo de 6 categorías y 20 unidades (catálogo de prueba, supuesto).
- **RNF-05:** Las contraseñas de los administradores deben almacenarse con Argon2id (memoria ≥ 19 MiB, iteraciones ≥ 2).
- **RNF-06:** Las URLs de exportación iCal deben incluir un token aleatorio de al menos 128 bits; sin token válido responden HTTP 404.
- **RNF-07:** El *soft lock* debe expirar con tolerancia de 0 s, tomando como referencia la hora del servidor de base de datos.
- **RNF-08:** Una solicitud de anonimización no completada tras el plazo configurado (30 días) debe quedar marcada como vencida para el administrador. **[A CONFIRMAR]**
- **RNF-09:** El cálculo de "hoy" debe usar la zona horaria `America/Argentina/Buenos_Aires`.

## Criterios de Aceptación

> Escenarios de referencia: categoría **De Luxe** con precio base $40.000/noche (ARS) y USD 40/noche (valor de ejemplo); fechas DD/MM/AAAA; "hoy" es 01/10/2026 salvo indicación. Catálogo: De Luxe (5), Premium (5), Superior (4), Loft (2), King Suite (2), Classic (2), capacidad máxima entre paréntesis.

### Portal Público

- **AC-01 (RF-01):**
  - **Dado** que el usuario eligió *Check-in* el 10/11/2026,
  - **Cuando** intenta elegir *Check-out* el 08/11/2026,
  - **Entonces** el selector no permite esa fecha y mantiene solo el *Check-in* seleccionado.
- **AC-02 (RF-01, RF-12):**
  - **Dado** el selector de rango,
  - **Cuando** el usuario elige 10/11/2026 y 14/11/2026,
  - **Entonces** el selector muestra "10/11/2026 – 14/11/2026" y "4 noches".
- **AC-03 (RF-02):**
  - **Dado** el paso de búsqueda,
  - **Cuando** el usuario selecciona 2 adultos y 1 niño y continúa,
  - **Entonces** el resumen muestra "2 adultos, 1 niño".
- **AC-04 (RF-03):**
  - **Dado** 0 adultos y 1 niño seleccionados,
  - **Cuando** el usuario intenta continuar,
  - **Entonces** no avanza y se muestra el mensaje "Se requiere al menos 1 adulto".
- **AC-05 (RF-04):**
  - **Dado** Loft (capacidad 2) y De Luxe (capacidad 5) con unidades libres,
  - **Cuando** el usuario busca con 2 adultos y 1 niño,
  - **Entonces** el listado muestra De Luxe y no muestra Loft.
- **AC-06 (RF-05):**
  - **Dado** el enlace `/?checkin=2026-11-10&checkout=2026-11-14`,
  - **Cuando** el usuario lo abre,
  - **Entonces** el selector muestra 10/11/2026 – 14/11/2026.
- **AC-07 (RF-06):**
  - **Dado** el enlace `/?categoria=de-luxe`,
  - **Cuando** el usuario lo abre,
  - **Entonces** la categoría De Luxe queda preseleccionada.
- **AC-08 (RF-07):**
  - **Dado** el enlace `/?checkin=2026-13-45&categoria=inexistente`,
  - **Cuando** el usuario lo abre,
  - **Entonces** el selector de fechas queda vacío, ninguna categoría queda preseleccionada y no se muestra mensaje de error.
- **AC-09 (RF-08, RNF-09):**
  - **Dado** que hoy es 01/10/2026,
  - **Cuando** el usuario elige *Check-in* 30/09/2026,
  - **Entonces** el selector no permite la fecha; con *Check-in* 01/10/2026 sí la permite.
- **AC-10 (RF-08, RNF-09):**
  - **Dado** que son las 23:30 del 01/10/2026 en Buenos Aires (02:30 UTC del 02/10),
  - **Cuando** el usuario elige *Check-in* 01/10/2026,
  - **Entonces** el selector permite la fecha.
- **AC-11 (RF-08):**
  - **Dado** *Check-in* 10/11/2026,
  - **Cuando** el usuario elige *Check-out* 10/11/2026,
  - **Entonces** el selector no permite esa fecha (mínimo 1 noche).
- **AC-12 (RF-08):**
  - **Dado** un máximo de 30 noches,
  - **Cuando** el usuario elige 31 noches,
  - **Entonces** se rechaza con el mensaje "El máximo es de 30 noches"; con 30 noches se acepta.
- **AC-13 (RF-08):**
  - **Dado** un máximo de anticipación de 12 meses y hoy 01/10/2026,
  - **Cuando** el usuario elige *Check-in* 02/10/2027,
  - **Entonces** se rechaza; con *Check-in* 01/10/2027 se acepta.
- **AC-14 (RF-09):**
  - **Dado** que todas las unidades de De Luxe tienen reservas *Confirmadas* del 10/11/2026 al 14/11/2026 y Classic tiene una unidad libre,
  - **Cuando** un usuario busca del 11/11/2026 al 13/11/2026,
  - **Entonces** el listado muestra Classic y no muestra De Luxe.
- **AC-15 (RF-09):**
  - **Dado** que De Luxe tiene una sola unidad y una reserva *Pendiente* del 10/11/2026 al 12/11/2026,
  - **Cuando** un usuario busca esas fechas,
  - **Entonces** De Luxe no aparece en el listado.
- **AC-16 (RF-09):**
  - **Dado** una reserva *Confirmada* del 10/11/2026 al 14/11/2026 sobre la última unidad de De Luxe,
  - **Cuando** un usuario busca del 14/11/2026 al 16/11/2026,
  - **Entonces** De Luxe aparece en el listado.
- **AC-17 (RF-10):**
  - **Dado** el listado con De Luxe en ARS,
  - **Cuando** el usuario cambia la moneda a USD,
  - **Entonces** De Luxe muestra "USD 40/noche" y todos los montos del flujo pasan a USD.
- **AC-18 (RF-11, RF-12, RF-13):**
  - **Dado** De Luxe sin temporada ni regla de descuento aplicable,
  - **Cuando** un usuario busca 3 noches,
  - **Entonces** la tarjeta muestra "$40.000/noche", "3 noches" y "Total: $120.000".
- **AC-19 (RF-14):**
  - **Dada** una temporada del 20/12/2026 al 28/02/2027 con $55.000/noche para De Luxe y sin reglas de descuento,
  - **Cuando** un usuario busca 4 noches dentro del rango,
  - **Entonces** De Luxe muestra "$55.000/noche" y "Total: $220.000".
- **AC-20 (RF-14, RF-13):**
  - **Dada** esa temporada,
  - **Cuando** un usuario busca del 18/12/2026 al 22/12/2026 (noches 18, 19, 20 y 21),
  - **Entonces** el total es $190.000 (2 × $40.000 + 2 × $55.000).
- **AC-21 (RF-15):**
  - **Dada** esa temporada con estadía mínima de 4 noches,
  - **Cuando** un usuario intenta reservar 2 noches del 21/12/2026 al 23/12/2026,
  - **Entonces** se muestra "La estadía mínima es de 4 noches" y no puede continuar.
- **AC-22 (RF-15):**
  - **Dada** esa temporada,
  - **Cuando** un usuario busca del 18/12/2026 al 20/12/2026 (2 noches, ninguna en temporada),
  - **Entonces** puede continuar; y del 19/12/2026 al 21/12/2026 (una noche en temporada) no puede continuar.
- **AC-23 (RF-16):**
  - **Dada** una regla activa de "15% a partir de 5 noches" y De Luxe sin temporada,
  - **Cuando** un usuario selecciona 5 noches,
  - **Entonces** el resumen muestra Subtotal: $200.000, Descuento (15%): -$30.000 y Total: $170.000.
- **AC-24 (RF-16):**
  - **Dadas** las reglas activas "10% desde 3 noches" y "15% desde 5 noches",
  - **Cuando** un usuario selecciona 6 noches en De Luxe sin temporada,
  - **Entonces** se aplica solo el 15%: Subtotal $240.000, Descuento (15%) -$36.000, Total $204.000.
- **AC-25 (RF-16):**
  - **Dadas** esas mismas reglas,
  - **Cuando** un usuario selecciona 4 noches,
  - **Entonces** se aplica solo el 10%: Subtotal $160.000, Descuento (10%) -$16.000, Total $144.000.
- **AC-26 (RF-17):** *(se ejecuta una vez por cada uno de los 6 campos obligatorios)*
  - **Dado** un formulario con todos los campos completos excepto uno,
  - **Cuando** el usuario intenta continuar,
  - **Entonces** no se abre el modal, no se crea la reserva y el campo faltante tiene `aria-invalid="true"` y un mensaje de error visible asociado.
- **AC-27 (RF-18):**
  - **Dado** que hoy es 01/10/2026,
  - **Cuando** el titular ingresa fecha de nacimiento 02/10/2008 (17 años),
  - **Entonces** el envío se bloquea; con 01/10/2008 (18 años exactos) se permite.
- **AC-28 (RF-19):**
  - **Dado** un formulario completo,
  - **Cuando** el email es "juan@",
  - **Entonces** el envío se bloquea; con "juan@mail.com" se permite.
- **AC-29 (RF-20):**
  - **Dado** el campo de teléfono,
  - **Cuando** el usuario elige Argentina,
  - **Entonces** se muestra "+54" antepuesto al campo del número.
- **AC-30 (RF-21):**
  - **Dado** un país elegido,
  - **Cuando** el número tiene 5 dígitos, 13 dígitos o contiene letras,
  - **Entonces** el envío se bloquea; con 6 y con 12 dígitos se permite.
- **AC-31 (RF-22):**
  - **Dado** el tipo DNI,
  - **Cuando** el número tiene 6 dígitos, 9 dígitos o contiene letras,
  - **Entonces** el envío se bloquea; con 7 y con 8 dígitos se permite.
- **AC-32 (RF-22):**
  - **Dado** el tipo Pasaporte,
  - **Cuando** el número tiene 5 caracteres o 10 caracteres,
  - **Entonces** el envío se bloquea; con 6 y con 9 caracteres alfanuméricos se permite.
- **AC-33 (RF-23, RF-28):**
  - **Dado** un formulario completo sin acompañantes,
  - **Cuando** el usuario confirma en el modal,
  - **Entonces** existe 1 reserva nueva en la base con 0 acompañantes.
- **AC-34 (RF-23):**
  - **Dado** un formulario completo con 2 acompañantes cargados,
  - **Cuando** el usuario confirma en el modal,
  - **Entonces** la reserva queda con 2 acompañantes asociados, visibles en el panel admin.
- **AC-35 (RF-24):**
  - **Dado** un formulario completo con teléfono +54 y número 1155551234,
  - **Cuando** el usuario continúa,
  - **Entonces** se abre un modal con el texto "+54 1155551234", el aviso de contacto por WhatsApp y los botones *Confirmar* y *Volver*, y todavía no existe la reserva en la base.
- **AC-36 (RF-24):**
  - **Dado** el modal abierto,
  - **Cuando** el usuario pulsa *Volver*,
  - **Entonces** el modal se cierra, el formulario conserva todos los datos y el campo de teléfono es editable.
- **AC-37 (RF-25):**
  - **Dado** que De Luxe tiene 1 sola unidad libre del 10/11/2026 al 12/11/2026 y el usuario A ingresó al formulario hace 5 minutos sin confirmar,
  - **Cuando** el usuario B busca esas fechas,
  - **Entonces** De Luxe no aparece en el listado de B.
- **AC-38 (RF-26, RNF-07):**
  - **Dado** un *soft lock* creado en el instante T sobre la última unidad de De Luxe,
  - **Cuando** el usuario B busca en T + 14 min 59 s y en T + 15 min 00 s,
  - **Entonces** De Luxe no aparece en la primera búsqueda y aparece en la segunda.
- **AC-39 (RF-27):**
  - **Dado** que el *soft lock* de A venció, la unidad sigue libre y A completó el formulario,
  - **Cuando** A confirma en el modal,
  - **Entonces** se renueva el *soft lock*, se crea la reserva y los datos de A se conservan.
- **AC-40 (RF-27):**
  - **Dado** que el *soft lock* de A venció y B tomó la última unidad,
  - **Cuando** A confirma,
  - **Entonces** recibe HTTP 409 con el mensaje "Las fechas seleccionadas ya no están disponibles" y el formulario conserva sus datos.
- **AC-41 (RF-28, RNF-03):**
  - **Dado** que De Luxe tiene 1 sola unidad libre del 10/11/2026 al 12/11/2026,
  - **Cuando** se envían 20 solicitudes concurrentes de confirmación para esas fechas,
  - **Entonces** exactamente 1 tiene éxito, las otras 19 reciben HTTP 409 con el mensaje "Las fechas seleccionadas ya no están disponibles" y existe 1 sola reserva en la base.
- **AC-42 (RF-28):**
  - **Dado** una reserva creada desde el portal,
  - **Cuando** el administrador abre su detalle,
  - **Entonces** el estado es *Pendiente* y no tiene unidad asignada.
- **AC-43 (RF-29):**
  - **Dado** esa misma reserva,
  - **Cuando** el administrador abre su detalle,
  - **Entonces** el origen es *Web Directa*.
- **AC-44 (RF-30):**
  - **Dado** un visitante,
  - **Cuando** abre `/ruta-que-no-existe`,
  - **Entonces** es redirigido a `/`.

### Panel de Administración

- **AC-45 (RF-31):**
  - **Dado** un administrador registrado,
  - **Cuando** ingresa su email y su contraseña correcta,
  - **Entonces** es redirigido a `/adminpanel` y la respuesta es HTTP 200 con sesión iniciada.
- **AC-46 (RF-31):**
  - **Dado** un administrador registrado,
  - **Cuando** ingresa su email con una contraseña incorrecta,
  - **Entonces** el acceso se rechaza, permanece en el login y no se crea sesión.
- **AC-47 (RF-32):**
  - **Dado** 3 intentos fallidos con el email X desde la IP A,
  - **Cuando** se intenta un cuarto login con la contraseña correcta, desde la IP B,
  - **Entonces** se rechaza durante 15 minutos (bloqueo por email); al cumplirse los 15 minutos el login correcto funciona.
- **AC-48 (RF-32):**
  - **Dado** 3 intentos fallidos desde la IP A con tres emails distintos,
  - **Cuando** se intenta un login desde la IP A con las credenciales correctas de otro email,
  - **Entonces** se rechaza durante 15 minutos (bloqueo por IP).
- **AC-49 (RF-33):**
  - **Dado** el panel y el portal,
  - **Cuando** se inspecciona el HTML,
  - **Entonces** las páginas del panel contienen `<meta name="robots" content="noindex">` y ninguna página del portal contiene un enlace a `/adminpanel`.
- **AC-50 (RF-34):**
  - **Dado** un administrador autenticado,
  - **Cuando** crea la categoría "Suite" con descripción, capacidad máxima 4, precio base $60.000 y USD 60,
  - **Entonces** "Suite" aparece en el catálogo con esos datos.
- **AC-51 (RF-35):**
  - **Dada** la categoría Suite,
  - **Cuando** el administrador cambia su precio base a $65.000,
  - **Entonces** el catálogo muestra $65.000.
- **AC-52 (RF-36):**
  - **Dada** una categoría sin reservas,
  - **Cuando** el administrador la elimina,
  - **Entonces** desaparece del catálogo.
- **AC-53 (RF-36):**
  - **Dada** una categoría con una reserva *Pendiente* futura,
  - **Cuando** el administrador intenta eliminarla,
  - **Entonces** se rechaza con un mensaje que indica las reservas que lo impiden y la categoría permanece.
- **AC-54 (RF-36):**
  - **Dada** una categoría cuyas únicas reservas son pasadas o *Canceladas*,
  - **Cuando** el administrador la elimina,
  - **Entonces** se elimina y esas reservas conservan su historial.
- **AC-55 (RF-37):**
  - **Dada** la categoría De Luxe con 2 unidades,
  - **Cuando** el administrador crea la unidad "Apart 7" asignada a De Luxe,
  - **Entonces** De Luxe tiene 3 unidades y "Apart 7" aparece en el calendario.
- **AC-56 (RF-38):**
  - **Dada** la unidad "Apart 7",
  - **Cuando** el administrador la reasigna a Premium,
  - **Entonces** figura en Premium y deja de figurar en De Luxe.
- **AC-57 (RF-39):**
  - **Dada** una unidad con una reserva *Confirmada* futura,
  - **Cuando** el administrador intenta eliminarla,
  - **Entonces** se rechaza con un mensaje y la unidad permanece.
- **AC-58 (RF-39):**
  - **Dada** una unidad sin reservas *Pendiente* ni *Confirmada* futuras,
  - **Cuando** el administrador la elimina,
  - **Entonces** desaparece del calendario.
- **AC-59 (RF-40):**
  - **Dado** un administrador autenticado,
  - **Cuando** crea la regla "15% a partir de 5 noches",
  - **Entonces** la regla figura en el listado como activa.
- **AC-60 (RF-41):**
  - **Dada** esa regla,
  - **Cuando** el administrador cambia el porcentaje a 20%,
  - **Entonces** 5 noches en De Luxe muestran Descuento (20%): -$40.000.
- **AC-61 (RF-42):**
  - **Dada** esa regla activa,
  - **Cuando** el administrador la desactiva,
  - **Entonces** 5 noches en De Luxe muestran Total: $200.000 sin descuento.
- **AC-62 (RF-43):**
  - **Dado** un administrador autenticado,
  - **Cuando** crea la temporada 20/12/2026–28/02/2027, estadía mínima 4 y $55.000 para De Luxe,
  - **Entonces** la temporada figura en el listado con esos datos.
- **AC-63 (RF-44):**
  - **Dada** esa temporada,
  - **Cuando** el administrador cambia su estadía mínima a 3,
  - **Entonces** una búsqueda de 3 noches dentro del rango puede continuar.
- **AC-64 (RF-45):**
  - **Dada** esa temporada,
  - **Cuando** el administrador la elimina,
  - **Entonces** una búsqueda de 4 noches dentro del rango muestra "$40.000/noche".
- **AC-65 (RF-46):**
  - **Dado** un plazo de vencimiento de *Pendiente* de 5 días,
  - **Cuando** el administrador lo cambia a 7 días y se recarga la aplicación,
  - **Entonces** el panel muestra 7 días y el valor está guardado en la base de datos.
- **AC-66 (RF-47):**
  - **Dada** una reserva *Confirmada* en Apart 3 del 10/11/2026 al 14/11/2026,
  - **Cuando** el administrador abre el calendario de noviembre,
  - **Entonces** Apart 3 figura ocupado las noches del 10 al 13 y libre el 14.
- **AC-67 (RF-48):**
  - **Dada** una reserva *Pendiente* con disponibilidad,
  - **Cuando** el administrador la cambia a *Confirmada*,
  - **Entonces** queda *Confirmada* en el listado y en el calendario.
- **AC-68 (RF-48):**
  - **Dada** una reserva *Confirmada* sobre la última unidad de De Luxe del 10/11/2026 al 12/11/2026,
  - **Cuando** el administrador la cambia a *Cancelada*,
  - **Entonces** De Luxe aparece disponible en el portal para esas fechas.
- **AC-69 (RF-48):**
  - **Dada** una reserva *Pendiente*,
  - **Cuando** el administrador intenta pasarla a *Finalizada*,
  - **Entonces** el cambio se rechaza con el mensaje "Transición no permitida" y la reserva sigue *Pendiente*.
- **AC-70 (RF-48):**
  - **Dada** una reserva *Confirmada*,
  - **Cuando** el administrador intenta pasarla a *Pendiente*,
  - **Entonces** el cambio se rechaza con el mensaje "Transición no permitida". **[A CONFIRMAR: Confirmada→Pendiente no figura entre las transiciones aprobadas]**
- **AC-71 (RF-48, RF-49):**
  - **Dada** una reserva *Finalizada* y disponibilidad en sus fechas,
  - **Cuando** el administrador la cambia a *Pendiente*,
  - **Entonces** queda *Pendiente*.
- **AC-72 (RF-49):**
  - **Dada** una reserva *Cancelada* de De Luxe del 10/11/2026 al 12/11/2026 y otra reserva *Confirmada* que ocupa la última unidad en esas fechas,
  - **Cuando** el administrador intenta pasar la primera a *Confirmada*,
  - **Entonces** el sistema responde HTTP 409 con el mensaje "No hay disponibilidad en esas fechas" y la reserva sigue *Cancelada*.
- **AC-73 (RF-50):**
  - **Dada** una reserva *Confirmada* en De Luxe sin unidad asignada,
  - **Cuando** el administrador le asigna Apart 3,
  - **Entonces** la reserva aparece en la fila de Apart 3 del calendario.
- **AC-74 (RF-50):**
  - **Dado** que Apart 3 ya tiene una reserva *Confirmada* en fechas superpuestas,
  - **Cuando** el administrador intenta asignarle una segunda reserva,
  - **Entonces** el sistema responde HTTP 409 con el mensaje "La unidad ya tiene una reserva en esas fechas" y no asigna.
- **AC-75 (RF-51):**
  - **Dado** que Apart 5 está libre del 01/12/2026 al 05/12/2026,
  - **Cuando** el administrador registra un bloqueo por mantenimiento,
  - **Entonces** Apart 5 figura bloqueado en el calendario y la disponibilidad de su categoría baja en 1 unidad.
- **AC-76 (RF-52):**
  - **Dada** una reserva *Pendiente*,
  - **Cuando** el administrador registra que se envió el método de pago,
  - **Entonces** el detalle muestra la fecha y hora de ese envío.
- **AC-77 (RF-53, RF-46):**
  - **Dadas** una reserva *Pendiente* sin envío registrado creada hace 24 h 00 min y otra creada hace 23 h 59 min, con plazo de aviso de 24 h,
  - **Cuando** un administrador inicia sesión,
  - **Entonces** el aviso lista la primera y no lista la segunda.
- **AC-78 (RF-53):**
  - **Dada** una reserva en el aviso de 24 h,
  - **Cuando** el administrador inicia sesión,
  - **Entonces** la reserva sigue *Pendiente* y sigue ocupando disponibilidad.
- **AC-79 (RF-54):**
  - **Dada** una reserva *Pendiente* sin cobros con envío del método de pago registrado hace 5 días 0 h 0 min y otra hace 4 días 23 h 59 min, con plazo de 5 días,
  - **Cuando** corre el proceso de vencimiento,
  - **Entonces** la primera pasa a *Cancelada* con la marca "cancelada por vencimiento" y libera la unidad, y la segunda sigue *Pendiente*.
- **AC-80 (RF-54):**
  - **Dada** una reserva *Pendiente*,
  - **Cuando** el administrador la cancela manualmente,
  - **Entonces** queda *Cancelada* sin la marca "cancelada por vencimiento".
- **AC-81 (RF-54):**
  - **Dada** una reserva *Pendiente* con 1 cobro registrado y envío del método de pago hace 6 días,
  - **Cuando** corre el proceso de vencimiento,
  - **Entonces** la reserva sigue *Pendiente*. **[A CONFIRMAR: "sin pago" se interpreta como sin ningún cobro registrado]**
- **AC-82 (RF-55):**
  - **Dada** una reserva con total de $170.000,
  - **Cuando** el administrador registra una seña de $50.000 en ARS por transferencia con referencia "TRF-123456",
  - **Entonces** el detalle lista ese cobro con monto, moneda, método y referencia.
- **AC-83 (RF-55):**
  - **Dada** una reserva,
  - **Cuando** el administrador registra un cobro con un archivo PNG de 3 MB y sin referencia,
  - **Entonces** el cobro se guarda y el detalle permite abrir el archivo.
- **AC-84 (RF-55):**
  - **Dada** una reserva,
  - **Cuando** el administrador registra un cobro sin referencia y sin archivo,
  - **Entonces** el cobro se rechaza con el mensaje "Cargá una referencia o un archivo".
- **AC-85 (RF-55):**
  - **Dada** una reserva,
  - **Cuando** el administrador adjunta un archivo `.exe`, o un PDF de 10 MB + 1 byte,
  - **Entonces** el cobro se rechaza; un PDF de exactamente 10 MB se acepta. **[A CONFIRMAR: 10 MB = 10.485.760 bytes]**
- **AC-86 (RF-55):**
  - **Dada** una reserva cuyo precio se mostró en ARS,
  - **Cuando** el administrador registra un cobro de USD 50,
  - **Entonces** el detalle lista ese cobro como "USD 50" sin conversión.
- **AC-87 (RF-56):**
  - **Dado** un archivo de comprobante cargado hace 3 meses y 1 día,
  - **Cuando** corre el proceso de limpieza,
  - **Entonces** el archivo se elimina y el monto, la moneda, el método y la referencia del cobro permanecen.
- **AC-88 (RF-57):**
  - **Dada** una reserva cuyo titular es un cliente nuevo,
  - **Cuando** el administrador abre el CRM,
  - **Entonces** el cliente aparece con nombre, apellido, email, teléfono, documento y fecha de nacimiento.
- **AC-89 (RF-58):**
  - **Dado** un cliente con DNI 30111222 y email a@mail.com,
  - **Cuando** el mismo DNI hace una nueva reserva con email b@mail.com,
  - **Entonces** el CRM muestra 1 solo cliente con email b@mail.com.
- **AC-90 (RF-59):**
  - **Dado** un cliente con 2 reservas *Finalizadas* con el mismo documento,
  - **Cuando** el administrador abre su ficha,
  - **Entonces** el historial lista ambas estadías con sus fechas.
- **AC-91 (RF-60):**
  - **Dado** que hoy es 01/10/2026, el cliente A cumple años el 15/10 y el cliente B el 15/11,
  - **Cuando** el administrador abre el widget,
  - **Entonces** A aparece con su email y teléfono, y B no aparece.
- **AC-92 (RF-60):**
  - **Dado** que hoy es 20/12/2026 y un cliente cumple años el 05/01,
  - **Cuando** el administrador abre el widget,
  - **Entonces** ese cliente aparece.
- **AC-93 (RF-60):**
  - **Dado** que hoy es 01/10/2026,
  - **Cuando** el administrador abre el widget con un cliente que cumple el 31/10 y otro el 01/11,
  - **Entonces** aparece el del 31/10 (día 30) y no el del 01/11 (día 31).
- **AC-94 (RF-60):**
  - **Dado** que hoy es 20/02/2027 (año no bisiesto) y un cliente nació un 29/02,
  - **Cuando** el administrador abre el widget,
  - **Entonces** ese cliente aparece con cumpleaños el 28/02. **[A CONFIRMAR]**
- **AC-95 (RF-61):**
  - **Dado** un cliente,
  - **Cuando** el administrador registra una solicitud de anonimización,
  - **Entonces** la ficha muestra la fecha de la solicitud y el estado "pendiente".
- **AC-96 (RF-62):**
  - **Dada** una solicitud de anonimización pendiente,
  - **Cuando** el administrador anonimiza al cliente,
  - **Entonces** nombre, apellido, documento, email, teléfono y fecha de nacimiento del cliente y de sus acompañantes quedan reemplazados por un valor fijo, y las fechas de sus estadías se conservan en el historial. **[A CONFIRMAR: qué se conserva]**
- **AC-97 (RF-62, RNF-08):**
  - **Dada** una solicitud pendiente hace 30 días 0 h y otra hace 29 días 23 h, con plazo de 30 días,
  - **Cuando** el administrador abre el listado de solicitudes,
  - **Entonces** la primera figura "plazo vencido" y la segunda no.
- **AC-98 (RF-63, RNF-06):**
  - **Dada** una reserva *Confirmada* en Apart 3 del 10/11/2026 al 14/11/2026,
  - **Cuando** se consulta la URL iCal de Apart 3 con su token válido,
  - **Entonces** el feed contiene un evento del 10/11/2026 al 14/11/2026 y ningún nombre ni dato personal del huésped.
- **AC-99 (RF-64, RF-65):**
  - **Dada** una URL de importación de Booking para Apart 3 con un evento del 20/11/2026 al 22/11/2026,
  - **Cuando** se ejecuta la sincronización,
  - **Entonces** Apart 3 figura bloqueado esas fechas y la disponibilidad de su categoría baja en 1 unidad.
- **AC-100 (RF-66):**
  - **Dada** la sincronización automática activa durante 60 minutos,
  - **Cuando** se revisa el registro de ejecuciones,
  - **Entonces** hay al menos 4 ejecuciones y entre dos consecutivas pasan como máximo 15 minutos.
- **AC-101 (RF-67):**
  - **Dado** un evento nuevo en el feed de Booking de Apart 3,
  - **Cuando** el administrador pulsa "Sincronizar ahora",
  - **Entonces** el bloqueo aparece en el calendario sin esperar a la ejecución automática.

### No Funcionales

- **AC-102 (RNF-01):**
  - **Dado** el portal público,
  - **Cuando** se completa el flujo de reserva en anchos de 360 px, 768 px y 1920 px,
  - **Entonces** `document.documentElement.scrollWidth` es menor o igual al ancho de la ventana en cada paso, y cada control del flujo se puede accionar con teclado y con puntero.
- **AC-103 (RNF-02):**
  - **Dada** la guía de estilo de la web principal,
  - **Cuando** se auditan los estilos computados del portal,
  - **Entonces** 0 colores y 0 familias tipográficas quedan fuera de esa guía.
- **AC-104 (RNF-04):**
  - **Dado** un entorno de staging con 6 categorías y 20 unidades,
  - **Cuando** 20 usuarios concurrentes consultan disponibilidad y tarifas durante 5 minutos,
  - **Entonces** el p95 medido en servidor es menor a 1,5 s.
- **AC-105 (RNF-05):**
  - **Dado** un administrador recién creado,
  - **Cuando** se inspecciona su registro en la base,
  - **Entonces** el campo de contraseña empieza con `$argon2id$` y no contiene la contraseña en claro.

### Control de Acceso

- **AC-106 (RF-31):**
  - **Dado** un usuario sin sesión,
  - **Cuando** solicita cualquier ruta del panel o endpoint de la API administrativa,
  - **Entonces** recibe HTTP 401 (API) o es redirigido al login (UI), y la respuesta no contiene datos.
- **AC-107 (RF-17, RF-23):**
  - **Dado** que existen reservas de otros huéspedes,
  - **Cuando** un visitante consulta cualquier endpoint público, con o sin identificadores de reserva o cliente,
  - **Entonces** ninguna respuesta incluye nombre, documento, fecha de nacimiento, email ni teléfono de otros huéspedes.
- **AC-108 (RNF-06):**
  - **Dada** la URL iCal de Apart 3,
  - **Cuando** se solicita sin token o con un token inválido,
  - **Entonces** el sistema responde HTTP 404 y no entrega el feed.

## Fuera de Alcance

- Procesamiento automatizado de cobros con pasarelas de pago (MercadoPago/Stripe); los cobros se registran a mano.
- Integración vía API de un Channel Manager oficial; Booking y Airbnb se gestionan solo por feeds iCal.
- Login y contraseñas para clientes finales (reservan como invitados).
- Gestión de inventario de consumos internos (frigobar, amenities de pago).
- Múltiples roles o permisos diferenciados: V1 tiene un único rol de administrador (el staff y el dueño lo usan).
- Envío de emails automáticos al huésped.
- Envío automático de mensajes por WhatsApp (el contacto lo hace un empleado a mano).
- Cancelación de reservas por parte del huésped; las realiza el administrador.
- Alta manual de reservas desde el panel y orígenes distintos de *Web Directa* (WhatsApp, Mostrador, Booking.com, Airbnb).
- Multi-idioma del portal y del panel (solo español).
- Impuestos, tasas turísticas y facturación electrónica.
- Reportes y estadísticas más allá del calendario y el widget de cumpleañeros.
- App móvil nativa.
- Conversión automática de moneda entre ARS y USD.

## Riesgos y Dependencias

### Riesgos

- **Riesgo:** Desfase temporal de hasta 15 minutos entre calendarios externos (iCal) y el sistema, con posible reserva doble contra un canal externo.
  **Mitigación:** Sincronización automática cada 15 minutos (RF-66) y sincronización manual (RF-67).
- **Riesgo:** *Soft locks* abandonados que reducen el inventario visible.
  **Mitigación:** Expiración con tolerancia de 0 s evaluada en cada consulta de disponibilidad (RF-26, RNF-07).
- **Riesgo:** Reservas *Pendiente* sin contacto o sin pago que ocupan inventario.
  **Mitigación:** Aviso a las 24 h (RF-53) y cancelación automática a los 5 días del envío del método de pago (RF-54); ambos plazos configurables (RF-46). Una reserva sin contacto registrado no vence sola.
- **Riesgo:** Alguien que escribe el documento de otra persona en el formulario sobrescribe su email y teléfono en el CRM (RF-58).
  **Mitigación:** No definida en esta versión.
- **Riesgo:** Cumplimiento de la Ley 25.326 de Protección de Datos Personales.
  **Mitigación:** Anonimización a pedido con plazo de 30 días (RF-61, RF-62, RNF-08).

### Dependencias

- PostgreSQL con soporte para restricciones de exclusión de rangos, como garantía de anti-superposición a nivel de base de datos (RNF-03).
- Proceso programado (*cron*) para la sincronización iCal, el vencimiento de *Pendiente*, la limpieza de adjuntos y la expiración de *soft locks*.
- Hora del servidor de base de datos como referencia de tiempo (RNF-07).
- Guía de estilo de la web principal (RNF-02).
