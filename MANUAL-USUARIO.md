# Manual de usuario — GuardaPass 🔐

GuardaPass es tu gestor de contraseñas personal. Guarda tus accesos (sitio web, usuario y contraseña) de forma **cifrada y solo en tu dispositivo**. Este manual explica cómo **instalarla** y **usarla** paso a paso.

**Dirección de la app:** `https://javiroma1984.github.io/guardapass/`

---

## 1. Instalación

GuardaPass es una **PWA**: se instala directamente desde el navegador, sin tiendas de aplicaciones.

### 📱 Android (Chrome)
1. Abre `https://javiroma1984.github.io/guardapass/` en **Chrome**.
2. Toca el menú **⋮** (arriba a la derecha).
3. Pulsa **"Instalar aplicación"** (o *"Añadir a pantalla de inicio"*).
4. Confirma. El icono aparecerá en tu pantalla de inicio como una app más.

> También puede aparecer automáticamente un botón verde **"Instalar App"** dentro de la propia página; puedes usarlo directamente.

### 🍎 iPhone / iPad (Safari)
1. Abre la dirección en **Safari** (en iOS debe ser Safari).
2. Toca el botón **Compartir** (el cuadrado con la flecha hacia arriba).
3. Elige **"Añadir a pantalla de inicio"**.
4. Pulsa **"Añadir"**.

### 💻 Ordenador (Chrome / Edge)
1. Abre la dirección en Chrome o Edge.
2. Haz clic en el icono de **instalar** que aparece en la barra de direcciones (o menú **⋮ → Instalar GuardaPass**).

---

## 2. Primer uso: crear tu contraseña maestra

La primera vez que abras la app te pedirá **crear una contraseña maestra**. Es la llave que protege y cifra todas tus claves.

1. Escribe una contraseña maestra (**mínimo 8 caracteres**).
2. Repítela para confirmar.
3. Pulsa **"Crear y entrar"**.

> ⚠️ **MUY IMPORTANTE:**
> - Solo **tú** conoces esta contraseña; no se guarda en ningún sitio.
> - **No se puede recuperar.** Si la olvidas, perderás el acceso a todas tus claves para siempre.
> - Elige algo **fuerte y que puedas recordar** (o guárdala en un lugar seguro).

---

## 3. Desbloquear la app

Cada vez que abras la app (o tras el bloqueo automático), deberás desbloquearla:

- **Con la contraseña maestra:** escríbela y pulsa **"Desbloquear"**.
- **Con huella / cara** (si la activaste): pulsa **"Usar huella / biometría"** y confirma con tu dedo o rostro.

---

## 4. Activar el desbloqueo con huella (opcional)

Para no teclear la maestra cada vez, puedes activar la biometría del dispositivo:

1. Desbloquea la app con tu contraseña maestra.
2. En la pantalla principal, pulsa **"Activar desbloqueo con huella"**.
3. Confirma con tu huella/cara cuando el dispositivo lo pida.
4. A partir de entonces podrás entrar con biometría.

> - El botón solo aparece si tu dispositivo/navegador lo soporta.
> - La **contraseña maestra sigue funcionando** como respaldo.
> - Puedes quitarla con **"Desactivar desbloqueo con huella"**.

---

## 5. Guardar una nueva clave

1. En la pantalla principal pulsa **"Crear Nueva"**.
2. Rellena:
   - **Sitio web** (ej. `gmail.com`)
   - **Usuario** (ej. `tucorreo@gmail.com`)
   - **Contraseña**
3. Pulsa **"Guardar Entrada"**.

---

## 6. Ver, copiar, editar y borrar

Pulsa **"Agenda"** en la pantalla principal para ver todas tus entradas.

### Ver detalles
- Toca el icono del **ojo** 👁️ de una entrada.
- Verás el sitio, el usuario y la contraseña (oculta por defecto).
- Pulsa el **ojo** junto a la contraseña para **mostrarla/ocultarla**.

### Copiar
- En la pantalla de detalles, usa los iconos de **copiar** para llevar el usuario o la contraseña al portapapeles.

