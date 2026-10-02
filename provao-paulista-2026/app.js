/* Simulador Provão Paulista Seriado 2026 — vanilla JS, sem build. */
"use strict";

const CONFIG = {
  TOTAL_QUESTOES_PROVA: 60,      // questões na prova da 1ª e da 2ª série
  PESO_SERIE_1: 0.25,
  PESO_SERIE_2: 0.25,
  PESO_SERIE_3_REDACAO: 0.5,     // 30% prova da 3ª série + 20% redação
  LIMITES_CHANCE: { boa: 5, possivel: 15, dificil: 25 }, // pontos que faltam na média
  DATA_URL: "cursos.json",
  PAGE_SIZE: 60,                 // linhas renderizadas por lote (lazy render)
  MAX_PINS: 4,
  SITE_URL: "prova-paulista-provao-paulista-2026.vercel.app",
  STORAGE_KEY: "pp26-state",
  DEFAULTS: { n1: 40, n2: 42, n3: 70 },
};

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
function gapText(i) {
  if (need[i] > 100) return "acima de 100";
  if (need[i] <= state.n3) return "você já alcança";
  return `faltam ${fmt1(need[i] - state.n3)}`;
}

/* ---------- inputs ---------- */
const inputs = [
  { key: "n1", range: $("#n1Range"), num: $("#n1Num"), max: () => CONFIG.TOTAL_QUESTOES_PROVA, unit: "acertos", bubbles: $('.bubbles[data-for="n1"]') },
  { key: "n2", range: $("#n2Range"), num: $("#n2Num"), max: () => CONFIG.TOTAL_QUESTOES_PROVA, unit: "acertos", bubbles: $('.bubbles[data-for="n2"]') },
  { key: "n3", range: $("#n3Range"), num: $("#n3Num"), max: () => 100, unit: "pontos" },
];
function paintInput(inp) {
  const max = inp.max(), v = state[inp.key];
  inp.range.style.setProperty("--p", (v / max) * 100 + "%");
  inp.range.setAttribute("aria-valuetext", `${nf0.format(v)} ${inp.unit} de ${max}`);
  if (inp.bubbles) inp.bubbles.querySelectorAll(".bub").forEach((b, k) => b.classList.toggle("on", k < v));
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
    if (inp.bubbles) {
      let html = "";
      for (let g = 0; g < max; g += 10) {
        html += '<span class="bgroup">';
        for (let k = g; k < Math.min(max, g + 10); k++) html += `<span class="bub" data-k="${k + 1}"></span>`;
        html += "</span>";
      }
      inp.bubbles.innerHTML = html;
      inp.bubbles.addEventListener("click", (e) => {
        const b = e.target.closest(".bub"); if (!b) return;
        const k = Number(b.dataset.k);
        setValue(inp, k === state[inp.key] ? k - 1 : k);
        inp.num.value = state[inp.key];
      });
    }
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
  $("#notaMax").textContent = fmt1(calc.max);
  $("#notaBase").textContent = fmt1(calc.base);
  $("#scoreFormula").textContent = `0,25 × ${fmt1(calc.nota1)} + 0,25 × ${fmt1(calc.nota2)} + 0,5 × ${nf0.format(state.n3)}`;
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
    update({ reset: true });
  });
}
function renderStats(counts, total) {
  $("#distTotal").textContent = nf0.format(total);
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
    b.querySelector("[data-pct]").textContent = total ? `${Math.round((n / total) * 100)}%` : "0%";
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
  const meta = [c.unidade, c.municipio, c.turno].filter(Boolean).map(esc).join(" · ");
  el.innerHTML = `
    <div class="c-course">
      <div class="c-tags"><span class="inst" data-inst="${esc(c.instituicao)}"><i></i>${esc(c.instituicao)}</span><span class="rank mono">#${c.ranking}</span></div>
      <h3>${esc(c.curso)}</h3>
      <p class="meta">${meta}</p>
    </div>
    <div class="c-num vagas" data-label="Vagas">${nf0.format(c.vagas)}</div>
    <div class="c-num nota" data-label="Nota estimada">${fmt1(c.notaEstimada)}</div>
    <div class="c-num need" data-label="Média na 3ª" data-need></div>
    <div class="c-chance">
      <button class="chance" type="button" data-badge><i></i><span data-label></span></button>
      <span class="gap"><span class="gap-bar"><i data-prox></i></span><span class="gap-text mono" data-gap></span></span>
    </div>
    <div class="c-pin"><button class="pin" type="button" data-pin aria-pressed="false" aria-label="Adicionar ${esc(c.curso)} (${esc(c.instituicao)}) ao comparador">${icon("pin")}</button></div>`;
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
  el.querySelector("[data-pin]").setAttribute("aria-pressed", String(state.pins.includes(i)));
  badge.setAttribute("aria-label", `${CHANCE_BY_KEY[k].label}, ${gapText(i)}`);
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
  }
  const el = nodeCache.get(i); if (el) updateRow(el, i);
  renderCompare();
  persist();
}
function renderCompare() {
  state.pins = state.pins.filter((i) => CURSOS[i]);
  $("#compare").hidden = state.pins.length === 0;
  if (!state.pins.length) return;
  $("#pinCount").textContent = `${state.pins.length} de ${CONFIG.MAX_PINS}`;
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
  else if (n <= state.n3) msg = `Sua estimativa atual (<b>${nf0.format(state.n3)}</b>) já alcança essa média.`;
  else msg = `Faltam <b>${fmt1(n - state.n3)} pontos</b> em relação à sua estimativa atual (<b>${nf0.format(state.n3)}</b>).`;
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
    else if (e.target.closest("[data-badge]")) {
      if (chanceOf[i] === "boa") celebrate(e.target.closest("[data-badge]"));
      else if (chanceOf[i] === "fora") toast(`Mesmo com 100 na 3ª + redação, sua nota máxima é ${fmt1(calc.max)}. Este curso pede ${fmt1(CURSOS[i].notaEstimada)}.`);
      else toast(`Faltam ${fmt1(need[i] - state.n3)} pontos na média da 3ª série + redação para ${CURSOS[i].curso}.`);
    }
  });
  $("#compareTable").addEventListener("click", (e) => { const b = e.target.closest("[data-unpin]"); if (b) togglePin(Number(b.dataset.unpin)); });
  $("#btnClearPins").addEventListener("click", () => {
    const old = state.pins.slice(); state.pins = [];
    old.forEach((i) => { const el = nodeCache.get(i); if (el) updateRow(el, i); });
    renderCompare(); persist();
  });

  if ("IntersectionObserver" in window) {
    new IntersectionObserver((ents) => { if (ents.some((x) => x.isIntersecting)) renderMore(); }, { rootMargin: "900px 0px" }).observe($("#sentinel"));
  }
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
  renderCompare();
  renderReverse();
  $("#countLabel").textContent = `${nf0.format(list.length)} de ${nf0.format(CURSOS.length)}`;
  announce(`${list.length} cursos na lista`);
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
    btn.innerHTML = icon(dark ? "sun" : "moon");
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

