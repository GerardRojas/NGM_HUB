# PLAN DE REMEDIACION - Memory Leaks NGM HUB

**Fecha:** 2026-02-14
**Archivos analizados:** ~20 modulos JS
**Riesgos encontrados:** 75
**Scope:** Solo diagnostico + plan (sin cambios de codigo aun)

---

## CLASIFICACION DE RIESGOS DE MODIFICACION

Cada fix tiene dos dimensiones:
1. **Severidad del leak** - Que tan grave es el memory leak
2. **Riesgo de modificacion** - Que tan peligroso es tocarlo (que puede tronar)

### Escala de Riesgo de Modificacion
- **SAFE** = Se puede modificar sin riesgo. Pattern claro, una linea, sin dependencias
- **MODERATE** = Requiere cuidado. Tiene dependencias o timing que respetar
- **DANGEROUS** = Alto riesgo de romper funcionalidad. UI critica depende de este codigo

---

## FASE 1: QUICK WINS (Riesgo SAFE, Alto Impacto)

Fixes de 1-5 lineas que no pueden romper nada. Hacer primero.

### 1.1 pipeline_links_modal.js — Agregar guard `_bound`
- **Leak:** Cada apertura del modal duplica ~30 listeners
- **Fix:** Copiar patron de `companies_modal_ui.js` (agregar `let _bound = false; if(_bound) return; _bound = true;`)
- **Riesgo de modificacion:** SAFE
- **Por que no truena:** `companies_modal_ui.js` ya usa este patron exitosamente. Solo copiar

### 1.2 firebase-init.js — Guardar ref de setInterval + guard
- **Leak:** `setInterval` cada 60min sin `clearInterval`. Si el script re-carga, timers se acumulan
- **Fix:** Agregar `let _tokenRefreshInitialized = false` guard + guardar return value
- **Riesgo de modificacion:** SAFE
- **Por que no truena:** Token refresh es background maintenance. No afecta UI

### 1.3 firebase-init.js — Guard en onMessage handler
- **Leak:** `messaging.onMessage()` puede registrar multiples callbacks si init se llama 2x
- **Fix:** Agregar `let _foregroundHandlerInitialized = false` guard
- **Riesgo de modificacion:** SAFE
- **Por que no truena:** Firebase SDK ya maneja deduplicacion internamente

### 1.4 sidebar.js — Max retry en waitForAPIAndInit
- **Leak:** Recursive `setTimeout` cada 50ms sin limite. Loop infinito si `API_BASE` no carga
- **Fix:** Agregar contador `let retryCount = 0; if (retryCount++ > 100) return;`
- **Riesgo de modificacion:** SAFE
- **Por que no truena:** API_BASE carga en <100ms normalmente. 100 retries = 5 segundos de margen

### 1.5 dashboard.js — Cleanup elapsedTimeInterval en beforeunload
- **Leak:** setInterval cada 60s sigue corriendo al salir del dashboard
- **Fix:** `window.addEventListener('beforeunload', () => clearInterval(elapsedTimeInterval))`
- **Riesgo de modificacion:** SAFE
- **Por que no truena:** Solo limpia al salir. No afecta funcionalidad activa

### 1.6 messages.js — Clear _renderCache en selectChannel
- **Leak:** Cache de HTML renderizado crece sin limite entre canales
- **Fix:** Agregar `_renderCache.clear()` al inicio de `selectChannel()`
- **Riesgo de modificacion:** SAFE
- **Por que no truena:** Solo fuerza re-render del HTML (rapido). Mensajes ya estan en state.messages

---

## FASE 2: EVENT DELEGATION (Riesgo MODERATE, Alto Impacto)

Cambiar de `querySelectorAll().forEach(addEventListener)` a event delegation en container padre.

### 2.1 dashboard.js — renderMyWorkTasks (lineas 685, 697)
- **Leak:** Cada re-render de tasks agrega listeners duplicados a botones
- **Fix:** Mover a event delegation en `listEl` con `e.target.closest('.task-start-btn')`
- **Riesgo de modificacion:** MODERATE
- **Donde puede tronar:**
  - Si `e.stopPropagation()` en alguna parte bloquea la delegacion
  - Si el selector `.closest()` no matchea por estructura HTML diferente
  - Probar: click en "Start Task", "Send to Review", "Approve", "Reject"
- **Blast radius:** Solo botones del dashboard (no afecta otras paginas)

### 2.2 dashboard.js — renderPendingReviews (lineas 1125, 1137)
- **Leak:** Misma pattern que 2.1 para botones de approval
- **Fix:** Event delegation en container de pending reviews
- **Riesgo de modificacion:** MODERATE
- **Donde puede tronar:** Mismos riesgos que 2.1
- **Probar:** Approve/Reject workflow completo

