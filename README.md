# Backend del Admin HUD (roster de VRChat Groups)

Udon no puede leer VRChat Groups. Este script lo hace fuera de VRChat y publica `roster.json` en un host que los mundos pueden leer.

## Puesta en marcha (GitHub Actions + Pages)
1. Creá un repositorio con estos archivos (`build-roster.mjs`, `.github/workflows/roster.yml`). En *Settings → Pages* elegí **Source: GitHub Actions**.
2. Creá una cuenta de VRChat **dedicada** (no la tuya), agregala al grupo con un rol que pueda ver la lista de miembros, y obtené su cookie `auth` (login manual con 2FA; copiá el valor de la cookie `auth`).
3. *Settings → Secrets → Actions*: `VRC_AUTH_COOKIE`, `VRC_GROUP_ID` (grp_...), opcional `VRC_USER_AGENT` (identificable, con contacto) y `BANS_JSON` (contenido de tu lista de bans; máx. 48 KB).
4. Ejecutá el workflow una vez (*Run workflow*). La URL queda `https://TU-USUARIO.github.io/TU-REPO/roster.json`. Pegala en la ventana Admin HUD → *Roster y grupo*.
5. Los IDs de rol (`grol_...`) se ven en la respuesta de la API del grupo (`/groups/{id}/roles`) o en el propio `roster.json` (campo `r` de cada miembro). Pegalos en *Roles*.

## Perma Bans
Se registran en `bans.json` (ver `bans.example.json`) o en el secreto `BANS_JSON`. Campos: id, userId (estable), name, category, reason, date, by, evidence, status.
**Solo** `id`, `category` y dos hashes del nombre llegan a `roster.json`. Motivo, fecha, responsable y evidencia nunca se publican. Si el repo es público, usá `BANS_JSON` como Secret (no subas bans.json).
Los bans se resuelven por `userId` al nombre visible actual en cada ejecución, así que un cambio de nombre se actualiza solo (con el retraso de la caché).

## Modo manual (sin la API de VRChat)
`MANUAL_MEMBERS=miembros.json node build-roster.mjs` con `[{"n":"Nombre","r":["grol_..."]}]`. Subí `dist/roster.json` a cualquier host permitido.

## Avisos honestos
- La API de VRChat no es oficial; su uso automatizado puede violar los términos. Cuenta dedicada, pocas peticiones, plan B manual.
- Si la API falla, el script **conserva** el roster anterior (nunca publica uno vacío).
- GitHub Pages cachea unos minutos: un cambio de rol tarda en llegar (cron 10 min + caché + refresco del mundo).
- Todo lo que descarga el cliente es público: por eso solo hay nombres de miembros con IDs de rol y hashes de bans. Los hashes de un nombre corto pueden revertirse por fuerza bruta: no son secreto fuerte.
