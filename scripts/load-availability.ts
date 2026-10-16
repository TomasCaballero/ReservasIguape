// Prueba de carga de GET /api/availability (RNF-04, AC-104, D-15, P-08).
// 20 workers en paralelo durante 5 minutos contra un servidor de producción local:
//   npm run build && npm start        (en otra terminal)
//   npx tsx scripts/load-availability.ts
// Variables opcionales: BASE_URL (default http://localhost:7777), WORKERS (20), SECONDS (300).
// Termina con exit 1 si p95 >= 1,5 s o si alguna respuesta no es 200.

const BASE_URL = process.env.BASE_URL ?? "http://localhost:7777";
const WORKERS = Number(process.env.WORKERS ?? 20);
const SECONDS = Number(process.env.SECONDS ?? 300);
const P95_LIMIT_MS = 1500;

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Búsqueda con fechas variadas: check-in entre 1 y 300 días, 1 a 14 noches. */
function randomQuery(): string {
  const start = new Date(Date.now() + (1 + Math.floor(Math.random() * 300)) * 86_400_000);
  const end = new Date(start.getTime() + (1 + Math.floor(Math.random() * 14)) * 86_400_000);
  const adults = 1 + Math.floor(Math.random() * 3);
  const currency = Math.random() < 0.5 ? "ARS" : "USD";
  return `checkin=${iso(start)}&checkout=${iso(end)}&adults=${adults}&children=0&currency=${currency}`;
}

const latencies: number[] = [];
let failures = 0;

async function worker(deadline: number) {
  while (Date.now() < deadline) {
    const started = performance.now();
    try {
      const res = await fetch(`${BASE_URL}/api/availability?${randomQuery()}`);
      await res.arrayBuffer();
      if (res.status !== 200) failures++;
    } catch {
      failures++;
    }
    latencies.push(performance.now() - started);
  }
}

const percentile = (sorted: number[], p: number) => sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];

async function main() {
  console.log(`Carga: ${WORKERS} workers × ${SECONDS} s contra ${BASE_URL}`);
  const deadline = Date.now() + SECONDS * 1000;
  await Promise.all(Array.from({ length: WORKERS }, () => worker(deadline)));

  const sorted = [...latencies].sort((a, b) => a - b);
  const [p50, p95, p99] = [50, 95, 99].map((p) => percentile(sorted, p));
  console.log(`Pedidos: ${sorted.length} (${(sorted.length / SECONDS).toFixed(1)}/s) · fallidos: ${failures}`);
  console.log(`p50 ${p50.toFixed(0)} ms · p95 ${p95.toFixed(0)} ms · p99 ${p99.toFixed(0)} ms`);

  const ok = p95 < P95_LIMIT_MS && failures === 0;
  console.log(ok ? "OK: p95 < 1,5 s" : "FALLA: p95 >= 1,5 s o hubo respuestas distintas de 200");
  process.exit(ok ? 0 : 1);
}

main();
