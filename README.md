# Iguapé Aparts — Motor de reservas y panel de administración

Proyecto del curso **AI Builder**: construir software profesional trabajando con IA como par de desarrollo.

## De dónde sale este proyecto

Desarrollé la web oficial de **[iguapeaparts.com.ar](https://iguapeaparts.com.ar/)** para un familiar, dueño de un complejo de aparts. Durante ese trabajo me comentó que le interesaba tener un **sistema de reservas con base de datos** para dejar de llevar todo en un Excel.

Este repositorio es ese sistema. Es un proyecto real, pensado para pasar a producción, no un ejercicio de laboratorio.

## Qué resuelve

- **Para el huésped:** buscar fechas, ver qué aparts hay disponibles con el precio final y reservar como invitado, sin pagar online.
- **Para el dueño:** un panel donde ve y gestiona reservas, calendario de ocupación, tarifas, temporadas, descuentos, cobros y clientes.
- **Problema central:** evitar el overbooking entre la web y Booking/Airbnb. Se sincroniza por iCal y la base de datos impide dos reservas superpuestas (*exclusion constraint* de PostgreSQL), no solo la lógica de la app.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind 4 · PostgreSQL 17 · Prisma 7 · Vitest · Playwright

## Cómo trabajé con IA (lo más relevante para la evaluación)

Usé Claude Code con un proceso explícito, documentado en el repo:

| Artefacto | Para qué sirve |
|---|---|
| [`PRD.md`](PRD.md) | Requerimientos numerados (RF-01..67, RNF-01..09, AC-01..108). Fuente de verdad del alcance. |
| [`docs/plan_implementacion_v1.0.0.md`](docs/plan_implementacion_v1.0.0.md) | Decisiones técnicas (`D-xx`) y arquitectura. |
| [`docs/tareas_v1.0.0.md`](docs/tareas_v1.0.0.md) | Tareas derivadas del plan, con su protocolo de trabajo. |
| [`AGENTS.md`](AGENTS.md) / [`CLAUDE.md`](CLAUDE.md) | Reglas que le doy al agente: principios, invariantes de dominio, cosas prohibidas. |
| [`FASES.md`](FASES.md) | Historial de las fases, cada una cerrada con tests y commit. |

Algunas prácticas que apliqué:

- **Requisitos primero, código después:** cada cambio cita el RF/RNF/AC que implementa.
- **Mentalidad "perezoso pero eficiente":** el agente debe reusar y elegir lo más simple antes de escribir código nuevo o sumar dependencias.
- **Límites claros para la IA:** no resuelve por su cuenta lo ambiguo del PRD (frena y pregunta) y no commitea ni pushea sin mi aprobación.
- **Invariantes críticos en la base de datos**, no solo en la app, porque un overbooking cuesta más que cualquier demora.
- **Pruebas por capas:** unitarias, de base de datos y e2e de punta a punta.

## Estado

Fases 0 a 10 completas: motor de reservas, panel de administración, CRM de huéspedes, sincronización iCal, tareas programadas, auditorías de estilo y accesibilidad, y prueba de carga.

## Cómo correrlo

Requiere Node 22 y PostgreSQL 17. Copiá `.env.example` a `.env` y completá los valores.

```bash
npm install
npx prisma migrate deploy && npx prisma generate
npx prisma db seed        # crea las categorías y el primer admin
npm run dev               # http://localhost:7777  (panel: /adminpanel)

npm test                  # unitarios + base de datos
npx playwright test       # e2e
```

## Qué mirar primero

1. [`PRD.md`](PRD.md): qué se pidió y por qué.
2. [`AGENTS.md`](AGENTS.md): cómo se le indicó trabajar al agente.
3. `prisma/migrations/`: la *exclusion constraint* anti-overbooking, en SQL.
4. `lib/booking/`: disponibilidad, tarifas y reglas de estadía.
5. `tests/`: la cobertura por capas.
