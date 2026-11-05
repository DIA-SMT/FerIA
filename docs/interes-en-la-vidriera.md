# Interés en la vidriera

Qué mira el vecino en el market, y cómo medirlo sin ponerle una cookie encima.

Escrito el 3/11/2026, antes de implementarlo, como diseño a revisar. Igual que
`autenticacion.md`: lo que se decidió **no hacer** no se lee en el código.

---

## El problema aparece apenas se mira el código

La idea original era "un contador de vistas por producto". No se puede, y
conviene saberlo antes de escribir la migración: **no hay página por producto.**
Los productos se muestran todos juntos en la grilla de `/stands/[slug]`.

Si contáramos una vista por producto cada vez que se abre un stand, todos los
productos de ese stand tendrían **exactamente el mismo número**. El eje de
interés —que era el punto de todo esto— queda plano justo donde hay que
comparar: entre los productos de un mismo feriante.

Lo que sí es por producto, y ya está construido, es el botón **«Consultar por
este producto»**: abre WhatsApp con el nombre del producto adentro del mensaje
(`mensajeConsultaProducto`, en `src/lib/whatsapp.ts`). Quien aprieta eso quiere
ese producto, y lo dice con el pulgar. Es la señal más fuerte que hay en la
plataforma, ocurre todos los días, y hoy se tira.

---

## Los dos números

| evento | dónde ocurre | para qué sirve |
|---|---|---|
| Apertura de la vidriera | render de `/stands/[slug]` | el **denominador** |
| Consulta por un producto | clic en «Consultar por este producto» | el **numerador**, por producto |
| Consulta general del stand | clic en «Consultar» del encabezado | interés sin producto identificado |

Lo útil no es el conteo suelto, es el cociente:

> De cada 100 personas que abrieron tu vidriera, 7 preguntaron por el pan de
> campo y ninguna por la mermelada.

El denominador compartido es lo que hace justa la comparación entre productos
del mismo stand. Un conteo de consultas a secas premia al feriante con más
tráfico, que es información que ya tiene.

---

## 1. Base de datos

Una migración, dos tablas. Ninguna columna nueva en lo existente.

```prisma
/// Interés en la vidriera de un feriante, agregado por día.
model InteresStand {
  vendedorId String
  vendedor   Vendedor @relation(fields: [vendedorId], references: [id], onDelete: Cascade)

  /// Medianoche del día **en Tucumán** (`hoyEnZona`), no en UTC. Una consulta
  /// del sábado a las 22 tiene que caer en el sábado, que es el día de feria.
  fecha DateTime @db.Date

  /// Veces que se abrió la página del stand. No son personas: ver más abajo.
  aperturas Int @default(0)
  /// Clics en el «Consultar» del encabezado, sin producto identificado.
  consultas Int @default(0)

  @@id([vendedorId, fecha])
}

/// Interés en un producto concreto, agregado por día.
model InteresProducto {
  productoId String
  producto   Producto @relation(fields: [productoId], references: [id], onDelete: Cascade)

  fecha DateTime @db.Date

  consultas Int @default(0)

  @@id([productoId, fecha])
}
```

**Una fila por día y por cosa, no una fila por evento.** Un evento por fila es
un registro de navegación de vecinos y habría que justificarlo, retenerlo y
purgarlo. Un contador diario no: es un número. Además el volumen queda ridículo
—sólo nace la fila el día que alguien hace algo— y los cortes que se van a
querer (esta semana contra la anterior, esta feria contra la otra) son sumas.

Lo que se pierde con el día como grano: la hora pico. No importa todavía; eso lo
va a dar el escaneo en el mostrador, si alguna vez se hace.

---

## 2. Dónde se cuenta cada cosa

### La apertura, en el servidor

En el Server Component de la página, dentro de `after()` de Next: el incremento
corre **después** de mandar la respuesta, así que no le agrega un milisegundo a
la vidriera. Envuelto en `try`/`catch`: si el contador falla, la página ya salió
y el vecino no se entera.

