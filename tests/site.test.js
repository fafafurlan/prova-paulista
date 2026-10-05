/* Testes do site no navegador (Playwright + Chromium). Requisições externas
 * (fontes, confete, analytics) são bloqueadas para o teste não depender de internet. */
"use strict";
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const { start, ROOT } = require("./server");

let srv, browser;
before(async () => {
  srv = await start();
  browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
});
after(async () => { await browser.close(); await srv.close(); });

async function abrir({ estado, perfil, largura = 1366, caminho = "/" } = {}) {
  const ctx = await browser.newContext({ viewport: { width: largura, height: 900 } });
  await ctx.addInitScript(([e, p]) => {
    if (sessionStorage.getItem("seed")) return;
    sessionStorage.setItem("seed", "1");
    localStorage.setItem("pp26-welcome-done", "1");
    if (e) localStorage.setItem("pp26-state", e);
    if (p) localStorage.setItem("pp26-profile", p);
  }, [estado ? JSON.stringify(estado) : null, perfil ? JSON.stringify(perfil) : null]);
  const page = await ctx.newPage();
  const erros = [];
  page.on("pageerror", (e) => erros.push(e.message));
  await page.route((url) => !url.href.startsWith(srv.url), (r) => r.abort());
  await page.goto(srv.url + caminho, { waitUntil: "networkidle" });
  if (caminho === "/") await page.waitForFunction(() => document.querySelectorAll("#grid .row").length > 0);
  return { page, ctx, erros };
}
const legenda = (page) => page.$$eval(".leg", (ls) => Object.fromEntries(ls.map((l) => [l.dataset.chance, Number(l.querySelector("[data-num]").textContent.replace(/\D/g, ""))])));
const aba = (page, nome) => page.click(`[data-tab="${nome}"]`);
const esperar = (page) => page.waitForTimeout(700); // count-up e debounce dos filtros
const setDet = (page, k, v) => page.$eval(`#det-${k}`, (el, v) => { el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); }, v);

// Contagem independente, direto de cursos.json, com a regra da planilha (modo nota única).
function contagemEsperada(n1, n2, n3) {
  const cursos = JSON.parse(fs.readFileSync(path.join(ROOT, "cursos.json"), "utf8"));
  const base = 0.25 * (n1 / 90) * 100 + 0.25 * (n2 / 90) * 100;
  const r = { boa: 0, possivel: 0, dificil: 0, muito: 0, fora: 0 };
  for (const c of cursos) {
    const media = Math.max(0, (c.notaEstimada - base) / 0.5), gap = media - n3;
    r[media > 100 ? "fora" : gap <= 5 ? "boa" : gap <= 15 ? "possivel" : gap <= 25 ? "dificil" : "muito"]++;
  }
  return { total: cursos.length, ...r };
}

test("carrega os cursos e calcula a nota padrão", async () => {
  const { page, ctx, erros } = await abrir();
  const esp = contagemEsperada(60, 63, 70);
  assert.equal(await page.textContent("#countLabel"), `${esp.total.toLocaleString("pt-BR")} de ${esp.total.toLocaleString("pt-BR")}`);
  await esperar(page);
  assert.equal(await page.textContent("#notaFinal"), "69,2");
  const leg = await legenda(page);
  for (const k of ["boa", "possivel", "dificil", "muito", "fora"]) assert.equal(leg[k], esp[k], k);
  assert.deepEqual(erros, []);
  await ctx.close();
});

test("converte acertos salvos na escala antiga de 60 questões", async () => {
  const { page, ctx } = await abrir({ estado: { n1: 40, n2: 42, n3: 70 } });
  assert.equal(await page.inputValue("#n1Num"), "60");
  assert.equal(await page.inputValue("#n2Num"), "63");
  await esperar(page);
  assert.equal(await page.textContent("#notaFinal"), "69,2");
  await ctx.close();
});

test("filtros, busca e limpar filtros", async () => {
  const { page, ctx } = await abrir();
  await aba(page, "cursos");
  await page.click('#instChips button[data-inst="USP"]');
  assert.match(await page.textContent("#countLabel"), /^173 de/);
  await page.fill("#q", "medicina");
  await page.waitForTimeout(400);
  assert.match(await page.textContent("#activeList"), /medicina.*USP/);
  await page.selectOption("#fChance", "boa");
  await page.waitForTimeout(300);
  assert.equal(await page.isVisible("#empty"), true);
  await page.click("#btnClearFilters2");
  await page.waitForTimeout(300);
  assert.match(await page.textContent("#countLabel"), /^1\.805 de/);
  assert.equal(await page.isVisible("#activeFilters"), false);
  await ctx.close();
});

test("filtros não ficam salvos entre visitas", async () => {
  const { page, ctx } = await abrir({ estado: { v: 2, n1: 60, n2: 63, n3: 70, inst: "UNICAMP", chance: "muito" } });
  assert.match(await page.textContent("#countLabel"), /^1\.805 de/);
  await ctx.close();
});

