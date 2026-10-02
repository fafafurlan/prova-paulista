#!/usr/bin/env python3
"""Gera escolas.json: escolas públicas de SP com ensino médio (rede estadual,
ETECs e escolas municipais), que são as que participam do Provão Paulista.

Fonte: diretório de escolas da Base dos Dados (basedosdados.org), montado a
partir do Censo Escolar do INEP, e diretório de municípios (IBGE).

Uso:  python3 scripts/build_escolas.py            # baixa os arquivos
      python3 scripts/build_escolas.py escola.csv.gz municipio.csv.gz
"""
import csv
import gzip
import io
import json
import re
import sys
import urllib.request
from pathlib import Path

BASE = "https://storage.googleapis.com/basedosdados-public/one-click-download/br_bd_diretorios_brasil"
URL_ESCOLAS = f"{BASE}/escola/escola.csv.gz"
URL_MUNICIPIOS = f"{BASE}/municipio/municipio.csv.gz"
OUT = Path(__file__).resolve().parent.parent / "escolas.json"


def abrir(arg, url):
    data = Path(arg).read_bytes() if arg else urllib.request.urlopen(url, timeout=120).read()
    return csv.DictReader(io.TextIOWrapper(gzip.GzipFile(fileobj=io.BytesIO(data)), encoding="utf-8"))


# Títulos que o Censo coloca no fim do nome ("RUBENS PAIVA DEPUTADO").
TITULOS = {
    "PROFESSOR": "Professor", "PROFESSORA": "Professora", "PROF": "Prof.", "PROFA": "Profa.",
    "DOUTOR": "Doutor", "DOUTORA": "Doutora", "DR": "Dr.", "DRA": "Dra.", "PADRE": "Padre",
    "DONA": "Dona", "DOM": "Dom", "CORONEL": "Coronel", "CEL": "Cel.", "DEPUTADO": "Deputado",
    "DEPUTADA": "Deputada", "VEREADOR": "Vereador", "PREFEITO": "Prefeito", "MONSENHOR": "Monsenhor",
    "CAPITAO": "Capitão", "COMENDADOR": "Comendador", "SENADOR": "Senador", "JORNALISTA": "Jornalista",
    "MAJOR": "Major", "PASTOR": "Pastor", "MINISTRO": "Ministro", "MAESTRO": "Maestro",
    "ENGENHEIRO": "Engenheiro", "IRMA": "Irmã", "IRMAO": "Irmão", "REVERENDO": "Reverendo",
    "GOVERNADOR": "Governador", "GOV": "Gov.", "GENERAL": "General", "GAL": "Gen.", "CONEGO": "Cônego",
    "PRESIDENTE": "Presidente", "TENENTE": "Tenente", "TTE": "Ten.", "SARGENTO": "Sargento",
    "MARECHAL": "Marechal", "BRIGADEIRO": "Brigadeiro", "ALMIRANTE": "Almirante", "DESEMBARGADOR": "Desembargador",
    "MADRE": "Madre", "FREI": "Frei", "BISPO": "Bispo", "VISCONDE": "Visconde", "BARAO": "Barão",
    "CONSELHEIRO": "Conselheiro", "ENG": "Eng.", "MAESTRINA": "Maestrina", "POETA": "Poeta", "PROFESSORES": "Professores",
}
# Tipos de escola que aparecem no fim do nome e vão para o início.
TIPOS_FIM = [
    ("ESCOLA MUNICIPAL DE ENSINO", "Escola Municipal"), ("COLEGIO MUNICIPAL", "Colégio Municipal"),
    ("ESCOLA MUNICIPAL", "Escola Municipal"), ("ETEC", "ETEC"), ("EMEFM", "EMEFM"), ("EMEBP", "EMEBP"),
    ("CEMEP", "CEMEP"), ("EM", "EM"), ("EE", "E.E."),
]
SIGLAS = {"ETEC", "EM", "EMEF", "EMEFM", "EMEBP", "EMEBS", "EEFMT", "CEMEP", "CI", "CTA", "CTIG", "UNESP",
          "UNICAMP", "USP", "FUMEP", "COTIP", "SESI", "SENAI", "CEU", "CHB", "II", "III", "IV", "VI", "VII",
          "VIII", "IX", "XI", "XII", "XV", "XX", "EE", "SP", "CEEJA", "CEL"}
