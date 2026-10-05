/* Dá pra passar? Simulador do Provão Paulista Seriado 2026 — vanilla JS, sem build. */
"use strict";

const CONFIG = {
  TOTAL_QUESTOES_PROVA: 90,      // questões em cada prova (edital, Anexo IV)
  PESO_SERIE_1: 0.25,
  PESO_SERIE_2: 0.25,
  PESO_SERIE_3_REDACAO: 0.5,     // 30% prova da 3ª série + 20% redação
  LIMITES_CHANCE: { boa: 5, possivel: 15, dificil: 25 }, // pontos que faltam na média
  DATA_URL: "cursos.json",
  PAGE_SIZE: 60,                 // linhas renderizadas por lote (lazy render)
  MAX_PINS: 4,
  SITE_URL: "prova-paulista-provao-paulista-2026.vercel.app",
  STORAGE_KEY: "pp26-state",
  DEFAULTS: { n1: 60, n2: 63, n3: 70 },
  STATE_VERSION: 2,              // v1 usava 60 questões por prova
  // Provão Paulista Seriado III (Anexo IV): itens por área e pesos por área do curso (Anexo V, Quadro X).
  PROVA3_ITENS: { ling: 24, mat: 18, hum: 24, nat: 24 },
  PESO_OBJETIVA_3: 0.30,
  PESO_REDACAO: 0.20,
  PESOS_AREA: {
    humanas: { ling: 2, mat: 1, hum: 2, nat: 1, red: 2 },
    exatas: { ling: 1, mat: 3, hum: 1, nat: 2, red: 1 },
    biologicas: { ling: 2, mat: 1, hum: 1, nat: 3, red: 1 },
  },
  MIN_ACERTOS_3: 22,             // item 13.9: USP, Unesp e Unicamp
  INST_COM_MINIMO: ["USP", "UNESP", "UNICAMP"],
  REDACAO_MINIMA: 20,            // item 11.2.4: nota inferior a 20% da redação elimina
  DETALHE_DEFAULTS: { ling: 16, mat: 11, hum: 16, nat: 14, red: 70 },
};
const AREAS = { humanas: "Humanas e Artes", exatas: "Exatas e Tecnológicas", biologicas: "Biológicas e Saúde" };
const AREAS_CURTO = { humanas: "Humanas", exatas: "Exatas", biologicas: "Biológicas" };
const DET_CAMPOS = [
  { k: "ling", label: "Linguagens", max: () => CONFIG.PROVA3_ITENS.ling },
  { k: "mat", label: "Matemática", max: () => CONFIG.PROVA3_ITENS.mat },
  { k: "hum", label: "Ciências Humanas", max: () => CONFIG.PROVA3_ITENS.hum },
  { k: "nat", label: "Ciências da Natureza", max: () => CONFIG.PROVA3_ITENS.nat },
  { k: "red", label: "Redação", max: () => 100 },
];

const INSTITUICOES = ["USP", "UNESP", "UNICAMP", "FATEC", "UNIVESP"];
const CHANCES = [
  { key: "boa", label: "Boa chance" },
  { key: "possivel", label: "Possível" },
  { key: "dificil", label: "Difícil" },
  { key: "muito", label: "Muito difícil" },
  { key: "fora", label: "Fora de alcance" },
];
const CHANCE_BY_KEY = Object.fromEntries(CHANCES.map((c, i) => [c.key, { ...c, order: i }]));
const TURNOS = ["Integral", "Manhã", "Tarde", "Noite", "Misto", "EaD"];

/* Lucide icons (MIT), inline para evitar dependência. */
const ICONS = {
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2m-7.07-14.07 1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  share: '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="m16 6-4-4-4 4M12 2v13"/>',
  pin: '<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/>',
  whats: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/><path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1"/>',
  more: '<circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/><circle cx="5" cy="12" r="1.5"/>',
  nota: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
  lista: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  trofeu: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  copy: '<rect x="8" y="8" width="14" height="14" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
};
const icon = (name) => `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ""}</svg>`;

/* ---------- utils ---------- */
const $ = (s, r = document) => r.querySelector(s);
const nf1 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nf0 = new Intl.NumberFormat("pt-BR");
const fmt1 = (v) => nf1.format(v);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const norm = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
// Mesmas regras de scripts/build_paginas.py: "Medicina (Integral)" -> "medicina" (página /cursos/medicina).
const cursoBase = (s) => String(s).replace(/\s*\([^)]*\)/g, "").trim();
const slugCurso = (s) => norm(cursoBase(s)).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage indisponível */ } },
};

