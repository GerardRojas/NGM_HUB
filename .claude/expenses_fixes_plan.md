# Expenses Module - Plan de Mejoras

## Resumen del Diagnostico

**Archivo principal:** `assets/js/expenses.js` (~10,500 lineas, 208+ funciones)
**Fecha diagnostico:** 2026-02-05

### Problemas Identificados por Severidad

| Severidad | Problema | Lineas | Riesgo de Romper |
|-----------|----------|--------|------------------|
| CRITICA | Memory leaks en event listeners | 1638-1640, 8308-8330, 9426 | BAJO |
| CRITICA | Sin virtualizacion de tabla | 2500-2538 | MEDIO |
| ALTA | Funcion duplicada levenshteinDistance | 893-918, 3809-3831 | BAJO |
| ALTA | Estado global masivo (+30 vars) | 12-86 | ALTO - SALTAR |
| MEDIA | Complejidad O(n^2) en duplicados | 1090-1291 | MEDIO |
| MEDIA | Busquedas O(n) innecesarias | 1340, 2866 | BAJO |
| MEDIA | XSS potencial en HTML | 2579, 9416-9422 | BAJO |
| BAJA | Race conditions | 9796-9871 | MEDIO |

---

## FASE 1: Limpieza Segura (Sin Riesgo)

### 1.1 Eliminar Funcion Duplicada
**Estado:** [x] COMPLETADO 2026-02-05
**Riesgo:** NINGUNO
**Tiempo estimado:** 5 min

```
Problema: levenshteinDistance esta definida dos veces
- Primera definicion: lineas 893-918 (usada por deteccion de duplicados)
- Segunda definicion: lineas 3809-3831 (usada por fuzzy matching)

Solucion: Eliminar la segunda definicion (lineas 3809-3831) y sus funciones dependientes
- calculateSimilarity (3839-3845) usa la segunda
- findSimilarAccounts (3854-3869) usa calculateSimilarity

Verificar: Buscar todas las llamadas a estas funciones antes de eliminar
```

### 1.2 Agregar Cleanup de Listeners en Panel de Duplicados
**Estado:** [x] COMPLETADO 2026-02-05
**Riesgo:** NINGUNO
**Tiempo estimado:** 15 min

```
Problema: Lineas 1638-1640 agregan listeners a document sin cleanup
  handle.addEventListener('mousedown', dragStart);
  document.addEventListener('mousemove', drag);
  document.addEventListener('mouseup', dragEnd);

Solucion:
1. Crear funcion cleanupDuplicatePanelListeners()
2. Llamarla en hideDuplicateReviewPanel() antes de ocultar
3. Usar referencias nombradas para poder remover

Patron:
  let panelDragHandlers = { mousedown: null, mousemove: null, mouseup: null };

  function setupPanelDrag() {
    panelDragHandlers.mousedown = dragStart;
    panelDragHandlers.mousemove = drag;
    panelDragHandlers.mouseup = dragEnd;
    handle.addEventListener('mousedown', panelDragHandlers.mousedown);
    document.addEventListener('mousemove', panelDragHandlers.mousemove);
    document.addEventListener('mouseup', panelDragHandlers.mouseup);
  }

  function cleanupPanelDrag() {
    handle.removeEventListener('mousedown', panelDragHandlers.mousedown);
    document.removeEventListener('mousemove', panelDragHandlers.mousemove);
    document.removeEventListener('mouseup', panelDragHandlers.mouseup);
  }
```

### 1.3 Agregar Cleanup de Listeners en Resize de Columnas
**Estado:** [x] COMPLETADO 2026-02-05
**Riesgo:** NINGUNO
**Tiempo estimado:** 15 min

```
Problema: Lineas 8297-8330 - listeners de resize pueden acumularse

Solucion: Ya tiene cleanup en onMouseUp, pero verificar que siempre se ejecute
- Agregar try/finally para garantizar removeEventListener
- Agregar timeout de seguridad por si mouseup no se dispara
```

### 1.4 Sanitizar HTML en Tooltips y Chips
**Estado:** [x] COMPLETADO 2026-02-05
**Riesgo:** NINGUNO
**Tiempo estimado:** 20 min

