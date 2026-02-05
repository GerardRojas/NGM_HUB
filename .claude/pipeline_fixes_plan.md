# Pipeline Module - Plan de Correcciones

**Creado:** 2026-02-05
**Estado General:** EN PROGRESO
**Total Issues:** 39
**Resueltos:** 23

---

## PRIORIDAD 1: BUGS CRITICOS (Causan perdida de datos o fallos)

### [P1-01] Mapeo de Campo Collaborator Roto
- **Estado:** [x] COMPLETADO (2026-02-05)
- **Severidad:** CRITICA
- **Archivo:** `assets/js/pipeline_table_interactions.js`
- **Lineas:** 200-214 (fieldMap) y 520-534 (onChange)
- **Problema:** El inline editor envia `collaborators` (plural) pero fieldMap solo tiene `collaborator` (singular). Los cambios de colaboradores fallan silenciosamente.
- **Solucion:** Agregar mapeo para campos plurales en fieldMap o manejar la conversion en saveFieldToBackend()
- **Test:** Editar colaboradores en tabla inline, verificar que se guarde en backend

### [P1-02] Memory Leak - Document Listeners en Table Interactions
- **Estado:** [x] COMPLETADO (2026-02-05)
- **Severidad:** CRITICA
- **Archivo:** `assets/js/pipeline_table_interactions.js`
- **Lineas:** 992-1009
- **Problema:** Los event listeners `document.addEventListener('click')` y `document.addEventListener('keydown')` se agregan pero NUNCA se remueven. Se acumulan con cada visita a Pipeline.
- **Solucion:** Convertir a IIFE con cleanup, o usar AbortController, o mover a nivel de modulo con flag de inicializacion
- **Test:** Navegar a Pipeline multiples veces, verificar en DevTools que no hay listeners duplicados

### [P1-03] Memory Leak - Document Listeners en PeoplePicker
- **Estado:** [x] COMPLETADO (2026-02-05)
- **Severidad:** CRITICA
- **Archivo:** `assets/js/pipeline_people_picker.js`
- **Lineas:** 295-312
- **Problema:** Cada instancia agrega listeners a document. destroy() existe pero los modales no lo llaman.
- **Solucion:** Asegurar que close() en modales llame destroy() en todos los pickers
- **Test:** Abrir/cerrar modal New Task 10 veces, verificar memoria

### [P1-04] Memory Leak - Document Listeners en CatalogPicker
- **Estado:** [x] COMPLETADO (2026-02-05)
- **Severidad:** CRITICA
- **Archivo:** `assets/js/pipeline_catalog_picker.js`
- **Lineas:** 317-330
- **Problema:** Mismo issue que PeoplePicker
- **Solucion:** Mismo que P1-03
- **Test:** Mismo que P1-03

### [P1-05] Race Condition en Pre-seleccion de Catalogos
- **Estado:** [x] COMPLETADO (2026-02-05)
- **Severidad:** CRITICA
- **Archivo:** `assets/js/pipeline_edit_task_ui.js`
- **Lineas:** 402-417 (preSelectCatalogItem)
- **Problema:** Usa delay hardcodeado de 300ms. Si backend es lento, pre-seleccion falla silenciosamente.
- **Solucion:** Esperar a que picker.items este poblado, usar polling o evento
- **Test:** Simular latencia alta, verificar que pre-seleccion funcione

### [P1-06] Manager Picker No Se Limpia Correctamente
- **Estado:** [x] COMPLETADO (2026-02-05)
- **Severidad:** ALTA
- **Archivo:** `assets/js/pipeline_edit_task_ui.js`
- **Lineas:** 68-76 (close function)
- **Problema:** managerPicker se setea a null en vez de llamar .clear() y .destroy()
- **Solucion:** Llamar managerPicker?.destroy() antes de setear a null
- **Test:** Editar tarea con manager, cerrar, editar otra sin manager, verificar que no aparezca el anterior

---

## PRIORIDAD 2: SEGURIDAD

