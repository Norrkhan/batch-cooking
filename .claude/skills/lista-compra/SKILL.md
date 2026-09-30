---
name: lista-compra
description: Genera las listas de compra del mes (Costco, Lidl mensual, Lidl semanal y extras) a partir del menú, con costes y precio de rentabilidad de Costco.
argument-hint: "[AAAA-MM]"
disable-model-invocation: true
---

Genera `menus/$ARGUMENTS/compra.md`. Si no se indica mes, usa el último menú de `menus/`.

## 1. Suma las cantidades
- Suma los ingredientes de todas las recetas del menú, multiplicados por el número de lotes.
- Añade la cena de él para 30 días: leche desnatada (500 ml al día ≈ 15 l) y fruta congelada (100 g al día ≈ 3 kg).
- Añade los táperes que falten, según el recuento de `menu.md`.
- Pregúntame por los **extras** del mes (desayunos, limpieza, suplementos…) antes de cerrar la lista.

## 2. Precios
- Primero ejecuta `python scripts/leer_precios.py <mes anterior>`: son los precios que anotamos en tienda desde la web. Fusiónalos en `datos/precios.md` como `verificado` (sustituyen a las filas `est.` del mismo producto y súper).
- Busca cada producto en `datos/precios.md`. Si falta o tiene más de 30 días, lanza el subagente `investigador-precios` con la lista de productos pendientes, en una sola llamada.

## 3. Reparte por supermercado
- **Costco (mensual)**: granel, congelados y proteína en formato grande que se congele o no caduque en un mes. Solo si el €/kg es menor que el de Lidl **y** el formato no genera desperdicio.
- **Lidl mensual**: el resto de lo que se usa en la sesión de cocina.
- **Lidl semanal**: perecederos que no se congelan, una lista por semana (semana 1 a 4).
- **Extras**: sección aparte.

## 4. Formato
- Tabla Costco: producto | cantidad | formato | precio | €/kg | **precio de rentabilidad** (€/kg en Lidl; si Costco supera ese precio, sale más barato comprar en Lidl) | fuente y fecha.
- Tablas Lidl: producto | cantidad | formato | precio | fuente y fecha.
- Dentro de cada supermercado, agrupa por sección: fruta y verdura, carne, lácteos y huevos, congelados, despensa, otros.
- Al final: coste total por supermercado, coste del mes, coste por ración media. Indica cuántos precios son `(est.)`.
