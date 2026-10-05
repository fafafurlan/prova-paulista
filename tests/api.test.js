/* Testes da API do ranking (api/ranking.js) contra o Redis falso. */
"use strict";
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { start } = require("./server");
const nomeBloqueado = require("../provao-paulista-2026/bloqueio.js");

let srv;
before(async () => { srv = await start(); });
after(async () => { await srv.close(); });

const ESCOLA = { escola: "E.E. Deputado Rubens Paiva", cidade: "Praia Grande" };
const token = () => crypto.randomBytes(32).toString("hex");
const api = async (method, body, headers = {}) => {
  const q = new URLSearchParams(ESCOLA);
  const r = await fetch(method === "GET" ? `${srv.url}/api/ranking?${q}` : `${srv.url}/api/ranking`, {
    method, headers: { "content-type": "application/json", ...headers }, body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, data: await r.json() };
};
const entrar = (t, extra = {}) => api("POST", { token: t, nome: "Ana Beatriz Souza", ...ESCOLA, n1: 66.7, n2: 70, n3: 70, ...extra });

test("lista começa vazia", async () => {
  const { status, data } = await api("GET");
  assert.equal(status, 200);
  assert.deepEqual(data, { total: 0, top: [], voce: null });
});

test("entrar: nome vira primeiro nome + inicial e a nota é recalculada pelo servidor", async () => {
  const t = token();
  const { status, data } = await entrar(t);
  assert.equal(status, 200);
  assert.equal(data.top[0].nome, "Ana S.");
  assert.equal(data.top[0].nota, 69.2); // 0,25·66,7 + 0,25·70 + 0,5·70
  assert.equal(data.voce.pos, 1);
  await api("DELETE", { token: t });
});

test("nome com HTML e números é limpo", async () => {
  const t = token();
  const { data } = await entrar(t, { nome: "João <b>Pedro</b> Lima 123" });
  assert.equal(data.top.find((r) => r.voce).nome, "João L.");
  await api("DELETE", { token: t });
});

test("aceita notas de 0 a 100 com uma casa decimal e recusa as inválidas", async () => {
  const t = token();
  assert.equal((await entrar(t, { n1: 100, n2: 100, n3: 100 })).data.voce.nota, 100);
  assert.equal((await entrar(t, { n1: 72.5, n2: 0, n3: 0 })).data.voce.nota, 18.1);
  for (const bad of [{ n1: 100.5 }, { n2: -1 }, { n3: 101 }, { n1: 10.55 }, { n1: "40" }]) {
    const { status, data } = await entrar(t, bad);
    assert.equal(status, 400, JSON.stringify(bad));
    assert.equal(data.error, "notas_invalidas");
  }
  await api("DELETE", { token: t });
});

test("recusa escola fora da lista oficial e chave inválida", async () => {
  assert.equal((await entrar(token(), { escola: "Escola Inventada" })).data.error, "escola_invalida");
  assert.equal((await api("POST", { token: "123", nome: "x", ...ESCOLA, n1: 1, n2: 1, n3: 1 })).data.error, "token_invalido");
});

test("ordena por nota, reconhece o aluno pela chave e sai do ranking", async () => {
  const a = token(), b = token();
  await entrar(a, { nome: "Ana Souza" });
  await entrar(b, { nome: "Bruno Lima", n1: 80 });
  const comA = await api("GET", null, { "x-rank-token": a });
  assert.deepEqual(comA.data.top.map((r) => r.nome), ["Bruno L.", "Ana S."]);
  assert.equal(comA.data.voce.pos, 2);
  assert.equal(comA.data.top[1].voce, true);
  await api("DELETE", { token: a });
  await api("DELETE", { token: b });
  assert.equal((await api("GET")).data.total, 0);
});

test("mudar de escola move o registro", async () => {
  const t = token();
  await entrar(t);
  const outra = await api("POST", { token: t, nome: "Ana Souza", escola: "ETEC Engenheiro Herval Bellusci", cidade: "Adamantina", n1: 66.7, n2: 70, n3: 70 });
  assert.equal(outra.data.total, 1);
  assert.equal((await api("GET")).data.total, 0);
  await api("DELETE", { token: t });
});

test("registros sem atualização há mais de 180 dias são apagados", async () => {
  await entrar(token());
  assert.equal((await api("GET")).data.total, 1);
  srv.age();
  assert.equal((await api("GET")).data.total, 0);
});

test("filtro de nomes: barra ofensas e disfarces, deixa nomes reais passarem", () => {
  for (const n of ["Porra Silva", "p0rr4", "Caralhooo", "fdp", "Ana Puta", "C4r4lh0 da Silva", "p u n h e t a", "Hitler"]) assert.equal(nomeBloqueado(n), true, n);
  for (const n of ["Ana Beatriz Souza", "Paulo Pinto", "Ana Cunha", "Caroline Puttini", "Débora Fodor", "Sofia Rola", "Igor Caralin", "Lucas Pauletti"]) assert.equal(nomeBloqueado(n), false, n);
});

test("ranking recusa nome ofensivo", async () => {
  const { status, data } = await entrar(token(), { nome: "Caralho da Silva" });
  assert.equal(status, 400);
  assert.equal(data.error, "nome_invalido");
  assert.equal((await api("GET")).data.total, 0);
});
