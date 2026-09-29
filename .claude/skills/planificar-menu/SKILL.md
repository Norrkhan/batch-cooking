---
name: planificar-menu
description: Crea el menú mensual de batch cooking (comidas para dos y cenas de ella) cumpliendo restricciones, objetivos calóricos y temporada.
argument-hint: "[AAAA-MM]"
disable-model-invocation: true
---

Crea el menú del mes `$ARGUMENTS`. Si no se indica mes, usa el mes siguiente al actual.

## 1. Lee antes de empezar
- `datos/restricciones.md` y `datos/perfil.md`
- `historial.md`: repite las recetas con nota ≥ 4 y evita las de nota ≤ 2
- `recetas/`: reutiliza las recetas que ya existen

## 2. Diseña el menú
- **Comidas** (el mismo plato para los dos): 6–8 recetas base, bajas en hidratos, sin pescado ni marisco. Ración de él ≈ 1,7 veces la de ella (ver `perfil.md`).
- **Cenas de ella**: 5–7 recetas, ligeras (~400 kcal). Pueden llevar pescado y marisco.
- **Módulo de hidratos**: 2–3 opciones (arroz integral, patata, legumbre…) en raciones individuales. Calcula unas 13 raciones por persona al mes (3 días × ~4,3 semanas).
- Ninguna receta se repite más de 2 veces por semana.
- Usa productos de temporada del mes y comparte bases entre recetas: el mismo sofrito, la misma proteína cocinada de dos formas…
- Todo debe poder congelarse. Lo que no se congele bien (ensaladas, huevo cocido…) se marca como **"compra semanal / preparar en el momento"**.
- Si faltan platos de proteína, intercala sin alterar las reglas. Nada de horno.

## 3. Escribe los archivos
- Cada receta nueva va en `recetas/<nombre-en-kebab>.md` con la skill `formato-receta`.
- `menus/AAAA-MM/menu.md` debe contener:
  - Tabla por semana: día | comida | cena (ella). Los días de gimnasio no son fijos, así que no marques días: añade una nota que diga "3 días a la semana, añadir 1 módulo de hidratos".
  - Tabla resumen: receta | tipo | raciones de él | raciones de ella | táperes.
  - Recuento de táperes por tamaño.
  - kcal y proteína media por día y persona frente al objetivo de `perfil.md`.

## 4. Verifica
Lanza el subagente `revisor-nutricional` sobre el menú. Corrige lo que marque como fallo antes de entregar el menú.