### 2.3 estimator.js — renderEstimatesList / renderTemplatesList (lineas 1114, 1651)
- **Leak:** Listeners en items de lista se duplican al re-renderizar
- **Fix:** Event delegation en el container de la lista
- **Riesgo de modificacion:** MODERATE
- **Donde puede tronar:**
  - Estimator tiene logica compleja de templates con async loading
  - Si el selector `.closest()` falla, no se puede abrir un estimate/template
  - Probar: click en estimate de la lista, click en template, refresh catalog
- **Blast radius:** Solo la lista lateral del estimator

### 2.4 process_manager.js — Flow Node Detail Panel (linea 8243)
- **Leak:** Cada click en un flow node agrega un nuevo document mousedown listener
- **Fix:** Mover a un unico listener delegado o agregar guard
- **Riesgo de modificacion:** MODERATE
- **Donde puede tronar:**
  - El panel se cierra al hacer click fuera. Si el listener no se registra, el panel queda abierto
  - Asegurar que `closeFlowNodeDetailPanel()` siga funcionando
  - Probar: abrir panel de nodo, click fuera para cerrar, abrir otro nodo
- **Blast radius:** Solo el panel de detalle de flow nodes

---

## FASE 3: DOCUMENT LISTENER CLEANUP (Riesgo MODERATE-DANGEROUS)

Listeners globales en `document` que se acumulan. Requieren AbortController o guards.

### 3.1 process_manager.js — Diagram badge listeners (lineas 1850-1865)
- **Leak:** 3 document listeners (mouseenter, mouseleave, click) con capture phase
- **Fix:** Guardar handlers como named functions, agregar guard `if (_badgeListenersAttached) return`
- **Riesgo de modificacion:** MODERATE
- **Donde puede tronar:**
  - Capture phase es necesario para que mouseenter funcione con delegacion
  - Si se remueven, los tooltips de diagramas dejan de aparecer
  - Probar: hover sobre badge de algorithm, ver preview, click para abrir modal
- **Blast radius:** Solo diagrams de algoritmos (feature secundario)

### 3.2 process_manager.js — Context menu listeners (lineas 1873-1881)
- **Leak:** 2 document listeners (click, mousedown) sin cleanup
- **Fix:** Guard `if (_contextMenuListenersAttached) return`
- **Riesgo de modificacion:** SAFE
- **Donde puede tronar:** Nada. Solo previene duplicados
- **Blast radius:** Context menu del process manager

### 3.3 expenses.js — Filter dropdown close (linea 7323)
- **Leak:** Document click listener para cerrar dropdown
- **Fix:** Guard o AbortController
- **Riesgo de modificacion:** DANGEROUS
- **Donde puede tronar:**
  - **CRITICO**: Si este listener se remueve, el dropdown de filtros NO SE CIERRA
  - El dropdown no tiene otro mecanismo de cierre
  - Si se usa AbortController, hay que asegurar que el signal no se aborte prematuramente
  - Probar: abrir filter dropdown, click fuera, verificar que cierra
- **Blast radius:** Toda la interfaz de filtrado de expenses

### 3.4 expenses.js — Context menu close (lineas 7604, 7611, 7614)
- **Leak:** 3 document listeners para cerrar context menu
- **Fix:** Guard o AbortController
- **Riesgo de modificacion:** DANGEROUS
- **Donde puede tronar:**
  - **CRITICO**: Sin estos listeners, el context menu queda "pegado" en pantalla
  - Hay 3 listeners (click, scroll, keydown Escape) que cooperan
  - Probar: right-click en fila, verificar que click fuera cierra el menu, scroll cierra, Escape cierra
- **Blast radius:** Context menu de expenses (bloquea interaccion si se rompe)

---

## FASE 4: MEJORAS ESTRUCTURALES (Riesgo MODERATE, Bajo Impacto)

Cambios preventivos para sesiones largas. No son leaks criticos hoy.

### 4.1 vault.js — setupResizer document listeners
- **Leak:** mousemove/mouseup en document se agregan por cada drag del resizer
- **Fix:** Usar `{ once: true }` o mover a AbortController
- **Riesgo de modificacion:** MODERATE
- **Donde puede tronar:** Si mouseup no se detecta, el resize se "pega". Probar drag del panel separator

