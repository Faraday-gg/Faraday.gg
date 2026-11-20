# 0105. Vestíbulo con continuidad de juego, progreso y amigos

- **Estado:** implementada.
- **Fecha:** 2026-11-20.
- **Quién:** Álvaro, con Codex.
- **Amplía:** [Portada en una sola pantalla](0103-portada-en-una-pantalla.md).

## Referencias

GeoGuessr acerca al inicio la reanudación de partidas, las misiones y los logros de amigos. Chess.com permite jugar con amigos y revisar una partida reciente desde su inicio. NYT Games agrupa archivo y juegos, y usa el resultado diario para la competición entre amigos. [GeoGuessr, continuidad](https://geoguessr.canny.io/changelog/changelog-9th-october-2026) · [GeoGuessr, amigos](https://geoguessr.canny.io/changelog/changelog-6th-november-2026) · [Chess.com](https://support.chess.com/en/articles/8615318-welcome-to-chess-com) · [NYT Games](https://thenewyorktimeshelpcenter.helpjuice.com/360052273251-The-New-York-Times-Games-app).

## Decisión

- Toda la zona de juego comparte el fondo y la cuadrícula del escenario. El avatar sigue centrado y la entrada cabe en la ventana. Los acentos de color identifican cada modalidad.
- El reto diario muestra las preguntas respondidas y adapta su acción al estado de la partida. La tarjeta Duelos ofrece retomar la sala o abrir el resultado pendiente cuando la consulta del servidor devuelve ese estado.
- La ficha del avatar muestra el nivel, el progreso en XP y los avisos de misiones, y abre Misiones. Comparte espacio con «Editar avatar» y el acceso a los cofres pendientes.
- «Con amigos» reúne los retos privados, las ligas del reto diario y las invitaciones. El acceso a Duelos desde la portada o el panel social comprueba si hay una partida activa y, si no la hay, abre el vestíbulo con foco en «Retar a un amigo». La sala se crea cuando el jugador pulsa ese botón.
- Plus conserva el módulo común y sus condiciones. El diseño usa el progreso y las reglas existentes, con el mismo acceso para quien juega sin cuenta.
