#!/usr/bin/env python3
"""Classifica cada curso numa das três áreas do Quadro X do edital
(pesos do Provão Paulista Seriado III):

  "humanas"   Ciências Humanas e Artes
  "exatas"    Ciências Exatas e Tecnológicas
  "biologicas" Ciências Biológicas e Saúde

A classificação é por palavras-chave no nome do curso (o edital vincula a área
ao curso escolhido, mas a planilha não traz essa coluna). Ajuste as listas
abaixo se algum curso cair na área errada e rode:

    python3 scripts/areas.py        # grava o campo "area" em cursos.json
"""
import json
import re
import sys
import unicodedata
from pathlib import Path

# A ordem importa: a primeira regra que bater define a área.
REGRAS = [
    # Exceções específicas antes das regras gerais.
    # Univesp: o eixo de negócios leva a Processos Gerenciais, Administração ou Eng. de Produção.
    ("humanas", ["eixo de negocios"]),
    ("exatas", ["engenharia de alimentos", "engenharia bioquimica", "engenharia de bioprocessos", "fisica medica",
                "fisica biomolecular", "fisica biologica", "informatica biomedica", "sistemas biomedicos",
                "ciencia de dados", "big data", "matematica aplicada a negocios", "eixo de computacao"]),
    ("biologicas", ["engenharia agronomica", "engenharia florestal", "engenharia de pesca", "engenharia agricola",
                    "engenharia de biossistemas"]),
    ("exatas", ["engenharia"]),
    ("humanas", ["gestao", "administracao", "agronegocio", "comercio exterior", "marketing",
                 "secretariado", "logistica", "financas", "recursos humanos", "informatica para negocios"]),
    ("biologicas", ["medicina", "odontologia", "enfermagem", "farmacia", "fisioterapia", "fonoaudiologia",
                    "nutricao", "biolog", "biomedic", "veterinaria", "zootecnia", "educacao fisica", "psicologia",
                    "terapia ocupacional", "saude", "obstetricia", "gerontologia", "gerontogia", "esporte",
                    "radiologia", "ecologia", "oceanografia", "biotecnologia", "ciencias dos alimentos",
                    "ciencias da natureza", "cosmeticos", "alimentos",
                    "producao agropecuaria", "paisagismo"]),
    ("humanas", ["direito", "economi", "contab", "atuari", "relacoes", "jornalismo", "comunicacao", "publicidade",
                 "letras", "linguistica", "literari", "pedagogia", "historia", "geografia", "filosofia",
                 "ciencias sociais", "servico social", "turismo", "lazer", "biblioteconomia", "arquivologia",
                 "arquitetura", "design", "audiovisual", "producao cultural", "fonografica", "moda",
                 "educomunicacao", "politicas publicas", "midialogia", "editoracao", "traducao", "eventos",
                 "negocios", "gastronom", "servicos"]),
]
PADRAO = "exatas"  # engenharias, computação, ciências exatas e cursos tecnológicos da Fatec


def normalizar(s):
    s = unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode().lower()
    return " ".join(re.sub(r"[^a-z]", " ", s).split())


def classificar(curso):
    n = normalizar(curso)
    for area, chaves in REGRAS:
        if any(k in n for k in chaves):
            return area
    return PADRAO


def main():
    caminho = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent / "cursos.json"
    cursos = json.loads(caminho.read_text(encoding="utf-8"))
    for c in cursos:
        c["area"] = classificar(c["curso"])
    caminho.write_text(json.dumps(cursos, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    contagem = {}
    for c in cursos:
        contagem[c["area"]] = contagem.get(c["area"], 0) + 1
    print(f"{len(cursos)} cursos classificados: {contagem}")


if __name__ == "__main__":
    main()