### Editar
- En los detalles, pulsa **"Editar Entrada"**, cambia lo que necesites y pulsa **"Guardar Cambios"**.

### Eliminar
- En la lista (Agenda), pulsa el icono de la **papelera** 🗑️ de la entrada.
- Confirma en la ventana emergente. **Esta acción no se puede deshacer.**

---

## 7. Bloquear la app

- **Manualmente:** en la pantalla principal, pulsa **"Bloquear ahora"**.
- **Automáticamente:** la app se bloquea sola tras **2 minutos de inactividad**.

Al bloquearse, habrá que volver a desbloquear con la maestra o la biometría.

---

## 8. Actualizar la app (sin perder tus datos)

GuardaPass se actualiza sola: cuando abres la app **con conexión a internet**, descarga la versión más reciente. Si no ves los cambios, **cierra la app por completo** (desde las apps recientes) y **vuelve a abrirla**; a veces el cambio se aplica al segundo intento. **No necesitas desinstalarla ni borrar nada.**

### ⚠️ Cuidado: borrar caché NO es lo mismo que borrar datos

| Acción | ¿Borra tus contraseñas? |
|--------|--------------------------|
| **Borrar caché** (solo archivos temporales) | ❌ **No.** Solo elimina los archivos de la app (que se vuelven a descargar). Tus claves están en el *almacenamiento*, no en la caché. |
| **Borrar datos / almacenamiento** del sitio o de la app ("Clear & reset", "Borrar datos de sitios web") | ✅ **Sí. Borra TODO tu baúl.** |

- 🔴 **Nunca uses "Borrar datos", "Borrar almacenamiento" ni "Borrar datos de sitios web".** Eso elimina tu base de datos cifrada y, como **no hay recuperación** de la contraseña maestra, **perderías todas tus contraseñas para siempre**.
- En el navegador, al *"Borrar datos de navegación"*: la casilla *"Imágenes y archivos en caché"* es **segura**; **no marques** *"Cookies y datos de sitios"*.
- El **icono** de la pantalla de inicio es lo único que a veces requiere reinstalar para verse actualizado; el resto de la app se actualiza sola.

---

## 9. Consejos de seguridad

- 🔑 Usa una **contraseña maestra fuerte** y **única** (que no uses en otros sitios).
- 🧠 Asegúrate de **recordarla** o guardarla en un lugar seguro: **no hay recuperación**.
- 📵 No compartas tu dispositivo desbloqueado con la app abierta.
- 💾 Recuerda: las claves están **solo en este dispositivo**. Si cambias de móvil o borras los datos del navegador/app, **empezarás de cero**.

---

## 10. Preguntas frecuentes

**¿Se envían mis contraseñas a algún servidor?**
No. Se guardan cifradas únicamente en tu dispositivo. Nada sale a internet.

**¿Qué pasa si olvido la contraseña maestra?**
No hay forma de recuperarla ni de recuperar los datos. Es así a propósito, para que nadie más pueda acceder.

**Si cambio el PIN o la huella del teléfono, ¿deja de funcionar?**
No. El desbloqueo biométrico sigue funcionando. Solo se vería afectado si quitas por completo el bloqueo del dispositivo o cambias de móvil; en ese caso, entra con la contraseña maestra.

**Instalé la app en otro teléfono y no veo mis claves.**
Los datos no se sincronizan entre dispositivos: cada instalación tiene su propio baúl.

**No me aparece la opción de huella.**
Tu navegador o dispositivo no soporta esa función; puedes seguir usando la contraseña maestra con total normalidad.

**Actualicé la app pero el icono se ve igual/antiguo.**
Android cachea el icono. Desinstala y vuelve a instalar la app para refrescarlo.

**¿Puedo borrar la caché para forzar la actualización?**
Sí, borrar **solo la caché** es seguro y no afecta a tus contraseñas. Pero **no borres los "datos"/"almacenamiento" del sitio o de la app**: eso elimina tu baúl y no se puede recuperar. Lo normal es que no necesites borrar nada: basta con cerrar y volver a abrir la app con internet (ver la sección 8).