MINUSCULAS = {"DA", "DE", "DO", "DAS", "DOS", "E", "AO", "AOS", "A", "O", "NA", "NO", "EM"}
INSTITUICAO = {"COLEGIO", "ESCOLA", "CENTRO", "INSTITUTO", "FUNDACAO", "UNESP", "UNICAMP", "USP", "CTA",
               "CTIG", "SESI", "SENAI", "CEU", "CHB", "CEEJA", "EEFMT", "EMEFM", "EMEBS", "EMEF", "EM"}
ACENTOS = {
    "JOSE": "José", "ANTONIO": "Antônio", "MARIO": "Mário", "JULIO": "Júlio", "ALVARO": "Álvaro",
    "OTAVIO": "Otávio", "OCTAVIO": "Octávio", "FABIO": "Fábio", "CASSIO": "Cássio", "LUCIA": "Lúcia",
    "MONICA": "Mônica", "VERONICA": "Verônica", "ANGELA": "Ângela", "CELIA": "Célia", "GLORIA": "Glória",
    "VITORIA": "Vitória", "HELIO": "Hélio", "ROGERIO": "Rogério", "SERGIO": "Sérgio", "MARCIA": "Márcia",
    "FLAVIO": "Flávio", "LAERCIO": "Laércio", "EMILIO": "Emílio", "CICERO": "Cícero", "PLINIO": "Plínio",
    "TARCISIO": "Tarcísio", "VALERIO": "Valério", "EUCLIDES": "Euclides", "INES": "Inês", "IRENE": "Irene",
    "JESUS": "Jesus", "LUIS": "Luís", "ANESIA": "Anésia", "BENEDITA": "Benedita", "AMELIA": "Amélia",
    "AURELIO": "Aurélio", "CLAUDIO": "Cláudio", "CLAUDIA": "Cláudia", "DARIO": "Dário", "ELIDIO": "Elídio",
    "EUGENIO": "Eugênio", "GETULIO": "Getúlio", "HERCULES": "Hércules", "HORACIO": "Horácio", "IGNACIO": "Ignácio",
    "INACIO": "Inácio", "JOAQUINA": "Joaquina", "LAZARO": "Lázaro", "LEONIDAS": "Leônidas", "LIDIA": "Lídia",
    "MAURICIO": "Maurício", "NATALIA": "Natália", "OSORIO": "Osório", "PATRICIO": "Patrício", "PLACIDO": "Plácido",
    "ROMULO": "Rômulo", "SILVERIO": "Silvério", "TEOFILO": "Teófilo", "VIRGILIO": "Virgílio", "ZELIA": "Zélia",
    "JARDIM": "Jardim", "BAIRRO": "Bairro", "REPUBLICA": "República", "AMERICA": "América", "PAULISTA": "Paulista",
    "TECNICO": "Técnico", "TECNICA": "Técnica", "MEDIO": "Médio", "BASICA": "Básica", "PUBLICA": "Pública",
    "ACADEMICO": "Acadêmico", "AGRICOLA": "Agrícola", "MUSICA": "Música", "SAUDE": "Saúde", "VILA": "Vila",
    "BELEM": "Belém", "JACAREI": "Jacareí", "ARACATUBA": "Araçatuba", "TAUBATE": "Taubaté", "JUNDIAI": "Jundiaí",
    "GUARUJA": "Guarujá", "PIRACICABA": "Piracicaba", "MARILIA": "Marília", "TUPA": "Tupã", "AVARE": "Avaré",
    "CONCEICAO": "Conceição", "ASSUNCAO": "Assunção", "ASCENCAO": "Ascenção", "EDUCACAO": "Educação",
    "APARECIDA": "Aparecida", "VERISSIMO": "Veríssimo", "JUNIOR": "Júnior", "LIBERO": "Líbero", "CANDIDO": "Cândido",
    "PIO": "Pio", "ESPIRITO": "Espírito", "AGUA": "Água", "AGUAS": "Águas", "SITIO": "Sítio", "CHACARA": "Chácara",
    "PARAISO": "Paraíso", "ITAQUERA": "Itaquera", "ESTADUAL": "Estadual", "COLEGIO": "Colégio", "ANALIA": "Anália",
    "ODILIA": "Odília", "OTILIA": "Otília", "ACACIO": "Acácio", "ANISIO": "Anísio", "ARLINDO": "Arlindo",
    "BRASILIO": "Brasílio", "CECILIA": "Cecília", "DIOGENES": "Diógenes", "EMILIA": "Emília", "ESTEVAO": "Estêvão",
    "GERONIMO": "Gerônimo", "HILARIO": "Hilário", "JANUARIO": "Januário", "JERONIMO": "Jerônimo", "LIGIA": "Lígia",
    "NIVEA": "Nívea", "ONOFRE": "Onofre", "PERICLES": "Péricles", "ROSALIA": "Rosália", "SAVIO": "Sávio",
    "SIMOES": "Simões", "GUIMARAES": "Guimarães", "MAGALHAES": "Magalhães", "LEMOS": "Lemos", "ALVARES": "Álvares",
    "GONCALVES": "Gonçalves", "GONCALO": "Gonçalo", "CANDIDA": "Cândida", "MELLO": "Mello", "BRAZ": "Braz",
    "VALERIA": "Valéria", "SILVIA": "Sílvia", "SILVIO": "Sílvio", "VINICIUS": "Vinícius", "CESAR": "César",
    "TEREZINHA": "Terezinha", "ZULMIRA": "Zulmira", "DIRCEU": "Dirceu", "ACADEMIA": "Academia",
}