test("modo por área: pesos, mínimo de 22 acertos e redação mínima", async () => {
  const { page, ctx, erros } = await abrir();
  await page.click('[data-modo="area"]');
  await esperar(page);
  const notas = await page.$$eval("#areaPick [data-area]", (bs) => bs.map((b) => b.querySelector("[data-areanota]").textContent));
  assert.deepEqual(notas, ["67,5", "66,7", "66,9"]); // padrões 16/11/16/14 + redação 70
  for (const [k, v] of [["ling", 5], ["mat", 4], ["hum", 6], ["nat", 5]]) await setDet(page, k, v);
  await esperar(page);
  assert.match(await page.textContent("#detAlert"), /22 acertos/);
  await aba(page, "cursos");
  await page.fill("#q", "direito");
  await page.waitForTimeout(400);
  const direito = await page.$$eval("#grid .row", (rs) => rs.filter((r) => r.textContent.includes("Direito")).map((r) => [r.querySelector(".inst").textContent, r.dataset.chance, r.querySelector("[data-gap]").textContent]));
  assert.ok(direito.length > 0);
  for (const [inst, chance, gap] of direito) if (["USP", "UNESP", "UNICAMP"].includes(inst)) { assert.equal(chance, "fora"); assert.match(gap, /22 acertos/); }
  await page.fill("#q", "");
  await aba(page, "nota");
  await setDet(page, "red", 10);
  await esperar(page);
  const leg = await legenda(page);
  assert.equal(leg.fora, 1805);
  assert.deepEqual(erros, []);
  await ctx.close();
});

test("ranking: entrar, aparecer como Ana S. e sair", async () => {
  const perfil = { nome: "Ana Beatriz Souza", escola: "E.E. Deputado Rubens Paiva", cidade: "Praia Grande" };
  const { page, ctx, erros } = await abrir({ perfil });
  await aba(page, "ranking");
  await page.waitForSelector("#rankJoin");
  await page.click("#rankJoin");
  await page.waitForSelector(".rank-list li.me");
  assert.match(await page.textContent(".rank-list li.me"), /Ana S\./);
  assert.match(await page.getAttribute("#rankBody .btn-whats", "href"), /^https:\/\/wa\.me\/\?text=/);
  await page.click('[data-rank="leave"]');
  await page.waitForSelector("#rankJoin");
  const r = await (await fetch(`${srv.url}/api/ranking?escola=${encodeURIComponent(perfil.escola)}&cidade=${encodeURIComponent(perfil.cidade)}`)).json();
  assert.equal(r.total, 0);
  assert.deepEqual(erros, []);
  await ctx.close();
});

test("compartilhar: imagem e link do WhatsApp", async () => {
  const { page, ctx } = await abrir();
  await page.click("#btnMenu");
  await page.click("#btnShare");
  await page.waitForSelector("#shareModal:not([hidden])");
  assert.match(await page.getAttribute("#shareImg", "src"), /^data:image\/png;base64,/);
  const href = await page.getAttribute("#shareWhats", "href");
  assert.match(decodeURIComponent(href), /Minha nota projetada.*ref=whatsapp/s);
  await ctx.close();
});

test("celular: sem rolagem horizontal", async () => {
  const { page, ctx } = await abrir({ largura: 390 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= 390));
  await page.click('[data-modo="area"]');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= 390));
  await ctx.close();
});

test("página de privacidade e manifest do app", async () => {
  const { page, ctx, erros } = await abrir({ caminho: "/privacidade" });
  assert.match(await page.title(), /Privacidade/);
  assert.match(await page.textContent("main"), /simuladorprovao2026@gmail\.com/);
  assert.match(await page.textContent("main"), /180 dias/);
  assert.deepEqual(erros, []);
  await ctx.close();
  const m = await (await fetch(`${srv.url}/manifest.webmanifest`)).json();
  assert.equal(m.display, "standalone");
  for (const i of m.icons) assert.equal((await fetch(`${srv.url}/${i.src}`)).status, 200, i.src);
});

test("abas: navegação, link direto e faixa de chance leva à lista filtrada", async () => {
  const { page, ctx, erros } = await abrir({ caminho: "/#ranking" });
  assert.equal(await page.isVisible("#secao-ranking"), true);
  assert.equal(await page.isVisible("#painel-nota"), false);
  await aba(page, "nota");
  await esperar(page);
  await page.click('.leg[data-chance="possivel"]');
  assert.equal(await page.isVisible("#painel-cursos"), true);
  assert.match(await page.textContent("#activeList"), /Possível/);
  assert.equal(new URL(page.url()).hash, "#cursos");
  assert.deepEqual(erros, []);
  await ctx.close();
});

test("lista compacta: tocar no curso mostra os detalhes", async () => {
  const { page, ctx } = await abrir();
  await aba(page, "cursos");
  const linha = page.locator("#grid .row").first();
  assert.equal(await linha.locator(".row-details").isVisible(), false);
  await linha.locator(".row-main").click();
  assert.equal(await linha.locator(".row-details").isVisible(), true);
  assert.match(await linha.locator(".row-details").textContent(), /Vagas.*Nota estimada.*Média na 3ª/s);
  await linha.locator("[data-pin]").click();
  assert.equal(await page.isVisible("#compare"), true);
  await ctx.close();
});

test("menu do topo abre, troca o tema e fecha com Esc", async () => {
  const { page, ctx } = await abrir();
  await page.click("#btnMenu");
  assert.equal(await page.isVisible("#menu"), true);
  const antes = await page.getAttribute("html", "data-theme");
  await page.click("#btnTheme");
  assert.notEqual(await page.getAttribute("html", "data-theme"), antes);
  assert.equal(await page.isVisible("#menu"), false);
  await page.click("#btnMenu");
  await page.keyboard.press("Escape");
  assert.equal(await page.isVisible("#menu"), false);
  await ctx.close();
});
