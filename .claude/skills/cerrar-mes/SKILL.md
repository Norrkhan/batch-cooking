---
name: cerrar-mes
description: Cierra el mes, recoge las notas (1-5) de cada plato, actualiza historial.md y prepara las decisiones para el mes siguiente.
argument-hint: "[AAAA-MM]"
disable-model-invocation: true
---

Cierra el mes `$ARGUMENTS` (por defecto, el último de `menus/`).

1. Lista las recetas del menú del mes y pídeme una nota del 1 al 5 para él y para ella, y un comentario opcional. Pregunta en bloques pequeños.
2. Pregunta también:
   - ¿Sobró o faltó comida? ¿Qué platos?
   - ¿Coste real del mes, si lo sabes?
   - ¿Cambios de peso o de objetivos?
3. Añade una fila por receta a la tabla de notas de `historial.md` y un resumen del mes de ~5 líneas.
4. Si cambió el peso, recalcula `datos/perfil.md`.
5. Si detectas un gusto claro (por ejemplo, las notas bajas coinciden en un ingrediente), propón añadirlo a `datos/restricciones.md` en la sección de preferencias. No lo añadas sin mi confirmación.
6. Termina con una recomendación: repetir el menú, cambiarlo en parte o hacer uno nuevo.