function turnoGrupo(t) {
  const s = norm(t);
  if (s.includes("ead")) return "EaD";
  if (s.includes("integral")) return "Integral";
  if (/[/(]|semestre|ano|bac/.test(s)) return "Misto";
  if (s.includes("manha") || s.includes("matutino")) return "Manhã";
  if (s.includes("tarde") || s.includes("vespertino")) return "Tarde";
  if (s.includes("noite") || s.includes("noturno")) return "Noite";
  return "Misto";
}

/* ---------- state ---------- */
const saved = store.get(CONFIG.STORAGE_KEY) || {};
// Estado salvo antes da correção para 90 questões: converte os acertos mantendo a mesma nota.
if (saved.v !== CONFIG.STATE_VERSION) {
  ["n1", "n2"].forEach((k) => { if (Number.isFinite(saved[k])) saved[k] = Math.round((saved[k] * 90) / 60); });
}
const savedDet = saved.det && typeof saved.det === "object" ? saved.det : {};
const state = {
  modo3: saved.modo3 === "area" ? "area" : "simples",
  det: Object.fromEntries(DET_CAMPOS.map((f) => [f.k, Number.isFinite(savedDet[f.k]) ? savedDet[f.k] : CONFIG.DETALHE_DEFAULTS[f.k]])),
  areaFoco: AREAS[saved.areaFoco] ? saved.areaFoco : "exatas",
  n1: Number.isFinite(saved.n1) ? saved.n1 : CONFIG.DEFAULTS.n1,
  n2: Number.isFinite(saved.n2) ? saved.n2 : CONFIG.DEFAULTS.n2,
  n3: Number.isFinite(saved.n3) ? saved.n3 : CONFIG.DEFAULTS.n3,
  // Filtros não são salvos: cada visita começa com todos os cursos.
  inst: "",
  chance: "",
  turno: "",
  sort: "ranking",
  q: "",
  curso: "", // slug vindo de /cursos/<curso> ("Simular minha chance")
  pins: Array.isArray(saved.pins) ? saved.pins.slice(0, CONFIG.MAX_PINS) : [],
  revId: Number.isInteger(saved.revId) ? saved.revId : null,
};
const persist = debounce(() => {
  const { n1, n2, n3, pins, revId, modo3, det, areaFoco } = state;
  store.set(CONFIG.STORAGE_KEY, { v: CONFIG.STATE_VERSION, n1, n2, n3, pins, revId, modo3, det, areaFoco });
}, 300);

let CURSOS = [];
let need = new Float32Array(0);
let chanceOf = [];
let elimOf = [];   // motivo de eliminação por curso ("" se nenhum)
let calc = { nota1: 0, nota2: 0, base: 0, final: 0, max: 0, own: {}, ownFoco: 0, acertos3: 0, elimRed: false, abaixo22: false };
let list = [];
let rendered = 0;
const nodeCache = new Map();

/* ---------- cálculo (fórmula oficial, Anexo V, Quadro II) ---------- */
function classify(media, estimativa) {
  if (media > 100) return "fora";
  const gap = media - estimativa;
  const L = CONFIG.LIMITES_CHANCE;
  if (gap <= L.boa) return "boa";
  if (gap <= L.possivel) return "possivel";
  if (gap <= L.dificil) return "dificil";
  return "muito";
}
function mediaNecessaria(notaCurso, base) {
  return Math.max(0, (notaCurso - base) / CONFIG.PESO_SERIE_3_REDACAO);
}
// Nota da prova objetiva da 3ª série (0–100) ponderada pelos pesos da área do curso.
function objetiva3(area) {
  const w = CONFIG.PESOS_AREA[area], it = CONFIG.PROVA3_ITENS, d = state.det;
  let soma = 0, pesos = 0;
  for (const k of ["ling", "mat", "hum", "nat"]) { soma += w[k] * (d[k] / it[k]) * 100; pesos += w[k]; }
  return soma / pesos;
}
// "3ª série + redação" combinadas (0–100), comparável com a média necessária de cada curso.
function own3(area) {
  if (state.modo3 !== "area") return state.n3;
  return (CONFIG.PESO_OBJETIVA_3 * objetiva3(area) + CONFIG.PESO_REDACAO * state.det.red) / CONFIG.PESO_SERIE_3_REDACAO;
}
function recompute() {
  const T = CONFIG.TOTAL_QUESTOES_PROVA;
  const nota1 = (state.n1 / T) * 100;
  const nota2 = (state.n2 / T) * 100;
  const base = CONFIG.PESO_SERIE_1 * nota1 + CONFIG.PESO_SERIE_2 * nota2;
  const own = Object.fromEntries(Object.keys(AREAS).map((a) => [a, own3(a)]));
  const detalhado = state.modo3 === "area";
  const acertos3 = detalhado ? state.det.ling + state.det.mat + state.det.hum + state.det.nat : null;
  const elimRed = detalhado && state.det.red < CONFIG.REDACAO_MINIMA;
  const abaixo22 = detalhado && acertos3 < CONFIG.MIN_ACERTOS_3;
  const ownFoco = own[state.areaFoco];
  calc = { nota1, nota2, base, own, ownFoco, acertos3, elimRed, abaixo22,
    final: base + CONFIG.PESO_SERIE_3_REDACAO * ownFoco, max: base + CONFIG.PESO_SERIE_3_REDACAO * 100 };
  for (let i = 0; i < CURSOS.length; i++) {
    const c = CURSOS[i];
    need[i] = mediaNecessaria(c.notaEstimada, base);
    elimOf[i] = elimRed ? "redação abaixo de 20"
      : abaixo22 && CONFIG.INST_COM_MINIMO.includes(c.instituicao) ? `menos de ${CONFIG.MIN_ACERTOS_3} acertos na 3ª` : "";
    chanceOf[i] = elimOf[i] ? "fora" : classify(need[i], own[c.area] ?? ownFoco);
  }
}
const ownOf = (i) => calc.own[CURSOS[i].area] ?? calc.ownFoco;
const proximity = (i) => (elimOf[i] ? 0 : need[i] <= 0 ? 100 : clamp((ownOf(i) / need[i]) * 100, 0, 100));
function gapText(i) {
  if (elimOf[i]) return elimOf[i];
  if (need[i] > 100) return "acima de 100";
  if (need[i] <= ownOf(i)) return "você já alcança";
  return `faltam ${fmt1(need[i] - ownOf(i))}`;
}

/* ---------- inputs ---------- */
const inputs = [
  { key: "n1", range: $("#n1Range"), num: $("#n1Num"), max: () => CONFIG.TOTAL_QUESTOES_PROVA, unit: "acertos" },
  { key: "n2", range: $("#n2Range"), num: $("#n2Num"), max: () => CONFIG.TOTAL_QUESTOES_PROVA, unit: "acertos" },
  { key: "n3", range: $("#n3Range"), num: $("#n3Num"), max: () => 100, unit: "pontos" },
];
function paintInput(inp) {
  const max = inp.max(), v = state[inp.key];
  inp.range.style.setProperty("--p", (v / max) * 100 + "%");
  inp.range.setAttribute("aria-valuetext", `${nf0.format(v)} ${inp.unit} de ${max}`);
}
function setValue(inp, v) {
  state[inp.key] = clamp(Math.round(v), 0, inp.max());
  inp.range.value = state[inp.key];
  paintInput(inp);
  scheduleUpdate();
}
function setupInputs() {
  document.querySelectorAll("[data-total]").forEach((el) => (el.textContent = CONFIG.TOTAL_QUESTOES_PROVA));
  inputs.forEach((inp) => {
    const max = inp.max();
    inp.range.max = max; inp.num.max = max;
    state[inp.key] = clamp(state[inp.key], 0, max);
    inp.range.value = state[inp.key]; inp.num.value = state[inp.key];
    inp.range.closest(".field").querySelectorAll("[data-step]").forEach((btn) => btn.addEventListener("click", () => {
      setValue(inp, state[inp.key] + Number(btn.dataset.step));
      inp.num.value = state[inp.key];
    }));
    paintInput(inp);
    inp.range.addEventListener("input", () => { setValue(inp, Number(inp.range.value)); inp.num.value = state[inp.key]; });
    inp.num.addEventListener("input", () => {
      const v = parseFloat(String(inp.num.value).replace(",", "."));
      if (Number.isFinite(v)) setValue(inp, v);
    });
    inp.num.addEventListener("change", () => { inp.num.value = state[inp.key]; });
    inp.num.addEventListener("focus", () => inp.num.select());
  });
}

/* ---------- 3ª série por área ---------- */
function setupDetalhe() {
  const grid = $("#detGrid");
  grid.innerHTML = DET_CAMPOS.map((f) => `
    <div class="det-item" data-d="${f.k}">
      <label for="det-${f.k}">${f.label} <small class="mono">${f.k === "red" ? "nota 0–100" : `de ${f.max()}`}</small></label>
      <div class="stepper sm">
        <button class="step" type="button" data-dstep="-1" aria-label="Diminuir ${f.label}">−</button>
        <input class="num-input num" id="det-${f.k}" type="number" inputmode="numeric" min="0" max="${f.max()}" step="1">
        <button class="step" type="button" data-dstep="1" aria-label="Aumentar ${f.label}">+</button>
      </div>
    </div>`).join("");
  const set = (k, v) => {
    const f = DET_CAMPOS.find((x) => x.k === k);
    state.det[k] = clamp(Math.round(v), 0, f.max());
    $(`#det-${k}`).value = state.det[k];
    scheduleUpdate();
  };
  DET_CAMPOS.forEach((f) => {
    const inp = $(`#det-${f.k}`);
    state.det[f.k] = clamp(state.det[f.k], 0, f.max());
    inp.value = state.det[f.k];
    inp.addEventListener("input", () => { const v = parseFloat(String(inp.value).replace(",", ".")); if (Number.isFinite(v)) { state.det[f.k] = clamp(Math.round(v), 0, f.max()); scheduleUpdate(); } });
    inp.addEventListener("change", () => { inp.value = state.det[f.k]; });
    inp.addEventListener("focus", () => inp.select());
  });
  grid.addEventListener("click", (e) => {
    const b = e.target.closest("[data-dstep]"); if (!b) return;
    const k = b.closest(".det-item").dataset.d;
    set(k, state.det[k] + Number(b.dataset.dstep));
  });
  document.querySelectorAll("[data-modo]").forEach((b) => b.addEventListener("click", () => {
    state.modo3 = b.dataset.modo;
    syncModo();
    scheduleUpdate();
  }));
  $("#areaPick").innerHTML = Object.keys(AREAS).map((a) => `<button type="button" data-area="${a}" aria-pressed="false"><span>${AREAS_CURTO[a]}</span><b class="num" data-areanota></b></button>`).join("");
  $("#areaPick").addEventListener("click", (e) => {
    const b = e.target.closest("[data-area]"); if (!b) return;
    state.areaFoco = b.dataset.area;
    scheduleUpdate();
  });
  syncModo();
}
function syncModo() {
  const area = state.modo3 === "area";
  document.querySelectorAll("[data-modo]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modo === state.modo3)));
  $("#modoSimples").hidden = area;
  $("#modoArea").hidden = !area;
  $("#areaPick").hidden = !area;
}
function renderDetalhe() {
  if (state.modo3 !== "area") return;
  $("#detTotal").textContent = `${nf0.format(calc.acertos3)} de 90 acertos na prova objetiva · redação ${nf0.format(state.det.red)}`;
  const alertas = [];
  if (calc.elimRed) alertas.push(`Redação abaixo de ${CONFIG.REDACAO_MINIMA}: pelo edital (item 11.2.4), isso elimina em todos os cursos.`);
  if (calc.abaixo22) alertas.push(`Menos de ${CONFIG.MIN_ACERTOS_3} acertos na prova da 3ª série: USP, Unesp e Unicamp exigem esse mínimo (item 13.9). Fatec e Univesp não.`);
  $("#detAlert").hidden = !alertas.length;
  $("#detAlert").textContent = alertas.join(" ");
  document.querySelectorAll("#areaPick [data-area]").forEach((b) => {
    const a = b.dataset.area;
    b.setAttribute("aria-pressed", String(a === state.areaFoco));
    b.querySelector("[data-areanota]").textContent = fmt1(calc.base + CONFIG.PESO_SERIE_3_REDACAO * calc.own[a]);
    b.setAttribute("aria-label", `Cursos de ${AREAS[a]}: nota ${fmt1(calc.base + CONFIG.PESO_SERIE_3_REDACAO * calc.own[a])}`);
  });
}

let rafPending = false;
function scheduleUpdate() {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => { rafPending = false; update(); });
}

/* ---------- boletim ---------- */
const counters = new WeakMap();
function countTo(el, to, dur = 450, f = fmt1) {
  const from = counters.get(el) ?? 0;
  counters.set(el, to);
  if (reduceMotion() || Math.abs(to - from) < 0.05) { el.textContent = f(to); return; }
  const t0 = performance.now();
  const step = (t) => {
    if (counters.get(el) !== to) return;
    const k = Math.min(1, (t - t0) / dur);
    el.textContent = f(from + (to - from) * (1 - Math.pow(1 - k, 3)));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
function renderScore() {
  countTo($("#notaFinal"), calc.final, 600);
  countTo($("#tsNota"), calc.final, 400);
  $("#tsMax").textContent = fmt1(calc.max);
  $("#n1Nota").textContent = fmt1(calc.nota1);
  $("#n2Nota").textContent = fmt1(calc.nota2);
  $("#n1Contrib").textContent = "+" + fmt1(CONFIG.PESO_SERIE_1 * calc.nota1);
  $("#n2Contrib").textContent = "+" + fmt1(CONFIG.PESO_SERIE_2 * calc.nota2);
  $("#n3Contrib").textContent = "+" + fmt1(CONFIG.PESO_SERIE_3_REDACAO * calc.ownFoco);
  $("#notaMax").textContent = fmt1(calc.max);
  $("#notaBase").textContent = fmt1(calc.base);
  $("#scoreFormula").textContent = state.modo3 === "area"
    ? `0,25 × ${fmt1(calc.nota1)} + 0,25 × ${fmt1(calc.nota2)} + 0,3 × ${fmt1(objetiva3(state.areaFoco))} + 0,2 × ${nf0.format(state.det.red)} · cursos de ${AREAS[state.areaFoco]}`
    : `0,25 × ${fmt1(calc.nota1)} + 0,25 × ${fmt1(calc.nota2)} + 0,5 × ${nf0.format(state.n3)}`;
  renderDetalhe();
  $("#sbFill").style.width = calc.final + "%";
  $("#sbMax").style.width = calc.max + "%";
  $("#sbTick").style.left = `calc(${calc.max}% - 1px)`;
  $("#sbTickLabel").textContent = "máx " + fmt1(calc.max);
  $("#scoreBarImg").setAttribute("aria-label", `Nota projetada ${fmt1(calc.final)} de 100; máxima possível ${fmt1(calc.max)}`);
}

/* ---------- filtros ---------- */
let qTokens = [];
function baseFilter(i) {
  const c = CURSOS[i];
  if (state.inst && c.instituicao !== state.inst) return false;
  if (state.turno && c._turno !== state.turno) return false;
  if (state.curso && c._slug !== state.curso) return false;
  if (qTokens.length) { for (const t of qTokens) if (!c._s.includes(t)) return false; }
  return true;
}
function buildList() {
  const out = [];
  const counts = { boa: 0, possivel: 0, dificil: 0, muito: 0, fora: 0 };
  let total = 0;
  for (let i = 0; i < CURSOS.length; i++) {
    if (!baseFilter(i)) continue;
    total++;
    counts[chanceOf[i]]++;
    if (state.chance && chanceOf[i] !== state.chance) continue;
    out.push(i);
  }
  const R = (a, b) => CURSOS[a].ranking - CURSOS[b].ranking;
  const by = {
    ranking: R,
    chance: (a, b) => CHANCE_BY_KEY[chanceOf[a]].order - CHANCE_BY_KEY[chanceOf[b]].order || need[b] - need[a] || R(a, b),
    vagas: (a, b) => CURSOS[b].vagas - CURSOS[a].vagas || R(a, b),
    notaAsc: (a, b) => CURSOS[a].notaEstimada - CURSOS[b].notaEstimada || R(a, b),
    notaDesc: (a, b) => CURSOS[b].notaEstimada - CURSOS[a].notaEstimada || R(a, b),
  }[state.sort] || R;
  out.sort(by);
  return { out, counts, total };
}

/* ---------- distribuição por chance ---------- */
function setupStats() {
  $("#distBar").innerHTML = CHANCES.map((c) => `<span class="dist-seg" data-c="${c.key}" style="flex-grow:1"></span>`).join("");
  $("#stats").innerHTML = CHANCES.map((c) => `
    <button class="leg" type="button" data-chance="${c.key}" aria-pressed="false" style="--cc:var(--c-${c.key})">
      <span class="leg-top"><i></i>${c.label}</span>
      <span class="leg-num num" data-num>0</span>
      <span class="leg-pct mono" data-pct></span>
    </button>`).join("");
  $("#stats").addEventListener("click", (e) => {
    const b = e.target.closest(".leg"); if (!b) return;
    const k = b.dataset.chance;
    state.chance = state.chance === k ? "" : k;
    if (k === "boa" && state.chance === "boa") celebrate(b);
    if (state.chance) showTab("cursos");
    update({ reset: true });
  });
}
// A pergunta do nome do site, respondida com as notas atuais.
function veredito(counts) {
  const n = (k) => nf0.format(counts[k]), cursos = (k) => (counts[k] === 1 ? "curso" : "cursos");
  if (counts.boa) return { tom: "boa", sim: "Dá!", txt: `Boa chance em ${n("boa")} ${cursos("boa")}` + (counts.possivel ? ` e possível em mais ${n("possivel")}.` : ".") };
  if (counts.possivel) return { tom: "possivel", sim: "Dá, com esforço.", txt: `Chance possível em ${n("possivel")} ${cursos("possivel")}.` };
  if (counts.dificil) return { tom: "dificil", sim: "Ainda está difícil.", txt: `${n("dificil")} ${cursos("dificil")} ficam ao alcance subindo a nota da 3ª série.` };
  return { tom: "muito", sim: "Por enquanto, não.", txt: "Aumente a estimativa da 3ª série para ver onde dá." };
}
function renderStats(counts, total) {
  $("#distTotal").textContent = nf0.format(total);
  // Resposta só com a lista completa (sem cursos carregados ou com filtros, a contagem não responde a pergunta).
  if (CURSOS.length && total === CURSOS.length) {
    const v = veredito(counts), ve = $("#veredito");
    ve.dataset.tom = v.tom;
    ve.innerHTML = `<b>${v.sim}</b> ${esc(v.txt)}`;
  }
  const bar = $("#distBar");
  bar.classList.toggle("filtered", !!state.chance);
  bar.querySelectorAll(".dist-seg").forEach((s) => {
    s.style.flexGrow = counts[s.dataset.c];
    s.style.display = counts[s.dataset.c] ? "" : "none";
    s.classList.toggle("sel", state.chance === s.dataset.c);
  });
  document.querySelectorAll(".leg").forEach((b) => {
    const k = b.dataset.chance, n = counts[k];
    countTo(b.querySelector("[data-num]"), n, 400, (v) => nf0.format(Math.round(v)));
    const pct = b.querySelector("[data-pct]");
    let note = "";
    if (k === "muito" && n === 0) {
      note = state.modo3 !== "area" && state.n3 + CONFIG.LIMITES_CHANCE.dificil >= 100
        ? `Vazia com estimativa a partir de ${100 - CONFIG.LIMITES_CHANCE.dificil}: quem precisaria de mais de 100 na 3ª fica em “Fora de alcance”.`
        : "Nenhum curso nesta faixa com as suas notas.";
    }
    const p100 = total ? (n / total) * 100 : 0;
    pct.textContent = note || (n > 0 && p100 < 1 ? "<1%" : `${Math.round(p100)}%`);
    pct.classList.toggle("note", !!note);
    b.setAttribute("aria-pressed", String(state.chance === k));
    b.setAttribute("aria-label", `${CHANCE_BY_KEY[k].label}: ${n} cursos. ${state.chance === k ? "Remover filtro" : "Filtrar lista"}`);
  });
}

/* ---------- linhas da tabela ---------- */
function createRow(i) {
  const c = CURSOS[i];
  const el = document.createElement("article");
  el.className = "row enter";
  el.dataset.id = i;
  const detalhes = [c.unidade, c.turno, `Área: ${AREAS[c.area] || "—"}`].filter(Boolean).map(esc).join(" · ");
  el.innerHTML = `
    <div class="row-main" role="button" tabindex="0" aria-expanded="false" aria-controls="det-curso-${i}">
      <div class="c-course">
        <div class="c-tags"><span class="inst" data-inst="${esc(c.instituicao)}"><i></i>${esc(c.instituicao)}</span><span class="meta-city">${esc(c.municipio || "")}</span></div>
        <h3>${esc(c.curso)}</h3>
      </div>
      <div class="c-chance">
        <span class="chance" data-badge><i></i><span data-label></span></span>
        <span class="gap"><span class="gap-bar"><i data-prox></i></span><span class="gap-text mono" data-gap></span></span>
      </div>
      <span class="chev" aria-hidden="true"></span>
    </div>
    <div class="row-details" id="det-curso-${i}" hidden>
      <dl class="row-nums">
        <div><dt>Vagas</dt><dd>${nf0.format(c.vagas)}</dd></div>
        <div><dt>Nota estimada</dt><dd>${fmt1(c.notaEstimada)}</dd></div>
        <div><dt>Média na 3ª</dt><dd class="need" data-need></dd></div>
        <div><dt>Ranking</dt><dd>#${c.ranking}</dd></div>
      </dl>
      <p class="meta">${detalhes}</p>
      <button class="btn btn-sm pin" type="button" data-pin aria-pressed="false">${icon("pin")}<span data-pinlabel>Comparar</span></button>
    </div>`;
  el.addEventListener("animationend", () => el.classList.remove("enter"), { once: true });
  return el;
}
function updateRow(el, i) {
  const k = chanceOf[i];
  const badge = el.querySelector("[data-badge]");
  if (el.dataset.chance !== k) {
    if (el.dataset.chance) { badge.classList.remove("pop"); void badge.offsetWidth; badge.classList.add("pop"); }
    el.dataset.chance = k;
    badge.querySelector("[data-label]").textContent = CHANCE_BY_KEY[k].label;
  }
  el.querySelector("[data-need]").textContent = need[i] > 100 ? ">100" : fmt1(need[i]);
  el.querySelector("[data-prox]").style.width = proximity(i) + "%";
  el.querySelector("[data-gap]").textContent = gapText(i);
  const pinned = state.pins.includes(i);
  const pin = el.querySelector("[data-pin]");
  pin.setAttribute("aria-pressed", String(pinned));
  pin.querySelector("[data-pinlabel]").textContent = pinned ? "No comparador" : "Comparar";
  el.querySelector(".row-main").setAttribute("aria-label", `${CURSOS[i].curso}, ${CURSOS[i].instituicao}, ${CURSOS[i].municipio}: ${CHANCE_BY_KEY[k].label}, ${gapText(i)}. Toque para ver detalhes.`);
}
function toggleRow(el) {
  const open = !el.classList.contains("open");
  el.classList.toggle("open", open);
  el.querySelector(".row-main").setAttribute("aria-expanded", String(open));
  el.querySelector(".row-details").hidden = !open;
}
function getNode(i) {
  let el = nodeCache.get(i);
  if (!el) { el = createRow(i); nodeCache.set(i, el); }
  updateRow(el, i);
  return el;
}

const grid = $("#grid");
let lastList = [];
function renderGrid(reset) {
  const sameOrder = !reset && list.length === lastList.length && list.every((v, j) => v === lastList[j]);
  if (sameOrder) {
    for (let j = 0; j < rendered; j++) updateRow(grid.children[j], list[j]);
  } else {
    rendered = Math.min(list.length, reset ? CONFIG.PAGE_SIZE : Math.max(rendered, CONFIG.PAGE_SIZE));
    grid.replaceChildren(...list.slice(0, rendered).map(getNode));
  }
  lastList = list;
  grid.setAttribute("aria-busy", "false");
  $("#empty").hidden = list.length > 0;
}
function renderMore() {
  if (rendered >= list.length) return;
  const next = Math.min(list.length, rendered + CONFIG.PAGE_SIZE);
  const frag = document.createDocumentFragment();
  for (let j = rendered; j < next; j++) frag.appendChild(getNode(list[j]));
  grid.appendChild(frag);
  rendered = next;
}

/* ---------- comparador ---------- */
function togglePin(i) {
  const at = state.pins.indexOf(i);
  if (at >= 0) state.pins.splice(at, 1);
  else {
    if (state.pins.length >= CONFIG.MAX_PINS) { toast(`Dá para comparar até ${CONFIG.MAX_PINS} cursos. Remova um para adicionar outro.`); return; }
    state.pins.push(i);
    toast(state.pins.length === 1 ? "Adicionado ao comparador. Marque outro curso para comparar." : "Adicionado ao comparador.");
  }
  const el = nodeCache.get(i); if (el) updateRow(el, i);
  renderCompare();
  persist();
}
function renderCompare() {
  state.pins = state.pins.filter((i) => CURSOS[i]);
  const n = state.pins.length;
  $("#cmpBar").hidden = n === 0;
  document.body.classList.toggle("has-pins", n > 0);
  $("#cmpBarCount").textContent = String(n);
  $("#cmpBarSub").textContent = n === 1 ? "curso" : "cursos";
  if (!n) { closeCompare(); return; }
  $("#pinCount").textContent = `${n} de ${CONFIG.MAX_PINS}`;
  const P = state.pins.map((i) => ({ i, c: CURSOS[i], k: chanceOf[i] }));
  const row = (label, cell, cls = "") => `<tr><th scope="row">${label}</th>${P.map((p) => `<td class="${cls}">${cell(p)}</td>`).join("")}</tr>`;
  $("#compareTable").innerHTML =
    `<thead><tr><th scope="col"><span class="sr-only">Critério</span></th>${P.map(({ i, c }) => `<th scope="col"><div class="cmp-h">
      <span class="inst" data-inst="${esc(c.instituicao)}"><i></i>${esc(c.instituicao)}</span>${esc(c.curso)}
      <button class="link-btn x" type="button" data-unpin="${i}" aria-label="Remover ${esc(c.curso)} do comparador">Remover</button></div></th>`).join("")}</tr></thead><tbody>` +
    row("Local", ({ c }) => `${esc(c.unidade)}<br><span style="color:var(--ink-2)">${esc(c.municipio)}</span>`) +
    row("Turno", ({ c }) => esc(c.turno)) +
    row("Vagas", ({ c }) => nf0.format(c.vagas), "n") +
    row("Nota estimada", ({ c }) => fmt1(c.notaEstimada), "n") +
    row("Média na 3ª", ({ i, k }) => `<span style="color:var(--c-${k});font-weight:600">${need[i] > 100 ? ">100" : fmt1(need[i])}</span>`, "n") +
    row("Sua chance", ({ i, k }) => `<span style="color:var(--c-${k});font-weight:600">${CHANCE_BY_KEY[k].label}</span><br><span class="mono" style="font-size:12px;color:var(--ink-3)">${gapText(i)}</span>`) +
    "</tbody>";
  // No celular, um cartão por curso (a tabela lado a lado não cabe).
  $("#compareCards").innerHTML = P.map(({ i, c, k }) => `<article class="cmp-c" style="--cc:var(--c-${k})">
    <div class="cmp-c-head"><span class="inst" data-inst="${esc(c.instituicao)}"><i></i>${esc(c.instituicao)}</span>
      <button class="link-btn" type="button" data-unpin="${i}" aria-label="Remover ${esc(c.curso)} do comparador">Remover</button></div>
    <h3>${esc(c.curso)}</h3>
    <p class="cmp-c-local">${esc(c.unidade)} · ${esc(c.municipio)} · ${esc(c.turno)}</p>
    <p class="cmp-c-chance"><b>${CHANCE_BY_KEY[k].label}</b> <span class="mono">${gapText(i)}</span></p>
    <dl><div><dt>Vagas</dt><dd>${nf0.format(c.vagas)}</dd></div><div><dt>Nota estimada</dt><dd>${fmt1(c.notaEstimada)}</dd></div>
      <div><dt>Média na 3ª</dt><dd class="need">${need[i] > 100 ? ">100" : fmt1(need[i])}</dd></div></dl>
  </article>`).join("");
}

let closeCompare = () => {};
function setupCompare() {
  const modal = $("#compareModal"), bar = $("#cmpBar");
  closeCompare = () => {
    if (modal.hidden) return;
    modal.hidden = true;
    if (!bar.hidden) bar.focus();
  };
  bar.addEventListener("click", () => {
    $("#toast").hidden = true;
    renderCompare();
    modal.hidden = false;
    modal.querySelector(".btn-icon[data-close]").focus();
  });
  modal.addEventListener("click", (e) => {
    if (e.target.closest("[data-close]")) closeCompare();
    const b = e.target.closest("[data-unpin]"); if (b) togglePin(Number(b.dataset.unpin));
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.hidden) closeCompare(); });
}

/* ---------- quanto preciso? ---------- */
function setupReverse() {
  const input = $("#revInput"), listEl = $("#revList");
  let matches = [], active = -1;
  const close = () => { listEl.hidden = true; input.setAttribute("aria-expanded", "false"); input.removeAttribute("aria-activedescendant"); active = -1; };
  const paint = () => {
    listEl.innerHTML = matches.map((i, j) => {
      const c = CURSOS[i];
      return `<li role="option" id="rev-opt-${j}" data-i="${i}" aria-selected="${j === active}"><span class="inst" data-inst="${esc(c.instituicao)}"><i></i>${esc(c.instituicao)}</span><span class="t">${esc(c.curso)}</span><small>${esc(c.municipio)}</small></li>`;
    }).join("");
    if (active >= 0) input.setAttribute("aria-activedescendant", "rev-opt-" + active); else input.removeAttribute("aria-activedescendant");
  };
  const search = debounce(() => {
    const toks = norm(input.value).split(/\s+/).filter(Boolean);
    if (!toks.length) { close(); return; }
    matches = [];
    for (let i = 0; i < CURSOS.length && matches.length < 8; i++) {
      if (toks.every((t) => CURSOS[i]._s.includes(t))) matches.push(i);
    }
    active = matches.length ? 0 : -1;
    paint();
    listEl.hidden = !matches.length;
    input.setAttribute("aria-expanded", String(!!matches.length));
  }, 120);
  const choose = (i) => { state.revId = i; input.value = `${CURSOS[i].curso} (${CURSOS[i].instituicao})`; close(); renderReverse(); persist(); };
  input.addEventListener("input", search);
  input.addEventListener("keydown", (e) => {
    if (listEl.hidden) return;
    if (e.key === "ArrowDown") { active = (active + 1) % matches.length; paint(); e.preventDefault(); }
    else if (e.key === "ArrowUp") { active = (active - 1 + matches.length) % matches.length; paint(); e.preventDefault(); }
    else if (e.key === "Enter" && active >= 0) { choose(matches[active]); e.preventDefault(); }
    else if (e.key === "Escape") close();
  });
  listEl.addEventListener("mousedown", (e) => { const li = e.target.closest("li"); if (li) { e.preventDefault(); choose(Number(li.dataset.i)); } });
  input.addEventListener("blur", () => setTimeout(close, 100));
  if (state.revId != null && CURSOS[state.revId]) input.value = `${CURSOS[state.revId].curso} (${CURSOS[state.revId].instituicao})`;
}
function renderReverse() {
  const out = $("#revOut");
  const i = state.revId;
  if (i == null || !CURSOS[i]) { out.innerHTML = ""; return; }
  const c = CURSOS[i], n = need[i], k = chanceOf[i];
  let msg;
  if (n > 100) msg = `Mesmo com 100 na 3ª série + redação, sua nota máxima (<b>${fmt1(calc.max)}</b>) fica abaixo da nota estimada (<b>${fmt1(c.notaEstimada)}</b>).`;
  else if (elimOf[i]) msg = `Com as notas informadas você seria eliminado neste curso: ${esc(elimOf[i])}.`;
  else if (n <= ownOf(i)) msg = `Sua estimativa atual (<b>${fmt1(ownOf(i))}</b>) já alcança essa média.`;
  else msg = `Faltam <b>${fmt1(n - ownOf(i))} pontos</b> em relação à sua estimativa atual (<b>${fmt1(ownOf(i))}</b>).`;
  const min22 = ["USP", "UNESP", "UNICAMP"].includes(c.instituicao)
    ? `<p class="full">${esc(c.instituicao)} também exige no mínimo <b>22 acertos</b> na prova da 3ª série.</p>` : "";
  out.innerHTML = `<div class="rev" data-chance="${k}">
    <span class="rev-big num">${n > 100 ? ">100" : fmt1(n)}</span>
    <p>média mínima na 3ª série + redação para <b>${esc(c.curso)}</b>, ${esc(c.instituicao)} · ${esc(c.municipio)} (nota estimada ${fmt1(c.notaEstimada)})</p>
    <p><b style="color:var(--cc)">${CHANCE_BY_KEY[k].label}.</b> ${msg}</p>
    ${min22}
  </div>`;
}

/* ---------- filtros UI ---------- */
function setupFilters() {
  const chips = $("#instChips");
  chips.innerHTML = `<button type="button" data-inst="" aria-pressed="false">Todas</button>` +
    INSTITUICOES.map((n) => `<button type="button" data-inst="${n}" aria-pressed="false" style="--sq:var(--${n.toLowerCase()})"><span class="sq"></span>${n}</button>`).join("");
  chips.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    state.inst = b.dataset.inst === state.inst ? "" : b.dataset.inst;
    update({ reset: true });
  });
  const fChance = $("#fChance");
  fChance.insertAdjacentHTML("beforeend", CHANCES.map((c) => `<option value="${c.key}">${c.label}</option>`).join(""));
  fChance.addEventListener("change", () => { state.chance = fChance.value; if (state.chance === "boa") celebrate(fChance); update({ reset: true }); });
  const fTurno = $("#fTurno");
  fTurno.insertAdjacentHTML("beforeend", TURNOS.map((t) => `<option value="${t}">${t}</option>`).join(""));
  fTurno.value = state.turno;
  fTurno.addEventListener("change", () => { state.turno = fTurno.value; update({ reset: true }); });
  const fSort = $("#fSort");
  fSort.value = state.sort;
  fSort.addEventListener("change", () => { state.sort = fSort.value; update({ reset: true }); });
  const q = $("#q");
  q.addEventListener("input", debounce(() => {
    state.q = q.value;
    qTokens = norm(q.value).split(/\s+/).filter(Boolean);
    update({ reset: true });
  }, 160));

  grid.addEventListener("click", (e) => {
    const row = e.target.closest(".row"); if (!row) return;
    const i = Number(row.dataset.id);
    if (e.target.closest("[data-pin]")) togglePin(i);
    else if (e.target.closest(".row-main")) toggleRow(row);
  });
  grid.addEventListener("keydown", (e) => {
    const main = e.target.closest(".row-main");
    if (main && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); toggleRow(main.closest(".row")); }
  });
  $("#btnClearFilters").addEventListener("click", clearFilters);
  $("#btnClearFilters2").addEventListener("click", clearFilters);
  $("#btnClearPins").addEventListener("click", () => {
    const old = state.pins.slice(); state.pins = [];
    old.forEach((i) => { const el = nodeCache.get(i); if (el) updateRow(el, i); });
    renderCompare(); persist();
  });

  if ("IntersectionObserver" in window) {
    new IntersectionObserver((ents) => { if (ents.some((x) => x.isIntersecting)) renderMore(); }, { rootMargin: "900px 0px" }).observe($("#sentinel"));
  }
}
// As páginas de curso chegam como /?curso=medicina#cursos: filtra o curso e limpa o endereço.
function filtroDoLink() {
  const params = new URLSearchParams(location.search);
  const curso = (params.get("curso") || "").toLowerCase();
  if (!curso) return;
  if (/^[a-z0-9-]{1,80}$/.test(curso)) state.curso = curso;
  params.delete("curso");
  history.replaceState(null, "", location.pathname + (params.toString() ? `?${params}` : "") + location.hash);
}
function activeFilters() {
  const f = [];
  if (state.curso) { const i = CURSOS.findIndex((c) => c._slug === state.curso); f.push(i >= 0 ? cursoBase(CURSOS[i].curso) : "curso"); }
  if (state.q.trim()) f.push(`busca “${state.q.trim()}”`);
  if (state.inst) f.push(state.inst);
  if (state.chance) f.push(CHANCE_BY_KEY[state.chance].label);
  if (state.turno) f.push(`turno ${state.turno}`);
  return f;
}
function clearFilters() {
  state.inst = ""; state.chance = ""; state.turno = ""; state.q = ""; state.curso = ""; qTokens = [];
  $("#q").value = ""; $("#fTurno").value = "";
  update({ reset: true });
}
function renderActiveFilters() {
  const f = activeFilters();
  const bar = $("#activeFilters");
  bar.hidden = f.length === 0;
  $("#activeList").textContent = f.join(" · ");
  const empty = $("#empty");
  if (!list.length) {
    $("#emptyText").textContent = f.length
      ? `Nenhum curso com ${f.length > 1 ? "estes filtros" : "este filtro"}: ${f.join(" · ")}.`
      : "Nenhum curso encontrado.";
  }
  empty.querySelector("button").hidden = f.length === 0;
}
function syncFilterUI() {
  document.querySelectorAll("#instChips button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.inst === state.inst)));
  $("#fChance").value = state.chance;
}

/* ---------- update loop ---------- */
function update(opts = {}) {
  recompute();
  renderScore();
  if (!CURSOS.length) return;
  const { out, counts, total } = buildList();
  list = out;
  renderStats(counts, total);
  syncFilterUI();
  renderGrid(!!opts.reset);
  renderActiveFilters();
  renderCompare();
  renderReverse();
  $("#countLabel").textContent = `${nf0.format(list.length)} de ${nf0.format(CURSOS.length)}`;
  announce(`${list.length} cursos na lista`);
  persist();
  if (rank.on) syncRanking();
  else if (rank.data && rank.status === "ok") renderRanking();
}
const announce = debounce((t) => { $("#liveCount").textContent = t; }, 600);

/* ---------- confete ---------- */
let confettiP = null;
function loadScript(src) {
  return new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.async = true; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
}
function celebrate(fromEl) {
  if (reduceMotion()) { toast("Boa chance! 🎉"); return; }
  confettiP = confettiP || loadScript("https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js");
  confettiP.then(() => {
    const r = fromEl ? fromEl.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 2, width: 0, height: 0 };
    const origin = { x: (r.left + r.width / 2) / innerWidth, y: (r.top + r.height / 2) / innerHeight };
    window.confetti({ particleCount: 90, spread: 70, startVelocity: 38, origin, colors: ["#1d3fd1", "#7d95ff", "#4cc27a", "#e0b23e", "#ffffff"], disableForReducedMotion: true });
  }).catch(() => toast("Boa chance! 🎉"));
}

