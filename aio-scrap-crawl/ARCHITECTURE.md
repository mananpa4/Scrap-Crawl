# ARCHITECTURE.md — aio-scrap-crawl

> Fase 2. Arquitectura final del AIO. Acompaña a `MERGE_ANALYSIS.md`.

## 1. Principio rector

> **Un núcleo único orquesta; cada herramienta existente es un _engine_ detrás
> de una interfaz común.** No se fusiona código fuente de frameworks completos.

El plano de control es **TypeScript (monorepo pnpm + Turborepo)**. Los engines en
otros lenguajes (Python, Go) y los servicios AGPL (Firecrawl, Maxun) viven detrás
de **fronteras de proceso** (HTTP / binario / Docker) y se consumen vía adaptadores
que implementan la misma interfaz que los engines nativos.

## 2. Diagrama de capas

```
                 ┌──────────────────────────────────────────────┐
   apps/         │  cli (✓ funcional)   web (Maxun, AGPL)  desktop│
                 └───────────────┬──────────────────────────────┘
                                 │  (mismo core)
                 ┌───────────────▼──────────────────────────────┐
   packages/core │  Job model · Output schema · EngineRegistry   │
                 │  Config · Logger · Exporters · URL/dedupe ·    │
                 │  robots · FetchEngine (built-in, 0 deps)       │
                 └───────────────┬──────────────────────────────┘
                                 │  ScrapeEngine / CrawlEngine
        ┌────────────────┬───────┴────────┬───────────────┬───────────────┐
        ▼                ▼                ▼               ▼               ▼
 packages/crawler   adapters/         adapters/       adapters/      modules/
 Crawlee (✓)        firecrawl (HTTP)  katana (bin)    pyai · scrapling security · ai
 Apache-2.0         AGPL service      Go binary       FastAPI svc    WipeDown · LLM
                                                          │
                                              services/py-ai (FastAPI)
                                              wraps: crawl4ai · scrapling
                                                     scrapegraph-ai · browser-use
                                                     wipedown · 2captcha (captcha)

 modules/captcha → CaptchaSolver: 2captcha (real) · ai-vision (stub)
 (fuera del core) MasterDnsVPN → egress SOCKS5 opcional (no es un engine)
```

✓ = implementado y funcional en esta primera entrega. El resto son adaptadores
reales con frontera de proceso, activables por configuración.

## 3. Contrato común (lo que unifica todo)

Definido en `packages/core/src/engine.ts` y `types.ts`:

- **`ScrapeJob` / `CrawlJob`** — entrada normalizada (url, formats, límites,
  robots, concurrencia, proxy/UA…).
- **`PageData`** — salida **única** para cualquier engine:
  `url, finalUrl, statusCode, ok, title, description, html, text, markdown,
  links[], images[], metadata{}, structuredData?, fetchedAt, engine, error?`.
- **`CrawlResult`** — `{ startUrl, pages[], count, durationMs, engine }`.
- **`EngineCapabilities`** — `{ scrape, crawl, javascript, markdown, structured,
  agent }`, para que el orquestador elija el engine adecuado a cada job.
- **`Engine` / `ScrapeEngine` / `CrawlEngine`** — interfaces que **todos** los
  engines implementan, nativos o remotos. `isAvailable()` permite degradar con
  gracia si una dependencia externa no está instalada.

Cambiar de engine = cambiar un string. La salida y los exports no cambian.

## 4. Componentes y de dónde viene cada uno