### [P2-01] Validacion de URL Insuficiente
- **Estado:** [x] COMPLETADO (2026-02-05)
- **Severidad:** MEDIA-ALTA
- **Archivo:** `assets/js/pipeline_links_modal.js`
- **Lineas:** 160-167 (isValidUrl)
- **Problema:** No valida protocolo. Permite javascript:, data:, etc.
- **Solucion:** Validar que URL empiece con http:// o https://
- **Test:** Intentar guardar `javascript:alert(1)` como link

### [P2-02] XSS Potencial en Links Display
- **Estado:** [x] REVISADO - BAJO RIESGO (2026-02-05)
- **Severidad:** BAJA (reclasificado)
- **Archivo:** `assets/js/pipeline.js`
- **Lineas:** 321-330
- **Analisis:** URLs ya escapados con Utils.escapeHtml(). El onclick="event.stopPropagation()" es codigo estatico sin variables de usuario. No hay XSS real.
- **Conclusion:** Code smell menor, no vulnerabilidad. Event delegation seria mas limpio pero funcionalidad es correcta. Considerar para refactoring futuro.
- **Test:** Verificado que URLs se escapan correctamente

---

## PRIORIDAD 3: MEMORY LEAKS ADICIONALES

### [P3-01] Pickers en New Task Modal No Llaman destroy()
- **Estado:** [x] COMPLETADO (2026-02-05)
- **Severidad:** MEDIA
- **Archivo:** `assets/js/pipeline_new_task_ui.js`
- **Lineas:** 26-41 (close function)
- **Problema:** Solo llama .clear() en people pickers, no destroy(). Catalog pickers solo se setean a null.
- **Solucion:** Llamar destroy() en todos los pickers antes de clear/null
- **Test:** Abrir/cerrar modal 20 veces, monitorear memoria

### [P3-02] Pickers en Edit Task Modal No Llaman destroy()
- **Estado:** [x] COMPLETADO (2026-02-05)
- **Severidad:** MEDIA
- **Archivo:** `assets/js/pipeline_edit_task_ui.js`
- **Lineas:** 64-77 (close function)
- **Problema:** Mismo que P3-01
- **Solucion:** Mismo que P3-01
- **Test:** Mismo que P3-01

### [P3-03] Dropdown Positioning Styles No Se Limpian
- **Estado:** [x] COMPLETADO (2026-02-05)
- **Severidad:** BAJA
- **Archivos:** pipeline_catalog_picker.js, pipeline_people_picker.js
- **Problema:** position: fixed y estilos inline persisten en DOM detached
- **Solucion:** destroy() ahora llama a close() primero para limpiar estilos
- **Test:** Inspeccionar DOM despues de cerrar picker

---

## PRIORIDAD 4: ESTADO E INCONSISTENCIAS

### [P4-01] activeEditor State Puede Quedar Huerfano
- **Estado:** [x] COMPLETADO (2026-02-05)
- **Severidad:** MEDIA
- **Archivo:** `assets/js/pipeline_table_interactions.js`
- **Lineas:** 126-166
- **Problema:** Si modal se abre mientras hay editor activo, activeEditor puede apuntar a celda invisible
- **Solucion:** Limpiar activeEditor cuando se abre modal
- **Test:** Click en celda, luego doble click en otra fila, verificar estado

### [P4-02] Cache de Usuarios Sin Invalidacion Manual
- **Estado:** [x] COMPLETADO (2026-02-05)
- **Severidad:** MEDIA
- **Archivo:** `assets/js/pipeline_people_picker.js`
- **Lineas:** 12
- **Problema:** Cache de 5 min sin metodo de invalidar
- **Solucion:** Exponer funcion clearCache() en window.PM_PeoplePicker
- **Test:** Agregar usuario en otro tab, verificar que aparezca despues de invalidar

### [P4-03] Cache Key de Catalogo Mal Formado
- **Estado:** [x] COMPLETADO (2026-02-05)
- **Severidad:** BAJA
- **Archivo:** `assets/js/pipeline_catalog_picker.js`
- **Lineas:** 114
- **Problema:** cacheKey = catalogType + 's' genera 'companys' en vez de 'companies'
- **Solucion:** Usar mapa explicito para pluralizacion
- **Test:** Verificar que todos los catalogos se cacheen correctamente

