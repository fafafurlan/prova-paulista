# Simulador Provão Paulista Seriado 2026

Site estático (HTML + CSS + JS puro, sem build) que calcula a nota final projetada no Provão Paulista Seriado 2026 e a chance do aluno em 1.805 cursos da USP, Unesp, Unicamp, Fatec e Univesp.

## Estrutura

```
provao-paulista-2026/
├── index.html            # página, meta tags SEO/OG/Twitter, favicon SVG inline
├── privacidade.html      # política de privacidade (dados do ranking, analytics, como apagar)
├── style.css             # tema escuro/claro, glassmorphism, animações
├── app.js                # CONFIG, cálculo, filtros, lazy render, comparador, compartilhar
├── bloqueio.js           # filtro de nomes ofensivos (navegador e api/ranking.js)
├── cursos.json           # 1.805 cursos extraídos da aba "Todos os cursos"
├── escolas.json          # 4.060 escolas de SP com ensino médio (sugestões no campo "Escola")
├── cursos/, universidades/  # páginas por curso e por universidade (geradas, para o Google)
├── sitemap.xml, robots.txt # gerados junto com as páginas
├── og.png                # imagem de pré-visualização para redes sociais (1200×630)
├── manifest.webmanifest  # app instalável (nome, cores, ícones)
├── sw.js                 # service worker: funciona sem internet (menos o ranking)
├── icons/                # ícones do app (192, 512, maskable, apple-touch)
├── api/ranking.js        # função da Vercel do ranking por escola (Upstash Redis)
├── vercel.json           # headers e cache para Vercel
├── netlify.toml          # alternativa para Netlify
├── scripts/xlsx_to_json.py    # regenera cursos.json a partir da planilha
├── scripts/build_escolas.py   # regenera escolas.json a partir do Censo Escolar
├── scripts/areas.py           # classifica cada curso em Humanas, Exatas ou Biológicas (campo "area")
├── scripts/build_paginas.py   # gera cursos/, universidades/, sitemap.xml e os ?v= dos HTML
└── scripts/fonte.json         # texto e data do aviso "Notas de corte estimadas"
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
3. Rode `python3 scripts/build_paginas.py` (páginas de curso e sitemap) e atualize a data em `scripts/fonte.json`.
4. Faça commit e push de `cursos.json` e dos arquivos gerados. Com o projeto conectado à Vercel, o deploy é automático; senão rode `vercel --prod` de novo.

Para mudar o número de questões das provas ou os limites de chance, edite só o `CONFIG` em `app.js`.

## Atualizar a lista de escolas

`escolas.json` traz as escolas públicas de SP que oferecem ensino médio (rede estadual, ETECs e municipais), com nome e cidade. A fonte é o diretório de escolas da [Base dos Dados](https://basedosdados.org/), montado a partir do Censo Escolar do INEP. O script também ajusta os nomes do formato do Censo ("RUBENS PAIVA DEPUTADO") para o formato que os alunos conhecem ("E.E. Deputado Rubens Paiva").

```bash
python3 scripts/build_escolas.py      # baixa os dados e regrava escolas.json
```

## Personalização e privacidade

Nome e escola informados pelo aluno ficam só no `localStorage` do navegador (`pp26-profile`). Nada é enviado a servidores. O próprio aluno pode editar ou apagar esses dados no botão do topo.

## Cache e versões dos arquivos

O `index.html` carrega `style.css?v=…`, `bloqueio.js?v=…` e `app.js?v=…` (a `privacidade.html` e as páginas de curso também carregam o `style.css?v=…`). O valor de `v` são os 8 primeiros caracteres do SHA-1 desses três arquivos. Assim o navegador de quem já visitou o site baixa a versão nova na hora, em vez de misturar HTML novo com CSS/JS antigos.

Não precisa trocar à mão: rode o gerador (seção abaixo) depois de mudar qualquer um desses arquivos.

## Páginas para o Google

`scripts/build_paginas.py` gera páginas estáticas a partir de `cursos.json`:

- `cursos/<curso>.html` (ex.: `/cursos/medicina`): todas as opções do curso, com vagas, cidade, turno e nota estimada, e o botão "Simular minha chance", que abre o simulador já filtrado nesse curso (`/?curso=medicina#cursos`);
- `universidades/<sigla>.html` (ex.: `/universidades/usp`) e `cursos/index.html` (`/cursos`);
- `sitemap.xml` e `robots.txt`.

O mesmo script atualiza os `?v=` e o aviso da fonte das notas no `index.html`. Rode sempre que mudar `cursos.json`, `scripts/fonte.json`, `style.css`, `app.js` ou `bloqueio.js`, e faça commit de tudo o que ele gerar (o teste automático falha se as páginas estiverem desatualizadas):

```bash
python3 scripts/build_paginas.py
```

