#!/usr/bin/env python3
"""Gera as páginas estáticas para o Google e atualiza as versões dos arquivos.

- cursos/<curso>.html        uma página por curso (Medicina, Direito…), com todas as opções
- cursos/index.html          lista de todos os cursos, por área
- universidades/<sigla>.html uma página por instituição
- sitemap.xml e robots.txt
- ?v=… de style.css, app.js e bloqueio.js em todos os HTML
- aviso da fonte das notas (scripts/fonte.json) no index.html

Uso:  python3 scripts/build_paginas.py   (rode de novo sempre que mudar cursos.json, fonte.json, style.css, app.js ou bloqueio.js)
"""
import hashlib
import json
import re
import shutil
import unicodedata
from collections import defaultdict
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CURSOS = json.loads((ROOT / "cursos.json").read_text(encoding="utf-8"))
FONTE = json.loads((ROOT / "scripts" / "fonte.json").read_text(encoding="utf-8"))
SITE = "https://" + re.search(r'SITE_URL:\s*"([^"]+)"', (ROOT / "app.js").read_text(encoding="utf-8")).group(1)
V = hashlib.sha1(b"".join((ROOT / f).read_bytes() for f in ("style.css", "app.js", "bloqueio.js"))).hexdigest()[:8]

INST = {  # sigla -> (nome curto, nome completo)
    "USP": ("USP", "Universidade de São Paulo"),
    "UNESP": ("Unesp", "Universidade Estadual Paulista"),
    "UNICAMP": ("Unicamp", "Universidade Estadual de Campinas"),
    "FATEC": ("Fatec", "Faculdades de Tecnologia do Estado de São Paulo"),
    "UNIVESP": ("Univesp", "Universidade Virtual do Estado de São Paulo"),
}
AREAS = {"humanas": "Humanas e Artes", "exatas": "Exatas e Tecnológicas", "biologicas": "Biológicas e Saúde"}


# Mesmas regras de cursoBase/slugCurso em app.js.
def curso_base(nome):
    return re.sub(r"\s*\([^)]*\)", "", nome).strip()


def slug(nome):
    s = re.sub("[̀-ͯ]", "", unicodedata.normalize("NFD", curso_base(nome))).lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def num(v):
    return (f"{v:.1f}".replace(".", ",") if isinstance(v, float) and not v.is_integer() else str(int(v)))


def faixa(notas):
    lo, hi = min(notas), max(notas)
    return num(lo) if lo == hi else f"{num(lo)}–{num(hi)}"


def lista_pt(itens):
    itens = list(itens)
    return itens[0] if len(itens) == 1 else ", ".join(itens[:-1]) + " e " + itens[-1]


def milhar(n):
    return f"{n:,}".replace(",", ".")


FONTE_HTML = (f'<span class="fonte-dot" aria-hidden="true"></span><span><b>{escape(FONTE["texto"])}</b>, '
              f'atualizadas em {escape(FONTE["atualizado"])}. Quando as universidades divulgarem as notas de corte oficiais, '
              f'elas substituem estas.</span>')

# Versão curta para a lista de cursos do simulador (a tela principal fica limpa).
FONTE_CURTA = (f'<span class="fonte-dot" aria-hidden="true"></span><span><b>{escape(FONTE["texto"])}</b>, '
               f'atualizadas em {escape(FONTE["atualizado"])}.</span>')

ANALYTICS = """<script>window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };</script>
<script defer src="/_vercel/insights/script.js"></script>"""


