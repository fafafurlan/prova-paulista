/* Simulador Provão Paulista Seriado 2026 — vanilla JS, sem build. */
"use strict";

const CONFIG = {
  TOTAL_QUESTOES_PROVA: 60,      // questões na prova da 1ª e da 2ª série
  PESO_SERIE_1: 0.25,
  PESO_SERIE_2: 0.25,
  PESO_SERIE_3_REDACAO: 0.5,     // 30% prova da 3ª série + 20% redação
  LIMITES_CHANCE: { boa: 5, possivel: 15, dificil: 25 }, // pontos que faltam na média
  DATA_URL: "cursos.json",
  PAGE_SIZE: 48,                 // cards renderizados por lote (lazy render)
  MAX_PINS: 4,
  SITE_URL: "prova-paulista-provao-paulista-2026.vercel.app",
  STORAGE_KEY: "pp26-state",
  DEFAULTS: { n1: 40, n2: 42, n3: 70 },
};

const INSTITUICOES = ["USP", "UNESP", "UNICAMP", "FATEC", "UNIVESP"];
const INST_COLORS = { USP: ["--usp", "--usp-fg"], UNESP: ["--unesp", "--unesp-fg"], UNICAMP: ["--unicamp", "--unicamp-fg"], FATEC: ["--fatec", "--fatec-fg"], UNIVESP: ["--univesp", "--univesp-fg"] };
const CHANCES = [
  { key: "boa", label: "Boa chance", icon: "check" },
  { key: "possivel", label: "Possível", icon: "trend" },
  { key: "dificil", label: "Difícil", icon: "alert" },
  { key: "muito", label: "Muito difícil", icon: "octagon" },
  { key: "fora", label: "Fora de alcance", icon: "xcircle" },
];
const CHANCE_BY_KEY = Object.fromEntries(CHANCES.map((c, i) => [c.key, { ...c, order: i }]));
const TURNOS = ["Integral", "Manhã", "Tarde", "Noite", "Misto", "EaD"];