Dos cosas hay que descartar o el número no vale nada:

- **Los prefetch de Next.** Pasar el mouse por encima de un link hace que Next
  se traiga la página. Sin filtrar la cabecera `Next-Router-Prefetch` / `RSC`,
  un vecino que recorre la lista de stands con el mouse "abre" veinte vidrieras
  sin ver ninguna.
- **Los bots.** El log de pm2 muestra escaneos automáticos todos los días. Un
  filtro por user agent alcanza: no hace falta que sea perfecto, hace falta que
  no sea sistemático.

### La consulta, en el navegador

`navigator.sendBeacon` en el clic, contra `POST /api/interes`. El `<a>` conserva
su `href` a wa.me tal como está hoy: si el beacon falla, lo bloquea una
extensión o no hay JavaScript, el vecino **igual** llega a WhatsApp. El contador
nunca se mete en el camino de la consulta.

Se descartó la alternativa obvia —pasar el link por un redirector propio,
`/consultar/<id>` que registra y manda a wa.me—. Funciona sin JavaScript, que es
su ventaja, pero un bot que sigue links incrementa **todos los productos por
igual**, y eso no agrega ruido: borra la señal, porque lo que estamos midiendo
son las diferencias entre productos. El beacon tiene el defecto inverso y mucho
más benigno: subcuenta parejo.

---

## 3. Lo que no se guarda

No hay cookie. No hay identificador de visitante. No se guarda IP, ni user
agent, ni referrer, ni la hora. La fila más detallada que llega a existir es:

```
producto X · 3 de noviembre · 12 consultas
```

Dos consecuencias, y las dos son el punto:

- **No hace falta banner de cookies ni consentimiento**, porque no hay dato
  personal ni identificador que pedir permiso para usar. Esto es una decisión de
  diseño, no una omisión: con un identificador de visitante la métrica sería
  mejor y la conversación con Legales, otra.
- **No se puede saber si fueron 12 personas o una que apretó 12 veces.** Es el
  precio, es a propósito, y obliga a que Migue diga «consultas» y nunca
  «personas».

---

## 4. Lo que el número no dice

Conviene que esté escrito, porque Migue va a hablar con estos datos y no tiene
que sonar más seguro de lo que el dato permite.

- **Las aperturas no son personas.** Un refresh cuenta dos.
- **Hay sesgo de posición.** La grilla ordena por destacado, disponible y
  nombre. Lo que cae vigésimo primero se ve menos, y eso no es falta de interés.
  Migue tiene que poder decir *«la mermelada está última en tu vidriera, probá
  destacarla»* antes de decir *«no le interesa a nadie»* — y puede, porque el
  orden se deriva del catálogo sin guardar nada.
- **Interés no es venta.** Justamente: todo el valor aparece cuando se cruza con
  lo que efectivamente salió, que todavía no se mide. Esto es **uno de los dos
  ejes**, y solo no cierra el cuadro.
- **Es inflable.** Un feriante puede apretar su propio botón. Se engaña a sí
  mismo y a nadie más; detectarlo pediría identificar al visitante, que es lo
  que no queremos. Se acepta.

---

## 5. Qué puede decir Migue con esto solo

- «Esta semana te abrieron la vidriera 40 veces, el doble que la anterior.»
- «De las consultas de este mes, 7 de cada 10 fueron por el pan de campo.»
- «Tenés 14 productos cargados y 11 no recibieron ni una consulta en 30 días.»
- «El bolso de cuero es lo que más te consultan y lo tenés sin foto.»

Lo que **no** puede decir todavía, y es la mitad buena: si lo que te consultan es
lo que te compran. Eso necesita el conteo de jornada —llevé 20, volví con 3— y
es la conversación siguiente.

---

## 6. Riesgos, y qué contiene cada uno