def pagina(caminho, titulo, descricao, migalhas, corpo):
    url = SITE + caminho
    crumbs = " › ".join(f'<a href="{h}">{escape(t)}</a>' if h else f'<span aria-current="page">{escape(t)}</span>' for t, h in migalhas)
    ld = {
        "@context": "https://schema.org", "@type": "BreadcrumbList",
        "itemListElement": [{"@type": "ListItem", "position": i + 1, "name": t, "item": SITE + (h or caminho)}
                            for i, (t, h) in enumerate(migalhas)],
    }
    return f"""<!doctype html>
<html lang="pt-BR" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{escape(titulo)}</title>
<meta name="description" content="{escape(descricao)}">
<meta name="theme-color" content="#0e1014">
<link rel="canonical" href="{url}">
<meta property="og:type" content="website">
<meta property="og:locale" content="pt_BR">
<meta property="og:site_name" content="Dá pra passar?">
<meta property="og:title" content="{escape(titulo)}">
<meta property="og:description" content="{escape(descricao)}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{SITE}/og.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='16' fill='%231d3fd1'/%3E%3Ctext x='32' y='49' text-anchor='middle' font-family='Arial,Helvetica,sans-serif' font-weight='900' font-size='46' fill='white'%3E%3F%3C/text%3E%3C/svg%3E">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,500..800&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
<link rel="stylesheet" href="/style.css?v={V}">
<script>try{{var t=localStorage.getItem("pp26-theme");document.documentElement.setAttribute("data-theme",t||"dark")}}catch(e){{}}</script>
{ANALYTICS}
<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>
</head>
<body class="pg-body">
<header class="topbar">
  <div class="topbar-inner wrap">
    <a class="brand" href="/" aria-label="Dá pra passar? Simulador do Provão Paulista 2026, início">
      <span class="brand-mark" aria-hidden="true"></span>
      <span class="brand-name">Dá pra passar?</span>
      <span class="brand-year mono">Provão Paulista 2026</span>
    </a>
    <a class="btn btn-primary btn-sm pg-top-cta" href="/">Simular minha nota</a>
  </div>
</header>
<main class="wrap pg">
<nav class="pg-crumb" aria-label="Você está em">{crumbs}</nav>
{corpo}
</main>
<footer class="footer">
  <div class="wrap">
    <p><b>Dá pra passar?</b> é um simulador independente, sem vínculo com a Seduc-SP ou com as universidades. · <a href="/cursos">Todos os cursos</a> · <a href="/privacidade">Privacidade e seus dados</a></p>
  </div>
</footer>
</body>
</html>
"""


def kpis(itens):
    return '<dl class="pg-kpis">' + "".join(f'<div><dt>{escape(k)}</dt><dd class="num">{v}</dd></div>' for k, v in itens) + "</dl>"


def cta(nome_curso, q):  # q: slug do curso, filtra a lista do simulador
    alvo = f"/?curso={q}#cursos" if q else "/"
    titulo = f"Dá pra passar em {escape(nome_curso)}?" if nome_curso else "Dá pra passar?"
    return (f'<div class="pg-cta"><p><b>{titulo}</b> Coloque suas notas do Provão I e II e veja quanto precisa tirar na 3ª série.</p>'
            f'<a class="btn btn-primary" href="{alvo}">Simular minha chance →</a></div>')


def badge(sigla):
    return f'<span class="pg-inst" style="--ic:var(--{sigla.lower()})">{INST[sigla][0]}</span>'


# ---------- agrupa ----------
por_curso = defaultdict(list)
for c in CURSOS:
    por_curso[slug(c["curso"])].append(c)
nomes = {}
for s, cs in por_curso.items():
    variantes = {curso_base(c["curso"]) for c in cs}
    assert len(variantes) == 1, f"slug {s} junta nomes diferentes: {variantes}"
    nomes[s] = variantes.pop()
area_de = {s: max(AREAS, key=lambda a: sum(c["area"] == a for c in cs)) for s, cs in por_curso.items()}

for pasta in ("cursos", "universidades"):
    shutil.rmtree(ROOT / pasta, ignore_errors=True)
    (ROOT / pasta).mkdir()
urls = ["/", "/cursos"]


# ---------- página de cada curso ----------
def parecidos(s, n=8):
    alvo = max(c["notaEstimada"] for c in por_curso[s])
    outros = [o for o in por_curso if o != s and area_de[o] == area_de[s]]
    outros.sort(key=lambda o: (abs(max(c["notaEstimada"] for c in por_curso[o]) - alvo), -len(por_curso[o]), nomes[o]))
    return outros[:n]