def palavra(w, primeira):
    if w in ACENTOS:
        return ACENTOS[w]
    if w in TITULOS:
        return TITULOS[w]
    if w in SIGLAS or not re.search(r"[AEIOU]", w):
        return w
    if w in MINUSCULAS and not primeira:
        return w.lower()
    t = w.capitalize()
    if t.endswith("cao"):
        t = t[:-3] + "ção"
    elif t.endswith("ao"):
        t = t[:-2] + "ão"
    elif t.endswith("aes"):
        t = t[:-3] + "ães"
    elif t.endswith("oes"):
        t = t[:-3] + "ões"
    return t


def normalizar(nome, estadual):
    nome = re.sub(r"\s+", " ", nome.replace(" - ", " ").replace("-CI", " CI")).strip(" -")
    toks = nome.split(" ")
    prefixo = []
    for tipo, rotulo in TIPOS_FIM:
        tt = tipo.split(" ")
        if len(toks) > len(tt) and toks[-len(tt):] == tt:
            toks = toks[:-len(tt)]
            prefixo = [rotulo]
            break
    if not prefixo and toks[0] in ("EE", "ETEC", "EMEFM", "EMEF"):
        prefixo = ["E.E." if toks[0] == "EE" else toks[0]]
        toks = toks[1:]
    titulos = []
    while len(toks) > 1 and toks[-1] in TITULOS:
        titulos.insert(0, toks.pop())
    if not prefixo and estadual and not (set(toks) & INSTITUICAO):
        prefixo = ["E.E."]
    corpo = [palavra(w, i == 0) for i, w in enumerate(titulos + toks)]
    if corpo and corpo[0] in ("da", "de", "do"):
        corpo[0] = corpo[0].capitalize()
    return " ".join(prefixo + corpo)


def main():
    a = sys.argv[1:] + [None, None]
    municipios = {r["id_municipio"]: r["nome"] for r in abrir(a[1], URL_MUNICIPIOS) if r["sigla_uf"] == "SP"}
    vistos, escolas = set(), []
    for r in abrir(a[0], URL_ESCOLAS):
        if r["sigla_uf"] != "SP" or r["dependencia_administrativa"] not in ("Estadual", "Municipal"):
            continue
        if "Ensino Médio" not in r["etapas_modalidades_oferecidas"] or "PARALISADA" in r["restricao_atendimento"]:
            continue
        nome = normalizar(r["nome"], r["dependencia_administrativa"] == "Estadual")
        cidade = municipios.get(r["id_municipio"], "")
        if (nome, cidade) in vistos:
            continue
        vistos.add((nome, cidade))
        escolas.append([nome, cidade])
    escolas.sort(key=lambda e: (e[1], e[0]))
    OUT.write_text(json.dumps(escolas, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{len(escolas)} escolas gravadas em {OUT}")


if __name__ == "__main__":
    main()