/* ---------- toast ---------- */
let toastT;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastT);
  toastT = setTimeout(() => (t.hidden = true), 3200);
}

/* ---------- tema ---------- */
function setupTheme() {
  const btn = $("#btnTheme");
  const paint = () => {
    const dark = document.documentElement.getAttribute("data-theme") !== "light";
    btn.innerHTML = `${icon(dark ? "sun" : "moon")}<span>${dark ? "Tema claro" : "Tema escuro"}</span>`;
    btn.setAttribute("aria-label", dark ? "Ativar tema claro" : "Ativar tema escuro");
    document.querySelector('meta[name="theme-color"]').setAttribute("content", dark ? "#0e1014" : "#f3f4f6");
  };
  btn.addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("pp26-theme", next); } catch (e) { /* ok */ }
    paint();
  });
  paint();
}

/* ---------- personalização: nome e escola (só no aparelho) ---------- */
const PROFILE_KEY = "pp26-profile", WELCOME_KEY = "pp26-welcome-done";
let profile = (() => {
  const p = store.get(PROFILE_KEY);
  return p && typeof p.nome === "string" && p.nome.trim()
    ? { nome: p.nome.slice(0, 40), escola: String(p.escola || "").slice(0, 120), cidade: String(p.cidade || "").slice(0, 60) } : null;
})();
const cleanText = (s, max) => String(s || "").replace(/\s+/g, " ").trim().slice(0, max);
const escolaLabel = () => (profile && profile.escola ? profile.escola + (profile.cidade ? `, ${profile.cidade}` : "") : "");
const firstName = () => (profile ? profile.nome.split(" ")[0] : "");
function initials(nome) {
  const w = nome.split(" ").filter(Boolean);
  return ((w[0] || "")[0] + (w.length > 1 ? w[w.length - 1][0] : "")).toUpperCase();
}
function renderProfile() {
  const hello = $("#hello");
  hello.hidden = !profile;
  if (profile) hello.innerHTML = `Olá, <b>${esc(firstName())}</b>!` + (profile.escola ? ` <span class="hello-sep" aria-hidden="true">·</span> ${esc(escolaLabel())}` : "");
  $("#idNome").textContent = profile ? profile.nome : "—";
  $("#idEscola").textContent = escolaLabel() || "—";
  $("#btnEditId").textContent = profile ? "Editar" : "Adicionar nome";
  $("#profileAvatar").textContent = profile ? initials(profile.nome) : "+";
  $("#profileLabel").textContent = profile ? `Perfil: ${firstName()}` : "Adicionar nome e escola";
  $("#btnProfile").setAttribute("aria-label", profile ? `Editar nome e escola (${profile.nome})` : "Adicionar nome e escola");
  $("#shareIdWrap").hidden = !profile;
}
/* Lista de escolas (escolas.json): carregada só quando a pessoa vai preencher a escola. */
let ESCOLAS = null, escolasP = null;
const normEscola = (s) => norm(s).replace(/\./g, "").replace(/[-,()]/g, " ");
function loadEscolas() {
  escolasP = escolasP || fetch("escolas.json").then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then((rows) => (ESCOLAS = rows.map(([n, c]) => ({ n, c, s: normEscola(`${n} ${c}`), k: normEscola(n.replace(/^(E\.E\.|ETEC|EMEFM|EM)\s+/, "")) }))))
    .catch(() => { escolasP = null; ESCOLAS = null; });
  return escolasP;
}
function setupSchoolField(input, onPick) {
  const listEl = $("#pfEscolaList");
  let matches = [], active = -1;
  const close = () => { listEl.hidden = true; input.setAttribute("aria-expanded", "false"); input.removeAttribute("aria-activedescendant"); active = -1; };
  const paint = () => {
    listEl.innerHTML = matches.length
      ? matches.map((e, i) => `<li role="option" id="esc-opt-${i}" data-i="${i}" aria-selected="${i === active}"><b>${esc(e.n)}</b><span>${esc(e.c)}</span></li>`).join("")
      : `<li class="none" role="option" aria-disabled="true">Nenhuma escola encontrada. Pode deixar o nome como digitou.</li>`;
    if (active >= 0) input.setAttribute("aria-activedescendant", "esc-opt-" + active); else input.removeAttribute("aria-activedescendant");
    listEl.hidden = false;
    input.setAttribute("aria-expanded", "true");
  };
  const search = debounce(async () => {
    const q = normEscola(input.value).trim();
    if (q.length < 2) { close(); return; }
    await loadEscolas();
    if (!ESCOLAS) { close(); return; }
    const toks = q.split(/\s+/);
    const found = [];
    for (const e of ESCOLAS) if (toks.every((t) => e.s.includes(t))) found.push(e);
    found.sort((a, b) => (b.k.startsWith(q) - a.k.startsWith(q)) || a.n.localeCompare(b.n, "pt-BR"));
    matches = found.slice(0, 8);
    active = matches.length ? 0 : -1;
    paint();
  }, 120);
  const choose = (e) => { input.value = `${e.n}, ${e.c}`; onPick(e); close(); };
  input.addEventListener("focus", loadEscolas, { once: true });
  input.addEventListener("input", () => { onPick(null); search(); });
  input.addEventListener("keydown", (ev) => {
    if (listEl.hidden || !matches.length) { if (ev.key === "Escape" && !listEl.hidden) { close(); ev.stopPropagation(); } return; }
    if (ev.key === "ArrowDown") { active = (active + 1) % matches.length; paint(); ev.preventDefault(); }
    else if (ev.key === "ArrowUp") { active = (active - 1 + matches.length) % matches.length; paint(); ev.preventDefault(); }
    else if (ev.key === "Enter" && active >= 0) { choose(matches[active]); ev.preventDefault(); }
    else if (ev.key === "Escape") { close(); ev.stopPropagation(); }
  });
  listEl.addEventListener("mousedown", (ev) => { const li = ev.target.closest("li[data-i]"); if (li) { ev.preventDefault(); choose(matches[Number(li.dataset.i)]); } });
  input.addEventListener("blur", () => setTimeout(close, 120));
  return close;
}

