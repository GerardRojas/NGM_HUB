# Mejoras al Sistema de Autenticación Persistente

## ✅ Cambios Implementados

### 1. **Validación mejorada del token JWT** ([auth-guard.js](assets/js/auth-guard.js))
- Ahora valida que el token tenga el formato correcto (3 partes)
- Verifica que tenga campo de expiración (`exp`)
- Advierte cuando el token está por expirar (5 minutos antes)
- Logs más descriptivos con timestamps

### 2. **Validación del usuario almacenado** ([auth-guard.js](assets/js/auth-guard.js))
- Verifica que exista `ngmUser` en localStorage
- Valida que sea JSON válido
- Verifica que tenga campos requeridos (`user_id`, `user_name`)
- Limpia datos si están corruptos

### 3. **Verificación periódica durante uso activo** ([auth-guard.js](assets/js/auth-guard.js))
- Verifica el token cada 60 segundos mientras el usuario usa la app
- Detecta expiración durante sesión activa
- Muestra mensaje de alerta antes de redirigir
- Evita que el usuario pierda trabajo sin aviso

### 4. **Mejoras en login.js**
- Validación adicional de datos del usuario
- Manejo de errores más específico (401, 429, 500+)
- Incluye `credentials: 'include'` para manejar cookies
- Usa `window.location.replace()` consistentemente
- Valida respuesta del servidor antes de guardar
- Mejor manejo de errores de localStorage

### 5. **API mejorada de authGuard**
```javascript
window.authGuard = {
  isAuthenticated: () => boolean,  // Verifica token Y usuario
  checkAuth: () => boolean,         // Verifica autenticación completa
  clearAuthData: () => void,        // Limpia todos los datos
  redirectToLogin: () => void,      // Redirige a login
  getToken: () => string,           // Obtiene token actual
  getUser: () => object             // Obtiene objeto usuario parseado
};
```

---

## ⚠️ Problemas Identificados (No Corregidos Aún)

### 1. **No hay sistema de refresh token**
**Problema**: Cuando el token expira, el usuario debe volver a hacer login completo.

**Solución recomendada**: Implementar endpoint `/auth/refresh` en el backend que:
- Reciba el token actual (o refresh token separado)
- Valide y emita nuevo access token
- Frontend lo llame automáticamente cuando detecte expiración cercana

**Código sugerido para el frontend**:
```javascript
async function refreshToken() {
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('ngmToken')}`
      }
    });

    if (res.ok) {
      const data = await res.json();
      localStorage.setItem('ngmToken', data.access_token);
      return true;
    }
    return false;
  } catch (e) {
    return false;
  }
}
```

### 2. **No hay opción "Remember Me"**
**Problema**: Siempre guarda en localStorage (persistente). No hay opción para sesión temporal.

**Solución recomendada**: Agregar checkbox "Remember Me" en login:
- Checked: usar localStorage (persistente)
- Unchecked: usar sessionStorage (se borra al cerrar navegador)

**Código sugerido**:
```javascript
// En login.html
<label class="remember-me">
  <input type="checkbox" id="rememberMe" checked />
  <span>Remember me</span>
</label>