/* Lucide icons (MIT), inline para evitar dependência. */
const ICONS = {
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2m-7.07-14.07 1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.59 13.51 6.83 3.98M15.41 6.51l-6.82 3.98"/>',
  pin: '<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>',
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/>',
  copy: '<rect x="8" y="8" width="14" height="14" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  check: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  trend: '<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4M12 17h.01"/>',
  octagon: '<path d="M12 16h.01M12 8v4"/><path d="M15.31 2a2 2 0 0 1 1.42.59l4.68 4.68a2 2 0 0 1 .59 1.42v6.62a2 2 0 0 1-.59 1.42l-4.68 4.68a2 2 0 0 1-1.42.59H8.69a2 2 0 0 1-1.42-.59l-4.68-4.68A2 2 0 0 1 2 15.31V8.69a2 2 0 0 1 .59-1.42l4.68-4.68A2 2 0 0 1 8.69 2z"/>',
  xcircle: '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/>',
  map: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  building: '<path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6"/>',
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
const state = {
  n1: Number.isFinite(saved.n1) ? saved.n1 : CONFIG.DEFAULTS.n1,
  n2: Number.isFinite(saved.n2) ? saved.n2 : CONFIG.DEFAULTS.n2,
  n3: Number.isFinite(saved.n3) ? saved.n3 : CONFIG.DEFAULTS.n3,
  inst: saved.inst || "",
  chance: saved.chance || "",
  turno: saved.turno || "",
  sort: saved.sort || "ranking",
  q: "",
  pins: Array.isArray(saved.pins) ? saved.pins.slice(0, CONFIG.MAX_PINS) : [],
  revId: Number.isInteger(saved.revId) ? saved.revId : null,
};
const persist = debounce(() => {
  const { n1, n2, n3, inst, chance, turno, sort, pins, revId } = state;
  store.set(CONFIG.STORAGE_KEY, { n1, n2, n3, inst, chance, turno, sort, pins, revId });
}, 300);

let CURSOS = [];
let need = new Float32Array(0);
let chanceOf = [];
let calc = { nota1: 0, nota2: 0, base: 0, final: 0, max: 0 };
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
function recompute() {
  const T = CONFIG.TOTAL_QUESTOES_PROVA;
  const nota1 = (state.n1 / T) * 100;
  const nota2 = (state.n2 / T) * 100;
  const base = CONFIG.PESO_SERIE_1 * nota1 + CONFIG.PESO_SERIE_2 * nota2;
  calc = { nota1, nota2, base, final: base + CONFIG.PESO_SERIE_3_REDACAO * state.n3, max: base + CONFIG.PESO_SERIE_3_REDACAO * 100 };
  for (let i = 0; i < CURSOS.length; i++) {
    need[i] = mediaNecessaria(CURSOS[i].notaEstimada, base);
    chanceOf[i] = classify(need[i], state.n3);
  }
}
const proximity = (i) => (need[i] <= 0 ? 100 : clamp((state.n3 / need[i]) * 100, 0, 100));

/* ---------- inputs ---------- */
const inputs = [
  { key: "n1", range: $("#n1Range"), num: $("#n1Num"), max: () => CONFIG.TOTAL_QUESTOES_PROVA, unit: "acertos" },
  { key: "n2", range: $("#n2Range"), num: $("#n2Num"), max: () => CONFIG.TOTAL_QUESTOES_PROVA, unit: "acertos" },
  { key: "n3", range: $("#n3Range"), num: $("#n3Num"), max: () => 100, unit: "pontos" },
];
function paintRange(inp) {
  const max = inp.max();
  inp.num.style.width = Math.max(1, String(inp.num.value).length) + 0.4 + "ch";
  inp.range.style.setProperty("--p", (state[inp.key] / max) * 100 + "%");
  inp.range.setAttribute("aria-valuetext", `${nf0.format(state[inp.key])} ${inp.unit} de ${max}`);
}
function setupInputs() {
  document.querySelectorAll("[data-total]").forEach((el) => (el.textContent = CONFIG.TOTAL_QUESTOES_PROVA));
  inputs.forEach((inp) => {
    const max = inp.max();
    inp.range.max = max; inp.num.max = max;
    state[inp.key] = clamp(state[inp.key], 0, max);
    inp.range.value = state[inp.key]; inp.num.value = state[inp.key];
    paintRange(inp);
    inp.range.addEventListener("input", () => {
      state[inp.key] = Number(inp.range.value);
      inp.num.value = state[inp.key];
      paintRange(inp);
      scheduleUpdate();
    });
    inp.num.addEventListener("input", () => {
      const v = parseFloat(String(inp.num.value).replace(",", "."));
      if (!Number.isFinite(v)) return;
      state[inp.key] = clamp(Math.round(v), 0, max);
      inp.range.value = state[inp.key];
      paintRange(inp);
      scheduleUpdate();
    });
    inp.num.addEventListener("change", () => { inp.num.value = state[inp.key]; });
    inp.num.addEventListener("focus", () => inp.num.select());
  });
}

let rafPending = false;
function scheduleUpdate() {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => { rafPending = false; update(); });
}