Depois do primeiro deploy, cadastre o site no [Google Search Console](https://search.google.com/search-console) e envie `https://<seu-domínio>/sitemap.xml` para o Google encontrar as páginas mais rápido.

### Fonte das notas

O texto do aviso "Notas de corte estimadas…" (acima da lista de cursos e em cada página de curso) fica em `scripts/fonte.json` (`texto` e `atualizado`). Edite e rode o gerador.

## Ranking por escola

O ranking usa uma função da Vercel (`api/ranking.js`) e um banco Redis gratuito da Upstash. Sem o banco, o site funciona normalmente e a seção mostra "O ranking ainda não está ativado".

**Ativar (uma vez, no painel da Vercel):**
1. Abra o projeto → **Storage** → **Create Database** → **Upstash for Redis** (plano gratuito).
2. Conecte o banco a este projeto. A Vercel cria as variáveis `KV_REST_API_URL` e `KV_REST_API_TOKEN`.
3. Faça um novo deploy (**Deployments → ⋯ → Redeploy**) para a função enxergar as variáveis.

**Como funciona:**
- Participar é opcional: o aluno precisa ter escolhido a escola na lista de sugestões e clicar em "Entrar no ranking da escola".
- O ranking mostra só o primeiro nome e a inicial do sobrenome (ex.: "Ana S."). O servidor monta esse nome e descarta o resto.
- O servidor recalcula a nota a partir dos acertos e só aceita escolas de `escolas.json`.
- Nomes ofensivos são recusados no perfil e no servidor (`bloqueio.js`, o mesmo arquivo nos dois lados). A comparação é por palavra inteira, para não barrar sobrenomes como "Pinto" ou "Rola"; para bloquear outra palavra, inclua em `PALAVRAS` e rode o gerador de páginas (atualiza o `?v=`).
- Cada aparelho tem uma chave secreta (`pp26-rank-token` no `localStorage`); só quem tem a chave atualiza ou remove o próprio registro. "Sair do ranking" e "Apagar meus dados" removem o registro do servidor.
- Limite de 300 envios por hora por IP (uma escola inteira pode sair pelo mesmo IP).

## Nota da 3ª série por área

Pelo edital (Anexo IV), cada prova do Seriado tem 90 questões; na 3ª série: Linguagens 24, Matemática 18, Ciências Humanas 24 e Ciências da Natureza 24, mais a redação. No modo "Por área", a nota da prova objetiva da 3ª série é a média ponderada dos acertos com os pesos do Anexo V, Quadro X, conforme a área do curso. A redação continua com 20%: o Quadro X também lista um peso para a redação, mas o edital não diz como ele se combina com os 20% fixos.

O modo "Por área" também aplica as eliminações do edital: menos de 22 acertos na 3ª série (USP, Unesp e Unicamp, item 13.9) e redação abaixo de 20% (todos os cursos, item 11.2.4).

A área de cada curso está no campo `area` de `cursos.json`, atribuída por palavras-chave no nome do curso. Para corrigir um curso, ajuste as listas em `scripts/areas.py` e rode `python3 scripts/areas.py`. O `scripts/xlsx_to_json.py` já preenche a área ao regerar os dados.

Pesos, número de questões e mínimos ficam no `CONFIG` de `app.js` (e `TOTAL_QUESTOES` em `api/ranking.js`).

## Estatísticas de visita

O site carrega o Vercel Web Analytics (`/_vercel/insights/script.js`), sem cookies. Para começar a coletar, ative em **Vercel → projeto → Analytics → Enable**. Enquanto não estiver ativado, o script não carrega e nada muda para o visitante.

## App no celular (PWA)

O site pode ser instalado na tela inicial do celular. No Android/Chrome aparece o botão **Instalar app** no topo; no iPhone, use **Compartilhar → Adicionar à Tela de Início**. O `sw.js` busca sempre a versão mais nova quando há internet e, sem internet, abre a última cópia guardada (o ranking precisa de internet). Se mudar a lista de arquivos guardados em `sw.js`, troque o nome do cache (`pp26-v1` → `pp26-v2`) no `sw.js` e no `app.js`.

## WhatsApp

O compartilhamento e o convite do ranking abrem o WhatsApp com o texto pronto. Os links levam `?ref=whatsapp` ou `?ref=convite`, e o app instalado abre com `?ref=app`; no Vercel Analytics dá para ver quantas visitas vieram de cada um.

## Testes automáticos

A pasta `tests/` (na raiz do repositório, fora do que a Vercel publica) tem testes da API do ranking e do site no navegador (Playwright). Eles rodam sozinhos no GitHub a cada PR e a cada mudança no `main` (`.github/workflows/testes.yml`).

```bash
cd tests
npm ci
npx playwright install chromium   # só na primeira vez
npm test
```

O servidor de teste (`tests/server.js`) serve o site, roda `api/ranking.js` como a Vercel e simula o Redis da Upstash, então os testes não precisam de internet nem do banco real.

## Domínio próprio

1. Compre o domínio (ex.: em https://registro.br para `.com.br`).
2. Na Vercel: projeto → **Settings → Domains → Add** e digite o domínio (ex.: `simuladorprovao.com.br`). Adicione também `www.` e deixe um redirecionando para o outro.
3. No Registro.br (ou onde comprou), em **DNS**, crie os registros que a Vercel mostrar. Normalmente: `A` para `@` apontando para `76.76.21.21` e `CNAME` para `www` apontando para `cname.vercel-dns.com`. O HTTPS é automático.
4. Troque o endereço no código: `CONFIG.SITE_URL` em `app.js`; `canonical`, `og:url`, `og:image` e `twitter:image` em `index.html`; `canonical` em `privacidade.html`. Depois atualize o `?v=` (seção acima).