### [P4-04] fetchPipeline Sin Await
- **Estado:** [x] COMPLETADO (2026-02-05)
- **Severidad:** BAJA
- **Archivos:** Multiples (links_modal, new_task_ui, automations)
- **Problema:** window.fetchPipeline() se llama sin await
- **Solucion:** Agregar await o .catch() para manejar errores
- **Test:** Simular error en fetch, verificar que se maneje

---

## PRIORIDAD 5: UX

### [P5-01] Sin Estado de Carga en Pickers Lentos
- **Estado:** [x] COMPLETADO (2026-02-05)
- **Severidad:** BAJA
- **Archivos:** pipeline_styles.css (.pm-people-loading, .pm-catalog-loading)
- **Problema:** Solo "Loading..." sin indicador de progreso
- **Solucion:** Agregado spinner CSS animado con ::before pseudo-element
- **Test:** Simular latencia, verificar UX

### [P5-02] Toast Fallback Faltante
- **Estado:** [x] COMPLETADO (2026-02-05)
- **Severidad:** BAJA
- **Archivos:** pipeline_new_task_ui.js, pipeline_edit_task_ui.js, pipeline_table_interactions.js, pipeline_automations.js, pipeline_links_modal.js
- **Problema:** Si Toast no existe, error silencioso
- **Solucion:** Agregado console.warn/log como fallback en todos los archivos
- **Test:** Eliminar Toast, verificar que haya feedback en consola

### [P5-03] Date Picker Blur vs Change Confuso
- **Estado:** [x] COMPLETADO (2026-02-05)
- **Severidad:** BAJA
- **Archivo:** `assets/js/pipeline_table_interactions.js`
- **Lineas:** 440-468 (createDateEditor)
- **Problema:** Usuario no sabe si cambio se guardo
- **Solucion:** Guardar valor original, solo guardar si realmente cambio (element.value !== originalValue)
- **Test:** Abrir date picker, cerrar sin cambiar, verificar que no hay flash de "saving"

### [P5-04] Sin Undo para Ediciones Inline
- **Estado:** [ ] PENDIENTE
- **Severidad:** BAJA
- **Archivo:** `assets/js/pipeline_table_interactions.js`
- **Problema:** No hay forma de deshacer
- **Solucion:** Considerar para fase 2 (feature)
- **Test:** N/A

### [P5-05] MULTI_PERSON_COLS Referenciado Antes de Definir
- **Estado:** [x] COMPLETADO (2026-02-05)
- **Severidad:** MEDIA
- **Archivo:** `assets/js/pipeline_table_interactions.js`
- **Lineas:** 266 (uso) vs 487 (definicion)
- **Problema:** Hoisting funciona pero es confuso y puede causar bugs
- **Solucion:** Mover definicion de MULTI_PERSON_COLS arriba con otras constantes
- **Test:** Verificar que collaborator/manager rendericen correctamente

---

## PRIORIDAD 6: CODIGO (Calidad y Mantenibilidad)

### [P6-01] escapeHtml Duplicado 5 Veces
- **Estado:** [ ] PENDIENTE
- **Severidad:** BAJA
- **Archivos:** pipeline.js, people_picker.js, catalog_picker.js, table_interactions.js, edit_task_ui.js
- **Problema:** Mismo codigo copiado 5 veces
- **Solucion:** Crear assets/js/utils.js con funciones compartidas
- **Test:** Verificar que todas las referencias funcionen despues de refactor