// En login.js
const rememberMe = document.getElementById('rememberMe').checked;
const storage = rememberMe ? localStorage : sessionStorage;
storage.setItem('ngmToken', data.access_token);
storage.setItem('ngmUser', JSON.stringify(data.user));
```

### 3. **No hay interceptor de fetch para manejo automático de 401**
**Problema**: Si una API retorna 401, no hay manejo centralizado.

**Solución recomendada**: Crear un wrapper de fetch que detecte 401 y maneje automáticamente:
```javascript
// En nuevo archivo: assets/js/auth-fetch.js
window.authFetch = async function(url, options = {}) {
  const token = localStorage.getItem('ngmToken');

  if (token) {
    options.headers = {
      ...options.headers,
      'Authorization': `Bearer ${token}`
    };
  }

  options.credentials = 'include';

  const response = await fetch(url, options);

  if (response.status === 401) {
    console.warn('[Auth Fetch] 401 Unauthorized, clearing auth and redirecting');
    window.authGuard.clearAuthData();
    window.authGuard.redirectToLogin();
    throw new Error('Unauthorized');
  }

  return response;
};
```

### 4. **Verificación duplicada en login.html**
**Problema**: El inline script en login.html y login.js ambos verifican el token.

**Estado**: Esto no causa problemas graves (solo es redundante), pero puede optimizarse.

**Recomendación**: Dejar solo el inline script para máxima velocidad, eliminar la verificación de login.js.

---

## 📊 Estado Actual del Sistema

### ✅ Funcionalidades que SÍ están trabajando bien:
1. ✅ Persistencia de sesión en localStorage
2. ✅ Validación de expiración de JWT
3. ✅ Redirección automática si no está autenticado
4. ✅ Redirección a página original después de login
5. ✅ Limpieza de datos cuando token expira
6. ✅ Verificación temprana para evitar flash de contenido
7. ✅ Detección de expiración durante uso activo (NUEVO)
8. ✅ Validación de datos del usuario (NUEVO)

### ⚠️ Funcionalidades pendientes/mejorables:
1. ⚠️ Refresh automático de tokens
2. ⚠️ Opción "Remember Me" para sesiones temporales
3. ⚠️ Interceptor global de fetch para 401
4. ⚠️ Indicador visual de tiempo de sesión restante
5. ⚠️ Logout automático por inactividad

---

## 🔐 Recomendaciones de Seguridad

### 1. **Usar HttpOnly Cookies para el token** (Backend)
En lugar de guardar el token en localStorage, el backend puede enviarlo como cookie HttpOnly:
```python
# Backend (FastAPI ejemplo)
response.set_cookie(
    key="ngm_token",
    value=access_token,
    httponly=True,    # No accesible desde JavaScript
    secure=True,      # Solo HTTPS
    samesite="lax"    # Protección CSRF
)
```

**Ventaja**: El token no puede ser robado por XSS attacks.

### 2. **Implementar CSRF Protection**
Si usas cookies, agregar tokens CSRF para prevenir ataques CSRF.

### 3. **Logging de eventos de seguridad**
- Login exitoso
- Login fallido (intentos)
- Logout
- Token expirado
- Token inválido

### 4. **Rate Limiting en login**
El código ahora maneja 429 (Too Many Requests), pero el backend debe implementarlo.

---

## 🚀 Próximos Pasos Recomendados

### Corto Plazo (1-2 días):
1. Implementar endpoint `/auth/refresh` en backend
2. Agregar checkbox "Remember Me" en login
3. Crear wrapper `authFetch` para manejo centralizado de 401

### Mediano Plazo (1 semana):
1. Implementar HttpOnly cookies (requiere cambios en backend)
2. Agregar indicador visual de tiempo de sesión
3. Implementar logout por inactividad

### Largo Plazo (1 mes):
1. Implementar logging de seguridad completo
2. Agregar autenticación de dos factores (2FA)
3. Implementar refresh tokens con rotación

---

## 📝 Testing Recomendado

Para verificar que las mejoras funcionan:

1. **Test de expiración**:
   - Editar token en localStorage para que expire en 1 minuto
   - Esperar y verificar que redirija automáticamente

2. **Test de datos corruptos**:
   - Editar manualmente `ngmUser` en localStorage con JSON inválido
   - Recargar página y verificar que limpie y redirija

3. **Test de sesión válida**:
   - Con sesión activa, intentar acceder a login.html
   - Debe redirigir inmediatamente a dashboard

4. **Test de redirect**:
   - Sin sesión, intentar acceder a expenses.html
   - Debe guardar la URL y redirigir después del login

5. **Test de expiración durante uso**:
   - Modificar token para que expire en 2 minutos
   - Dejar la app abierta y esperar
   - Debe mostrar alerta y redirigir automáticamente

---

## 📞 Soporte

Si encuentras algún problema con la autenticación:
1. Abre la consola del navegador (F12)
2. Busca logs con `[Auth Guard]` o `[Login]`
3. Verifica que `ngmToken` y `ngmUser` existan en localStorage
4. Usa `window.authGuard.isAuthenticated()` para verificar estado

---

**Fecha de mejoras**: 2026-01-29
**Archivos modificados**:
- `assets/js/auth-guard.js`
- `assets/js/login.js`
