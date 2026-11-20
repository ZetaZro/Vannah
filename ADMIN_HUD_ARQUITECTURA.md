# Admin HUD — viabilidad, arquitectura y límites

## 1. Qué permite realmente Udon (verificado)
- **No hay User IDs ni API de Groups en Udon.** La identidad dentro del mundo es el *displayName*. `isInstanceOwner` y `isMaster` sí existen.
- Se puede **descargar texto** (VRCStringDownloader) de hosts permitidos (*.github.io, gist.githubusercontent.com, pastebin.com, etc.), 1 descarga cada 5 s, solo lectura, URL fija al subir el mundo. Se parsea con VRCJson/DataDictionary.
- `[NetworkCallable]` + `NetworkCalling.CallingPlayer` (SDK 3.8.1+) entrega el emisor real de una llamada de red, fijado por el servidor.
- No se pueden escribir archivos ni llamar APIs externas desde el mundo. Persistencia de VRChat = datos por jugador, no una base compartida.

**Consecuencia:** los roles de grupo, los Perma Bans y su evidencia viven en un backend; el mundo solo **lee** una vista pública derivada.

## 2. Arquitectura
```
VRChat Group ──(API, cuenta dedicada)──► build-roster.mjs (GitHub Actions) ──► roster.json en GitHub Pages
bans.json / BANS_JSON (privado) ───────────────┘                                        │ (descarga, solo lectura)
                                                                                          ▼
 ZetaAdminRoster (cliente) → ZetaAdminCore (roles, permisos, jerarquía) → ZetaAdminHud / Nametags
                                   │ acciones: evento de red → SOLO el dueño (personal) valida a quien llamó y ejecuta
                                   ▼ estado sincronizado: cárcel, registros, alertas, máscara de etiquetas
```
- **roster.json** (público): `members[{n, r[roleIds]}]` y `bans[{id,h1,h2,c}]`. Nada de evidencia, motivo ni responsable.
- **Roles**: se calcula el de mayor nivel entre IDs de rol del grupo, dueño de la instancia (VRChat) y miembro del grupo. Todo se configura en Unity; el permiso va ligado al **ID de rol**, no al nombre del rol.
- **No existe** función para agregar administradores desde el HUD. Perder el rol en el grupo quita permisos en el siguiente roster verificado.

## 3. Jerarquía y permisos
Creator (protegido) > Group Owner > Admin > Instance Owner > Moderator > Group Member > User (niveles editables).
- Solo se actúa sobre rango **menor**; nunca contra el Creator ni contra uno mismo.
- Instance Owner: semi-admin; **sin** Perma Ban (ni proponer) y sin poder sobre el Creator.
- Cada acción tiene permiso propio (13 bits editables por rol). La regla se valida en la UI y **otra vez** en el dueño del sistema.

## 4. Almacenamiento y sincronización (comparación)
| Opción | Ventaja | Problema |
|---|---|---|
| GitHub JSON/Pages (elegida) | gratis, simple, sin servidor propio | solo lectura, caché de minutos, todo es público |
| API propia | escritura, privacidad fina | el mundo igual solo puede leer hosts permitidos; costo y mantenimiento |
| Persistencia de VRChat | nativa | por jugador, no compartida ni administrable |
| Híbrido (elegida de facto) | lectura pública mínima + backend privado para escritura | más piezas |

Escritura de Perma Bans: **fuera de VRChat** (commit a bans.json / secreto). Desde el HUD solo se puede dejar una *propuesta* registrada.
Estado en vivo (cárcel, logs, alertas, etiquetas): objeto Manual-sync cuyo dueño es siempre personal autorizado (`OnOwnershipRequest`). Los logs son anillos de 40/30 entradas y duran lo que dura la instancia.

## 5. Fallos del backend
Descarga con reintentos de espera creciente; se **conserva el último roster bueno**; estado visible (Resumen/Grupo). Caducidad opcional de los roles de grupo. Si nunca cargó: solo el dueño de la instancia y los *creators de emergencia* (opcional, por nombre). El script del backend no publica un roster vacío si falla la API.

## 6. Seguridad y límites (sin promesas falsas)
- Se valida en el receptor con `CallingPlayer`; los métodos de red son `[NetworkCallable]` y los internos empiezan con `_`. Ocultar botones es solo comodidad.
- Exploit: llamadas administrativas de alguien **sin** permiso de HUD (la UI oficial nunca las emite) se registran; al llegar al umbral en la ventana se re-verifica y se aplican las acciones elegidas (registrar, alertar, cárcel temporal, propuesta de Perma Ban). **Nunca** se aplica una sanción permanente por una sola llamada ni automáticamente.
- **No hay anti-hack perfecto:** un cliente modificado puede ignorar la cárcel local, ocultarse etiquetas o falsear su propia vista. Lo protegido es el estado compartido y la validación.
- Identidad por nombre: un cambio de nombre pierde privilegios hasta que el roster se actualice (falla cerrado). Nombres con homoglifos no heredan privilegios; para bans el fallo es abierto (no coincide). Los hashes de bans no son secreto fuerte.
- La API de VRChat usada por el backend es no oficial.
- Sin Quick Kick ni expulsión automática: los Perma Bans solo generan **alertas** al personal presente.

## 7. Uso
1. Importar el paquete. 2. Tools ▸ ZetaZero ▸ Worlds ▸ Admin HUD: URL del roster, IDs de rol por cada rol, permisos, cárcel, seguridad, etiquetas. 3. *Construir*. 4. Mover `Celda` y `Consola`. 5. En juego: Interact en la Consola o la tecla configurada (F10).
Secciones: Resumen, Jugadores, Cárcel (motivo, duración, confirmación en 2 toques, lista y liberación), Perma Ban (alertas + propuesta), Administración (solo lectura), Grupo (estado y roles vinculados, actualizar), Etiquetas (por tipo, global y local), Espejos (ON/OFF/calidad; el Mirror Planner está en Unity), Registros, Ajustes.
Todo el código es nuevo y **no se compiló en Unity** en esta entrega: si hay errores de compilación, mandame el texto de la consola.
