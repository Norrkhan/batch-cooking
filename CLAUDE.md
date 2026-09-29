# Batch Cooking mensual

Proyecto para planificar un menú mensual de batch cooking saludable y económico, con recetas, listas de compra (Lidl y Costco, España) y una web estática en GitHub Pages.

- Todo el contenido (archivos `.md`, web, commits) se escribe en **español de España**.
- Unidades métricas (g, ml, ud). Precios en euros con coma decimal: `3,49 €`.

## Hogar

- 2 adultos (él 29 años, ella 27). Los dos entrenan y quieren **perder peso**.
- Cada día se preparan **2 comidas** (una por persona, el mismo plato) y **1 cena solo para ella**.
- Él cena todos los días un batido Huel Black Edition con leche desnatada y fruta congelada. No planificar su cena, pero añadir a la compra la leche desnatada y la fruta congelada que necesite.
- Días de gimnasio: 3 por semana, **no fijos**. Esos días los dos toman batidos de proteína Optimum Nutrition.
- Objetivos de calorías, proteína y tamaño de ración en `datos/perfil.md`.

## Reglas nutricionales (obligatorias)

- **Hidratos solo en los 3 días de gimnasio**, y como máximo **1/3 del plato**. Como los días no son fijos, los hidratos se congelan como **módulo aparte**. Los platos base son siempre bajos en hidratos.
- **Él no come pescado ni marisco.** Las comidas (compartidas) nunca los llevan. Las cenas de ella sí pueden llevarlos.
- **A ella no le gusta el maíz.**
- No hay alergias.
- Las restricciones detalladas están en `datos/restricciones.md`. Si ese archivo existe, léelo antes de proponer cualquier receta o menú.

## Cocina y logística

- Una sesión de cocina al mes (dos como máximo), en un día reservado para ello.
- Equipo: vitrocerámica, ollas de 12 l, 5 l, 3 l y 2 l, sartén pequeña, wok mediano, freidora de aire Moulinex de dos cajones y microondas. **No hay horno.**
- Congelador grande y vacío. Los táperes se compran según lo que haga falta: calcula cuántos y de qué tamaño.
- Toda receta debe poder congelarse y recalentarse bien. Si algo no se congela bien, va a la compra semanal y se cocina en el momento.
- Prioriza productos de temporada y el aprovechamiento de sobras o bases comunes entre recetas.

## Compras

- **Costco**: una vez al mes (granel, congelados, proteína en grandes cantidades).
- **Lidl**: una compra grande al mes para el batch cooking + compras semanales de perecederos que no se congelan.
- En la lista de Costco, indica para cada producto el **precio de rentabilidad**: el precio por kg o l a partir del cual sale más barato comprarlo en Lidl.
- Los precios deben ser lo más reales posible. Anota siempre la fuente y la fecha. Si un precio es estimado, márcalo como `(est.)`.
- Puede haber productos que no son del menú (desayunos, limpieza, etc.). Cambian cada mes y van en su propia sección.
- Presupuesto: sin límite fijo, pero económico sin sacrificar salud. Calcula el coste aproximado por receta y por ración.

## Estructura de archivos

```
datos/          perfil.md, restricciones.md, precios.md (base de precios con fecha y fuente)
recetas/        una receta por archivo, reutilizable entre meses
menus/AAAA-MM/  menu.md, compra.md, sesion.md (plan del día de cocina)
historial.md    resumen de cada mes, notas 1–5 por plato y qué repetir o descartar
docs/           web para GitHub Pages: HTML/CSS/JS puros + JSON generado desde los .md
```

Los `.md` son la fuente de verdad. La web se regenera con `/publicar-web`; nunca se edita su JSON a mano.

## Flujo mensual

`/planificar-menu` → `/lista-compra` → `/plan-sesion` → `/publicar-web` → (fin de mes) `/cerrar-mes`

## Git

- **Nunca hagas commit ni push sin mi permiso explícito** en ese mismo momento.
- Mensajes de commit cortos y concisos, en español.
- Nunca añadas líneas `Co-Authored-By` ni ninguna atribución a Claude.
- Ejecuta los comandos de git siempre con la herramienta Bash, no con PowerShell. Solo así se aplica la confirmación de `settings.json`.