function setupProfile() {
  const modal = $("#welcomeModal"), form = $("#welcomeForm"), nome = $("#pfNome"), escola = $("#pfEscola"), err = $("#pfError");
  let lastFocus = null, picked = null;
  const closeList = setupSchoolField(escola, (e) => { picked = e; });
  const open = () => {
    lastFocus = document.activeElement;
    loadEscolas();
    nome.value = profile ? profile.nome : "";
    escola.value = escolaLabel();
    picked = profile && profile.cidade ? { n: profile.escola, c: profile.cidade } : null;
    closeList();
    err.hidden = true; nome.removeAttribute("aria-invalid");
    $("#pfClear").hidden = !profile;
    $("#pfSave").textContent = profile ? "Salvar" : "Começar";
    modal.hidden = false;
    nome.focus();
  };
  const close = () => {
    modal.hidden = true;
    try { localStorage.setItem(WELCOME_KEY, "1"); } catch (e) { /* ok */ }
    if (lastFocus && lastFocus !== document.body) lastFocus.focus();
  };
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const n = cleanText(nome.value, 40);
    const ruim = !!n && typeof window.nomeBloqueado === "function" && window.nomeBloqueado(n);
    if (!n || ruim) {
      err.textContent = ruim ? "Esse nome não pode ser usado. Use seu nome de verdade." : "Digite seu nome para continuar, ou toque em “Pular”.";
      err.hidden = false; nome.setAttribute("aria-invalid", "true"); nome.focus(); return;
    }
    profile = picked
      ? { nome: n, escola: picked.n, cidade: picked.c }
      : { nome: n, escola: cleanText(escola.value, 120), cidade: "" };
    store.set(PROFILE_KEY, profile);
    renderProfile();
    close();
    if (rank.on && !rankSchool()) leaveRanking(true);
    else if (rank.on) syncRanking();
    loadRanking();
    toast(`Pronto, ${firstName()}! Seu boletim está personalizado.`);
  });
  nome.addEventListener("input", () => { if (nome.value.trim()) { err.hidden = true; nome.removeAttribute("aria-invalid"); } });
  $("#pfSkip").addEventListener("click", close);
  $("#pfClear").addEventListener("click", () => {
    if (rank.on) leaveRanking(true);
    profile = null;
    try { localStorage.removeItem(PROFILE_KEY); } catch (e) { /* ok */ }
    renderProfile();
    loadRanking();
    close();
    toast("Seus dados foram apagados deste aparelho.");
  });
  modal.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
  openProfileDialog = open;
  $("#btnProfile").addEventListener("click", open);
  $("#btnEditId").addEventListener("click", open);
  renderProfile();
  let seen = false;
  try { seen = !!localStorage.getItem(WELCOME_KEY); } catch (e) { seen = true; }
  if (!seen && !profile) open();
}