```
Problema: Interpolacion directa de datos en HTML

Ubicaciones:
- Linea 2579: tooltipText en title attribute
- Linea 9416-9422: exp.description en chip HTML

Solucion: Crear funcion escapeHtml()

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

Luego reemplazar:
- title="${tooltipText}" -> title="${escapeHtml(tooltipText)}"
- ${exp.description...} -> ${escapeHtml(exp.description...)}
```

---

## FASE 2: Optimizaciones de Rendimiento (Riesgo Bajo)

### 2.1 Usar lookupMaps Consistentemente
**Estado:** [x] COMPLETADO 2026-02-05
**Riesgo:** BAJO
**Tiempo estimado:** 30 min

```
Problema: Hay busquedas O(n) cuando ya existen maps O(1)

Ubicaciones a optimizar:
- Linea 1340: expenses.find() -> crear expensesMap
- Linea 2866: originalExpenses.find() -> crear originalExpensesMap

Solucion:
1. Crear map temporal al inicio de funciones que lo necesiten:
   const expensesMap = new Map(expenses.map(e => [e.expense_id || e.id, e]));

2. Reemplazar .find() por .get():
   const expense = expensesMap.get(expenseId);
```

### 2.2 Throttle en Resize de Columnas
**Estado:** [x] COMPLETADO 2026-02-05
**Riesgo:** BAJO
**Tiempo estimado:** 10 min

```
Problema: mousemove sin throttle causa muchos repaints

Solucion: Agregar throttle al handler de mousemove

// Ya existe debounce en linea 169, usar patron similar
function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// En linea 8308:
document.addEventListener('mousemove', throttle(onMouseMove, 16)); // ~60fps
```

### 2.3 Debounce en Input de Filtros
**Estado:** [x] VERIFICADO 2026-02-05 - Ya existe debounce en busqueda global (250ms)
**Riesgo:** BAJO
**Tiempo estimado:** 10 min

```
Verificar: Ya existe debounce en busqueda global (linea 163-164)
- SEARCH_DEBOUNCE_MS = 250

Revisar si los filtros de columna tambien lo usan.
Si no, agregar debounce a filterDropdownOptions (linea 9750)
```

---

## FASE 3: Mejoras Estructurales (Riesgo Medio - Evaluar)

### 3.1 Lazy Rendering para Tabla Grande
**Estado:** [ ] Pendiente
**Riesgo:** MEDIO
**Tiempo estimado:** 2-3 horas

```
Problema: Con +500 filas, el DOM se satura

Solucion SEGURA (no virtualizacion completa):
1. Renderizar primeras 100 filas
2. Agregar boton "Cargar mas" o IntersectionObserver
3. Mantener logica existente, solo limitar renderizado inicial

// En renderExpensesTable() linea 2500:
const INITIAL_RENDER_LIMIT = 100;
const displayExpenses = filteredExpenses.slice(0, INITIAL_RENDER_LIMIT);

// Agregar indicador si hay mas
if (filteredExpenses.length > INITIAL_RENDER_LIMIT) {
  // Agregar fila "Mostrando 100 de X. Click para cargar mas"
}

NOTA: Esto es mas seguro que virtualizacion completa que requeriria
reescribir mucha logica de seleccion, edicion, etc.
```

### 3.2 Cancelar Requests al Cambiar Proyecto
**Estado:** [ ] Pendiente
**Riesgo:** MEDIO
**Tiempo estimado:** 30 min

```
Problema: Race condition si usuario cambia proyecto rapidamente

Solucion: Usar AbortController

let currentLoadController = null;

async function loadExpensesByProject(projectId) {
  // Cancelar request anterior si existe
  if (currentLoadController) {
    currentLoadController.abort();
  }
  currentLoadController = new AbortController();

  try {
    const result = await fetch(url, {
      signal: currentLoadController.signal,
      ...options
    });
    // ... resto del codigo
  } catch (err) {
    if (err.name === 'AbortError') {
      console.log('[EXPENSES] Request cancelled - project changed');
      return; // Ignorar, no es error
    }
    throw err;
  }
}
```

---

## FASE 4: NO IMPLEMENTAR (Alto Riesgo)