| Componente | Paquete | Origen (repo) | Estado |
|---|---|---|---|
| Core / contrato / registro | `@aio/core` | diseño propio (modelo inspirado en Scrapy) | ✓ |
| Exporters JSON/JSONL/CSV | `@aio/core` | inspirado en feed exports de Scrapy | ✓ |
| Engine HTTP integrado | `@aio/core` (FetchEngine) | propio (sin deps) | ✓ |
| Engine de crawling escalable | `@aio/crawler` | **Crawlee** (Apache-2.0) | ✓ |
| Driver de navegador | (dep) | **Playwright** vía `@crawlee/playwright` | configurable |
| Adaptador scrape→markdown API | `@aio/adapters/firecrawl` | **Firecrawl** (AGPL, servicio) | adaptador ✓, servicio externo |
| Adaptador descubrimiento rápido | `@aio/adapters/katana` | **Katana** (Go binary) | adaptador ✓, binario externo |
| Adaptador IA (extract/markdown/agent) | `@aio/adapters/pyai` | **Crawl4AI · ScrapeGraphAI · browser-use** | adaptador ✓, servicio externo |
| Adaptador scrape stealth/adaptativo | `@aio/adapters/scrapling` | **Scrapling** (BSD-3) | adaptador ✓, servicio externo |
| Servicio IA | `services/py-ai` | Crawl4AI/Scrapling/ScrapeGraphAI/browser-use/WipeDown | esqueleto FastAPI |
| Egress de red (fuera del core) | — (documentado) | **MasterDnsVPN** (MIT, SOCKS5) | opcional, no es engine |
| Seguridad de contenido | `@aio/security` | **WipeDown** (MIT) | heurística local ✓ + cliente servicio |
| Capa de captcha | `@aio/captcha` + `services/py-ai` | **2captcha-python** (MIT) · ai-vision (stub) | 2captcha ✓ real · ai-vision stub |
| Facade de proveedores LLM | `@aio/ai` | unifica config de IA | esqueleto |
| App web no-code | `apps/web` | **Maxun** (AGPL, servicio) | placeholder documentado |
| App desktop | `apps/desktop` | Electron/Tauri sobre el front | placeholder |

## 5. Flujo de un job (ejemplo `crawl`)

1. CLI/API construye un `CrawlJob` y resuelve el engine (config `AIO_DEFAULT_ENGINE`
   o flag `--engine`).
2. `EngineRegistry` entrega el `CrawlEngine`; si no está disponible (`isAvailable()`
   false) se informa o se cae al `fetch` integrado.
3. El engine emite `PageData` normalizado por página (callback en streaming).
4. Si el job toca un engine LLM, `@aio/security` (WipeDown) sanea el contenido
   **antes** de enviarlo al modelo (mitiga prompt-injection).
5. Los exporters de `@aio/core` escriben JSON/JSONL/CSV en `AIO_OUTPUT_DIR`.

## 6. Decisiones técnicas registradas

- **Núcleo TS** (no Python) porque las piezas "producto" (Crawlee, Firecrawl,
  Playwright, Maxun) son TS y habilitan CLI + API + web + desktop con un solo core.
- **Crawlee como motor base** (Apache-2.0): cola, autoscaling, session pool,
  rotación de proxy y fingerprinting ya resueltos y con licencia permisiva.
- **AGPL aislado**: Firecrawl y Maxun **nunca** se importan en el core; se consumen
  por HTTP como servicios opcionales. Así el core/adaptadores quedan MIT/Apache.
- **Polyglot por frontera de proceso**: Python (IA) como microservicio FastAPI;
  Go (Katana) como binario; ambos opcionales y con `isAvailable()`.
- **FetchEngine de 0 dependencias** en el core: garantiza que el AIO funcione
  inmediatamente (scrape/crawl básicos) aunque no se instale ningún engine pesado.
- **Seguridad por defecto**: saneo WipeDown obligatorio antes de cualquier LLM.

## 7. Cómo crece (apps futuras)

- **API REST** (`apps/api`, pendiente): Fastify reutilizando `@aio/core`; contrato
  inspirado en Firecrawl (`/scrape`, `/crawl`, `/search`, `/extract`, `/map`).
- **Web** (`apps/web`): montar Maxun como servicio AGPL e integrar por API, o
  construir un front propio sobre `@aio/core` vía la API REST.
- **Desktop** (`apps/desktop`): Electron/Tauri envolviendo el front + CLI.
- **Nuevos engines**: crear un paquete que implemente `ScrapeEngine`/`CrawlEngine`
  y registrarlo. Nada más cambia (mismo Job, misma salida, mismos exports).