/* ---------- ranking da escola (api/ranking.js) ---------- */
const RANK_TOKEN_KEY = "pp26-rank-token", RANK_ON_KEY = "pp26-rank-on";
const rank = { on: false, data: null, status: "idle", lastSent: "" };
try { rank.on = localStorage.getItem(RANK_ON_KEY) === "1"; } catch (e) { /* ok */ }
let openProfileDialog = () => {};
function rankToken() {
  let t = null;
  try { t = localStorage.getItem(RANK_TOKEN_KEY); } catch (e) { /* ok */ }
  if (!t || !/^[a-f0-9]{64}$/.test(t)) {
    const a = new Uint8Array(32); crypto.getRandomValues(a);
    t = Array.from(a, (x) => x.toString(16).padStart(2, "0")).join("");
    try { localStorage.setItem(RANK_TOKEN_KEY, t); } catch (e) { /* ok */ }
  }
  return t;
}
function setRankOn(v) { rank.on = v; try { localStorage.setItem(RANK_ON_KEY, v ? "1" : "0"); } catch (e) { /* ok */ } }
// Mesmo formato que o servidor usa: "Ana S."
function rankName(nome) {
  const w = String(nome || "").replace(/[^\p{L}\s'-]/gu, " ").split(/\s+/).filter(Boolean);
  if (!w.length) return "";
  const cap = (s) => s.charAt(0).toLocaleUpperCase("pt-BR") + s.slice(1).toLocaleLowerCase("pt-BR");
  return w.length > 1 ? `${cap(w[0])} ${w[w.length - 1].charAt(0).toLocaleUpperCase("pt-BR")}.` : cap(w[0]);
}
const rankSchool = () => (profile && profile.escola && profile.cidade ? { escola: profile.escola, cidade: profile.cidade } : null);
async function rankApi(method, payload) {
  const s = rankSchool();
  const url = method === "GET"
    ? `/api/ranking?${new URLSearchParams({ escola: s.escola, cidade: s.cidade })}`
    : "/api/ranking";
  const r = await fetch(url, method === "GET"
    ? { headers: { "X-Rank-Token": rankToken() } }
    : { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: rankToken(), ...payload }) });
  let data = null;
  try { data = await r.json(); } catch (e) { /* resposta sem JSON */ }
  if (!r.ok) { const err = new Error((data && data.error) || String(r.status)); err.status = r.status; throw err; }
  return data;
}
const rankPayload = () => ({ nome: profile.nome, escola: profile.escola, cidade: profile.cidade, n1: state.n1, n2: state.n2, n3: clamp(Math.round(calc.ownFoco), 0, 100) });
const rankKey = () => (profile ? JSON.stringify(rankPayload()) : "");
async function loadRanking() {
  if (!rankSchool()) { rank.data = null; rank.status = "idle"; renderRanking(); return; }
  rank.status = "loading"; renderRanking();
  try {
    rank.data = await rankApi("GET");
    rank.status = "ok";
    if (rank.on && !rank.data.voce) setRankOn(false);       // registro removido em outro lugar
    if (rank.on && rankKey() !== rank.lastSent) syncRanking(); // notas mudaram desde a última visita
  } catch (e) {
    rank.status = e.status === 503 || e.status === 404 ? "off" : "error";
  }
  renderRanking();
}
async function joinRanking() {
  const btn = $("#rankJoin"); if (btn) btn.disabled = true;
  try {
    rank.data = await rankApi("POST", rankPayload());
    rank.lastSent = rankKey();
    setRankOn(true); rank.status = "ok";
    toast(`Pronto! Você está em ${rank.data.voce ? rank.data.voce.pos + "º" : ""} lugar na sua escola.`);
  } catch (e) {
    toast(e.message === "muitas_tentativas" ? "Muitas atualizações seguidas. Tente de novo em alguns minutos."
      : e.message === "escola_invalida" ? "Escolha sua escola na lista de sugestões para entrar no ranking."
      : e.message === "nome_invalido" ? "Esse nome não pode aparecer no ranking. Edite seu perfil com seu nome de verdade."
      : "Não foi possível entrar no ranking agora. Tente de novo.");
  }
  renderRanking();
}
async function leaveRanking(silent) {
  try { await rankApi("DELETE", {}); } catch (e) { if (!silent) { toast("Não foi possível sair do ranking agora. Tente de novo."); return; } }
  setRankOn(false); rank.lastSent = "";
  if (!silent) toast("Você saiu do ranking. Seu nome foi removido da lista.");
  loadRanking();
}
const syncRanking = debounce(async () => {
  if (!rank.on || !rankSchool() || rankKey() === rank.lastSent) return;
  try {
    rank.data = await rankApi("POST", rankPayload());
    rank.lastSent = rankKey(); rank.status = "ok";
    renderRanking();
  } catch (e) { /* tenta de novo na próxima mudança */ }
}, 2500);
function renderRanking() {
  const body = $("#rankBody"), s = rankSchool();
  $("#rankSchool").textContent = s ? `${s.escola}, ${s.cidade}` : "";
  if (!s) {
    body.innerHTML = `<div class="rank-empty"><p>${profile && profile.escola
      ? "Para ver o ranking, escolha sua escola na lista de sugestões (com a cidade)."
      : "Escolha sua escola para ver como você está entre os colegas que também usam o simulador."}</p>
      <button class="btn btn-primary" type="button" data-rank="profile">Escolher minha escola</button></div>`;
    return;
  }
  if (rank.status === "loading" && !rank.data) { body.innerHTML = `<p class="rank-msg">Carregando ranking…</p>`; return; }
  if (rank.status === "off") { body.innerHTML = `<p class="rank-msg">O ranking ainda não está ativado neste site.</p>`; return; }
  if (rank.status === "error" && !rank.data) { body.innerHTML = `<p class="rank-msg">Não foi possível carregar o ranking agora. <button class="link-btn" type="button" data-rank="retry">Tentar de novo</button></p>`; return; }
  const d = rank.data || { total: 0, top: [], voce: null };
  const rows = d.top.length
    ? `<ol class="rank-list">${d.top.map((r) => `<li class="${r.voce ? "me" : ""}"><span class="rank-pos num">${r.pos}º</span><span class="rank-name">${esc(r.nome)}${r.voce ? ' <small>(você)</small>' : ""}</span><span class="rank-nota num">${fmt1(r.nota)}</span></li>`).join("")}</ol>`
    : `<p class="rank-msg">Ninguém da sua escola entrou no ranking ainda. Seja o primeiro!</p>`;
  const meOutside = d.voce && d.voce.pos > d.top.length
    ? `<p class="rank-me">Sua posição: <b>${d.voce.pos}º de ${nf0.format(d.total)}</b> com ${fmt1(d.voce.nota)}</p>` : "";
  const action = rank.on && d.voce
    ? `<div class="rank-action"><p>Você está em <b>${d.voce.pos}º lugar</b> de ${nf0.format(d.total)} ${d.total === 1 ? "aluno" : "alunos"}. Sua nota é atualizada quando você muda os acertos.</p>
       <button class="link-btn" type="button" data-rank="leave">Sair do ranking</button></div>`
    : `<div class="rank-action join"><p>Você vai aparecer como <b>${esc(rankName(profile.nome))}</b> com sua nota projetada (<b>${fmt1(calc.final)}</b>). Só a lista da sua escola mostra seu nome, e você pode sair quando quiser. <a href="privacidade" target="_blank" rel="noopener">Como usamos seus dados</a>.</p>
       <button class="btn btn-primary" type="button" id="rankJoin" data-rank="join">Entrar no ranking da escola</button></div>`;
  const invite = `<a class="btn btn-whats" href="${whatsappUrl(inviteText(!!(rank.on && d.voce)))}" target="_blank" rel="noopener">${icon("whats")} Convidar colegas pelo WhatsApp</a>`;
  body.innerHTML = `${rows}${meOutside}${action}${invite}<p class="rank-note">${nf0.format(d.total)} ${d.total === 1 ? "aluno participa" : "alunos participam"}. As notas são simulações informadas pelos próprios alunos.</p>`;
}
function setupRanking() {
  $("#rankBody").addEventListener("click", (e) => {
    const b = e.target.closest("[data-rank]"); if (!b) return;
    const a = b.dataset.rank;
    if (a === "profile") openProfileDialog();
    else if (a === "join") joinRanking();
    else if (a === "leave") leaveRanking(false);
    else if (a === "retry") loadRanking();
  });
  loadRanking();
}