/* ---------- compartilhar: boletim em imagem (canvas) ---------- */
function topBoaChance(n = 3) {
  const idx = [];
  for (let i = 0; i < CURSOS.length; i++) if (chanceOf[i] === "boa") idx.push(i);
  idx.sort((a, b) => CURSOS[a].ranking - CURSOS[b].ranking);
  return idx.slice(0, n);
}
function shareText() {
  const counts = { boa: 0, possivel: 0 };
  chanceOf.forEach((k) => { if (k in counts) counts[k]++; });
  return `Minha nota projetada no Provão Paulista 2026: ${fmt1(calc.final)}/100.\n` +
    `${nf0.format(counts.boa)} cursos com boa chance e ${nf0.format(counts.possivel)} possíveis.\nSimule a sua: https://${CONFIG.SITE_URL}`;
}
function fitText(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text; while (t.length > 1 && ctx.measureText(t + "…").width > maxW) t = t.slice(0, -1);
  return t + "…";
}
async function drawShareCard() {
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
  ctx.strokeStyle = C.pen; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(X + 16, 128, 16, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = C.pen; ctx.beginPath(); ctx.arc(X + 16, 128, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = C.ink; ctx.font = `700 30px ${D}`; ctx.fillText("Simulador Provão Paulista 2026", X + 50, 139);
  ctx.fillStyle = C.ink3; ctx.font = `500 22px ${M}`; ctx.textAlign = "right"; ctx.fillText("BOLETIM", R, 137); ctx.textAlign = "left";
  line(180);

  // nota
  ctx.fillStyle = C.ink2; ctx.font = `600 24px ${M}`; ctx.fillText("NOTA FINAL PROJETADA", X, 240);
  ctx.fillStyle = C.ink; ctx.font = `800 condensed 240px ${D}`; ctx.fillText(fmt1(calc.final), X - 6, 430);
  const wNum = ctx.measureText(fmt1(calc.final)).width;
  ctx.fillStyle = C.ink3; ctx.font = `500 30px ${M}`; ctx.fillText("/100", X + wNum + 8, 430);
  ctx.fillStyle = C.ink2; ctx.font = `400 24px ${M}`;
  ctx.fillText(`1ª série ${fmt1(calc.nota1)} · 2ª série ${fmt1(calc.nota2)} · 3ª + redação ${nf0.format(state.n3)}`, X, 508);

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
  ctx.fillStyle = C.ink3; ctx.font = `400 22px ${S}`; ctx.fillText("Simule a sua nota em", X, H - 108);
  ctx.fillStyle = C.pen; ctx.font = `600 28px ${M}`; ctx.fillText(fitText(ctx, CONFIG.SITE_URL, CW), X, H - 70);
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