/* ---------- score panel ---------- */
const counters = new WeakMap();
function countTo(el, to, dur = 450) {
  const from = counters.get(el) ?? 0;
  counters.set(el, to);
  if (reduceMotion() || Math.abs(to - from) < 0.05) { el.textContent = fmt1(to); return; }
  const t0 = performance.now();
  const step = (t) => {
    if (counters.get(el) !== to) return;
    const k = Math.min(1, (t - t0) / dur);
    const e = 1 - Math.pow(1 - k, 3);
    el.textContent = fmt1(from + (to - from) * e);
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
function renderScore() {
  countTo($("#notaFinal"), calc.final, 700);
  countTo($("#tsNota"), calc.final, 450);
  $("#tsMax").textContent = fmt1(calc.max);
  $("#n1Nota").textContent = fmt1(calc.nota1);
  $("#n2Nota").textContent = fmt1(calc.nota2);
  $("#notaMax").textContent = fmt1(calc.max);
  $("#scoreFormula").textContent = `0,25 × ${fmt1(calc.nota1)} + 0,25 × ${fmt1(calc.nota2)} + 0,5 × ${nf0.format(state.n3)}`;
  $("#sbFill").style.width = calc.final + "%";
  $("#sbMax").style.width = calc.max + "%";
  $("#sbTick").style.left = `calc(${calc.max}% - 1px)`;
  $("#sbTickLabel").textContent = "máx " + fmt1(calc.max);
  $("#scoreBarImg").setAttribute("aria-label", `Nota projetada ${fmt1(calc.final)} de 100; máxima possível ${fmt1(calc.max)}`);
}

/* ---------- filtros ---------- */
function baseFilter(i) {
  const c = CURSOS[i];
  if (state.inst && c.instituicao !== state.inst) return false;
  if (state.turno && c._turno !== state.turno) return false;
  if (qTokens.length) { for (const t of qTokens) if (!c._s.includes(t)) return false; }
  return true;
}
let qTokens = [];
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
  const by = {
    ranking: (a, b) => CURSOS[a].ranking - CURSOS[b].ranking,
    chance: (a, b) => CHANCE_BY_KEY[chanceOf[a]].order - CHANCE_BY_KEY[chanceOf[b]].order || need[b] - need[a] || CURSOS[a].ranking - CURSOS[b].ranking,
    vagas: (a, b) => CURSOS[b].vagas - CURSOS[a].vagas || CURSOS[a].ranking - CURSOS[b].ranking,
    notaAsc: (a, b) => CURSOS[a].notaEstimada - CURSOS[b].notaEstimada || CURSOS[a].ranking - CURSOS[b].ranking,
    notaDesc: (a, b) => CURSOS[b].notaEstimada - CURSOS[a].notaEstimada || CURSOS[a].ranking - CURSOS[b].ranking,
  }[state.sort] || ((a, b) => a - b);
  out.sort(by);
  return { out, counts, total };
}

/* ---------- stats ---------- */
function setupStats() {
  $("#stats").innerHTML = CHANCES.map((c) => `
    <button class="stat" type="button" data-chance="${c.key}" aria-pressed="false" style="--cc:var(--c-${c.key})">
      <span class="stat-top">${icon(c.icon)} ${c.label}</span>
      <span class="stat-num mono" data-num>0</span>
      <span class="stat-sub" data-sub>cursos</span>
    </button>`).join("");
  $("#stats").addEventListener("click", (e) => {
    const b = e.target.closest(".stat"); if (!b) return;
    const k = b.dataset.chance;
    state.chance = state.chance === k ? "" : k;
    $("#fChance").value = state.chance;
    if (k === "boa" && state.chance === "boa") celebrate(b);
    update({ reset: true });
  });
}
function renderStats(counts, total) {
  document.querySelectorAll(".stat").forEach((b) => {
    const k = b.dataset.chance;
    const numEl = b.querySelector("[data-num]");
    const prev = counters.get(numEl) ?? 0;
    counters.set(numEl, counts[k]);
    animateInt(numEl, prev, counts[k]);
    b.querySelector("[data-sub]").textContent = `de ${nf0.format(total)} cursos`;
    b.setAttribute("aria-pressed", String(state.chance === k));
    b.setAttribute("aria-label", `${CHANCE_BY_KEY[k].label}: ${counts[k]} cursos. ${state.chance === k ? "Remover filtro" : "Filtrar"}`);
  });
}
function animateInt(el, from, to) {
  if (reduceMotion() || from === to) { el.textContent = nf0.format(to); return; }
  const t0 = performance.now(), dur = 400;
  const step = (t) => {
    if (counters.get(el) !== to) return;
    const k = Math.min(1, (t - t0) / dur);
    el.textContent = nf0.format(Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3))));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ---------- cards ---------- */
