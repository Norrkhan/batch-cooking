"""Genera los datos de la web (docs/datos/*.json) a partir de los .md del proyecto.

Uso: python scripts/generar_web.py [AAAA-MM]
Sin argumento, regenera todos los meses de menus/.
"""
import json
import re
import sys
import unicodedata
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
MENUS = RAIZ / "menus"
RECETAS = RAIZ / "recetas"
SALIDA = RAIZ / "docs" / "datos"

MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
         "agosto", "septiembre", "octubre", "noviembre", "diciembre"]

# Encabezado H2 de compra.md -> grupo de la web
GRUPOS = [
    ("costco", "Costco"),
    ("lidl", "Lidl: compra grande"),
    ("precios", "Comprobar precios"),
    ("casa", "Comprobar en casa"),
    ("extras", "Extras"),
    ("semanal", "Lidl semanal"),
]


def slug(texto):
    t = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", t.lower()).strip("-")


def limpiar(celda):
    return re.sub(r"\*\*(.+?)\*\*", r"\1", celda).strip()


def leer(ruta):
    return ruta.read_text(encoding="utf-8")


def frontmatter(texto):
    m = re.match(r"^---\n(.*?)\n---\n", texto, re.S)
    if not m:
        return {}, texto
    meta = {}
    for linea in m.group(1).splitlines():
        if ":" in linea:
            k, v = linea.split(":", 1)
            meta[k.strip()] = v.strip()
    return meta, texto[m.end():]


def celdas(linea):
    return [c.strip() for c in linea.strip().strip("|").split("|")]


def parsear_compra(texto):
    """Convierte las tablas y checklists de compra.md en artículos marcables."""
    items = []
    grupo, seccion, cabecera = None, "", None
    for linea in texto.splitlines():
        if linea.startswith("## "):
            titulo = linea[3:].strip()
            grupo = next((g for g, p in GRUPOS if titulo.startswith(p)), None)
            seccion, cabecera = "", None
            continue
        if linea.startswith("### "):
            seccion, cabecera = linea[4:].strip(), None
            continue
        if grupo is None:
            continue
        casilla = re.match(r"^- \[([ xX])\] (.+)", linea)
        if casilla:
            comprado = casilla.group(1) != " "
            texto = casilla.group(2)
            corte = texto.find(": ")
            # No partir en los ":" que están dentro de un paréntesis
            if corte >= 0 and "(" not in texto[:corte]:
                nombre, detalle = texto[:corte], texto[corte + 2:]
            else:
                nombre, detalle = texto, ""
            items.append({"id": f"{grupo}-{slug(nombre)}", "grupo": grupo, "seccion": seccion,
                          "producto": limpiar(nombre), "detalles": [["", limpiar(detalle)]] if detalle else [],
                          "comprado": comprado})
            continue
        if not linea.startswith("|"):
            cabecera = None
            continue
        fila = celdas(linea)
        if cabecera is None:
            cabecera = fila
            continue
        if set("".join(fila)) <= set("-: "):
            continue
        if cabecera[0] != "✓":
            continue
        datos = dict(zip(cabecera[1:], fila[1:]))
        nombre = datos.get("Producto") or datos.get("Tamaño") or fila[1]
        if nombre.startswith("**"):  # subtotales
            continue
        detalles = [[k, limpiar(v)] for k, v in datos.items()
                    if k not in ("Producto", "Tamaño") and v and v != "—"]
        # Una marca en la columna ✓ del .md significa que ya está comprado
        items.append({"id": f"{grupo}-{slug(nombre)}", "grupo": grupo, "seccion": seccion,
                      "producto": limpiar(nombre), "detalles": detalles,
                      "comprado": fila[0] in ("✓", "x", "X")})
    return items


def recetas_del_menu(menu_md):
    return list(dict.fromkeys(re.findall(r"recetas/([\w-]+)\.md", menu_md)))


def generar_mes(mes):
    carpeta = MENUS / mes
    menu_md = leer(carpeta / "menu.md")
    compra_md = leer(carpeta / "compra.md") if (carpeta / "compra.md").exists() else ""
    sesion_md = leer(carpeta / "sesion.md") if (carpeta / "sesion.md").exists() else ""

    recetas = []
    for s in recetas_del_menu(menu_md):
        meta, cuerpo = frontmatter(leer(RECETAS / f"{s}.md"))
        recetas.append({"slug": s, "nombre": meta.get("nombre", s), "tipo": meta.get("tipo", ""),
                        "meta": meta, "md": cuerpo.strip()})

    anio, num = mes.split("-")
    datos = {
        "mes": mes,
        "titulo": f"{MESES[int(num) - 1].capitalize()} {anio}",
        "menu_md": menu_md,
        "sesion_md": sesion_md,
        "compra_md": compra_md,
        "compra": parsear_compra(compra_md),
        "recetas": recetas,
    }
    SALIDA.mkdir(parents=True, exist_ok=True)
    (SALIDA / f"{mes}.json").write_text(json.dumps(datos, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{mes}: {len(recetas)} recetas, {len(datos['compra'])} artículos de compra")
    return datos["titulo"]


def main():
    todos = sorted(p.name for p in MENUS.iterdir() if (p / "menu.md").exists())
    for mes in (sys.argv[1:] or todos):
        generar_mes(mes)
    indice = [{"mes": m, "titulo": f"{MESES[int(m[5:]) - 1].capitalize()} {m[:4]}"}
              for m in sorted((p.stem for p in SALIDA.glob("????-??.json")), reverse=True)]
    (SALIDA / "meses.json").write_text(json.dumps(indice, ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