/* ---------- compartilhar: boletim em imagem (canvas) ---------- */
function topBoaChance(n = 3) {
  const idx = [];
  for (let i = 0; i < CURSOS.length; i++) if (chanceOf[i] === "boa") idx.push(i);
  idx.sort((a, b) => CURSOS[a].ranking - CURSOS[b].ranking);
  return idx.slice(0, n);
}
const siteLink = (ref) => `https://${CONFIG.SITE_URL}/?ref=${ref}`;
const whatsappUrl = (text) => `https://wa.me/?text=${encodeURIComponent(text)}`;
function shareText(ref = "compartilhar") {
  const counts = { boa: 0, possivel: 0 };
  chanceOf.forEach((k) => { if (k in counts) counts[k]++; });
  return `Dá pra passar? Minha nota projetada no Provão Paulista 2026: ${fmt1(calc.final)}/100.\n` +
    `${nf0.format(counts.boa)} cursos com boa chance e ${nf0.format(counts.possivel)} possíveis.\nDescubra a sua: ${siteLink(ref)}`;
}
function inviteText(joined) {
  const escola = profile && profile.escola ? profile.escola : "minha escola";
  return joined
    ? `Entrei no ranking da ${escola} no Dá pra passar?, o simulador do Provão Paulista 2026. Simula a sua nota, vê sua chance em 1.805 cursos e entra também: ${siteLink("convite")}`
    : `Bora montar o ranking da ${escola} no Dá pra passar?, o simulador do Provão Paulista 2026? Simula sua nota, vê sua chance em 1.805 cursos e entra no ranking da escola: ${siteLink("convite")}`;
}
function fitText(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text; while (t.length > 1 && ctx.measureText(t + "…").width > maxW) t = t.slice(0, -1);
  return t + "…";
}
async function drawShareCard(withId = false) {
  try {
    await Promise.all(['800 condensed 100px "Archivo"', '800 100px "Archivo"', '600 20px "IBM Plex Mono"', '500 20px "IBM Plex Mono"', '600 20px "IBM Plex Sans"', '400 20px "IBM Plex Sans"'].map((f) => document.fonts.load(f)));
  } catch (e) { /* usa fontes de fallback */ }
  const W = 1080, H = 1350, cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d");
  const D = '"Archivo", "Arial Narrow", Arial, sans-serif', S = '"IBM Plex Sans", Arial, sans-serif', M = '"IBM Plex Mono", ui-monospace, monospace';
  const C = { paper: "#f3f4f6", sheet: "#ffffff", ink: "#14171c", ink2: "#4a515c", ink3: "#646b77", rule: "#dfe2e7", pen: "#1d3fd1",
    boa: "#1f9d55", possivel: "#c99400", dificil: "#d9661f", muito: "#c62828", fora: "#8a909c" };
  const INST = { USP: "#e0ac00", UNESP: "#1e9e53", UNICAMP: "#c62828", FATEC: "#1f5fbf", UNIVESP: "#6d3fc0" };
  const X = 96, R = W - 96, CW = R - X;
  const line = (y, color = C.rule, w = 2) => { ctx.fillStyle = color; ctx.fillRect(X, y, CW, w); };

  ctx.fillStyle = C.paper; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = C.sheet; ctx.fillRect(48, 48, W - 96, H - 96);
  ctx.strokeStyle = C.rule; ctx.lineWidth = 2; ctx.strokeRect(48, 48, W - 96, H - 96);

  // cabeçalho
  // marca: quadrado azul com "?"
  ctx.fillStyle = C.pen; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(X, 108, 40, 40, 10); else ctx.rect(X, 108, 40, 40); ctx.fill();
  ctx.fillStyle = "#ffffff"; ctx.font = `800 30px ${D}`; ctx.textAlign = "center"; ctx.fillText("?", X + 20, 139); ctx.textAlign = "left";
  ctx.fillStyle = C.ink; ctx.font = `800 32px ${D}`; ctx.fillText("Dá pra passar?", X + 56, 140);
  if (!(withId && profile)) { const wb = ctx.measureText("Dá pra passar?").width; ctx.fillStyle = C.ink3; ctx.font = `400 22px ${S}`; ctx.fillText("Provão Paulista 2026", X + 72 + wb, 139); }
  ctx.textAlign = "right";
  if (withId && profile) {
    ctx.fillStyle = C.ink; ctx.font = `600 24px ${S}`; ctx.fillText(fitText(ctx, profile.nome, 330), R, profile.escola ? 122 : 137);
    if (profile.escola) { ctx.fillStyle = C.ink3; ctx.font = `400 20px ${S}`; ctx.fillText(fitText(ctx, escolaLabel(), 330), R, 152); }
  } else { ctx.fillStyle = C.ink3; ctx.font = `500 22px ${M}`; ctx.fillText("BOLETIM", R, 137); }
  ctx.textAlign = "left";
  line(180);

  // nota
  ctx.fillStyle = C.ink2; ctx.font = `600 24px ${M}`; ctx.fillText("NOTA FINAL PROJETADA", X, 240);
  ctx.fillStyle = C.ink; ctx.font = `800 condensed 240px ${D}`; ctx.fillText(fmt1(calc.final), X - 6, 430);
  const wNum = ctx.measureText(fmt1(calc.final)).width;
  ctx.fillStyle = C.ink3; ctx.font = `500 30px ${M}`; ctx.fillText("/100", X + wNum + 8, 430);
  ctx.fillStyle = C.ink2; ctx.font = `400 24px ${M}`;
  ctx.fillText(`1ª série ${fmt1(calc.nota1)} · 2ª série ${fmt1(calc.nota2)} · 3ª + redação ${fmt1(calc.ownFoco)}`, X, 508);

  // escala 0–100
  const sy = 568, sh = 22;
  ctx.fillStyle = C.paper; ctx.fillRect(X, sy, CW, sh);
  ctx.save(); ctx.beginPath(); ctx.rect(X, sy, CW * calc.max / 100, sh); ctx.clip();
  ctx.strokeStyle = "rgba(29,63,209,.25)"; ctx.lineWidth = 4;
  for (let x = X - sh; x < X + CW; x += 12) { ctx.beginPath(); ctx.moveTo(x, sy + sh); ctx.lineTo(x + sh, sy); ctx.stroke(); }
  ctx.restore();
  ctx.fillStyle = C.pen; ctx.fillRect(X, sy, CW * calc.final / 100, sh);
  ctx.strokeStyle = "#c3c8d0"; ctx.lineWidth = 2; ctx.strokeRect(X, sy, CW, sh);
  ctx.fillStyle = C.ink; ctx.fillRect(X + CW * calc.max / 100 - 2, sy - 10, 4, sh + 20);
  ctx.fillStyle = C.ink3; ctx.font = `400 20px ${M}`;
  [0, 20, 40, 60, 80, 100].forEach((t) => { ctx.textAlign = t === 0 ? "left" : t === 100 ? "right" : "center"; ctx.fillText(String(t), X + CW * t / 100, sy + sh + 32); });
  ctx.textAlign = "left";
  ctx.fillStyle = C.ink2; ctx.font = `500 20px ${M}`; ctx.fillText(`máx. possível ${fmt1(calc.max)}`, X, sy - 18);
  line(650);

  // distribuição
  const counts = {}; CHANCES.forEach((c) => (counts[c.key] = 0)); chanceOf.forEach((k) => counts[k]++);
  const total = CURSOS.length;
  ctx.fillStyle = C.ink2; ctx.font = `600 24px ${M}`; ctx.fillText(`CHANCES EM ${nf0.format(total)} CURSOS`, X, 702);
  let bx = X; const by = 724, bh = 20, gap = 4;
  const keys = CHANCES.map((c) => c.key).filter((k) => counts[k]);
  const usable = CW - gap * (keys.length - 1);
  keys.forEach((k) => { const w = usable * counts[k] / total; ctx.fillStyle = C[k]; ctx.fillRect(bx, by, w, bh); bx += w + gap; });
  const cols = ["boa", "possivel", "dificil", "muito"], colW = CW / cols.length;
  cols.forEach((k, j) => {
    const x = X + j * colW;
    ctx.fillStyle = C[k]; ctx.beginPath(); ctx.arc(x + 8, 784, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = C.ink2; ctx.font = `400 22px ${S}`; ctx.fillText(CHANCE_BY_KEY[k].label, x + 26, 792);
    ctx.fillStyle = C.ink; ctx.font = `800 60px ${D}`; ctx.fillText(nf0.format(counts[k]), x, 858);
  });
  line(892);

  // cursos
  ctx.fillStyle = C.ink2; ctx.font = `600 24px ${M}`; ctx.fillText("MAIS CONCORRIDOS COM BOA CHANCE", X, 944);
  const tops = topBoaChance(3);
  if (!tops.length) { ctx.fillStyle = C.ink; ctx.font = `600 32px ${S}`; ctx.fillText("Ainda nenhum. Bora estudar para a 3ª série!", X, 1010); }
  tops.forEach((i, j) => {
    const c = CURSOS[i], y = 960 + j * 64;
    ctx.fillStyle = INST[c.instituicao] || C.pen; ctx.fillRect(X, y + 24, 16, 16);
    ctx.fillStyle = C.ink2; ctx.font = `600 20px ${M}`; ctx.fillText(c.instituicao, X + 28, y + 40);
    ctx.fillStyle = C.ink3; ctx.font = `400 22px ${S}`; ctx.textAlign = "right"; ctx.fillText(fitText(ctx, c.municipio, 230), R, y + 41); ctx.textAlign = "left";
    ctx.fillStyle = C.ink; ctx.font = `600 30px ${S}`; ctx.fillText(fitText(ctx, c.curso, CW - 170 - 250), X + 150, y + 42);
    if (j < tops.length - 1) { ctx.fillStyle = C.rule; ctx.fillRect(X, y + 60, CW, 1); }
  });

  // rodapé
  line(H - 150);
  ctx.fillStyle = C.ink3; ctx.font = `400 22px ${S}`; ctx.fillText("Descubra se dá pra passar em", X, H - 108);
  ctx.fillStyle = C.pen; ctx.font = `600 28px ${M}`; ctx.fillText(fitText(ctx, CONFIG.SITE_URL, CW), X, H - 70);
  return cv;
}
function setupShare() {
  const modal = $("#shareModal");
  let blob = null, lastFocus = null;
  const close = () => { modal.hidden = true; if (lastFocus) lastFocus.focus(); };
  const build = async () => {
    const cv = await drawShareCard($("#shareId").checked);
    const url = cv.toDataURL("image/png");
    $("#shareImg").src = url;
    $("#shareDownload").href = url;
    blob = await new Promise((r) => cv.toBlob(r, "image/png"));
  };
  $("#shareId").addEventListener("change", build);
  $("#btnShare").addEventListener("click", () => { $("#shareWhats").href = whatsappUrl(shareText("whatsapp")); });
  $("#btnShare").addEventListener("click", async () => {
    if (!CURSOS.length) return;
    lastFocus = document.activeElement;
    await build();
    modal.hidden = false;
    modal.querySelector(".btn-icon[data-close]").focus();
  });
  modal.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.hidden) close(); });
  $("#shareNative").addEventListener("click", async () => {
    const text = shareText();
    try {
      const file = blob && new File([blob], "meu-provao-paulista-2026.png", { type: "image/png" });
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], text });
      else if (navigator.share) await navigator.share({ text, title: "Provão Paulista 2026" });
      else throw new Error("no-share");
    } catch (e) {
      if (e && e.name === "AbortError") return;
      toast("Compartilhamento indisponível aqui. Baixe a imagem ou copie o texto.");
    }
  });
  $("#shareCopy").addEventListener("click", () => {
    const text = shareText();
    navigator.clipboard.writeText(text).then(() => toast("Texto copiado."), () => toast(text));
  });
}