function createCard(i) {
  const c = CURSOS[i];
  const el = document.createElement("article");
  el.className = "card enter";
  el.dataset.id = i;
  el.innerHTML = `
    <div class="card-top">
      <span class="inst inst-${esc(c.instituicao)}">${esc(c.instituicao)}</span>
      <span class="rank mono">#${c.ranking}</span>
      <button class="pin" type="button" data-pin aria-pressed="false" aria-label="Fixar ${esc(c.curso)} no comparador">${icon("pin")}</button>
    </div>
    <h3>${esc(c.curso)}</h3>
    <p class="meta">
      <span>${icon("building")} ${esc(c.unidade || "—")}</span>
      <span>${icon("map")} ${esc(c.municipio || "—")}</span>
      <span>${icon("clock")} ${esc(c.turno || "—")}</span>
    </p>
    <dl class="nums">
      <div><dt>Vagas</dt><dd>${nf0.format(c.vagas)}</dd></div>
      <div><dt>Nota p/ garantir</dt><dd>${fmt1(c.notaEstimada)}</dd></div>
      <div><dt>Média na 3ª</dt><dd class="need" data-need></dd></div>
    </dl>
    <div class="card-bottom">
      <button class="badge" type="button" data-badge></button>
      <div class="prox"><span>Quão perto</span><span class="prox-bar"><i data-prox></i></span><span class="mono" data-proxv></span></div>
    </div>`;
  el.addEventListener("animationend", () => el.classList.remove("enter"), { once: true });
  return el;
}
function updateCard(el, i) {
  const k = chanceOf[i];
  const ch = CHANCE_BY_KEY[k];
  const badge = el.querySelector("[data-badge]");
  if (el.dataset.chance !== k) {
    if (el.dataset.chance) { badge.classList.remove("pop"); void badge.offsetWidth; badge.classList.add("pop"); }
    el.dataset.chance = k;
    badge.innerHTML = `${icon(ch.icon)} ${ch.label}`;
  }
  const n = need[i];
  el.querySelector("[data-need]").textContent = n > 100 ? ">100" : fmt1(n);
  const p = proximity(i);
  el.querySelector("[data-prox]").style.width = p + "%";
  el.querySelector("[data-proxv]").textContent = Math.round(p) + "%";
  const pin = el.querySelector("[data-pin]");
  pin.setAttribute("aria-pressed", String(state.pins.includes(i)));
  badge.setAttribute("aria-label", k === "boa" ? "Boa chance — comemorar" : `${ch.label}: ver quanto falta`);
}
function getNode(i) {
  let el = nodeCache.get(i);
  if (!el) { el = createCard(i); nodeCache.set(i, el); }
  updateCard(el, i);
  return el;
}

const grid = $("#grid");
let lastList = [];
function renderGrid(reset) {
  const sameOrder = !reset && list.length === lastList.length && list.every((v, j) => v === lastList[j]);
  if (sameOrder) {
    for (let j = 0; j < rendered; j++) updateCard(grid.children[j], list[j]);
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

/* ---------- 3D hover ---------- */
function setupTilt() {
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  let active = null, raf = 0, ev = null;
  grid.addEventListener("pointermove", (e) => {
    if (reduceMotion()) return;
    ev = e;
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const card = ev.target.closest(".card");
      if (active && active !== card) { active.style.removeProperty("--rx"); active.style.removeProperty("--ry"); }
      active = card;
      if (!card) return;
      const r = card.getBoundingClientRect();
      const x = (ev.clientX - r.left) / r.width - 0.5, y = (ev.clientY - r.top) / r.height - 0.5;
      card.style.setProperty("--ry", (x * 7).toFixed(2) + "deg");
      card.style.setProperty("--rx", (-y * 7).toFixed(2) + "deg");
    });
  });
  grid.addEventListener("pointerleave", () => {
    if (active) { active.style.removeProperty("--rx"); active.style.removeProperty("--ry"); active = null; }
  });
}