| riesgo | qué lo contiene |
|---|---|
| El contador rompe la vidriera | `after()` + `try`/`catch`: la respuesta ya salió cuando se escribe |
| Bots inflan el denominador | filtro de user agent y descarte de prefetch |
| Una escritura por visita | una fila por día, `upsert` con `increment`; el volumen de FerIA no lo nota |
| «Nos están midiendo» | no hay cookie ni identificador, y este documento está en el repositorio público |
| Dato que nadie usa | si en dos meses nadie mira la pantalla, se borran dos tablas y listo |

---

## 7. Orden de trabajo

1. Migración con las dos tablas.
2. `src/lib/interes.ts` — registrar apertura, registrar consulta, leer resumen.
3. `after()` en `/stands/[slug]`, con el filtro de prefetch y de bots.
4. `POST /api/interes` y el enlace de consulta como componente de cliente.
5. Pantalla mínima en `/mi-stand`, para que el feriante lo vea desde el día uno.
6. Más adelante: Migue lee el resumen.

---

## Decisiones tomadas

- Contador **diario agregado**, no registro por evento.
- Sin cookie, sin identificador, sin IP, sin consentimiento que pedir.
- **Beacon** y no redirector, para no dejar que los bots aplanen la señal.
- La consulta por producto es la señal; la apertura del stand es el denominador.
- Borrar un producto borra sus contadores (`Cascade`). Si alguna vez se quiere
  conservar la historia de un producto borrado, se hace como en `ItemPedido`:
  `productoId` nullable con `SetNull` y copia del nombre.
- **Sin interruptor de entorno.** `PERMITIR_PRECIOS`, `PERMITIR_PEDIDOS` y
  `MOSTRAR_CANON` existen porque cada uno espera una decisión de política. Acá
  no hay nada que decidir ni nada nuevo que publicar: se cuenta lo que ya pasa,
  en agregado y sin identificar a nadie.

## Decidido el 3/11/2026, después de escribir esto

- **Los números son del feriante.** Ve los suyos, y nadie ve el detalle de una
  persona. Si alguna vez la Dirección mira esto, mira agregados por feria.
- **No hay devolución hasta juntar un mes.** Se cuenta desde el día uno, pero la
  pantalla no saca conclusiones con cuatro días de datos: una devolución armada
  sobre ruido se gasta de entrada la confianza del feriante, y es la única que
  hay.

Eso dejaba un hueco —un contador que nadie mira durante treinta días es un
contador que nadie nota cuando se rompe— y lo tapa una pantalla que **informa
sin opinar** desde el primer día: «estamos contando; tu primer resumen el 3 de
diciembre». De paso evita la otra incomodidad, que al feriante le aparezca un
buen día un panel diciéndole hace cuánto lo miran sin que nadie le hubiera
avisado.

El mes se cuenta desde el primer día con registros **de toda la plataforma** y
no de cada stand: si no, una vidriera que recibe su primera visita el día 25
volvería a empezar el mes de cero y no llegaría nunca a la devolución.

---

## Cómo quedó

Implementado el mismo día. Lo que hay que saber para leerlo:

| pieza | dónde |
|---|---|
| Las dos tablas | `prisma/migrations/20261103120000_interes_en_la_vidriera` |
| Contar y resumir | `src/lib/interes.ts` |
| Quién cuenta como persona | `src/lib/visitas.ts` y su prueba |
| El aviso del clic | `src/components/public/enlace-consulta.tsx` → `POST /api/interes` |
| La apertura | `after()` en `/stands/[slug]` |
| La pantalla del feriante | `src/components/vendedor/interes-en-la-vidriera.tsx` |

El filtro de prefetch y de bots vive aparte, en `visitas.ts`, porque es lógica
pura y se puede probar sin levantar una base —el mismo motivo por el que
`ruta-publica.ts` vive separado de su ruta—. Es lo único de todo esto que tiene
pruebas, y es lo que las necesita: el contador siempre devuelve un número, y uno
inflado parejo por prefetch se lee igual que uno bueno.