for s, cs in sorted(por_curso.items()):
    nome = nomes[s]
    cs = sorted(cs, key=lambda c: (-c["notaEstimada"], c["instituicao"], c["municipio"], c["unidade"]))
    insts = [INST[i][0] for i in INST if any(c["instituicao"] == i for c in cs)]
    notas = [c["notaEstimada"] for c in cs]
    vagas = sum(c["vagas"] for c in cs)
    linhas = "".join(
        f'<tr><td>{badge(c["instituicao"])}</td><td>{escape(c["unidade"] or c["municipio"])}'
        f'<span class="pg-sub">{escape(" · ".join(x for x in (c["municipio"], c["turno"]) if x))}</span></td>'
        f'<td class="r num">{c["vagas"]}</td><td class="r num pg-nota">{num(c["notaEstimada"])}</td></tr>'
        for c in cs)
    rel = "".join(f'<a href="/cursos/{o}">{escape(nomes[o])}</a>' for o in parecidos(s))
    uni_links = " · ".join(f'<a href="/universidades/{i.lower()}">{INST[i][0]}</a>' for i in INST if any(c["instituicao"] == i for c in cs))
    corpo = f"""<header class="pg-head">
  <h1>{escape(nome)} no Provão Paulista 2026</h1>
  <p class="pg-lede">Vagas, cidades e nota de corte estimada de {escape(nome)} na {lista_pt(insts)} pelo Provão Paulista Seriado. Simule sua nota e veja sua chance em cada opção.</p>
</header>
{kpis([("Opções", milhar(len(cs))), ("Vagas", milhar(vagas)), ("Nota estimada", faixa(notas))])}
{cta(nome, s)}
<div class="sheet pg-table"><table>
<thead><tr><th scope="col">Univ.</th><th scope="col">Unidade</th><th scope="col" class="r">Vagas</th><th scope="col" class="r">Nota est.</th></tr></thead>
<tbody>{linhas}</tbody></table></div>
<p class="fonte">{FONTE_HTML}</p>
<section class="pg-rel"><h2>Cursos parecidos</h2><div class="pg-links">{rel}</div><p class="pg-uni">Ver todos os cursos: {uni_links}</p></section>"""
    titulo = f"{nome} no Provão Paulista 2026: nota de corte estimada e vagas | Dá pra passar?"
    desc = (f"{nome} pelo Provão Paulista 2026: {milhar(len(cs))} {'opção' if len(cs) == 1 else 'opções'} na {lista_pt(insts)}, "
            f"{milhar(vagas)} vagas e nota de corte estimada de {faixa(notas)}. Simule sua nota e veja sua chance.")
    html = pagina(f"/cursos/{s}", titulo, desc, [("Início", "/"), ("Cursos", "/cursos"), (nome, None)], corpo)
    (ROOT / "cursos" / f"{s}.html").write_text(html, encoding="utf-8")
    urls.append(f"/cursos/{s}")


def tabela_cursos(slugs, filtro=lambda c: True):
    linhas = []
    for s in slugs:
        cs = [c for c in por_curso[s] if filtro(c)]
        linhas.append(
            f'<tr><td><a href="/cursos/{s}">{escape(nomes[s])}</a></td><td class="r num">{milhar(len(cs))}</td>'
            f'<td class="r num">{milhar(sum(c["vagas"] for c in cs))}</td><td class="r num pg-nota">{faixa([c["notaEstimada"] for c in cs])}</td></tr>')
    return ('<div class="sheet pg-table"><table><thead><tr><th scope="col">Curso</th><th scope="col" class="r">Opções</th>'
            '<th scope="col" class="r">Vagas</th><th scope="col" class="r">Nota est.</th></tr></thead>'
            f'<tbody>{"".join(linhas)}</tbody></table></div>')


# ---------- página de cada universidade ----------
uni_nav = '<nav class="pg-links" aria-label="Universidades">' + "".join(
    f'<a href="/universidades/{i.lower()}">{INST[i][0]}</a>' for i in INST) + "</nav>"