/* ---------- comparador ---------- */
function togglePin(i) {
  const at = state.pins.indexOf(i);
  if (at >= 0) state.pins.splice(at, 1);
  else {
    if (state.pins.length >= CONFIG.MAX_PINS) { toast(`Você pode comparar até ${CONFIG.MAX_PINS} cursos. Remova um para adicionar outro.`); return; }
    state.pins.push(i);
  }
  const el = nodeCache.get(i); if (el) updateCard(el, i);
  renderCompare();
  persist();
}
function renderCompare() {
  const sec = $("#compare");
  state.pins = state.pins.filter((i) => CURSOS[i]);
  sec.hidden = state.pins.length === 0;
  $("#compareGrid").innerHTML = state.pins.map((i) => {
    const c = CURSOS[i], k = chanceOf[i], ch = CHANCE_BY_KEY[k];
    return `<article class="cmp glass" data-chance="${k}">
      <div class="cmp-head"><span class="inst inst-${esc(c.instituicao)}">${esc(c.instituicao)}</span>
        <button class="pin" type="button" data-unpin="${i}" aria-pressed="true" aria-label="Remover ${esc(c.curso)} do comparador">${icon("x")}</button></div>
      <h3>${esc(c.curso)}</h3>
      <p class="meta"><span>${icon("map")} ${esc(c.municipio)}</span><span>${icon("clock")} ${esc(c.turno)}</span></p>
      <dl>
        <dt>Ranking</dt><dd>#${c.ranking}</dd>
        <dt>Vagas</dt><dd>${nf0.format(c.vagas)}</dd>
        <dt>Nota p/ garantir</dt><dd>${fmt1(c.notaEstimada)}</dd>
        <dt>Média na 3ª</dt><dd style="color:var(--cc)">${need[i] > 100 ? ">100" : fmt1(need[i])}</dd>
        <dt>Quão perto</dt><dd>${Math.round(proximity(i))}%</dd>
      </dl>
      <span class="badge" style="--cc:var(--c-${k})">${icon(ch.icon)} ${ch.label}</span>
    </article>`;
  }).join("");
}