### [P6-02] API Endpoints Inconsistentes
- **Estado:** [ ] PENDIENTE
- **Severidad:** BAJA
- **Archivo:** `assets/js/pipeline_table_interactions.js`
- **Lineas:** 63, 81-86
- **Problema:** Mezcla /users, /projects, /pipeline/*
- **Solucion:** Documentar o unificar convencion
- **Test:** N/A (documentacion)

### [P6-03] Error Handling Faltante en fetchCatalog
- **Estado:** [x] COMPLETADO (2026-02-05)
- **Severidad:** MEDIA
- **Archivo:** `assets/js/pipeline_catalog_picker.js`
- **Lineas:** 151-154
- **Problema:** Falla silenciosa si fetch falla
- **Solucion:** Mostrar Toast de error
- **Test:** Simular error de red, verificar feedback

### [P6-04] Mensajes de Error Inconsistentes
- **Estado:** [ ] PENDIENTE
- **Severidad:** BAJA
- **Archivos:** Multiples
- **Problema:** "Create Failed", "Save Failed", "Automation Failed" - sin consistencia
- **Solucion:** Definir constantes para mensajes de error
- **Test:** N/A (UX review)

### [P6-05] Null Check Faltante en getCellValue
- **Estado:** [x] COMPLETADO (2026-02-05)
- **Severidad:** MEDIA
- **Archivo:** `assets/js/pipeline.js`
- **Lineas:** 207
- **Problema:** Si task es null, switch falla
- **Solucion:** Agregar guard clause al inicio
- **Test:** Pasar task null, verificar que no crashee

---

## PRIORIDAD 7: FUNCIONALIDAD

### [P7-01] Links Modal Hace Updates Secuenciales
- **Estado:** [x] COMPLETADO (2026-02-05)
- **Severidad:** MEDIA
- **Archivo:** `assets/js/pipeline_links_modal.js`
- **Lineas:** 113-131
- **Problema:** 2 PATCH requests en serie, si primero falla segundo no corre
- **Solucion:** Usar Promise.all() para updates independientes
- **Test:** Cambiar ambos links, verificar que ambos se guarden

### [P7-02] Automations Status Sin Graceful Fail
- **Estado:** [x] COMPLETADO (2026-02-05)
- **Severidad:** MEDIA
- **Archivo:** `assets/js/pipeline_automations.js`
- **Lineas:** 137-156 vs 201-213
- **Problema:** Si endpoint falla, renderAutomationsList crashea
- **Solucion:** Verificar null antes de mapear
- **Test:** Simular error en endpoint, verificar que no crashee

### [P7-03] estimated_hours Display vs Save Inconsistente
- **Estado:** [ ] PENDIENTE
- **Severidad:** BAJA
- **Archivo:** `assets/js/pipeline_table_interactions.js`
- **Lineas:** 278 vs 186
- **Problema:** Display agrega 'h', save envia numero raw
- **Solucion:** Documentar o unificar comportamiento
- **Test:** Editar horas, verificar formato

### [P7-04] start_date vs time_start Confusion
- **Estado:** [ ] PENDIENTE
- **Severidad:** BAJA
- **Archivos:** Multiples
- **Problema:** Nombres de campos confusos
- **Solucion:** Documentar claramente el modelo de datos
- **Test:** N/A (documentacion)

---

## PRIORIDAD 8: LAYOUT

### [P8-01] Dropdown Positioning con Scroll
- **Estado:** [ ] PENDIENTE
- **Severidad:** MEDIA
- **Archivos:** people_picker.js:348-371, catalog_picker.js:372-395
- **Problema:** getBoundingClientRect() relativo a viewport, no a tabla scrolleada
- **Solucion:** Recalcular posicion cuando tabla scrollea o usar Popper.js
- **Test:** Scrollear tabla, abrir picker, verificar posicion

### [P8-02] Sin Scroll Horizontal Indicator
- **Estado:** [ ] PENDIENTE
- **Severidad:** BAJA
- **Archivos:** pipeline_layout.js, pipeline_styles.css
- **Problema:** Tabla puede ser mas ancha que viewport sin indicador
- **Solucion:** Agregar indicador visual o sticky column
- **Test:** Expandir tabla al maximo, verificar UX

---

## NOTAS ADICIONALES

### Orden de Ejecucion Recomendado:
1. P1-01 (Collaborator field mapping) - Causa perdida de datos AHORA
2. P1-05 (Race condition pre-select) - Afecta UX de edicion
3. P1-06 (Manager cleanup) - Causa estado corrupto
4. P3-01, P3-02 (Modal picker destroy) - Memory leaks
5. P5-05 (MULTI_PERSON_COLS position) - Puede causar bugs
6. P2-01 (URL validation) - Seguridad
7. Resto en orden de prioridad

### Archivos a Modificar (por frecuencia):
1. `pipeline_table_interactions.js` - 8 issues
2. `pipeline_edit_task_ui.js` - 4 issues
3. `pipeline_new_task_ui.js` - 2 issues
4. `pipeline_people_picker.js` - 3 issues
5. `pipeline_catalog_picker.js` - 3 issues
6. `pipeline_links_modal.js` - 2 issues
7. `pipeline.js` - 2 issues
8. `pipeline_automations.js` - 1 issue

### Dependencias Entre Fixes:
- P6-01 (escapeHtml) debe hacerse antes de cualquier otro refactor grande
- P1-03, P1-04 deben completarse antes de P3-01, P3-02
- P5-05 debe hacerse antes de tocar updateCellDisplay

---

## HISTORIAL DE CAMBIOS

| Fecha | Issue | Estado | Notas |
|-------|-------|--------|-------|
| 2026-02-05 | PLAN | CREADO | Plan inicial con 39 issues |
| 2026-02-05 | P1-01 | COMPLETADO | Agregado fieldMap para plurales, flag alreadySaved para evitar doble-save |
| 2026-02-05 | P5-05 | COMPLETADO | Movido MULTI_PERSON_COLS al inicio con otras constantes |
| 2026-02-05 | P1-05 | COMPLETADO | Reemplazado delays hardcodeados con polling (max 3s, 100ms intervals) |
| 2026-02-05 | P1-06 | COMPLETADO | Agregado destroy() a managerPicker en close() de edit_task_ui |
| 2026-02-05 | P3-01 | COMPLETADO | Agregado destroy() a todos los pickers en close() de new_task_ui |
| 2026-02-05 | P3-02 | COMPLETADO | Agregado destroy() a todos los pickers en close() de edit_task_ui |
| 2026-02-05 | P2-01 | COMPLETADO | isValidUrl ahora solo acepta http:// y https:// |
| 2026-02-05 | P1-02 | COMPLETADO | Init guard, named handlers, destroy() expuesto en window.PM_TableInteractions |
| 2026-02-05 | P1-03 | COMPLETADO | destroy() ya existia, ahora se llama desde P3-01, P3-02 y table_interactions |
| 2026-02-05 | P1-04 | COMPLETADO | destroy() ya existia, ahora se llama desde P3-01, P3-02 y table_interactions |
| 2026-02-05 | P6-05 | COMPLETADO | Guard clause if (!task) return "-" en getCellValue |
| 2026-02-05 | P4-01 | COMPLETADO | closeActiveEditor() antes de abrir links modal |
| 2026-02-05 | P6-03 | COMPLETADO | Toast de error cuando fetchCatalog falla sin cache |
| 2026-02-05 | P7-01 | COMPLETADO | Promise.all() para updates paralelos en links modal |
| 2026-02-05 | P7-02 | COMPLETADO | try/catch con mensaje de error en renderAutomationsList |
| 2026-02-05 | P4-02 | COMPLETADO | clearCache() expuesto en window.PM_PeoplePicker |
| 2026-02-05 | P4-03 | COMPLETADO | pluralMap para cache keys correctos (companies, priorities) |
| 2026-02-05 | P4-04 | COMPLETADO | .catch() agregado a todas las llamadas a fetchPipeline |
| 2026-02-05 | P5-02 | COMPLETADO | Toast fallback con console.warn en todos los archivos pipeline |
| 2026-02-05 | P5-01 | COMPLETADO | Spinner CSS animado para .pm-people-loading y .pm-catalog-loading |
| 2026-02-05 | P3-03 | COMPLETADO | destroy() llama a close() para limpiar estilos inline |
| 2026-02-05 | P2-02 | REVISADO | No XSS real (URLs escapados, onclick estatico), reclasificado a bajo riesgo |
| 2026-02-05 | P5-03 | COMPLETADO | Date picker solo guarda si valor realmente cambio |