/* ---------- abas e menu ---------- */
const TABS = ["nota", "cursos", "ranking", "como"];
const TAB_ALIAS = { resultados: "cursos", "como-funciona": "como", topo: "nota" };
function tabFromHash() {
  const h = decodeURIComponent(location.hash.replace("#", ""));
  return TABS.includes(h) ? h : TAB_ALIAS[h] || null;
}
function showTab(name, { scroll = true } = {}) {
  if (!TABS.includes(name)) name = "nota";
  document.querySelectorAll(".tab-panel").forEach((p) => { p.hidden = p.dataset.panel !== name; });
  document.querySelectorAll("[data-tab]").forEach((t) => {
    const on = t.dataset.tab === name;
    t.setAttribute("aria-selected", String(on));
    t.tabIndex = on ? 0 : -1;
  });
  document.body.dataset.abaAtual = name; // não usar data-tab no body: o clique das abas procura [data-tab]
  if (location.hash !== `#${name}`) history.replaceState(null, "", `#${name}`);
  if (scroll) window.scrollTo({ top: 0, behavior: "instant" });
}
function setupTabs() {
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-tab], [data-goto]");
    if (!t) return;
    e.preventDefault();
    showTab(t.dataset.tab || t.dataset.goto);
  });
  $(".tabs").addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const tabs = [...document.querySelectorAll("[data-tab]")];
    const i = tabs.indexOf(document.activeElement); if (i < 0) return;
    const next = tabs[(i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length];
    showTab(next.dataset.tab); next.focus();
  });
  window.addEventListener("hashchange", () => { const t = tabFromHash(); if (t) showTab(t); });
  showTab(tabFromHash() || "nota", { scroll: false });
  // Filtros extras abertos no computador, recolhidos no celular.
  $("#moreFilters").open = window.matchMedia("(min-width: 760px)").matches;
}
function setupMenu() {
  const btn = $("#btnMenu"), menu = $("#menu");
  const close = (focus) => { menu.hidden = true; btn.setAttribute("aria-expanded", "false"); if (focus) btn.focus(); };
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const open = menu.hidden;
    menu.hidden = !open;
    btn.setAttribute("aria-expanded", String(open));
    if (open) { const first = menu.querySelector(".menu-item:not([hidden])"); if (first) first.focus(); }
  });
  menu.addEventListener("click", (e) => { if (e.target.closest(".menu-item")) close(false); });
  document.addEventListener("click", (e) => { if (!menu.hidden && !e.target.closest("#menu")) close(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !menu.hidden) close(true); });
  menu.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = [...menu.querySelectorAll(".menu-item:not([hidden])")];
    const i = items.indexOf(document.activeElement);
    items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length].focus();
  });
}

