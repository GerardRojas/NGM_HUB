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
- `arturito.html` - Asistente Arturito

## Reglas de Codigo

### Frontend
- NO usar emojis en el codigo del frontend (HTML, CSS, JS)
- Mantener consistencia con el estilo existente
- Los archivos JS deben ir en `assets/js/`
- Los archivos CSS deben ir en `assets/css/`

## Referencias de Modulos Complejos
Antes de trabajar en un modulo complejo, leer su archivo de referencia en `.claude/`:
- **Process Manager** -> `.claude/process_manager_reference.md`
- **Expenses** -> `.claude/expenses_reference.md`
- **Pipeline** -> `.claude/pipeline_reference.md`
- **Arturito (AI Assistant)** -> `.claude/arturito_reference.md`

## Patrones Comunes (aplican a todos los modulos)

### Config Global
- `assets/js/config.js` define `window.NGM_CONFIG = {API_BASE, SUPABASE_URL, SUPABASE_ANON_KEY}`
- API_BASE: `https://ngm-fastapi.onrender.com` (prod) o `http://127.0.0.1:8000` (dev)

### Auth
- Firebase para login, token almacenado en localStorage
- `getAuthHeaders()` esta definido localmente en cada modulo (no compartido), retorna `{Authorization: 'Bearer ' + token}`

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
