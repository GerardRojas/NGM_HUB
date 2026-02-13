# NGM HUB WEB

## Descripcion
Aplicacion web para gestion de proyectos, presupuestos, equipos y gastos.

## Stack
- HTML/CSS/JavaScript vanilla
- Bootstrap para UI
- Firebase para autenticacion
- Supabase para almacenamiento

## Estructura del Proyecto
```
/                       # Paginas HTML principales
/assets/css/            # Estilos CSS
/assets/js/             # Scripts JavaScript
/assets/img/            # Imagenes y logos
/partials/              # Modales y componentes HTML reutilizables
```

## Paginas Principales
- `index.html` / `login.html` - Autenticacion
- `dashboard.html` - Panel principal
- `pipeline.html` - Gestion de tareas
- `projects.html` - Proyectos
- `budgets.html` - Presupuestos
- `expenses.html` - Gastos
- `team.html` - Equipo
- `messages.html` - Mensajeria y chat
- `vault.html` - Data Vault (almacenamiento de archivos)
- `arturito.html` - Asistente Arturito
- `agents-settings.html` - Configuracion de agentes AI (Andrew, Daneel)

Para indice completo de los ~60 modulos JS/CSS, ver `.claude/modules_index.md`

## Reglas de Codigo

### Frontend
- NO usar emojis en el codigo del frontend (HTML, CSS, JS)
- Todo texto visible al usuario (botones, labels, mensajes, placeholders) debe estar en **ingles**
- Mantener consistencia con el estilo existente
- Los archivos JS deben ir en `assets/js/`
- Los archivos CSS deben ir en `assets/css/`

## Referencias de Modulos Complejos
Antes de trabajar en un modulo complejo, leer su archivo de referencia en `.claude/`:
- **Modules Index** -> `.claude/modules_index.md` (indice rapido de los ~60 modulos)
- **Process Manager** -> `.claude/process_manager_reference.md`
- **Expenses** -> `.claude/expenses_reference.md`
- **Pipeline** -> `.claude/pipeline_reference.md`
- **Messages** -> `.claude/messages_reference.md`
- **Arturito (AI Assistant)** -> `.claude/arturito_reference.md`
- **Code Inspection** -> `.claude/CODE_INSPECTION.md` (framework de inspeccion de codigo)
- **Algorithm Diagrams** -> `.claude/algorithm_diagram_spec.md` (para generar diagramas de algoritmos)

### Agentes AI (filosofia, personalidad, arquitectura, reglas de escalabilidad)
Antes de modificar o escalar un agente, leer su doc de filosofia:
- **Arturito** -> `.claude/agent_arturito.md` (recepcionista inteligente, NLU, copilot, intents)
- **Andrew** -> `.claude/agent_andrew.md` (contador de campo, OCR, categorizacion, reconciliacion)
- **Daneel** -> `.claude/agent_daneel.md` (auditor guardian, autorizacion R1-R9, presupuesto, duplicados)

## Patrones Comunes (aplican a todos los modulos)

### Config Global
- `assets/js/config.js` define `window.NGM_CONFIG = {API_BASE, SUPABASE_URL, SUPABASE_ANON_KEY}`
- API_BASE: `https://ngm-fastapi.onrender.com` (prod) o `http://127.0.0.1:8000` (dev)

### Shared Utilities
- `assets/js/utils.js` expone `window.NGMUtils` y globals individuales:
  - `getAuthHeaders()` - Headers de auth con Bearer token
  - `formatCurrency(amount)` - Formato numerico USD (sin $)
  - `formatUSD(amount)` - Formato USD completo ($1,234.56)
  - `escapeHtml(str)` - Escape XSS via string replace chain
  - `hashStringToHue(str)` - Hash determinista para colores de avatar
  - `getSupabaseClient()` - Singleton Supabase client
  - `getApiBase()` - API base URL con fallback chain
  - `debounce(fn, ms)` - Standard debounce
- Cargar despues de `config.js`, antes de scripts de pagina
- Los modulos existentes aun definen sus propias copias (migracion gradual)

### Auth
- Firebase para login, token almacenado en localStorage
- `getAuthHeaders()` disponible globalmente via `utils.js` (tambien definido localmente en modulos legacy)

### Notificaciones
- `assets/js/toast.js` expone `window.Toast` con: `.success()`, `.error()`, `.warning()`, `.info()`
- Estilos en `assets/css/toast.css`

### Sidebar
- `assets/js/sidebar.js` genera la navegacion dinamicamente segun permisos del rol del usuario
- No es un HTML parcial, se construye por JS basado en `role_permissions` de la DB

### CSS Base
- `assets/css/styles.css` es el CSS base compartido (importado por todas las paginas)
- Cada pagina agrega su CSS especifico (ej: `expenses_styles.css`, `pipeline_styles.css`)

### Push Notifications
- `assets/js/firebase-init.js` configura Firebase Cloud Messaging
- Expone `window.NGMPush` para manejo de tokens y notificaciones

## API Backend
El backend esta en el proyecto separado `NGM_API`. Ubicacion segun PC:
- `C:\Users\germa\Desktop\NGM_API`
- `C:\Users\ADMIN\Desktop\NGM_API`

---

## Git & Deployment

### Branches
```
main     → Produccion (tu equipo usa esto)
staging  → Pruebas (para testear cambios antes de produccion)
```

### Servicios en Render
| Servicio | Branch | URL | Proposito |
|----------|--------|-----|-----------|
| ngm-hub | main | ngm-hub.onrender.com | Produccion |
| ngm-hub-staging | staging | ngm-hub-staging.onrender.com | Testing |
| ngm-fastapi | main | ngm-fastapi.onrender.com | API Produccion |
| ngm-api-staging | staging | ngm-api-staging.onrender.com | API Testing |

### Flujo de Trabajo

**Para cambios en Frontend (NGM_HUB):**
```bash
git checkout staging
# hacer cambios...
git add .
git commit -m "feat/fix/refactor: descripcion"
git push origin staging
# → Render auto-deploya a ngm-hub-staging
# → Probar en URL de staging
# Si OK:
git checkout main
git merge staging
git push origin main
# → Render auto-deploya a produccion
```

**Para cambios en Backend (NGM_API):**
```bash
cd ../NGM_API
git checkout staging
# hacer cambios...
git push origin staging
# → Render auto-deploya a ngm-api-staging
# → Frontend staging automaticamente usa este backend
```

**Para cambios en AMBOS:**
1. Push staging en NGM_API primero
2. Push staging en NGM_HUB
3. Probar todo junto en URLs de staging
4. Si OK → merge a main en ambos repos

### Variables de Entorno por Ambiente
El frontend detecta el ambiente via `config.js`:
- **Produccion**: `API_BASE = https://ngm-fastapi.onrender.com`
- **Staging**: `API_BASE = https://ngm-api-staging.onrender.com`

### Reglas de Deployment
- **NUNCA** pushear directamente a `main` sin probar en `staging`
- Cambios grandes de refactorizacion → siempre por staging
- Hotfixes criticos → pueden ir directo a main (con cuidado)
- Dia de deployment a produccion: coordinar con el equipo
