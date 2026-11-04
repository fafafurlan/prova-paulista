# Dá pra passar? · Simulador do Provão Paulista 2026

**Site no ar:** https://daprapassar.com.br

O estudante informa os acertos do 1º e do 2º ano e descobre a nota final projetada no Provão Paulista Seriado 2026 e a chance de aprovação em **1.805 cursos** da USP, Unesp, Unicamp, Fatec e Univesp.

Projeto ligado ao perfil [@daprapassar_](https://www.instagram.com/daprapassar_/), que leva estudantes do Instagram e do TikTok para o simulador.

## Funcionalidades

- Cálculo da nota final pela fórmula oficial do edital (Anexo V, Quadro II).
- Chance em cada curso: Boa chance, Possível, Difícil, Muito difícil ou Fora de alcance.
- Filtros por universidade, cidade, período e área, e comparador de cursos.
- Ranking por escola (função serverless na Vercel com Redis).
- Uma página por curso e por universidade, gerada para aparecer no Google (SEO).
- Funciona como aplicativo instalável e sem internet (PWA).
- Testes automatizados do site e da API.

## Pastas

| Pasta | O que tem |
|---|---|
| [`provao-paulista-2026/`](provao-paulista-2026/) | O site do simulador. O README dessa pasta explica a fórmula, a estrutura e o deploy. |
| [`ferramentas/`](ferramentas/) | Ferramentas de produção dos Reels do @daprapassar_: narração com IA, legendas sincronizadas por palavra, capas e carrosséis exportados de HTML. |
| [`tests/`](tests/) | Testes do site e da API do ranking. |

## Tecnologia

HTML, CSS e JavaScript puro, sem build · Vercel (hospedagem e função serverless) · Upstash Redis · Python para gerar os dados dos cursos e das escolas · Node.js para os testes.

## Rodar localmente

```bash
cd provao-paulista-2026
python3 -m http.server 8000   # abra http://localhost:8000
```

## Autor

Fabrício Furlan · [Portfólio](https://github.com/fafafurlan/portfolio) · [LinkedIn](https://www.linkedin.com/in/fabr%C3%ADcio-furlan-680158449/)
