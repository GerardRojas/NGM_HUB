# NGM HUB - Pending Fixes & Improvements

> Checklist de issues identificados en el modulo de Expenses.
> Borrar items conforme se vayan completando exitosamente.

---

## CRITICOS (Deben corregirse antes de deploy)

✅ **Todos los críticos han sido corregidos** (2026-01-23)

---

## ALTA PRIORIDAD

✅ **Todos los de alta prioridad han sido corregidos** (2026-01-23)

---

## MEDIA PRIORIDAD

- [ ] **Sin deteccion de edicion concurrente**
  - Archivo: `assets/js/expenses.js` - `saveSingleExpense()`
  - Problema: Si otro usuario edita, last-write-wins
  - Fix: Agregar campo `updated_at` y verificar antes de guardar
  - Nota: Requiere cambios en backend para agregar campo `updated_at`

- [ ] **Sin transacciones multi-step**
  - Archivo: `assets/js/expenses.js` - batch insert + receipt upload + bill creation
  - Problema: Si falla a mitad, queda estado inconsistente
  - Fix: Implementar patron saga o compensating transactions
  - Nota: Requiere cambios arquitecturales significativos

---

## MEJORAS DE CODIGO (Nice to have)

- [ ] **Exceso de console.log en produccion**
  - Archivo: `assets/js/expenses.js` - todo el archivo
  - Fix: Agregar flag DEBUG y condicionar logs

- [ ] **Magic numbers sin constantes**
  - Archivo: `assets/js/expenses.js` - batch size 5, delay 300ms, etc
  - Fix: Definir constantes al inicio del archivo

- [ ] **Mensajes de error inconsistentes**
  - Archivo: `assets/js/expenses.js` - alerts varios
  - Fix: Estandarizar formato de mensajes

- [ ] **Sin timeout en estados de loading**
  - Archivo: `assets/js/expenses.js` - botones con loading
  - Fix: Agregar timeout de 30s para restaurar UI

- [ ] **Falta de atributos de accesibilidad**
  - Archivo: `expenses.html` - elementos dinamicos
  - Fix: Agregar aria-labels y manejo de focus

---

## COMPLETADOS

### Críticos (2026-01-23)
- [x] **Race Condition en Bulk Delete** - Cambiado a `Promise.allSettled()` con manejo individual de errores
- [x] **Receipt Upload sin Rollback** - Agregado tracking de fallos y notificación al usuario
- [x] **JSON.parse sin try-catch** - Agregado try-catch en `apiJson()`
- [x] **Sin validacion de Amount** - Agregada validación de negativos y límite máximo ($10M)
- [x] **Bulk Authorize sin re-verificar permisos** - Agregada verificación con API antes de ejecutar

### Alta Prioridad (2026-01-23)
- [x] **JWT token sin validar existencia** - Creado `getAuthToken()` con validación de existencia y expiración
- [x] **Bill status closed->open sin reglas** - Agregado diálogo de confirmación antes de reabrir bills
- [x] **Null checks faltantes en deletes** - Ya tenían checks `index >= 0` antes de splice
- [x] **Modal cierra antes de reload completo** - Reordenado para esperar reload antes de cerrar modal
- [x] **Loose equality en ID comparison** - Cambiado `==` por `String() === String()` para comparaciones seguras

### Media Prioridad (2026-01-23)
- [x] **Memory leak - Blob URLs** - Agregado tracking y `URL.revokeObjectURL()` en todas las funciones de receipt
- [x] **CSV parse errors sin feedback** - Agregado reporte de errores con número de fila y descripción
- [x] **Disclosure de filename en receipts** - Cambiado a mostrar "Receipt attached" en lugar del filename real

---

## NOTAS

- Los items CRITICOS deben completarse antes del proximo deploy
- Marcar como `[x]` cuando se complete y luego borrar de la lista
- Agregar nuevos items al final de cada seccion

**Ultima actualizacion:** 2026-01-23