/* ---------- reverso: quanto preciso? ---------- */
function setupReverse() {
  const input = $("#revInput"), listEl = $("#revList");
  let matches = [], active = -1;
  const close = () => { listEl.hidden = true; input.setAttribute("aria-expanded", "false"); active = -1; };
  const paint = () => {
    listEl.innerHTML = matches.map((i, j) => {
      const c = CURSOS[i];
      return `<li role="option" id="rev-opt-${j}" data-i="${i}" aria-selected="${j === active}"><span class="inst inst-${esc(c.instituicao)}">${esc(c.instituicao)}</span><span class="t">${esc(c.curso)}</span><small>${esc(c.municipio)}</small></li>`;
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
  const choose = (i) => { state.revId = i; input.value = `${CURSOS[i].curso} — ${CURSOS[i].instituicao}`; close(); renderReverse(); persist(); };
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
  if (state.revId != null && CURSOS[state.revId]) input.value = `${CURSOS[state.revId].curso} — ${CURSOS[state.revId].instituicao}`;
}
function renderReverse() {
  const out = $("#revOut");
  const i = state.revId;
  if (i == null || !CURSOS[i]) { out.innerHTML = ""; return; }
  const c = CURSOS[i], n = need[i], k = chanceOf[i], ch = CHANCE_BY_KEY[k];
  const minAcertos = ["USP", "UNESP", "UNICAMP"].includes(c.instituicao)
    ? `<p>Lembre: ${esc(c.instituicao)} exige no mínimo <b>22 acertos</b> na prova da 3ª série.</p>` : "";
  let msg;
  if (n > 100) msg = `Mesmo com 100 na 3ª série + redação, sua nota máxima (<b>${fmt1(calc.max)}</b>) fica abaixo da nota estimada de <b>${fmt1(c.notaEstimada)}</b>.`;
  else if (n <= state.n3) msg = `Sua estimativa atual (<b>${nf0.format(state.n3)}</b>) já cobre a média necessária. Mantenha o ritmo!`;
  else msg = `Faltam <b>${fmt1(n - state.n3)} pontos</b> em relação à sua estimativa atual (<b>${nf0.format(state.n3)}</b>).`;
  out.innerHTML = `<div class="rev-result" data-chance="${k}">
    <p>Para <b>${esc(c.curso)}</b> · ${esc(c.instituicao)} · ${esc(c.municipio)} (nota p/ garantir ${fmt1(c.notaEstimada)}), você precisa de média</p>
    <span class="rev-big">${n > 100 ? ">100" : fmt1(n)}</span>
    <p>na 3ª série + redação. ${msg}</p>
    <span class="badge" style="--cc:var(--c-${k})">${icon(ch.icon)} ${ch.label}</span>
    ${minAcertos}
  </div>`;
}

/* ---------- filtros UI ---------- */
function setupFilters() {
  const chips = $("#instChips");
  chips.innerHTML = `<button class="chip chip-all" type="button" data-inst="" aria-pressed="false">Todas</button>` +
    INSTITUICOES.map((n) => `<button class="chip" type="button" data-inst="${n}" aria-pressed="false" style="--sw:var(${INST_COLORS[n][0]});--sw-fg:var(${INST_COLORS[n][1]})"><span class="sw"></span>${n}</button>`).join("");
  chips.addEventListener("click", (e) => {
    const b = e.target.closest(".chip"); if (!b) return;
    state.inst = b.dataset.inst === state.inst ? "" : b.dataset.inst;
    update({ reset: true });
  });
  const fChance = $("#fChance");
  fChance.insertAdjacentHTML("beforeend", CHANCES.map((c) => `<option value="${c.key}">${c.label}</option>`).join(""));
  fChance.value = state.chance;
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
    const card = e.target.closest(".card"); if (!card) return;
    const i = Number(card.dataset.id);
    if (e.target.closest("[data-pin]")) togglePin(i);
    else if (e.target.closest("[data-badge]")) {
      if (chanceOf[i] === "boa") celebrate(e.target.closest("[data-badge]"));
      else if (chanceOf[i] === "fora") toast(`Mesmo com 100 na 3ª + redação, sua nota máxima é ${fmt1(calc.max)}. Este curso pede ${fmt1(CURSOS[i].notaEstimada)}.`);
      else toast(`Faltam ${fmt1(need[i] - state.n3)} pontos na sua média da 3ª série + redação para ${CURSOS[i].curso}.`);
    }
  });
  $("#compareGrid").addEventListener("click", (e) => { const b = e.target.closest("[data-unpin]"); if (b) togglePin(Number(b.dataset.unpin)); });
  $("#btnClearPins").addEventListener("click", () => {
    const old = state.pins.slice(); state.pins = [];
    old.forEach((i) => { const el = nodeCache.get(i); if (el) updateCard(el, i); });
    renderCompare(); persist();
  });

  const sentinel = $("#sentinel");
  if ("IntersectionObserver" in window) {
    new IntersectionObserver((ents) => { if (ents.some((x) => x.isIntersecting)) renderMore(); }, { rootMargin: "800px 0px" }).observe(sentinel);
  } else {
    rendered = Infinity;
  }
}
function syncFilterUI() {
  document.querySelectorAll("#instChips .chip").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.inst === state.inst)));
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
  renderCompare();
  renderReverse();
  $("#countLabel").textContent = `${nf0.format(list.length)} de ${nf0.format(CURSOS.length)}`;
  announce(`${list.length} cursos encontrados`);
  persist();
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
    const colors = ["#6366f1", "#a855f7", "#ec4899", "#4ade80", "#facc15"];
    window.confetti({ particleCount: 110, spread: 75, startVelocity: 42, origin, colors, disableForReducedMotion: true });
    setTimeout(() => window.confetti({ particleCount: 60, spread: 120, startVelocity: 30, origin, colors, scalar: 0.8, disableForReducedMotion: true }), 180);
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
    btn.innerHTML = icon(dark ? "sun" : "moon");
    btn.setAttribute("aria-label", dark ? "Ativar tema claro" : "Ativar tema escuro");
    document.querySelector('meta[name="theme-color"]').setAttribute("content", dark ? "#0a0a0f" : "#f6f6fb");
  };
  btn.addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("pp26-theme", next); } catch (e) { /* ok */ }
    paint();
  });
  paint();
}

