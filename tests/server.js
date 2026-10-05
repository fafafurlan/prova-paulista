/* Servidor local para os testes: arquivos do site + /api/ranking (a mesma função
 * da Vercel) + um Redis falso que fala o protocolo REST da Upstash (/pipeline).
 * Também imita o cleanUrls da Vercel (/privacidade -> privacidade.html, /cursos -> cursos/index.html). */
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "provao-paulista-2026");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".png": "image/png", ".webmanifest": "application/manifest+json", ".xml": "application/xml", ".txt": "text/plain", ".svg": "image/svg+xml" };

function fakeRedis() {
  const db = new Map();
  const map = (k) => { if (!db.has(k)) db.set(k, new Map()); return db.get(k); };
  const sorted = (k) => [...(db.get(k) || new Map()).entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? 1 : -1));
  const del = (k, ms) => ms.reduce((n, m) => n + ((db.get(k) || new Map()).delete(m) ? 1 : 0), 0);
  const run = ([op, ...a]) => {
    switch (op) {
      case "ZADD": map(a[0]).set(a[2], Number(a[1])); return 1;
      case "ZREM": return del(a[0], a.slice(1));
      case "ZCARD": return (db.get(a[0]) || new Map()).size;
      case "ZREVRANGE": { const s = sorted(a[0]).slice(+a[1], +a[2] + 1); return a[3] ? s.flatMap(([m, sc]) => [m, String(sc)]) : s.map((x) => x[0]); }
      case "ZREVRANK": { const i = sorted(a[0]).findIndex((x) => x[0] === a[1]); return i < 0 ? null : i; }
      case "ZSCORE": { const v = (db.get(a[0]) || new Map()).get(a[1]); return v === undefined ? null : String(v); }
      case "ZRANGEBYSCORE": return [...(db.get(a[0]) || new Map()).entries()].filter(([, s]) => s >= +a[1] && s <= +a[2]).map((x) => x[0]);
      case "HSET": map(a[0]).set(a[1], a[2]); return 1;
      case "HDEL": return del(a[0], a.slice(1));
      case "HMGET": return a.slice(1).map((f) => (db.get(a[0]) || new Map()).get(f) ?? null);
      case "GET": return db.get(a[0]) ?? null;
      case "SET": db.set(a[0], a[1]); return "OK";
      case "DEL": return db.delete(a[0]) ? 1 : 0;
      case "INCR": { const v = (Number(db.get(a[0])) || 0) + 1; db.set(a[0], String(v)); return v; }
      case "EXPIRE": return 1;
      default: throw new Error(`comando não suportado: ${op}`);
    }
  };
  // Envelhece todos os registros do ranking (para testar a retenção de 180 dias).
  const age = () => { for (const [k, v] of db) if (k.startsWith("rkt:")) for (const m of v.keys()) v.set(m, 1000); };
  return { run, age };
}

function listen(server) {
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server.address().port)));
}

async function start() {
  const redis = fakeRedis();
  const redisServer = http.createServer((req, res) => {
    let body = "";
    req.on("data", (d) => (body += d));
    req.on("end", () => {
      if (req.headers.authorization !== "Bearer teste") { res.writeHead(401); return res.end(); }
      const out = JSON.parse(body).map((c) => { try { return { result: redis.run(c) }; } catch (e) { return { error: e.message }; } });
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(out));
    });
  });
  const redisPort = await listen(redisServer);
  process.env.KV_REST_API_URL = `http://127.0.0.1:${redisPort}`;
  process.env.KV_REST_API_TOKEN = "teste";
  delete require.cache[require.resolve(path.join(ROOT, "api/ranking.js"))];
  const handler = require(path.join(ROOT, "api/ranking.js"));

  const site = http.createServer((req, res) => {
    const u = new URL(req.url, "http://localhost");
    let body = "";
    req.on("data", (d) => (body += d));
    req.on("end", () => {
      if (u.pathname === "/api/ranking") {
        req.query = Object.fromEntries(u.searchParams);
        req.body = body ? JSON.parse(body) : undefined;
        req.headers["x-forwarded-proto"] = "http";
        const r = { code: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; },
          json(o) { res.writeHead(this.code, { ...this.headers, "content-type": "application/json" }); res.end(JSON.stringify(o)); } };
        return handler(req, r);
      }
      let f = path.join(ROOT, u.pathname === "/" ? "index.html" : decodeURIComponent(u.pathname));
      if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
      if (!fs.existsSync(f) && fs.existsSync(`${f}.html`)) f = `${f}.html`;
      if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
      if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" });
      fs.createReadStream(f).pipe(res);
    });
  });
  const port = await listen(site);
  return {
    url: `http://127.0.0.1:${port}`,
    age: redis.age,
    close: () => Promise.all([new Promise((r) => site.close(r)), new Promise((r) => redisServer.close(r))]),
  };
}

module.exports = { start, ROOT };
