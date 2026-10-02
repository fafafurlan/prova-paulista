# Simulador Provão Paulista Seriado 2026

Site estático (HTML + CSS + JS puro, sem build) que calcula a nota final projetada no Provão Paulista Seriado 2026 e a chance do aluno em 1.805 cursos da USP, Unesp, Unicamp, Fatec e Univesp.

## Estrutura

```
provao-paulista-2026/
├── index.html            # página, meta tags SEO/OG/Twitter, favicon SVG inline
├── style.css             # tema escuro/claro, glassmorphism, animações
├── app.js                # CONFIG, cálculo, filtros, lazy render, comparador, compartilhar
├── cursos.json           # 1.805 cursos extraídos da aba "Todos os cursos"
├── og.png                # imagem de pré-visualização para redes sociais (1200×630)
├── vercel.json           # headers e cache para Vercel
├── netlify.toml          # alternativa para Netlify
└── scripts/xlsx_to_json.py  # regenera cursos.json a partir da planilha
```

## Fórmula (Anexo V, Quadro II)

```
nota1 = acertos1 / TOTAL_QUESTOES_PROVA * 100
nota2 = acertos2 / TOTAL_QUESTOES_PROVA * 100
final = 0,25·nota1 + 0,25·nota2 + 0,5·(3ª série + redação)
máxima possível = 0,25·nota1 + 0,25·nota2 + 50
média necessária no curso = max(0, (notaEstimada − 0,25·nota1 − 0,25·nota2) / 0,5)
```

Chance (média necessária − estimativa): ≤ 5 Boa chance · ≤ 15 Possível · ≤ 25 Difícil · acima disso Muito difícil · média > 100 Fora de alcance.

Constantes ajustáveis ficam no objeto `CONFIG`, no topo de `app.js` (`TOTAL_QUESTOES_PROVA`, pesos, limites de chance, URL do site).

## Rodar localmente

```bash
cd provao-paulista-2026
python3 -m http.server 8000   # abra http://localhost:8000
```

(Precisa de servidor: o `cursos.json` é carregado via `fetch`.)

## Deploy

### Vercel (recomendado)

Pelo painel: **Add New → Project → importe `fafafurlan/prova-paulista`**, defina **Root Directory = `provao-paulista-2026`**, Framework Preset = *Other*, sem build command. Cada push no branch publicado gera um novo deploy automaticamente.

Pela CLI:

```bash
npm i -g vercel
cd provao-paulista-2026
vercel login
vercel --prod            # na primeira vez, nomeie o projeto "provao-paulista-2026"
```

Site publicado: `https://prova-paulista-provao-paulista-2026.vercel.app`. Se a URL mudar (outro nome de projeto ou domínio próprio), atualize `CONFIG.SITE_URL` e as meta tags `og:url`/`canonical`/`og:image` em `index.html`.

Domínio próprio: **Project → Settings → Domains → Add**, depois crie no seu provedor de DNS um registro `CNAME www → cname.vercel-dns.com` (ou `A @ → 76.76.21.21` para o domínio raiz).

### Netlify

```bash
npm i -g netlify-cli
cd provao-paulista-2026
netlify login
netlify deploy --prod --dir .
```

## Atualizar os dados

1. Edite a planilha (aba **Todos os cursos**, colunas A–I: ranking, instituição, código, curso, unidade, turno, município, vagas, nota estimada).
2. Regere o JSON:
   ```bash
   pip install openpyxl
   python3 scripts/xlsx_to_json.py caminho/para/ESTIMATIVA_PROVAO_PAULISTA.xlsx
   ```
3. Faça commit e push de `cursos.json`. Com o projeto conectado à Vercel, o deploy é automático; senão rode `vercel --prod` de novo.

Para mudar o número de questões das provas ou os limites de chance, edite só o `CONFIG` em `app.js`.
