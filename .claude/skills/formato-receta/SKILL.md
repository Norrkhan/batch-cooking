---
name: formato-receta
description: Plantilla obligatoria para escribir o editar cualquier receta en recetas/. Úsala siempre que crees o modifiques una receta.
user-invocable: false
---

Cada receta es un archivo `recetas/<nombre-en-kebab>.md` con exactamente esta estructura:

```markdown
---
nombre: Pollo al curry con verduras
tipo: comida | cena | hidrato
proteina: pollo
pescado: no
hidratos: no
congela: sí
raciones_el: 4
raciones_ella: 4
coste_total: 12,40 €
coste_racion: 1,55 €
---

# Pollo al curry con verduras

## Ingredientes (lote completo)
| Ingrediente | Cantidad | Súper |
|---|---|---|

## Preparación
1. Pasos cortos. Indica el recipiente (olla de 12/5/3/2 l, wok, sartén, freidora de aire con el cajón y la temperatura) y el tiempo.

## Raciones y táperes
- Él: X g por ración · Ella: Y g por ración · Táperes: N grandes + M pequeños

## Conservación
- Nevera: X días · Congelador: X meses
- Recalentado: microondas X min / freidora X °C X min

## Macros por ración (est.)
| | kcal | Proteína | Hidratos | Grasa |
|---|---|---|---|---|
| Él | | | | |
| Ella | | | | |
```

Reglas:
- Cantidades en gramos crudos. Los costes salen de `datos/precios.md`; si un precio falta, se marca `(est.)`.
- `raciones_el` y `raciones_ella` indican cuántas raciones de cada tamaño da el lote. En las cenas de ella, `raciones_el: 0`.
- Nada de horno. Si la receta no se congela bien, pon `congela: no` y explica cuándo se prepara.
