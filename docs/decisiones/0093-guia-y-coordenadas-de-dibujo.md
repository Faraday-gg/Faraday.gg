# 0093. Guía y coordenadas de dibujo

- **Estado** — Implementada; la lectura de coordenadas se actualiza por la [decisión 0104](0104-trazo-suave-y-lectura-cercana.md). El aviso de inicio permanece.
- **Fecha** — 2026-11-18.
- **Quién** — Álvaro, con Codex.

El tramo sombreado muestra «Dibuja el resto» y el punto amarillo de inicio tiene un anillo que pulsa si el dispositivo permite animaciones. El aviso desaparece al dibujar la primera muestra o guardar un punto con el editor. Vuelve al borrar el trazo.

Las dos líneas punteadas unen el punto activo con sus ejes. Una etiqueta muestra el periodo más cercano, y la otra el valor estimado en ese punto. Debajo de la gráfica se conserva la última lectura con el periodo completo, el valor y la unidad. Los rótulos habituales que quedarían parcialmente detrás de la etiqueta de fecha se ocultan mientras se muestra la lectura.

La guía pública de [Extraplot](https://guessdash.com/extraplot) sitúa el inicio en el corte y pide continuar por el tramo sombreado. Faraday mantiene el punto amarillo para iniciar y reanudar la línea y usa sus propios estilos y proyecciones de coordenadas.
