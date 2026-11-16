# 0075. Intercambios privados de artículos de colección

- **Estado:** propuesta (código en la rama `feat/intercambios`; la migración `20261116140000_intercambios` está **sin aplicar**)
- **Fecha:** 2026-11-16
- **Quién:** Luis, con Claude Code
- **Concreta a:** la [0055](0055-tokenomics-suscripcion-y-mercado.md). Es la segunda entrega de la fase 4, después del mercado ([0073](0073-mercado-de-ediciones.md) y [0074](0074-mercado-con-pujas-e-indicadores.md)).

## Contexto

La 0055 pide intercambios privados desde el primer día, entre dos cuentas cualesquiera (también del mismo dueño), que muevan **solo artículos de colección, nunca faradios**, en una pantalla donde los dos ponen sus artículos, los dos ven lo que reciben y los dos confirman. El servidor lo hace entero o no lo hace: nadie entrega primero.

## Decisión

### Cómo se encuentran dos jugadores

- Uno **crea el intercambio** y recibe un **código de 6 letras y números** (y un enlace que lo lleva dentro).
- El otro **entra con el código**, o abre el enlace.
- Solo caben dos. No hace falta ser amigos ni saber el nombre de la cuenta del otro.

### Cómo se hace

1. Cada uno elige, de sus artículos de colección, los que ofrece (hasta 10). El otro lo ve al momento.
2. Cuando están de acuerdo, **confirman los dos**.
3. Con las dos confirmaciones, el servidor comprueba otra vez todos los artículos y los cambia de dueño en una sola operación.

- **Si alguien cambia su oferta, se quitan las dos confirmaciones.** Además, confirmar lleva la versión de la oferta que se ha visto: si cambió mientras tanto, la confirmación no vale.
- Se puede quitar la confirmación mientras el otro no haya confirmado, y cualquiera de los dos puede cancelar.
- **Vale dar sin recibir** (un regalo, o pasar algo a otra cuenta propia). Tiene que haber al menos un artículo en total.
- **No se puede ofrecer lo que está anunciado en el mercado.** Si se anuncia después de ofrecerlo, el cambio no se hace y se quitan las confirmaciones.
- Un intercambio **caduca si nadie lo toca en 30 minutos**. Cada cuenta puede tener 5 abiertos.
- Solo pide tener cuenta: ni nivel ni correo comprobado.

### Dónde está

En el mercado, en la pestaña **Intercambios**: crear, entrar con un código, la lista de los propios y la sala del intercambio (lo que ofrece cada uno, los artículos que se pueden ofrecer y los botones de confirmar y cancelar). La sala se pone al día sola cada pocos segundos.

### Datos

- Tabla nueva `trades`: los dos jugadores, lo que ofrece cada uno, las dos confirmaciones, el estado y la versión.
- Funciones de la base de datos: `trade_join`, `trade_offer`, `trade_confirm`, `trade_cancel` y `trade_free` (interna). `trade_confirm` bloquea el intercambio y todas las unidades antes de mover ninguna.
- **No toca el libro contable**: no se mueve ningún faradio y no hay comisión.

### Código

- `lib/intercambios.mjs` (nuevo): reglas, los intercambios del almacén en memoria y las acciones `intercambios`, `intercambio`, `intercambio-crear`, `intercambio-unirse`, `intercambio-ofrecer`, `intercambio-confirmar` e `intercambio-cancelar` de `POST /api/progreso`. `lib/stores.mjs`: lo mismo contra Supabase. `lib/comunidad.mjs` solo lo conecta.
- `supabase/migrations/20261116140000_intercambios.sql`.
- `dist/market.js` y `dist/market.css`: la pestaña y la sala.
- `tests/intercambios.test.mjs` (nuevo, en la lista de [AGENTS.md](../../AGENTS.md)).

## Alternativas descartadas

- **Buscar al otro por su nombre de usuario o entre los amigos.** Obliga a enseñar quién tiene cuenta y a un sistema de solicitudes; con un código se queda con quien uno quiere, por el canal que quiera.
- **Intercambios con faradios.** Dejarían el mercado sin uso y la comisión sin efecto (0055).
- **Que cada uno entregue por separado.** Es justo lo que se quiere evitar: alguien entrega y el otro no.
- **Bloquear los artículos ofrecidos** (que no se puedan anunciar mientras estén en un intercambio). Un intercambio abandonado los dejaría atrapados media hora; basta con comprobarlo al hacer el cambio.
- **Pedir nivel o correo comprobado.** La 0055 dice «entre dos cuentas cualesquiera».
- **Avisar con una conexión permanente** en vez de preguntar cada pocos segundos. Es lo que ya hacen los duelos y no necesita nada nuevo.

## Consecuencias

- **Hace falta aplicar la migración** (con la confirmación de Luis). Sin ella, la pestaña dice que los intercambios no están disponibles; el resto del mercado funciona.
- **Los intercambios se saltan la comisión del mercado**, a propósito: quien quiera faradios tiene que vender. Dos jugadores pueden acordar un pago por fuera del juego; no se puede impedir y la 0055 lo asume.
- **Sirven para repartir artículos entre cuentas propias**, que es lo que Luis quería permitir.
- **Quien tiene el código puede entrar** mientras no haya entrado nadie. Si entra un desconocido, basta con no confirmar, o cancelar.
- **No hay historial público de intercambios** ni cuentan en los indicadores del mercado: no tienen precio.
- Queda de la fase 4 decidir si los acabados se venden y se intercambian. Después vienen la suscripción (fase 5) y la segunda versión del mercado (fase 6).