### 4.2 process_manager.js — Canvas listeners (lineas 1819-1823)
- **Leak:** Potencial duplicacion si setupEventListeners() se llama 2x (hoy no pasa)
- **Fix:** Guard `if (_canvasListenersAttached) return`
- **Riesgo de modificacion:** SAFE (preventivo)
- **Donde puede tronar:** Nada. Solo previene futuro problema

### 4.3 estimator.js — backendSyncTimer cleanup
- **Leak:** setInterval de 60s nunca se limpia al salir
- **Fix:** beforeunload clearInterval
- **Riesgo de modificacion:** SAFE
- **Donde puede tronar:** Nada

### 4.4 arturito.js — viewport resize cleanup
- **Leak:** visualViewport listeners nunca se remueven al salir
- **Fix:** Guardar refs y remover en beforeunload
- **Riesgo de modificacion:** SAFE
- **Donde puede tronar:** Solo afecta mobile

### 4.5 messages.js — AudioContext leak
- **Leak:** `new AudioContext()` por cada sonido de notificacion, nunca `.close()`
- **Fix:** Agregar `audioContext.close()` despues de que termine el sonido
- **Riesgo de modificacion:** SAFE
- **Donde puede tronar:** Nada. AudioContext se cierra despues de usarse

---

## NO TOCAR (Analisis confirmo que estan bien)

Estos areas fueron evaluadas y **NO requieren cambios**:

| Area | Por que esta OK |
|------|----------------|
| expenses.js drag panel (1780-81) | Ya tiene `cleanupPanelDrag()` con handler refs |
| messages.js subscribeToChannel | Ya hace `.unsubscribe()` antes de re-suscribir |
| messages.js polling timers | Ya hace `stopMessagePolling()` antes de re-iniciar |
| sidebar.js initRealtime | Event listener tiene `{ once: true }` guard |
| pipeline.js cluster toggle | Event delegation correcto, llamado una vez |
| pipeline.js filter listeners | Llamados una vez a nivel de modulo |
| pipeline.js empty row listeners | DOM replacement limpia listeners automaticamente |
| process_manager.js flow node loops (3733) | DOM replacement limpia listeners |
| vault.js renderTree innerHTML | Usa event delegation en containers padres |
| companies_modal_ui.js bind() | Ya tiene guard `_bound` |
| utils.js Supabase singleton | Pattern correcto, ref global necesaria |
| config.js | Sin state, sin listeners, sin timers |

---

## ORDEN DE EJECUCION RECOMENDADO

```
Fase 1 (Quick Wins)     → 30 min estimado, 0% riesgo de romper algo
  1.1 pipeline_links_modal guard
  1.2 firebase-init setInterval guard
  1.3 firebase-init onMessage guard
  1.4 sidebar max retry
  1.5 dashboard interval cleanup
  1.6 messages cache clear

Fase 2 (Event Delegation) → 1-2 horas, requiere testing
  2.1-2.2 dashboard delegation
  2.3 estimator delegation
  2.4 process_manager panel guard

Fase 3 (Document Listeners) → 1-2 horas, requiere testing cuidadoso
  3.1-3.2 process_manager guards (SAFE)
  3.3-3.4 expenses guards (DANGEROUS - probar exhaustivamente)

Fase 4 (Preventivos)     → 30 min, bajo riesgo
  4.1-4.5 cleanups varios
```

---

## TESTING CHECKLIST POST-FIX

### Fase 1 Tests
- [ ] Links modal: abrir/cerrar 5 veces, verificar que funciona
- [ ] Firebase: verificar que notificaciones push siguen llegando
- [ ] Sidebar: cargar pagina, verificar que sidebar aparece en <3s
- [ ] Dashboard: navegar entre paginas, verificar que no hay timers huerfanos
- [ ] Messages: cambiar entre 5 canales, verificar que mensajes cargan

### Fase 2 Tests
- [ ] Dashboard: click Start Task, Send to Review, Approve, Reject
- [ ] Dashboard: re-cargar tasks 3 veces, verificar que buttons responden
- [ ] Estimator: abrir estimate de lista, abrir template, refresh catalog
- [ ] Process Manager: click nodo → panel detalle → click fuera → panel cierra

### Fase 3 Tests
- [ ] Process Manager: hover badge algorithm → preview aparece → click → modal abre
- [ ] Process Manager: right-click nodo → context menu → click fuera → cierra
- [ ] Expenses: abrir filter dropdown → click fuera → cierra
- [ ] Expenses: right-click fila → context menu → click fuera/scroll/Escape → cierra

### Fase 4 Tests
- [ ] Vault: drag panel separator izq/der 10 veces, verificar que funciona smooth
- [ ] Arturito (mobile): abrir teclado, cerrar, verificar resize correcto