/* ---------- app instalável (PWA) ---------- */
function setupPWA() {
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register("sw.js")
      .then(() => navigator.serviceWorker.ready)
      .then(() => caches.open("pp26-v1"))
      .then((c) => c.addAll([...document.querySelectorAll('link[rel="stylesheet"][href^="style.css"], script[src^="app.js"]')]
        .map((el) => el.getAttribute("href") || el.getAttribute("src"))))
      .catch(() => { /* site funciona sem o service worker */ });
  }
  const btn = $("#btnInstall");
  let prompt = null;
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); prompt = e; btn.hidden = false; });
  window.addEventListener("appinstalled", () => { btn.hidden = true; prompt = null; toast("App instalado! Ele aparece na tela inicial."); });
  btn.addEventListener("click", async () => {
    if (!prompt) return;
    prompt.prompt();
    try { await prompt.userChoice; } catch (e) { /* ok */ }
    prompt = null; btn.hidden = true;
  });
}

/* ---------- boot ---------- */
function hydrateIcons() {
  document.querySelectorAll("[data-icon]").forEach((el) => el.insertAdjacentHTML("afterbegin", icon(el.dataset.icon)));
}
async function boot() {
  hydrateIcons();
  setupTabs();
  setupMenu();
  setupPWA();
  setupTheme();
  setupInputs();
  setupDetalhe();
  setupStats();
  setupFilters();
  setupCompare();
  filtroDoLink();
  setupShare();
  setupProfile();
  setupRanking();
  update();
  try {
    const res = await fetch(CONFIG.DATA_URL);
    if (!res.ok) throw new Error(res.status);
    CURSOS = await res.json();
  } catch (e) {
    grid.innerHTML = `<div class="loading">Não foi possível carregar a lista de cursos. Recarregue a página.</div>`;
    return;
  }
  CURSOS.forEach((c) => {
    c._turno = turnoGrupo(c.turno);
    c._s = norm(`${c.curso} ${c.unidade} ${c.municipio} ${c.instituicao} ${c.codigo}`);
    c._slug = slugCurso(c.curso);
  });
  need = new Float32Array(CURSOS.length);
  chanceOf = new Array(CURSOS.length);
  $("#heroTotal").textContent = nf0.format(CURSOS.length);
  setupReverse();
  update({ reset: true });
}
boot();
