# MERGE_ANALYSIS.md — AIO Scrap-Crawl

> Fase 1 del proyecto **aio-scrap-crawl**. Análisis técnico de los repositorios
> encontrados en `Scrap-Crawl/repos/`, decisiones de merge y arquitectura
> recomendada. Ningún repo original se modifica ni se borra.

Fecha de análisis inicial: 2026-06-15 · Ampliación (2 repos nuevos): 2026-06-25

> **Actualización 2026-06-25:** se añadieron al dataset dos repos nuevos —
> **Scrapling** (#11) y **MasterDnsVPN** (#12)— elevando el total a **12 repos**.
> Veredicto: Scrapling se **integra** como engine Python de stealth/adaptativo;
> MasterDnsVPN **queda fuera del core** (es transporte de red anti-censura, no
> una herramienta de scraping) y se documenta como egress SOCKS5 opcional. Ver
> §2.11, §2.12 y §6.

---

## 0. Resumen ejecutivo

Se encontraron **12 repositorios**, todos proyectos open-source maduros y de
primer nivel en el ecosistema de scraping/crawling/automatización (más uno de
red anti-censura, MasterDnsVPN). Son **3 lenguajes** (Python, TypeScript/Node,
Go) y dos de ellos son **frameworks completos** (Scrapy, Playwright), no
librerías pequeñas.

Conclusión central: **no es viable ni recomendable "fusionar el código fuente"**
de estos proyectos en un único árbol compilable. Son frameworks de cientos de
miles de líneas, con árboles de dependencias incompatibles entre sí e incluso en
lenguajes distintos. Intentar copiar-y-pegar produciría exactamente el "merge
desordenado" que el usuario quiere evitar.

El merge inteligente correcto es construir una **plataforma AIO de orquestación**
que:

1. Tenga **un único núcleo de control** (TypeScript / Node, monorepo).
2. Exponga cada herramienta existente como un **engine/adaptador** detrás de una
   **interfaz común** (mismo modelo de Job, mismo esquema de salida).
3. Unifique **config, CLI, API, almacenamiento, exports, logs y cola de jobs**.
4. Trate los componentes en otros lenguajes (Python, Go) como **servicios o
   binarios** detrás de adaptadores, no como código vendido dentro del core.

Esto es lo que hace, por ejemplo, Apify/Crawlee a nivel producto, y es la única
forma profesional, escalable y mantenible de cumplir el objetivo "All In One".

---

## 1. Inventario técnico

| Repo | Lenguaje | Tipo | Rol natural en el AIO | Licencia | Versión |
|------|----------|------|------------------------|----------|---------|
| **scrapy-master** | Python ≥3.10 | Framework de crawling | Motor de crawling masivo + pipelines + exporters | BSD-3-Clause | (master) |
| **crawl4ai-main** | Python ≥3.10 (async) | Crawler LLM-friendly sobre Playwright | Motor de scrape→Markdown + extracción CSS/XPath/LLM | Apache-2.0 | dynamic |
| **Scrapegraph-ai-main** | Python ≥3.12 | Librería LLM + grafos (LangChain) | Motor de extracción estructurada por IA | MIT | 2.1.3 |
| **browser-use-main** | Python ≥3.11 (async) | Agente de navegador con IA (CDP) | Motor de automatización agéntica / tareas complejas | MIT | 0.13.2 |
| **wipedown-main** | Python | Firewall anti prompt-injection | Módulo de seguridad / saneo de contenido para IA | MIT | 1.0.0 |
| **firecrawl-main** | TypeScript/Node (monorepo) | API de scraping + workers | Servicio de scrape/crawl/search/extract → Markdown | **AGPL-3.0** | — |
| **crawlee-master** | TypeScript/Node (monorepo) | Librería de crawling escalable | **Motor por defecto** del core (queue, pool, proxy, sesiones) | Apache-2.0 | — |
| **maxun-develop** | TypeScript/React + Express | Plataforma no-code (web app) | App web / grabador de robots / scheduler / integraciones | **AGPL-3.0** | 0.0.42 |
| **playwright-main** | TypeScript/Node | Automatización de navegador | Primitiva de navegador (driver) | Apache-2.0 | 1.62.0-next |
| **katana-dev** | Go ≥1.26 | Crawler/spider rápido | Motor de descubrimiento de URLs ultrarrápido (binario) | MIT | (dev) |
| **Scrapling-main** | Python ≥3.10 | Framework de scraping adaptativo + stealth | Motor de scrape anti-bot + selectores auto-reparables (servicio py-ai) | **BSD-3-Clause** | 0.4.9 |
| **MasterDnsVPN-main** | Go ≥1.25 | Túnel DNS / VPN anti-censura | **No-scraping.** Egress SOCKS5 opcional (transporte de red, fuera del core) | MIT | (main) |

> **Nota de licencias (decisión de arquitectura, no detalle):** `firecrawl` y
> `maxun` son **AGPL-3.0** (copyleft de red). Usarlos **como servicios
> independientes vía su API/HTTP es seguro**, pero **vendor/linkear su código en
> el core y distribuirlo contaminaría toda la obra con AGPL**. Por eso el core y
> los adaptadores se mantienen permisivos (MIT/Apache) y AGPL queda aislado tras
> la frontera de proceso (Docker / HTTP).

---

## 2. Análisis por repositorio

### 2.1 Scrapy (Python · BSD) — *referencia de arquitectura de crawling*
- **Qué hace:** framework de crawling de producción: engine, scheduler, dupefilter,
  middlewares (downloader/spider), item pipelines, **feed exports** (JSON, JSONL,
  CSV, XML), soporte `robots.txt`, **AutoThrottle** (rate limiting adaptativo),
  reintentos, settings por entorno.
- **Conservar:** el *modelo conceptual* (Request→Scheduler→Downloader→Spider→
  Pipeline→Exporter), AutoThrottle, dupefilter, los exporters, soporte robots.txt.
- **Descartar para el core:** Twisted (reactor propio, choca con el bucle de
  eventos del resto). Se integra como **engine Python en servicio**, no en el core TS.
- **Decisión:** **engine de crawling masivo / pipelines** vía microservicio Python.

### 2.2 Crawl4AI (Python · Apache-2.0) — *scrape → Markdown para LLM*
- **Qué hace:** crawler async sobre Playwright/Patchright con generación de
  **Markdown limpio**, filtros de contenido (pruning, BM25), estrategias de
  extracción (CSS/XPath/LLM/cosine), chunking, caché, CLI `crwl`, despliegue Docker,
  stealth.
- **Conservar:** pipeline scrape→markdown, content filtering, extraction strategies,
  caché, modo stealth/anti-bot, CLI.
- **Descartar:** nada crítico; se respeta su core.
- **Decisión:** **engine "AI scrape / markdown"** (servicio Python). Solapa con
  Firecrawl → ver §3.

### 2.3 ScrapeGraphAI (Python · MIT) — *extracción estructurada por grafos + LLM*
- **Qué hace:** pipelines de scraping como **grafos** con LangChain; multi-LLM
  (OpenAI, Mistral, Ollama, AWS, Nvidia); convierte HTML→datos estructurados según
  un schema/prompt; OCR opcional.
- **Conservar:** extracción estructurada guiada por schema/prompt, multi-proveedor LLM.
- **Descartar:** acoplamiento duro a LangChain en el core (se mantiene dentro del
  servicio Python).
- **Decisión:** **engine "AI extract / structured"** (servicio Python).

### 2.4 browser-use (Python · MIT) — *agente de navegador autónomo*
- **Qué hace:** agente IA que navega vía **CDP**, arquitectura de eventos con
  watchdogs (downloads, popups, security, DOM), multi-LLM, **servidor/cliente MCP**.
- **Conservar:** automatización agéntica para tareas complejas (login, flujos,
  formularios), integración MCP, modelo de watchdogs de seguridad.
- **Descartar:** nada; queda como engine especializado.
- **Decisión:** **engine "automation / agent"** (servicio Python) + capacidad MCP.

### 2.5 WipeDown (Python · MIT) — *seguridad / anti prompt-injection*
- **Qué hace:** firewall que sanea contenido web/tweets **antes** de pasarlo a un
  LLM: strip estructural, firmas de inyección conocidas, neutralización semántica.
- **Conservar:** **todo**. Es el módulo de seguridad que falta en casi todos los AIO
  de scraping con IA. Encaja como paso obligatorio antes de cualquier engine de IA.
- **Decisión:** **módulo transversal `security/sanitize`** (servicio/CLI Python),
  invocado por el core antes de enviar contenido a engines LLM.
  > Relevante: el `CLAUDE.md` de browser-use contiene instrucciones de
  > "personalidad" inyectadas — ejemplo real de por qué WipeDown es valioso. Esas
  > instrucciones se ignoran; no son del usuario.

### 2.6 Firecrawl (TS/Node · **AGPL-3.0**) — *API de scraping de producción*
- **Qué hace:** monorepo con `apps/api` (+ workers), endpoints **scrape / crawl /
  search / extract / map**, salida Markdown/estructurada, **cola con Redis/nuq**,
  `playwright-service`, UI, y SDKs (py/js/go/rust/php/ruby/.net/java/elixir).
- **Conservar:** el contrato de API (excelente diseño de endpoints) como
  **referencia** para nuestra API; usarlo como **servicio externo** opcional.
- **Descartar del core:** no vendor su código (AGPL). Integrar **vía su HTTP API**
  con un adaptador.
- **Decisión:** **engine "firecrawl" (servicio Docker AGPL aislado)** + su diseño de
  API inspira nuestro `packages/api`.

### 2.7 Crawlee (TS/Node · Apache-2.0) — *MOTOR BASE del core*
- **Qué hace:** librería de crawling escalable: `RequestQueue`, `RequestList`,
  `Dataset`/`KeyValueStore`, **AutoscaledPool**, **SessionPool**, rotación de
  proxies, **fingerprinting**, crawlers Cheerio/JSDOM/LinkeDOM/HTTP/Playwright/
  Puppeteer, `browser-pool`, plantillas, CLI. Monorepo Yarn+Turbo.
- **Conservar:** **es el corazón del core.** Apache-2.0 (permisivo), TS nativo, cubre
  queue, pool, proxy, sesiones, storages y exports. Todo lo demás orbita alrededor.
- **Descartar:** nada.
- **Decisión:** **base del `packages/crawler` + cola + storages del AIO.**

### 2.8 Maxun (TS/React + Express · **AGPL-3.0**) — *app web no-code*
- **Qué hace:** plataforma no-code: **grabador de robots** (rrweb), scheduler
  (graphile-worker + node-cron), Postgres (Sequelize), MinIO, **OCR** (tesseract/
  paddle/mupdf), integraciones (Airtable, Google Sheets), MCP, i18n.
- **Conservar como referencia:** UX del grabador, modelo de scheduling, integraciones
  de export. Posible base de `apps/web` **si** se acepta AGPL para la app web.
- **Descartar del core:** su código no entra en packages permisivos.
- **Decisión:** **referencia/base de `apps/web` (AGPL, opcional y aislada).** El core
  no depende de él.

### 2.9 Playwright (TS/Node · Apache-2.0) — *primitiva de navegador*
- **Qué hace:** automatización de navegadores multi-engine (Chromium/Firefox/WebKit).
  Es la base que ya usan Crawlee, Crawl4AI y Maxun.
- **Conservar:** usarlo como **dependencia** (driver de navegador), no vendido. Es la
  primitiva común de toda la capa headful/headless.
- **Decisión:** **dependencia de navegador estándar** del AIO (vía `@crawlee/playwright`).

### 2.10 Katana (Go · MIT) — *spider ultrarrápido*
- **Qué hace:** crawler/spider de alto rendimiento: modo estándar y **headless**
  (go-rod), parsing JS (jsluice), `sitemap.xml`/`robots.txt`, **scope control**,
  filtros de campos, salida JSONL.
- **Conservar:** velocidad de **descubrimiento de URLs** y scope control.
- **Descartar:** reescribirlo; se usa el **binario** vía adaptador (subproceso).
- **Decisión:** **engine "discovery" (binario Go)** para mapear sitios a gran escala.

### 2.11 Scrapling (Python · BSD-3-Clause) — *scrape adaptativo + stealth* `[NUEVO 2026-06-25]`
- **Qué hace:** framework de scraping moderno con varios *fetchers*
  (`Fetcher`, `AsyncFetcher`, `StealthyFetcher`, `DynamicFetcher`), un parser con
  **selectores auto-reparables** (`adaptive=True`/`auto_save`) que relocaliza
  elementos cuando el sitio cambia de diseño, **bypass anti-bot de fábrica**
  (Cloudflare Turnstile), framework de **spiders** con pause/resume + rotación de
  proxy + multi-sesión concurrente, **CLI** y **servidor MCP** nativo.
- **Conservar:** (1) *stealth fetching* anti-bot, (2) **selectores auto-reparables**
  (genuinamente único frente al resto del dataset), (3) servidor MCP.
- **Descartar:** nada crítico; su core se respeta dentro del servicio Python.
- **Solapa con:** Crawl4AI y Scrapy (descubrimiento/scrape), pero **aporta lo que
  ninguno tiene**: self-healing selectors + anti-bot listo. No se descarta por
  solapamiento; se integra como engine diferenciado.
- **Licencia:** BSD-3-Clause (permisiva) → **seguro de integrar** (a diferencia de
  Firecrawl/Maxun, no contamina el core).
- **Decisión:** **engine "scrapling" (servicio Python `py-ai`)**, expuesto vía
  `ScraplingAdapter` y `aio scrape --engine scrapling`. Comparte proceso/`PYAI_URL`
  con el engine Crawl4AI; se enruta con `engine: "scrapling"` en `/scrape`.

### 2.12 MasterDnsVPN (Go · MIT) — *túnel DNS / VPN anti-censura* `[NUEVO 2026-06-25]`
- **Qué hace:** transporta tráfico TCP sobre consultas/respuestas **DNS** (similar
  a DNSTT/SlipStream): protocolo propio + ARQ, multipath, duplicación de paquetes,
  health-checks de resolvers, **proxy SOCKS5/SOCKS4 local**, caché DNS. Probado en
  apagones totales de Internet (Irán).
- **Análisis de encaje:** **no es una herramienta de scraping/crawling/parsing/
  extracción.** Es infraestructura de red para sobrevivir a censura. Su único punto
  de contacto con un AIO de scraping es que expone un **SOCKS5 local** por el que
  se podría enrutar el egress de un crawl hacia destinos censurados/geobloqueados.
- **Conservar:** únicamente como **transporte de red opcional y fuera de banda**.
  El AIO ya cubre proxy/UA con Crawlee; aquí solo se documenta cómo apuntar un
  proxy a su SOCKS5.
- **Descartar del core:** **todo el código.** Vendorizarlo o convertirlo en "engine"
  sería precisamente el *merge desordenado* que el objetivo quiere evitar (mezclar
  dominios distintos). Licencia MIT (permisiva), pero la decisión no es de licencia
  sino de **pertinencia**.
- **Decisión:** **fuera del core.** Documentado como egress SOCKS5 opcional en
  `.env.example` (`AIO_PROXY_URL`, comentado) y README. El cableado real del proxy
  a través de Crawlee queda como TODO honesto (no se finge implementado).

---

## 3. Solapamientos y deduplicación

| Capacidad | Repos que la implementan | Decisión |
|-----------|--------------------------|----------|
| Descubrimiento/crawl de URLs | Scrapy, Crawlee, Katana, Firecrawl, Crawl4AI | **Core = Crawlee**; Katana para velocidad; Scrapy para pipelines masivos |
| scrape → Markdown | Crawl4AI, Firecrawl | **Crawl4AI** (Apache, self-host) primario; Firecrawl opcional (AGPL service) |
| Extracción estructurada (schema) | ScrapeGraphAI, Crawl4AI, Firecrawl `extract` | **ScrapeGraphAI** primario; Crawl4AI alterno |
| Automatización de navegador | Playwright, Puppeteer (Crawlee), browser-use | **Playwright** primitiva; **browser-use** para agéntico |
| Cola de jobs | Scrapy (scheduler), Crawlee (RequestQueue), Firecrawl (Redis/nuq), Maxun (graphile) | **Crawlee RequestQueue** intra-crawl + **BullMQ/Redis** para jobs del AIO |
| Exports (JSON/CSV/...) | Scrapy feed exports, Crawlee Dataset, Maxun | **Capa de export unificada** del core (inspirada en Scrapy) |
| robots.txt / sitemaps | Scrapy, Katana, Crawlee | Unificar en `packages/core` (utilidad compartida) |
| Rate limit / proxy / UA | Scrapy AutoThrottle, Crawlee SessionPool+proxy+fingerprint | **Crawlee** (más completo) |
| API REST | Firecrawl, Maxun | **API propia** (Fastify/Express) con contrato inspirado en Firecrawl |
| Web UI | Maxun | **Maxun** como base opcional de `apps/web` |
| CLI | Crawl4AI (`crwl`), Crawlee CLI, browser-use, Katana | **CLI propia** unificada que orquesta engines |
| IA / LLM | ScrapeGraphAI, Crawl4AI, browser-use | Capa `modules/ai` con proveedores unificados |
| Seguridad de contenido | WipeDown | **Único** → módulo transversal obligatorio antes de IA |
| Anti-bot / stealth fetching | Crawl4AI (stealth), **Scrapling**, browser-use | **Scrapling** primario (Cloudflare Turnstile de fábrica); Crawl4AI alterno |
| Selectores auto-reparables | **Scrapling** (único) | **Scrapling** — capacidad nueva que el AIO no tenía |
| Servidor MCP | browser-use, **Scrapling**, Maxun | Disponible vía engines; expuesto incrementalmente |
| Egress / red anti-censura | **MasterDnsVPN** (único) | **Fuera del core**: SOCKS5 opcional, no es un engine |

---

## 4. Repo base y arquitectura recomendada

- **Núcleo / plano de control:** **TypeScript + Node (monorepo pnpm + Turborepo)**.
  Razones: 4 de los componentes "producto" más fuertes son TS (Crawlee, Firecrawl,
  Playwright, Maxun); TS habilita de forma natural los `apps/web`, `apps/desktop`
  (Electron/Tauri sobre el front) y `apps/cli` que pide el objetivo; Crawlee (Apache)
  da gratis cola, pool, proxy, sesiones y storages.
- **Motor base del crawling:** **Crawlee**.
- **Capa de IA/extracción y scrape avanzado:** **servicio Python** (FastAPI) que
  envuelve Crawl4AI, **Scrapling** (stealth/adaptativo), ScrapeGraphAI y browser-use
  detrás de una API interna; **WipeDown** como saneo previo.
- **Motor de descubrimiento rápido:** **binario Katana (Go)** tras un adaptador.
- **Servicios AGPL opcionales y aislados:** **Firecrawl** (API) y **Maxun** (web),
  vía Docker + adaptador HTTP. Nunca vendidos en el core.
- **Egress de red opcional (fuera del core):** **MasterDnsVPN** como proxy SOCKS5
  fuera de banda para destinos censurados. No es un engine; no se vendoriza.
- **Patrón unificador:** todos los engines implementan una interfaz común
  `ScrapeEngine` / `CrawlEngine` con un **modelo de Job y un esquema de salida
  únicos**; el core enruta cada job al engine adecuado.

Detalle completo en `ARCHITECTURE.md`.

### Tabla "conservar / descartar / refactor / pendiente"

- **Conservar e integrar ya:** Crawlee (core), Crawl4AI (markdown/extract),
  **Scrapling (stealth/adaptativo)**, ScrapeGraphAI (structured), browser-use
  (agent), WipeDown (security), Katana (discovery), Playwright (driver).
- **Conservar como servicio AGPL aislado:** Firecrawl (API), Maxun (web UI).
- **Refactorizar:** envolver Scrapy/Crawl4AI/Scrapling/ScrapeGraphAI/browser-use
  bajo una API Python única en `services/py-ai`; normalizar salidas al esquema común.
- **Pendiente/documentado (no rompe):** adaptador Katana (requiere binario),
  servicio Firecrawl (requiere despliegue), `apps/web` sobre Maxun (decisión AGPL),
  wiring real de Scrapling/Crawl4AI en `py-ai` (libs opcionales).
- **Fuera del core (documentado, no es scraping):** **MasterDnsVPN** — egress
  SOCKS5 opcional para redes censuradas; no se integra ni se vendoriza.

---

## 5. Riesgos y notas

1. **Polyglot runtime:** el AIO necesita Node + Python + (opcional) Go/Docker. Se
   gestiona con `docker-compose` y adaptadores que degradan con gracia si un engine
   no está instalado.
2. **AGPL:** mantener Firecrawl/Maxun como servicios separados; documentar en cada
   adaptador la frontera de licencia.
3. **Dependencias pesadas (torch, transformers, navegadores):** opcionales por engine;
   el core arranca sin ellas.
4. **Prompt-injection en contenido scrapeado:** mitigado con WipeDown obligatorio
   antes de cualquier paso LLM (riesgo real, ya observado en este propio dataset).
5. **No reinventar:** primero se cablea lo existente tras la interfaz común; no se
   crean engines nuevos hasta agotar lo que ya hay.

---

## 6. Capa de captcha (carpeta `repos-captch/`) `[NUEVO 2026-06-27]`

Cuatro repos adicionales, en una carpeta aparte (`repos-captch/`, no `repos/`).
Aportan una **capa que el AIO no tenía: resolución de CAPTCHAs**, complementaria al
stealth de Scrapling (Scrapling *evita* la detección; estos *resuelven* el reto
cuando el sitio igualmente lo presenta).

| Repo | Qué es | Licencia | Veredicto |
|------|--------|----------|-----------|
| **2captcha-python** | Cliente oficial del servicio comercial 2Captcha (recaptcha v2/v3, hcaptcha, **turnstile**, funcaptcha, geetest, datadome, image/text… +30 tipos) | **MIT** | **Integrar — proveedor primario** |
| **ai-captcha-bypass** | Solver por IA multimodal (GPT-4o + Gemini) con Selenium: texto, reCAPTCHA v2, puzzle, audio | Custom **permisiva** | **Integrar selectivo — proveedor secundario self-hosted** (prompts/técnicas, no el pegamento Selenium) |
| **captcha_bypass** | reCAPTCHA v2 con Selenium + Buster (audio) + ratón B-spline | **SIN licencia** | **Solo referencia** (código no reutilizable; empaqueta `.xpi` GPL + binarios) |
| **challenge-bypass-extension** | Extensión Privacy Pass (tokens vs captcha) | BSD-3, **DEPRECATED** | **Fuera de alcance** (extensión interactiva, no librería; obsoleta) |

**Arquitectura adoptada** (consistente con "orquestación, no fusión"): módulo
`modules/captcha` (`@aio/captcha`) con una interfaz `CaptchaSolver` y proveedores
intercambiables:

```
CaptchaSolver { name, isAvailable(), solve(challenge) → solution }
  ├─ TwoCaptchaProvider → py-ai /captcha/solve (envuelve twocaptcha)   [primario, de pago, REAL]
  └─ AiVisionProvider   → py-ai /captcha/solve (provider=ai)           [secundario, self-host, STUB]
```

- El cliente `twocaptcha` (Python, MIT) vive en `services/py-ai`; la `TWOCAPTCHA_API_KEY`
  queda server-side. CLI: `aio captcha <tipo> --url … --sitekey …`.
- Proveedores degradan con `isAvailable(): false` si falta lib o key (mismo patrón
  que el resto de engines).
- **Nota ética/legal:** resolver captchas evade defensas anti-bot y suele chocar con
  ToS. Uso legítimo: sitios propios, engagements autorizados, accesibilidad, o donde
  el ToS lo permita. Dimensionado para uso autorizado.
- **No integrado:** `captcha_bypass` (sin licencia) y Privacy Pass (deprecado, no
  programable) — solo referencia de técnicas (ratón humano, tokens).

Detalle de mapeo en `MIGRATION_NOTES.md`.
