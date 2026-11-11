# Ingresos con cosméticos del avatar

- **Estado:** abierta
- **Fecha:** 2026-11-11
- **Propuesta por:** Luis (redactada con Claude Code)

## Qué

Ahora los faradios solo se ganan jugando ([decisión 0022](../decisiones/0022-avatar-faradios-y-misiones.md)). Para que el juego dé ingresos sin dar ventajas de pago, las opciones son:

1. **Pase de apoyo** (pago único o mensual pequeño): un par de piezas exclusivas por temporada, un distintivo junto al nombre en los duelos y el doble de faradios en las misiones. Es la opción que mejor encaja: quien paga apoya el juego y lo enseña.
2. **Colecciones de temporada** (Navidad, verano, Mundial): se pueden conseguir jugando durante la temporada o comprar directamente.
3. **Paquetes de faradios** de precio fijo, sin azar.
4. **Piezas patrocinadas** por marcas o instituciones (un museo, un club), gratis para el jugador.

## Por qué

Los cosméticos son la forma de ingreso que menos molesta en un juego de conocimiento: no cambian quién gana y no interrumpen la partida, a diferencia de la publicidad.

## Dudas y riesgos

- Hace falta inicio de sesión y guardar el progreso en el servidor antes de vender nada: hoy todo está en el navegador y se puede falsear ([idea de login](login-con-supabase.md)).
- Hace falta un proveedor de pagos, facturación e impuestos, y revisar la normativa si juegan menores.
- No queremos cajas de premios al azar ni ofertas con cuenta atrás. Cualquier propuesta que las incluya se descarta.
- No sabemos cuánta gente pagaría. Antes de construir pagos conviene medir cuántos jugadores abren el armario y gastan faradios.
