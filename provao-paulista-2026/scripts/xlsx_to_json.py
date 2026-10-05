#!/usr/bin/env python3
"""Converte a aba "Todos os cursos" da planilha em cursos.json.

Uso:  pip install openpyxl
      python3 scripts/xlsx_to_json.py caminho/ESTIMATIVA_PROVAO_PAULISTA.xlsx
"""
import json
import sys
from pathlib import Path

import openpyxl

sys.path.insert(0, str(Path(__file__).resolve().parent))
from areas import classificar  # noqa: E402

src = sys.argv[1] if len(sys.argv) > 1 else "ESTIMATIVA_PROVAO_PAULISTA.xlsx"
out = Path(__file__).resolve().parent.parent / "cursos.json"

ws = openpyxl.load_workbook(src, data_only=True)["Todos os cursos"]


def txt(v):
    return "" if v is None else str(v).strip()


cursos = []
for r in ws.iter_rows(min_row=2, values_only=True):
    if r[0] is None or r[8] is None:
        continue
    nota = float(r[8])
    cursos.append({
        "ranking": int(r[0]),
        "instituicao": txt(r[1]).upper(),
        "codigo": txt(r[2]),
        "curso": txt(r[3]),
        "unidade": txt(r[4]),
        "turno": txt(r[5]),
        "municipio": txt(r[6]),
        "vagas": int(r[7] or 0),
        "notaEstimada": int(nota) if nota.is_integer() else nota,
        "area": classificar(txt(r[3])),
    })

out.write_text(json.dumps(cursos, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print(f"{len(cursos)} cursos gravados em {out}")
