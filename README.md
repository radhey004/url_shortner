# ShortLink 🔗 — Scalable URL Shortener with Redis Caching

A full-stack URL shortening service built to explore real system design tradeoffs — caching strategy, database indexing, and async processing — not just another CRUD app.

![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=flat&logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=flat&logo=mongodb&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?style=flat&logo=redis&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=flat&logo=react&logoColor=black)

**[Live Demo](https://scalable-url-shortner.vercel.app)** · **[API Docs](#api-endpoints)** · **[Design Decisions](#design-decisions--tradeoffs)**
 
> **Note:** The live demo runs on free-tier hosting (Render + Vercel). If the link above isn't loading — Render's free tier spins down after inactivity and can take 10-15s to wake up on first load. If it's still unavailable, here's a screenshot of the app in action:
>
> ![ShortLink demo](./demo.png)

---

## The Problem

Long URLs are unwieldy to share, easy to mistype, and give no visibility into how often a link is actually used. A URL shortener solves this — but the interesting engineering problem isn't the redirect itself, it's making that redirect **fast at scale** when reads vastly outnumber writes.

## The Solution

ShortLink generates short, unique codes for long URLs and serves redirects through a **cache-aside layer** in front of MongoDB, so repeated lookups on popular links skip the database entirely. Click analytics are tracked asynchronously so they never add latency to the redirect path.

---

## Features

- 🔗 Shorten any valid URL into a compact, unique code
- ⚡ Redis cache-aside layer for sub-millisecond redirects on cached links
- 📊 Click tracking (count, timestamps) via non-blocking async writes
- 🛡️ Rate limiting on link creation to prevent abuse
- 🧭 Indexed MongoDB lookups for fast cache-miss fallback
- 💻 Simple React UI — shorten, copy, and view analytics

---

## Architecture

```
                    ┌─────────────┐
   Client ────────► │   Express    │
                    │     API      │
                    └──────┬───────┘
                           │
              ┌────────────┴────────────┐
              │                         │
       Cache HIT?                 Cache MISS
              │                         │
              ▼                         ▼
       ┌─────────────┐          ┌──────────────┐
       │    Redis     │ ◄────── │   MongoDB     │
       │ (short code   │  write   │  (source of   │
       │  → long URL)  │  back    │   truth)      │
       └─────────────┘          └──────────────┘
```

**Why cache-aside over write-through?** Writes (creating a short link) are infrequent; reads (redirects) are the hot path. Populating the cache lazily on first read — rather than on every write — avoids caching links that never get visited, keeping Redis memory usage proportional to actual traffic rather than total links created.

---

## Tech Stack

| Layer | Tech | Why |
|---|---|---|
| API | Node.js + Express | Non-blocking I/O fits a read-heavy, network-bound workload (mostly waiting on DB/cache, not CPU); minimal framework overhead for a focused API |
| Database | MongoDB Atlas | Indexed lookups on `shortCode` give O(log n) reads; flexible schema meant no migration overhead while iterating on the data model |
| Cache | Redis | In-memory key-value store built for exactly this access pattern — single-key lookups by `shortCode`; TTL support built in, no need to hand-roll expiry logic |
| Frontend | React | Component state (loading/error/result) maps cleanly to a small, interactive form — no need for heavier state management at this scale |
| Short code generation | `nanoid` | Collision-resistant, URL-safe by default, avoids hand-rolled hashing bugs that are easy to get subtly wrong |
| Testing | Jest + Supertest + mongodb-memory-server | In-memory Mongo means tests don't touch real Atlas data or require infra to be running — fast, isolated, CI-friendly |

All free/open-source — no paid services required to run this end-to-end.

---

## API Endpoints

```
POST   /api/shorten          { longUrl } → { shortCode, shortUrl }
GET    /:shortCode           → 302 redirect to longUrl (cache-aside lookup)
GET    /api/analytics/:code  → { clicks, createdAt }
DELETE /api/shorten/:code    → removes URL + invalidates cache
```

---

## Design Decisions & Tradeoffs

- **Cache-aside vs write-through**: chose cache-aside so Redis only holds links that are actually being accessed, not every link ever created — better memory efficiency for a system where most short links are never clicked more than a few times.
- **TTL-based expiry over manual invalidation only**: guards against stale cache entries if invalidation logic ever has a bug — the cache self-heals within the TTL window even in a worst case.
- **Async click tracking**: the redirect responds immediately; the click counter increments in a fire-and-forget write so analytics never slow down the user-facing redirect.
- **`nanoid(7)` for short codes**: gives a large enough keyspace to make collisions rare in practice, without the complexity of a custom encoding scheme — a pragmatic choice over engineering a distributed ID generator for a project at this scale.
- **What I'd change at higher scale**: add a CDN-level cache for the very hottest links, move to a distributed ID generator if running multiple write nodes, and add read replicas for MongoDB to handle cache-miss load separately from writes.

---

## Challenges & How They Were Solved

- **Node's SRV DNS resolution failing on Windows.** MongoDB Atlas connections use `mongodb+srv://` URIs, which require a DNS SRV lookup. Node's resolver failed with `querySrv ECONNREFUSED` even though MongoDB Compass connected fine with the identical URI. Isolated the issue by comparing Compass (uses the OS network stack) against Node (uses its own resolver) — confirmed it was Node-specific, not a network/firewall block. Fixed by explicitly setting Node's DNS servers (`dns.setServers(['8.8.8.8', '1.1.1.1'])`) before establishing the Mongo connection.
- **Getting a clean cache-hit vs. cache-miss comparison for load testing.** Redis re-populates on the very first request of a load test, so a naive "flush then load test" approach doesn't produce a true uncached baseline — the run self-warms within milliseconds. Solved by temporarily bypassing the Redis check in code to get a true MongoDB-only baseline, then restoring it for the cached run — giving a clean, comparable pair of numbers instead of a contaminated measurement.
- **Async click tracking without blocking the redirect.** Initially the click-count increment was `await`-ed before the redirect response, adding an extra database round-trip to the user-facing latency. Fixed by firing the update without awaiting it (with its own `.catch()` for error handling) so the redirect returns immediately regardless of when the write completes.

---

## Impact / Performance

Load tested with `autocannon` (50 concurrent connections, 10s duration) comparing the Redis cache-aside path against a MongoDB-only baseline:

| | Avg Latency | Throughput |
|---|---|---|
| **With Redis cache** | 49.72 ms | ~997 req/sec |
| **MongoDB only (no cache)** | 878.27 ms | ~53 req/sec |

**~17x lower latency and ~19x higher throughput** with the caching layer in place — demonstrating why cache-aside matters for a read-heavy system like a URL shortener, where the same handful of links get hit repeatedly.

---

## Getting Started

### Prerequisites
- Node.js (v18+)
- Docker (for local Redis)
- A free MongoDB Atlas account

### Setup

```bash
# Clone the repo
git clone https://github.com/yourusername/shortlink.git
cd shortlink

# Backend
cd server
npm install
docker-compose up -d   # starts local Redis
npm run dev

# Frontend
cd ../client
npm install
npm run dev
```

Create a `.env` file in `server/`:
```
MONGO_URI=your_atlas_connection_string
PORT=5000
CLIENT_URL=http://localhost:5173
```

---

## Project Structure

```
shortlink/
├── server/
│   ├── config/       # db.js, redis.js
│   ├── models/       # Url.js
│   ├── routes/       # shorten.js, redirect.js, analytics.js
│   ├── middleware/    # rateLimiter.js
│   ├── utils/          # logger.js
│   ├── tests/           # shorten.test.js
│   └── index.js
├── client/            # React frontend
├── docker-compose.yml
└── README.md
```

---

## Roadmap / Future Enhancements

- [ ] **Custom aliases** — let users pick a memorable slug instead of a random code; requires a uniqueness check against user input rather than trusting `nanoid`'s collision resistance
- [ ] **Distributed ID generation** — at higher write volume with multiple app instances, random short codes risk more frequent collisions; a Snowflake-style ID generator would guarantee uniqueness without a DB round-trip check
- [ ] **CDN-level caching for hot links** — Redis solves the app-tier bottleneck, but the very hottest links could be cached at the edge (e.g. Cloudflare) to skip the app server entirely
- [ ] **Read replicas for MongoDB** — currently all reads hit the same Mongo instance on cache miss; splitting reads to a replica would isolate that load from writes
- [ ] **QR code generation** — straightforward addition, useful for sharing short links outside a digital context
- [ ] **Link expiry** — auto-delete links after N days, useful for reducing storage and matching real-world link lifecycle

---

## License

MIT