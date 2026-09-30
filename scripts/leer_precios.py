"""Lee los precios anotados en la web (Supabase) y los imprime como filas de datos/precios.md.

Uso: python scripts/leer_precios.py [AAAA-MM]
Sin argumento, usa el último mes de docs/datos/. La conexión se toma de docs/config.js.
"""
import json
import re
import ssl
import subprocess
import sys
import urllib.parse
import urllib.request
from datetime import datetime
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
DATOS = RAIZ / "docs" / "datos"
SUPERS = [("lidl", "Lidl"), ("costco", "Costco")]


def config():
    texto = (RAIZ / "docs" / "config.js").read_text(encoding="utf-8")
    url = re.search(r'supabaseUrl:\s*"([^"]*)"', texto).group(1)
    clave = re.search(r'supabaseKey:\s*"([^"]*)"', texto).group(1)
    if not url or not clave:
        sys.exit("docs/config.js no tiene la URL o la clave de Supabase.")
    return url.rstrip("/"), clave


def formato_unidad(formato):
    """Misma lógica que parsearFormato() de docs/app.js: devuelve (cantidad, unidad) en kg, l o ud."""
    if not formato:
        return None
    t = re.sub(r"[×x*]", " * ", formato.lower().replace(",", "."))
    m = re.match(r"^\s*(?:(\d+(?:\.\d+)?)\s*\*\s*)?(\d+(?:\.\d+)?)\s*"
                 r"(kg|kilos?|gr?|gramos?|l|litros?|ml|cl|ud|uds|u|unidades?)\.?\s*$", t)
    if not m:
        return None
    q = float(m.group(2)) * (float(m.group(1)) if m.group(1) else 1)
    u = m.group(3)
    if u.startswith("k"):
        return q, "kg"
    if u.startswith("g"):
        return q / 1000, "kg"
    if u == "ml":
        return q / 1000, "l"
    if u == "cl":
        return q / 100, "l"
    if u.startswith("l"):
        return q, "l"
    return q, "ud"


def descargar(url, clave):
    peticion = urllib.request.Request(url, headers={"apikey": clave})
    try:
        with urllib.request.urlopen(peticion, timeout=20) as r:
            return json.load(r)
    except urllib.error.URLError as e:
        # El Python de python.org en macOS no trae certificados: se usa curl
        if not isinstance(e.reason, ssl.SSLError):
            raise
        salida = subprocess.run(["curl", "-sf", url, "-H", f"apikey: {clave}"],
                                capture_output=True, text=True, check=True, timeout=30)
        return json.loads(salida.stdout)


def euros(n):
    return f"{n:,.2f}".replace(",", " ").replace(".", ",").replace(" ", ".") + " €"


def main():
    meses = sorted(p.stem for p in DATOS.glob("????-??.json"))
    mes = sys.argv[1] if len(sys.argv) > 1 else meses[-1]
    productos = {x["id"]: x["producto"] for x in json.loads((DATOS / f"{mes}.json").read_text(encoding="utf-8"))["compra"]}

    url, clave = config()
    consulta = urllib.parse.urlencode({"select": "*", "mes": f"eq.{mes}", "order": "item_id"})
    filas = descargar(f"{url}/rest/v1/compra_estado?{consulta}", clave)

    salida = []
    for f in filas:
        fecha = datetime.fromisoformat(f["actualizado"].replace("Z", "+00:00")).strftime("%d/%m/%Y")
        nombre = productos.get(f["item_id"], f["item_id"] + " (ya no está en la lista)")
        for s, super_ in SUPERS:
            precio = f[f"{s}_precio"]
            if precio is None:
                continue
            precio = float(precio)
            formato = f[f"{s}_formato"] or ""
            fu = formato_unidad(formato)
            unit = f"{euros(precio / fu[0])}/{fu[1]}" if fu and fu[0] else ""
            salida.append(f"| {nombre} | {super_} | {formato} | {euros(precio)} | {unit} | verificado | Anotado en tienda (web) | {fecha} |")

    print(f"{mes}: {len(salida)} precios anotados en {len(filas)} artículos")
    if salida:
        print("| Producto | Súper | Formato | Precio | €/kg o €/l | Estado | Fuente | Fecha |")
        print("|---|---|---|---|---|---|---|---|")
        print("\n".join(salida))


if __name__ == "__main__":
    main()
