---
name: publicar-web
description: Regenera la web estática de docs/ (GitHub Pages) a partir de los archivos .md del mes. Nunca hace commit.
argument-hint: "[AAAA-MM]"
disable-model-invocation: true
---

Actualiza la web con el mes `$ARGUMENTS` (por defecto, el último menú de `menus/`).

## Arquitectura (opción A: sin compilación)
- `docs/index.html`, `docs/estilos.css`, `docs/app.js`: HTML, CSS y JS puros, sin frameworks ni dependencias externas.
- `docs/datos/AAAA-MM.json`: datos del mes generados a partir de `menu.md`, `compra.md`, `sesion.md` y las recetas del menú.
- `docs/datos/meses.json`: lista de los meses disponibles, para el selector.
- Los `.md` son la **fuente de verdad**. El JSON se regenera siempre; nunca se edita a mano.

## Funciones de la web
- Pestañas: Menú · Recetas · Compra · Sesión.
- Compra: casillas guardadas en `localStorage` (clave por mes y producto), filtro por supermercado (Costco / Lidl mensual / Comprobar precios / Lidl semanal / Extras / En casa) y botón para desmarcar todo. Lo que ya está comprado en el `.md` sale marcado y bloqueado.
- Diseño pensado primero para el móvil, con botones táctiles grandes.
- `@media print`: imprime solo la lista filtrada, sin la navegación.
- Todo el texto de la web en español.

## Pasos
1. Ejecuta `python scripts/generar_web.py $ARGUMENTS`. Genera el JSON del mes y `meses.json`. La compra se convierte en artículos marcables a partir de las tablas con columna `✓` y de las listas `- [ ]` de `compra.md`. Una `✓` en esa columna (o `- [x]`) indica que ya está comprado. La sección `## Comprobar precios…` es su propio grupo.
2. Cambia `index.html`, `estilos.css` o `app.js` solo si hace falta una función nueva.
3. Comprueba que el número de recetas y de artículos que muestra el script es el esperado. Para verlo en local: `python -m http.server -d docs`.
4. Termina con un resumen de los cambios y un mensaje de commit propuesto (corto, en español). **No hagas commit ni push**: espera a que te dé permiso.