### 4.1 Refactorizar Estado Global
**SALTAR** - Riesgo muy alto de romper funcionalidad
```
Las 30+ variables globales estan entrelazadas en todo el codigo.
Refactorizar requeriria reescribir gran parte del modulo.
Mejor dejar como esta y solo documentar dependencias.
```

### 4.2 Virtualizacion Completa de Tabla
**SALTAR** - Riesgo alto
```
Requeriria cambiar:
- Sistema de seleccion de filas
- Modo edicion
- Scroll behavior
- Calculo de totales visibles

Mejor usar lazy loading simple (Fase 3.1)
```

### 4.3 Migrar a Modulos ES6
**SALTAR** - Riesgo alto, beneficio bajo
```
El IIFE actual funciona. Migrar a ES6 modules requeriria:
- Cambiar estructura de todos los archivos
- Configurar bundler
- Probar toda la aplicacion
```

---

## Orden de Implementacion Recomendado

```
SEMANA 1 - Limpieza (sin riesgo): COMPLETADA 2026-02-05
[x] 1.1 Eliminar funcion duplicada (5 min) - HECHO
[x] 1.4 Sanitizar HTML (20 min) - HECHO: escapeHtml() agregada
[x] 1.2 Cleanup listeners panel duplicados (15 min) - HECHO: cleanupPanelDrag()
[x] 1.3 Cleanup listeners resize columnas (15 min) - HECHO: handles cleanup + blur handler

SEMANA 2 - Optimizaciones (riesgo bajo): COMPLETADA 2026-02-05
[x] 2.1 Usar lookupMaps consistentemente (30 min) - HECHO: buildExpenseMap() helper
[x] 2.2 Throttle en resize (10 min) - HECHO: requestAnimationFrame
[x] 2.3 Verificar debounce en filtros (10 min) - VERIFICADO: ya existe 250ms en busqueda global

SEMANA 3+ - Mejoras estructurales (evaluar):
[ ] 3.1 Lazy rendering (2-3 horas) - PROBAR EN STAGING PRIMERO
[ ] 3.2 Cancelar requests (30 min) - PROBAR EN STAGING PRIMERO
```

---

## Checklist de Testing por Cambio

### Despues de cada cambio, verificar:
- [ ] Cargar proyecto con expenses
- [ ] Filtrar por columna
- [ ] Busqueda global
- [ ] Agregar expense nuevo
- [ ] Editar expense existente
- [ ] Modo edicion masiva
- [ ] Deteccion de duplicados
- [ ] Panel Health Check
- [ ] Cambiar de proyecto
- [ ] Resize de columnas
- [ ] Receipt upload

---

## Notas para Recuperar Contexto

### Archivos relacionados:
- `assets/js/expenses.js` - Logica principal (10,500 lineas)
- `assets/css/expenses_styles.css` - Estilos pagina (3,957 lineas)
- `assets/css/expenses_modal.css` - Estilos modales (3,001 lineas)
- `expenses.html` - Estructura HTML (~1,400 lineas)
- `.claude/expenses_reference.md` - Documentacion de arquitectura

### Variables de estado criticas:
```javascript
expenses[]           // Array principal de gastos
filteredExpenses[]   // Vista filtrada actual
originalExpenses[]   // Backup para rollback en edicion
isEditMode           // true cuando esta en modo edicion masiva
selectedProjectId    // Proyecto actual seleccionado
duplicateClusters[]  // Clusters de duplicados detectados
```

### Funciones clave:
```javascript
renderExpensesTable()      // Renderiza tabla principal (linea 2459)
applyFilters()             // Aplica filtros (linea 2346)
loadExpensesByProject()    // Carga datos del API (linea 794)
detectDuplicateBillNumbers() // Deteccion duplicados (linea 1055)
saveAllExpenses()          // Guarda expenses nuevos (linea 3875)
saveEditChanges()          // Guarda cambios masivos (linea 2823)
```

### Endpoints API usados:
```
GET  /expenses?project={id}
GET  /expenses/all
POST /expenses/batch
PATCH /expenses/{id}
DELETE /expenses/{id}
GET  /expenses/meta
GET  /bills
```
