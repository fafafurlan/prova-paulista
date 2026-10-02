/* Ranking dos alunos por escola (Vercel Function + Upstash Redis via REST).
 *
 * GET    /api/ranking?escola=…&cidade=…   lista da escola (+ sua posição, com o header X-Rank-Token)
 * POST   /api/ranking  {token, nome, escola, cidade, n1, n2, n3}   entra/atualiza
 * DELETE /api/ranking  {token}                                      sai do ranking
 *
 * Variáveis de ambiente (criadas pela integração Upstash da Vercel):
 *   KV_REST_API_URL / KV_REST_API_TOKEN  ou  UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
 */
"use strict";
const crypto = require("crypto");

const TOTAL_QUESTOES = 60;
const TOP_N = 50;
const WRITES_PER_HOUR = 300; // por IP: uma escola inteira pode sair pelo mesmo IP

const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis(commands) {
  const r = await fetch(`${REDIS_URL}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(commands),
  });
  if (!r.ok) throw new Error(`redis ${r.status}`);
  const out = await r.json();
  return out.map((x) => {
    if (x.error) throw new Error(x.error);
    return x.result;
  });
}

const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const hash = (s) => crypto.createHash("sha256").update(s).digest("hex");
const schoolId = (escola, cidade) => hash(`${norm(escola)}|${norm(cidade)}`).slice(0, 20);

// Lista oficial de escolas (escolas.json do próprio site), em memória por instância.
let ESCOLAS = null;
async function escolaValida(req, escola, cidade) {
  if (!ESCOLAS) {
    const proto = req.headers["x-forwarded-proto"] || "https";
    const r = await fetch(`${proto}://${req.headers.host}/escolas.json`);
    if (!r.ok) throw new Error("escolas.json indisponível");
    ESCOLAS = new Set((await r.json()).map(([n, c]) => `${norm(n)}|${norm(c)}`));
  }
  return ESCOLAS.has(`${norm(escola)}|${norm(cidade)}`);
}

// "ana beatriz souza" -> "Ana S."; só letras, para não virar canal de recado.
function nomeExibido(nome) {
  const w = String(nome || "").replace(/[^\p{L}\s'-]/gu, " ").split(/\s+/).filter(Boolean);
  if (!w.length) return null;
  const cap = (s) => s.charAt(0).toLocaleUpperCase("pt-BR") + s.slice(1).toLocaleLowerCase("pt-BR");
  const first = cap(w[0]).slice(0, 18);
  return w.length > 1 ? `${first} ${w[w.length - 1].charAt(0).toLocaleUpperCase("pt-BR")}.` : first;
}

const inteiro = (v, max) => (Number.isInteger(v) && v >= 0 && v <= max ? v : null);
function notaFinal(n1, n2, n3) {
  const nota = 0.25 * (n1 / TOTAL_QUESTOES) * 100 + 0.25 * (n2 / TOTAL_QUESTOES) * 100 + 0.5 * n3;
  return Math.round(nota * 10) / 10;
}

async function lista(sid, me) {
  const k = `rk:${sid}`;
  const cmds = [["ZREVRANGE", k, "0", String(TOP_N - 1), "WITHSCORES"], ["ZCARD", k]];
  if (me) cmds.push(["ZREVRANK", k, me], ["ZSCORE", k, me]);
  const [range, total, rank, score] = await redis(cmds);
  const ids = range.filter((_, i) => i % 2 === 0);
  const nomes = ids.length ? await redis([["HMGET", `rkn:${sid}`, ...ids]]) : [[]];
  const top = ids.map((id, i) => ({ pos: i + 1, nome: nomes[0][i] || "Aluno(a)", nota: Number(range[i * 2 + 1]), voce: id === me }));
  return { total: Number(total) || 0, top, voce: me && rank !== null && rank !== undefined ? { pos: Number(rank) + 1, nota: Number(score) } : null };
}

async function limite(req) {
  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "anon";
  const k = `rl:${hash(ip).slice(0, 16)}`;
  const [n] = await redis([["INCR", k], ["EXPIRE", k, "3600", "NX"]]);
  return Number(n) <= WRITES_PER_HOUR;
}

function body(req) {
  if (req.body && typeof req.body === "object") return req.body;
  try { return JSON.parse(req.body || "{}"); } catch (e) { return {}; }
}
const tokenOk = (t) => typeof t === "string" && /^[a-f0-9]{64}$/.test(t);

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!REDIS_URL || !REDIS_TOKEN) return res.status(503).json({ error: "nao_configurado" });
  try {
    if (req.method === "GET") {
      const { escola, cidade } = req.query || {};
      const token = req.headers["x-rank-token"];
      if (!escola || !cidade) return res.status(400).json({ error: "escola_obrigatoria" });
      const me = tokenOk(token) ? hash(token) : null;
      return res.status(200).json(await lista(schoolId(escola, cidade), me));
    }

    const b = body(req);
    if (!tokenOk(b.token)) return res.status(400).json({ error: "token_invalido" });
    const me = hash(b.token);

    if (req.method === "DELETE") {
      const [old] = await redis([["GET", `dev:${me}`]]);
      if (old) await redis([["ZREM", `rk:${old}`, me], ["HDEL", `rkn:${old}`, me], ["DEL", `dev:${me}`]]);
      return res.status(200).json({ ok: true });
    }

    if (req.method === "POST") {
      if (!(await limite(req))) return res.status(429).json({ error: "muitas_tentativas" });
      const n1 = inteiro(b.n1, TOTAL_QUESTOES), n2 = inteiro(b.n2, TOTAL_QUESTOES), n3 = inteiro(b.n3, 100);
      const nome = nomeExibido(b.nome);
      if (n1 === null || n2 === null || n3 === null) return res.status(400).json({ error: "notas_invalidas" });
      if (!nome) return res.status(400).json({ error: "nome_obrigatorio" });
      if (!b.escola || !b.cidade || !(await escolaValida(req, b.escola, b.cidade))) return res.status(400).json({ error: "escola_invalida" });
      const sid = schoolId(b.escola, b.cidade);
      const [old] = await redis([["GET", `dev:${me}`]]);
      const cmds = [];
      if (old && old !== sid) cmds.push(["ZREM", `rk:${old}`, me], ["HDEL", `rkn:${old}`, me]);
      cmds.push(["ZADD", `rk:${sid}`, String(notaFinal(n1, n2, n3)), me], ["HSET", `rkn:${sid}`, me, nome], ["SET", `dev:${me}`, sid]);
      await redis(cmds);
      return res.status(200).json(await lista(sid, me));
    }

    res.setHeader("Allow", "GET, POST, DELETE");
    return res.status(405).json({ error: "metodo" });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "erro_interno" });
  }
};

module.exports.config = { maxDuration: 10 };
module.exports._test = { nomeExibido, notaFinal, schoolId };
