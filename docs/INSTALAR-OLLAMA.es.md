# Instalar y configurar Ollama para Cumplø

Ollama es el programa que ejecuta modelos de lenguaje en tu propio equipo. Cumplø lo usa como motor de IA local: la generación de desgloses ocurre dentro del ordenador, sin enviar proyectos a servicios externos.

## Instalación recomendada para usuarios finales

Para usuarios sin conocimientos informáticos, no se recomienda configurar todo manualmente. Usa los archivos incluidos en la raíz del repositorio:

### Windows

1. Instala Ollama desde <https://ollama.com/download>.
2. Abre Ollama desde el menú Inicio.
3. Haz doble clic en `Configurar_Cumplo_Windows.bat`.
4. Cuando termine, abre Cumplø con `Abrir_Cumplo_Windows.bat` o `start.bat`.

### macOS

1. Instala Ollama desde <https://ollama.com/download>.
2. Abre Ollama desde Aplicaciones.
3. Haz doble clic en `Configurar_Cumplo_macOS.command`.
4. Cuando termine, abre Cumplø con `Abrir_Cumplo_macOS.command` o `./start.sh`.

Si macOS bloquea un archivo `.command`, haz clic derecho sobre el archivo, selecciona **Abrir** y confirma la apertura.

## Qué hacen los configuradores

Los configuradores iniciales realizan estos pasos:

1. Comprueban que Python 3.8 o posterior esté disponible.
2. Comprueban que Ollama esté instalado.
3. Configuran `OLLAMA_ORIGINS` con el valor seguro para Cumplø:

```text
http://127.0.0.1:8765,http://localhost:8765
```

4. Reinician Ollama si es posible.
5. Descargan el modelo recomendado:

```bash
ollama pull gemma3n:e2b
```

Este paso puede tardar varios minutos la primera vez.

## Instalación manual de Ollama

### macOS

Descarga el `.dmg` desde <https://ollama.com/download>, arrastra Ollama a `Aplicaciones` y ábrelo. Aparecerá un icono en la barra de menú. Eso significa que el servicio está corriendo.

### Windows

Descarga el `.exe` desde <https://ollama.com/download> y ejecútalo. Ollama se instalará y arrancará como servicio en segundo plano; verás un icono en la bandeja del sistema.

### Linux

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

Verifica el servicio con:

```bash
systemctl status ollama
```

## Verificar que Ollama funciona

Abre el navegador y entra en:

```text
http://localhost:11434/
```

Deberías ver:

```text
Ollama is running
```

## Configurar el origen autorizado manualmente

Cumplø se sirve desde `http://127.0.0.1:8765` o `http://localhost:8765`. Ollama debe autorizar esos orígenes para evitar bloqueos CORS del navegador.

### Windows, manual

1. Pulsa la tecla Windows y escribe **Variables de entorno**.
2. Selecciona **Editar las variables de entorno del usuario**.
3. En el panel superior, **Variables de usuario**, pulsa **Nueva...**.
4. Nombre de la variable: `OLLAMA_ORIGINS`.
5. Valor:

```text
http://127.0.0.1:8765,http://localhost:8765
```

6. Pulsa Aceptar en todas las ventanas.
7. Cierra Ollama desde el icono de la bandeja del sistema.
8. Vuelve a abrir Ollama desde el menú Inicio.

### macOS, manual

En Terminal:

```bash
launchctl setenv OLLAMA_ORIGINS "http://127.0.0.1:8765,http://localhost:8765"
```

Después cierra Ollama desde el icono de la barra de menú y vuelve a abrirlo.

### Linux con systemd

```bash
sudo systemctl edit ollama.service
```

Añade:

```ini
[Service]
Environment="OLLAMA_ORIGINS=http://127.0.0.1:8765,http://localhost:8765"
```

Guarda, cierra y reinicia:

```bash
sudo systemctl daemon-reload
sudo systemctl restart ollama
```

## Por qué no usar `OLLAMA_ORIGINS=*`

No uses `OLLAMA_ORIGINS=*` salvo que sepas exactamente lo que implica. Esa configuración permite que cualquier web abierta en tu navegador intente llamar a tu Ollama local. Mantén el origen específico de Cumplø:

```text
http://127.0.0.1:8765,http://localhost:8765
```

## Descargar un modelo manualmente

Con Ollama corriendo, abre Terminal o PowerShell y ejecuta:

```bash
ollama pull gemma3n:e2b
```

Modelos recomendados para Cumplø:

| Modelo | Tamaño aproximado | RAM orientativa | Notas |
|---|---:|---:|---|
| `phi3.5:3.8b` | ~2.2 GB | 8 GB | Más ligero, calidad limitada. |
| `gemma3n:e2b` | ~5.6 GB | 12 GB | Recomendado como equilibrio inicial. |
| `qwen2.5:7b-instruct` | ~4.7 GB | 12 GB | Muy bueno siguiendo formato JSON. |
| `qwen3:8b` | ~5.2 GB | 16 GB | Alternativa robusta. |
| `gemma3n:e4b` | ~7.5 GB | 16 GB | Mejor calidad de generación. |

Cumplø detecta automáticamente los modelos descargados y los muestra en el selector de configuración.

## Arrancar Cumplø

Desde la carpeta del proyecto:

- Windows: doble clic en `Abrir_Cumplo_Windows.bat` o `start.bat`.
- macOS: doble clic en `Abrir_Cumplo_macOS.command` o ejecuta `./start.sh`.
- Linux: ejecuta `./start.sh`.

El navegador se abre automáticamente en:

```text
http://127.0.0.1:8765/index.html
```

## Solución de problemas

### El indicador dice “Ollama no detectado”

1. Verifica que Ollama está corriendo: `http://localhost:11434/` debe mostrar `Ollama is running`.
2. Si Ollama responde pero Cumplø no lo detecta, revisa `OLLAMA_ORIGINS`.
3. Reinicia Ollama.
4. Pulsa **Configuración** → **Reintentar detección**.

### El puerto 8765 está en uso

Otra instancia de Cumplø u otro programa está usando ese puerto. Puedes cerrar la instancia anterior o arrancar en otro puerto:

```bash
python server.py --port 8766
```

Si cambias de puerto, tendrás que añadirlo también a `OLLAMA_ORIGINS`.

### El modelo tarda mucho la primera vez

Es normal. Ollama tiene que cargar el modelo en memoria. Si el equipo tiene poca RAM, considera un modelo más pequeño como `phi3.5:3.8b`.

### El navegador dice “blocked by CORS policy”

Indica que `OLLAMA_ORIGINS` no incluye `http://127.0.0.1:8765` o `http://localhost:8765`. Vuelve a ejecutar el configurador inicial y reinicia Ollama.

## Apagar Cumplø

Desde la propia interfaz, pulsa **Apagar**. Esto detiene el servidor local de Cumplø. No apaga Ollama. Ollama puede seguir corriendo para otras aplicaciones.
