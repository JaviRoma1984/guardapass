# GuardaPass 🔐

Gestor de contraseñas personal, gratuito y **sin servidor**, empaquetado como **PWA** (aplicación web progresiva) instalable en el móvil y en el ordenador.

Todas las claves se guardan **solo en tu dispositivo** y **cifradas**. Ningún dato sale a internet ni se sube a ningún servidor.

> 📱 App en producción: `https://javiroma1984.github.io/guardapass/`
> 📖 Guía de instalación y uso: [MANUAL-USUARIO.md](MANUAL-USUARIO.md)

---

## Características

- ✅ Guardar entradas con **sitio web, usuario y contraseña**.
- ✅ Ver, copiar (usuario/contraseña), editar y eliminar entradas.
- ✅ Mostrar/ocultar contraseñas.
- ✅ **Contraseña maestra** que cifra todo el baúl.
- ✅ **Desbloqueo biométrico** opcional (huella / cara), con la maestra como respaldo.
- ✅ **Auto-bloqueo** por inactividad.
- ✅ Funciona **sin conexión** (PWA con service worker).
- ✅ Instalable como app en Android, iOS y escritorio.

---

## Seguridad de los datos

Esta es la parte más importante de un gestor de contraseñas. El diseño sigue el modelo estándar del sector (como Bitwarden o 1Password): **cifrado de conocimiento cero en el dispositivo**.

### 1. Almacenamiento local y cifrado
- Las entradas se guardan en **IndexedDB** (base de datos `GuardaPassDB`), **dentro del propio dispositivo**. No hay backend ni sincronización en la nube.
- Cada entrada se cifra con **AES-GCM de 256 bits** (cifrado autenticado). En la base de datos **solo queda texto cifrado**: sitio web, usuario y contraseña son ilegibles sin la llave.

### 2. Contraseña maestra (raíz criptográfica)
- El propietario **elige libremente** una contraseña maestra en el primer uso (mínimo 8 caracteres, con confirmación).
- De ella se **deriva la llave de cifrado** mediante **PBKDF2** (`SHA-256`, **210 000 iteraciones**) con una **sal aleatoria** única por baúl. El alto número de iteraciones encarece los ataques de fuerza bruta.
- La contraseña maestra **nunca se almacena** en ningún sitio. Para validarla se intenta descifrar un pequeño *verificador*; si el descifrado es correcto, la contraseña era correcta.
- **No hay recuperación**: si se olvida la maestra, los datos son irrecuperables. Es el precio de que nadie más pueda acceder.

### 3. Desbloqueo biométrico (opcional)
- Usa la **WebAuthn API** con la extensión **PRF** para desbloquear con la huella/cara del dispositivo.
- La verificación biométrica la realiza **el sistema operativo**; la app **nunca ve el PIN ni la huella**. Solo recibe una confirmación criptográfica.
- Con el secreto derivado de la biometría se **envuelve (wrap)** la llave del baúl (AES-GCM). Sin superar la biometría, la llave envuelta es inútil.
- La **contraseña maestra sigue siendo el respaldo**: si la biometría falla o se cambia de dispositivo, se entra con la maestra.
- Si el navegador/dispositivo no soporta PRF, la app **detecta la falta de soporte** y simplemente no ofrece la opción (se sigue usando la maestra).

### 4. Bloqueo automático
- La app se **bloquea sola tras 2 minutos de inactividad** y también manualmente con el botón *"Bloquear ahora"*. Al bloquear, la llave se borra de memoria y hay que volver a desbloquear.

### 5. Otras medidas
- **Sin XSS**: los datos del usuario se pintan con `textContent` (nunca con `innerHTML`), evitando inyección de código a través de los campos guardados.
- **HTTPS**: la app se sirve por conexión cifrada (GitHub Pages), requisito además de WebAuthn.
- **Sin telemetría ni terceros**: no se cargan librerías externas ni se envían datos a ningún sitio. Toda la criptografía usa la `Web Crypto API` nativa del navegador.

### Qué protege y qué no

| Situación | ¿Protegido? |
|-----------|-------------|
| Alguien abre DevTools o lee la base de datos del navegador | ✅ Sí — solo ve texto cifrado |
| Robo/pérdida del móvil (con la app bloqueada) | ✅ Sí — sin la maestra no se descifra |
| Fuerza bruta sobre la maestra | ✅ Mitigado — PBKDF2 con 210 000 iteraciones (depende de que la maestra sea fuerte) |
| Malware activo en el dispositivo **mientras la app está desbloqueada** | ❌ No — ninguna app protege en ese caso |
| Contraseña maestra débil o reutilizada | ❌ No — la seguridad depende de ella |
| Olvido de la maestra | ⚠️ No hay recuperación (por diseño) |

---

## Estructura del proyecto

```
guardapass/
├── index.html          # Estructura de la app (pantallas)
├── styles.css          # Estilos (diseño móvil / PWA)
├── app.js              # Lógica: cripto, bloqueo, biometría, CRUD
├── service-worker.js   # Caché offline (PWA)
├── manifest.json       # Web App Manifest (instalación PWA)
├── icons/              # Iconos (incluye versiones 'maskable' con margen)
├── README.md
└── MANUAL-USUARIO.md   # Guía de instalación y uso
```

---

## Tecnología

- **PWA** pura: HTML + CSS + JavaScript, sin frameworks ni dependencias externas.
- **Almacenamiento:** IndexedDB.
- **Criptografía:** Web Crypto API (PBKDF2 + AES-GCM + HKDF).
- **Autenticación biométrica:** WebAuthn (extensión PRF).
- **Offline:** Service Worker (estrategia *network-first*).
- **Hosting:** GitHub Pages.

---

## Desarrollo local

Al ser estática, basta con servir la carpeta por HTTP (algunas funciones como el Service Worker y WebAuthn requieren `http://localhost` o HTTPS; no funcionan abriendo el archivo con `file://`).

Ejemplos de servidor local:

```bash
# Con Python
python -m http.server 8080

# Con Node
npx serve
```

Luego abre `http://localhost:8080`.

> Nota: la biometría (WebAuthn/PRF) solo puede probarse de verdad en `localhost` o en el sitio desplegado por **HTTPS**, y necesita un dispositivo con autenticador (huella/cara).

---

## Despliegue

El sitio se publica con **GitHub Pages** desde este repositorio. Al hacer `push` a la rama principal, GitHub republica la app automáticamente en `https://javiroma1984.github.io/guardapass/`.

Tras cada despliegue con cambios, se sube la versión de la caché en `service-worker.js` (`CACHE_NAME`) para que los dispositivos ya instalados descarguen la versión nueva.

---

## Aviso

GuardaPass es un proyecto personal. Aunque implementa cifrado real en el dispositivo, úsalo con criterio: elige una contraseña maestra fuerte y **haz copias de seguridad** de tus datos importantes por otros medios, ya que no existe recuperación de la maestra.
