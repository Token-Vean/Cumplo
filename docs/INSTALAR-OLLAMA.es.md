# Instalar y configurar Ollama para Cumplø

[Ollama](https://ollama.com) es un programa que ejecuta modelos de lenguaje en tu propia máquina. Cumplø lo usa como motor de IA local: la generación de desgloses ocurre dentro de tu equipo, sin enviar nada a la nube.

## 1. Instalar Ollama

### macOS

Descarga el `.dmg` desde [ollama.com/download](https://ollama.com/download), arrastra Ollama a `Aplicaciones`, ábrelo. Aparecerá un icono en la barra de menú. Eso significa que el servicio está corriendo.

### Linux

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

El script instala Ollama y lo registra como servicio de systemd. Verifícalo con:

```bash
systemctl status ollama
```

### Windows

Descarga el `.exe` desde [ollama.com/download](https://ollama.com/download) y ejecútalo. Ollama se instalará y arrancará como servicio en segundo plano (verás un icono en la bandeja del sistema).

### Verificar que funciona

Abre el navegador y entra en `http://localhost:11434/`. Deberías ver:

> Ollama is running

Si lo ves, está listo.

## 2. Configurar el origen autorizado (paso clave)

Por defecto, Ollama acepta peticiones solo desde su propio origen. Como Cumplø se sirve desde `http://127.0.0.1:8765` o `http://localhost:8765`, hay que declararlo explícitamente o el navegador bloqueará las llamadas por CORS.

**Este paso se hace una sola vez por equipo**. Después de configurarlo, Cumplø arranca sin problemas en futuras sesiones.

### Windows

1. Pulsa la tecla Windows y escribe **"Variables de entorno"**.
2. Selecciona **"Editar las variables de entorno del usuario"**.
3. En el panel superior ("Variables de usuario"), pulsa **Nueva...**.
4. Nombre de la variable: `OLLAMA_ORIGINS`
5. Valor: `http://127.0.0.1:8765,http://localhost:8765`
6. Pulsa Aceptar en todas las ventanas.
7. **Cierra Ollama**: clic derecho sobre el icono de Ollama en la bandeja del sistema (junto al reloj) → "Quit Ollama".
8. **Vuelve a abrir Ollama** desde el menú Inicio.

### macOS

En una terminal:

```bash
launchctl setenv OLLAMA_ORIGINS "http://127.0.0.1:8765,http://localhost:8765"
```

Después cierra Ollama desde el icono de la barra de menú y vuelve a abrirlo.

### Linux (con systemd)

```bash
sudo systemctl edit ollama.service
```

Se abrirá un editor. Añade:

```ini
[Service]
Environment="OLLAMA_ORIGINS=http://127.0.0.1:8765,http://localhost:8765"
```

Guarda, cierra, y reinicia:

```bash
sudo systemctl daemon-reload
sudo systemctl restart ollama
```

### ¿Por qué no `OLLAMA_ORIGINS=*`?

Te lo encontrarás recomendado en muchos tutoriales. **No lo hagas** salvo que sepas exactamente lo que implica: convierte tu Ollama en un recurso accesible desde cualquier web abierta en tu navegador, lo que abre la puerta a ataques tipo DNS rebinding desde páginas externas. Mantén el origen específico.

## 3. Descargar tu primer modelo

Con Ollama corriendo, abre una terminal (PowerShell en Windows, Terminal en macOS/Linux):

```bash
ollama pull gemma3n:e2b
```

Modelos recomendados para Cumplø (ordenados por tamaño):

| Modelo               | Tamaño  | RAM mínima | Notas                                      |
| -------------------- | ------- | ---------- | ------------------------------------------ |
| `phi3.5:3.8b`        | ~2.2 GB | 8 GB       | Más ligero, calidad limitada.              |
| `gemma3n:e2b`        | ~5.6 GB | 12 GB      | **Recomendado**. Buen equilibrio.          |
| `qwen2.5:7b-instruct`| ~4.7 GB | 12 GB      | Muy bueno siguiendo el formato JSON.       |
| `qwen3:8b`           | ~5.2 GB | 16 GB      | Alternativa robusta y reciente.            |
| `gemma3n:e4b`        | ~7.5 GB | 16 GB      | Mejor calidad de generación.               |
| `gemma4:e2b`         | ~7.2 GB | 16 GB      | Reciente; multimodal, 128K contexto.       |

Cumplø detecta automáticamente todos los modelos que tengas descargados y los muestra en el selector de Configuración. El primero que encuentre de la lista de recomendados se activa por defecto.

## 4. Arrancar Cumplø

Desde la carpeta del proyecto:

- **Windows**: doble clic en `start.bat`.
- **macOS/Linux**: `./start.sh`.

Verás algo así en la consola:

```
  Cumplo - servidor local
  -----------------------
  URL:     http://127.0.0.1:8765/index.html
  Puerto:  8765
  Version: 0.3.0

  Puedes apagar Cumplo desde la interfaz o con Ctrl+C.
```

El navegador se abre automáticamente. En la cabecera verás el indicador de Ollama: verde si todo va bien, rojo si no se detecta. Pulsa "Configuración" para ver la lista de modelos disponibles y elegir el activo.

## 5. Solución de problemas

### El indicador dice "Ollama no detectado"

1. Verifica que Ollama está corriendo: `http://localhost:11434/` en el navegador debe mostrar "Ollama is running".
2. Si es así pero Cumplø sigue sin verlo, casi seguro es `OLLAMA_ORIGINS`. Repite el paso 2 y reinicia Ollama.
3. Pulsa "Configuración" → "Reintentar detección".

### Cumplø arranca pero la consola muestra caracteres raros (CumplÃ¸ en lugar de Cumplø)

En Windows pasa con consolas antiguas. `start.bat` ya hace `chcp 65001` para forzar UTF-8, pero algunas terminales lo ignoran. No afecta a la aplicación: el navegador siempre se ve bien.

### "El puerto 8765 ya está en uso"

Otra cosa lo está ocupando (otra instancia de Cumplø, Compo, Jupyter, etc.). Lánzalo en otro puerto:

```bash
python server.py --port 8766
```

Y abre `http://127.0.0.1:8766/`. Si cambias de puerto, tendrás que actualizar `OLLAMA_ORIGINS` para incluirlo.

### El modelo tarda mucho la primera vez

Normal: Ollama tiene que cargar el modelo en RAM. Las siguientes peticiones son mucho más rápidas. Si tu equipo tiene poca RAM, considera un modelo más pequeño (`phi3.5:3.8b`).

### El navegador dice "blocked by CORS policy"

Indica que `OLLAMA_ORIGINS` no incluye `http://127.0.0.1:8765` o `http://localhost:8765`. Repasa el paso 2 y reinicia Ollama.

### Borrar todos los modelos

```bash
ollama list
ollama rm <nombre-modelo>
```

## Apagar Cumplø

Desde la propia interfaz, botón **Apagar** en la cabecera. Esto detiene el servidor local de Cumplø.

El botón no apaga Ollama. Ollama puede seguir corriendo para otras aplicaciones. Si quieres detenerlo, hazlo desde su propio icono de bandeja (Windows/macOS) o con `systemctl stop ollama` (Linux).