/* ---------- compartilhar (card de imagem via canvas) ---------- */
function topBoaChance(n = 3) {
  const idx = [];
  for (let i = 0; i < CURSOS.length; i++) if (chanceOf[i] === "boa") idx.push(i);
  idx.sort((a, b) => CURSOS[a].ranking - CURSOS[b].ranking);
  return idx.slice(0, n);
}
function shareText() {
  const counts = { boa: 0, possivel: 0 };
  chanceOf.forEach((k) => { if (k in counts) counts[k]++; });
  return `Minha nota projetada no Provão Paulista 2026: ${fmt1(calc.final)}/100 🎯\n` +
    `${counts.boa} cursos com boa chance e ${counts.possivel} possíveis.\nSimule a sua: https://${CONFIG.SITE_URL}`;
}
function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function fitText(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text; while (t.length > 1 && ctx.measureText(t + "…").width > maxW) t = t.slice(0, -1);
  return t + "…";
}
async function drawShareCard() {
  try { await document.fonts.ready; } catch (e) { /* ok */ }
  const W = 1080, H = 1350, cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d");
  const F = '"Geist", "Inter", system-ui, sans-serif', M = '"Geist Mono", ui-monospace, monospace';
  ctx.fillStyle = "#0a0a0f"; ctx.fillRect(0, 0, W, H);
  [[200, 220, 520, "rgba(99,102,241,.45)"], [880, 300, 480, "rgba(168,85,247,.38)"], [900, 1180, 520, "rgba(236,72,153,.28)"]].forEach(([x, y, r, c]) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, c); g.addColorStop(1, "rgba(10,10,15,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  });
  const grad = ctx.createLinearGradient(80, 0, W - 80, 0);
  grad.addColorStop(0, "#6366f1"); grad.addColorStop(0.5, "#a855f7"); grad.addColorStop(1, "#ec4899");

  ctx.fillStyle = "#a1a1b5"; ctx.font = `600 30px ${F}`; ctx.fillText("PROVÃO PAULISTA SERIADO 2026", 80, 120);
  ctx.fillStyle = "#ededf3"; ctx.font = `700 54px ${F}`; ctx.fillText("Minha nota final projetada", 80, 200);
  ctx.fillStyle = grad; ctx.font = `700 260px ${M}`; ctx.fillText(fmt1(calc.final), 70, 450);
  ctx.fillStyle = "#6e6e85"; ctx.font = `500 34px ${M}`; ctx.fillText(`/100  ·  máx. possível ${fmt1(calc.max)}`, 84, 530);

  // barra
  roundRect(ctx, 80, 568, W - 160, 26, 13); ctx.fillStyle = "rgba(255,255,255,.08)"; ctx.fill();
  roundRect(ctx, 80, 568, Math.max(26, (W - 160) * calc.final / 100), 26, 13); ctx.fillStyle = grad; ctx.fill();

  // contagens
  const counts = {}; CHANCES.forEach((c) => (counts[c.key] = 0)); chanceOf.forEach((k) => counts[k]++);
  const cols = { boa: "#4ade80", possivel: "#facc15", dificil: "#fb923c", muito: "#f87171", fora: "#fb7185" };
  const show = ["boa", "possivel", "dificil"];
  const bw = (W - 160 - 40) / 3;
  show.forEach((k, j) => {
    const x = 80 + j * (bw + 20), y = 640;
    roundRect(ctx, x, y, bw, 170, 24); ctx.fillStyle = "rgba(255,255,255,.05)"; ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.10)"; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = cols[k]; ctx.font = `600 30px ${F}`; ctx.fillText(CHANCE_BY_KEY[k].label, x + 28, y + 56);
    ctx.fillStyle = "#ededf3"; ctx.font = `700 76px ${M}`; ctx.fillText(nf0.format(counts[k]), x + 28, y + 140);
  });

  ctx.fillStyle = "#a1a1b5"; ctx.font = `600 28px ${F}`; ctx.fillText("CURSOS MAIS CONCORRIDOS COM BOA CHANCE", 80, 872);
  const tops = topBoaChance(3);
  if (!tops.length) { ctx.fillStyle = "#ededf3"; ctx.font = `500 36px ${F}`; ctx.fillText("Bora estudar pra 3ª série! 💪", 80, 930); }
  tops.forEach((i, j) => {
    const c = CURSOS[i], y = 900 + j * 94;
    roundRect(ctx, 80, y, W - 160, 84, 18); ctx.fillStyle = "rgba(255,255,255,.05)"; ctx.fill();
    const instCol = { USP: "#facc15", UNESP: "#22c55e", UNICAMP: "#dc2626", FATEC: "#2563eb", UNIVESP: "#7c3aed" }[c.instituicao] || "#a855f7";
    roundRect(ctx, 100, y + 22, 150, 40, 8); ctx.fillStyle = instCol; ctx.fill();
    ctx.fillStyle = ["USP", "UNESP"].includes(c.instituicao) ? "#111" : "#fff"; ctx.font = `700 24px ${F}`; ctx.textAlign = "center"; ctx.fillText(c.instituicao, 175, y + 51); ctx.textAlign = "left";
    ctx.fillStyle = "#ededf3"; ctx.font = `600 32px ${F}`; ctx.fillText(fitText(ctx, c.curso, W - 160 - 220), 275, y + 54);
  });

  ctx.fillStyle = "#a1a1b5"; ctx.font = `500 26px ${F}`; ctx.fillText("Simule a sua nota em", 80, H - 112);
  ctx.fillStyle = grad; ctx.font = `700 34px ${F}`; ctx.fillText(fitText(ctx, CONFIG.SITE_URL, W - 160), 80, H - 66);
  return cv;
}
function setupShare() {
  const modal = $("#shareModal");
  let blob = null, lastFocus = null;
  const close = () => { modal.hidden = true; if (lastFocus) lastFocus.focus(); };
  $("#btnShare").addEventListener("click", async () => {
    if (!CURSOS.length) return;
    lastFocus = document.activeElement;
    const cv = await drawShareCard();
    const url = cv.toDataURL("image/png");
    $("#shareImg").src = url;
    $("#shareDownload").href = url;
    blob = await new Promise((r) => cv.toBlob(r, "image/png"));
    modal.hidden = false;
    modal.querySelector("[data-close].icon-btn").focus();
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
    navigator.clipboard.writeText(text).then(() => toast("Texto copiado!"), () => toast(text));
  });
}

/* ---------- boot ---------- */
function hydrateIcons() {
  document.querySelectorAll("[data-icon]").forEach((el) => el.insertAdjacentHTML("afterbegin", icon(el.dataset.icon)));
}
async function boot() {
  hydrateIcons();
  setupTheme();
  setupInputs();
  setupStats();
  setupFilters();
  setupShare();
  setupTilt();
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
  });
  need = new Float32Array(CURSOS.length);
  chanceOf = new Array(CURSOS.length);
  $("#heroTotal").textContent = nf0.format(CURSOS.length);
  setupReverse();
  update({ reset: true });
}
boot();