for sigla, (curto, completo) in INST.items():
    cs = [c for c in CURSOS if c["instituicao"] == sigla]
    slugs = sorted({slug(c["curso"]) for c in cs},
                   key=lambda s: (-max(c["notaEstimada"] for c in por_curso[s] if c["instituicao"] == sigla), nomes[s]))
    corpo = f"""<header class="pg-head">
  <h1>Cursos da {curto} no Provão Paulista 2026</h1>
  <p class="pg-lede">Todos os cursos da {escape(completo)} ({curto}) que recebem alunos pelo Provão Paulista Seriado, com vagas e nota de corte estimada. Toque em um curso para ver cidades e turnos.</p>
</header>
{kpis([("Cursos", milhar(len(slugs))), ("Opções", milhar(len(cs))), ("Vagas", milhar(sum(c["vagas"] for c in cs)))])}
{cta(None, None)}
{tabela_cursos(slugs, lambda c: c["instituicao"] == sigla)}
<p class="fonte">{FONTE_HTML}</p>
<section class="pg-rel"><h2>Outras universidades</h2>{uni_nav}</section>"""
    titulo = f"Cursos da {curto} no Provão Paulista 2026: vagas e notas de corte estimadas | Dá pra passar?"
    desc = (f"Os {milhar(len(slugs))} cursos da {curto} no Provão Paulista 2026: {milhar(sum(c['vagas'] for c in cs))} vagas "
            f"e nota de corte estimada de cada opção. Simule sua nota e veja sua chance.")
    html = pagina(f"/universidades/{sigla.lower()}", titulo, desc, [("Início", "/"), ("Cursos", "/cursos"), (curto, None)], corpo)
    (ROOT / "universidades" / f"{sigla.lower()}.html").write_text(html, encoding="utf-8")
    urls.append(f"/universidades/{sigla.lower()}")


# ---------- índice de cursos ----------
secoes = []
for area, rotulo in AREAS.items():
    slugs = sorted((s for s in por_curso if area_de[s] == area), key=lambda s: slug(nomes[s]))
    itens = "".join(f'<li><a href="/cursos/{s}">{escape(nomes[s])}</a> <span class="pg-sub">{milhar(len(por_curso[s]))}</span></li>' for s in slugs)
    secoes.append(f'<section class="pg-area"><h2>{rotulo} <span class="pg-sub">{len(slugs)} cursos</span></h2><ul class="pg-lista">{itens}</ul></section>')
corpo = f"""<header class="pg-head">
  <h1>Todos os cursos do Provão Paulista 2026</h1>
  <p class="pg-lede">Os {milhar(len(por_curso))} cursos da USP, Unesp, Unicamp, Fatec e Univesp que recebem alunos pelo Provão Paulista Seriado, somando {milhar(len(CURSOS))} opções de cidade e turno. O número ao lado de cada curso é a quantidade de opções.</p>
</header>
<section class="pg-rel"><h2>Por universidade</h2>{uni_nav}</section>
{cta(None, None)}
{"".join(secoes)}
<p class="fonte">{FONTE_HTML}</p>"""
html = pagina("/cursos", "Todos os cursos do Provão Paulista 2026: USP, Unesp, Unicamp, Fatec e Univesp | Dá pra passar?",
              f"Lista dos {milhar(len(por_curso))} cursos do Provão Paulista 2026, com vagas e nota de corte estimada de cada opção na USP, Unesp, Unicamp, Fatec e Univesp.",
              [("Início", "/"), ("Cursos", None)], corpo)
(ROOT / "cursos" / "index.html").write_text(html, encoding="utf-8")
urls.append("/privacidade")

# ---------- sitemap e robots ----------
(ROOT / "sitemap.xml").write_text(
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + "".join(f"  <url><loc>{SITE}{'' if u == '/' else u}{'/' if u == '/' else ''}</loc></url>\n" for u in urls)
    + "</urlset>\n", encoding="utf-8")
(ROOT / "robots.txt").write_text(f"User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: {SITE}/sitemap.xml\n", encoding="utf-8")

# ---------- versões e aviso da fonte nos HTML que já existem ----------
for nome in ("index.html", "privacidade.html"):
    p = ROOT / nome
    s = re.sub(r"(style\.css|app\.js|bloqueio\.js)\?v=[a-z0-9]+", rf"\1?v={V}", p.read_text(encoding="utf-8"))
    s = re.sub(r"(<!-- fonte -->).*?(<!-- /fonte -->)", lambda m: m.group(1) + FONTE_CURTA + m.group(2), s, flags=re.S)
    p.write_text(s, encoding="utf-8")

print(f"{len(por_curso)} cursos, {len(INST)} universidades, {len(urls)} URLs no sitemap, v={V}")
