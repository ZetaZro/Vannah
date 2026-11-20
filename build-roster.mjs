// ZetaTools Admin HUD — generador de roster.json (se ejecuta FUERA de VRChat: GitHub Actions o tu PC)
// Lee el grupo de VRChat (miembros + IDs de rol) y los Perma Bans privados, y escribe dist/roster.json (público).
//
// Variables de entorno:
//   VRC_AUTH_COOKIE  valor de la cookie "auth" de una cuenta DEDICADA con permiso de ver miembros del grupo (SECRETO)
//   VRC_GROUP_ID     grp_xxxxxxxx-....
//   VRC_USER_AGENT   opcional, p. ej. "MiMundoAdmin/1.0 contacto@ejemplo.com" (VRChat exige un User-Agent identificable)
//   BANS_JSON        opcional: contenido de bans.json (para repos públicos, guardalo como Secret)  | si no, se lee ./bans.json
//   MANUAL_MEMBERS   opcional: ruta a un JSON [{"n":"Nombre","r":["grol_.."]}] para modo manual (sin API de VRChat)
//
// AVISO: la API de VRChat no es oficial/documentada por VRChat y su uso automatizado puede ir contra sus términos. Usá una cuenta dedicada,
// respetá los límites (este script es lento a propósito) y tené un plan B: el modo manual (MANUAL_MEMBERS).
import fs from "node:fs";

const API = "https://api.vrchat.cloud/api/1";
const UA = process.env.VRC_USER_AGENT || "ZetaToolsAdminHud/1.0";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- mismos hashes que ZetaAdminRoster.Hash1/Hash2 (FNV-1a 32 bit sobre unidades UTF-16 del nombre normalizado)
const norm = (s) => (s || "").trim().toLowerCase();
function hash1(s) { let h = 0x811c9dc5 | 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h | 0; }
function hash2(s) { let h = 0x1b873593 | 0; for (let i = 0; i < s.length; i++) { h ^= (s.charCodeAt(i) + 31); h = Math.imul(h, 16777619); } return h | 0; }

async function api(path) {
  const cookie = process.env.VRC_AUTH_COOKIE;
  if (!cookie) throw new Error("Falta VRC_AUTH_COOKIE");
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(API + path, { headers: { "User-Agent": UA, Cookie: cookie.startsWith("auth=") ? cookie : "auth=" + cookie } });
    if (res.status === 429) { await sleep(15000 * (attempt + 1)); continue; }
    if (res.status === 401) throw new Error("Cookie de VRChat vencida o inválida (401): renová VRC_AUTH_COOKIE");
    if (!res.ok) throw new Error(`HTTP ${res.status} en ${path}`);
    return res.json();
  }
  throw new Error("Demasiados reintentos (429) en " + path);
}

async function loadMembers() {
  if (process.env.MANUAL_MEMBERS) return JSON.parse(fs.readFileSync(process.env.MANUAL_MEMBERS, "utf8"));
  const gid = process.env.VRC_GROUP_ID; if (!gid) throw new Error("Falta VRC_GROUP_ID");
  const out = [];
  for (let off = 0; ; off += 100) {
    const page = await api(`/groups/${gid}/members?n=100&offset=${off}`);
    if (!Array.isArray(page) || page.length === 0) break;
    for (const m of page) {
      const name = m.user && m.user.displayName; if (!name) continue;
      out.push({ n: name, r: Array.isArray(m.roleIds) ? m.roleIds : [] });
    }
    if (page.length < 100) break;
    await sleep(1500);
  }
  return out;
}

function loadBans() {
  const raw = process.env.BANS_JSON || (fs.existsSync("bans.json") ? fs.readFileSync("bans.json", "utf8") : "[]");
  const list = JSON.parse(raw);
  return Array.isArray(list) ? list : [];
}

async function currentName(b) {
  // el nombre visible puede cambiar: se resuelve por userId (estable) cuando hay cookie; si falla, se usa el último nombre conocido
  if (!b.userId || !process.env.VRC_AUTH_COOKIE || process.env.MANUAL_MEMBERS) return b.name;
  try { const u = await api(`/users/${b.userId}`); await sleep(1200); return u.displayName || b.name; } catch (e) { console.warn("No se pudo resolver", b.userId, e.message); return b.name; }
}

const prev = fs.existsSync("dist/roster.json") ? JSON.parse(fs.readFileSync("dist/roster.json", "utf8")) : null;
let members;
try { members = await loadMembers(); }
catch (e) {
  // Si la API falla NO publicamos un roster vacío (dejaría a todos sin permisos): se conserva el anterior.
  console.error("ERROR leyendo el grupo:", e.message);
  if (prev) { console.error("Se conserva el roster anterior."); process.exit(0); }
  process.exit(1);
}

const bans = [];
for (const b of loadBans()) {
  if ((b.status || "active") !== "active") continue;
  const name = norm(await currentName(b)); if (!name) continue;
  bans.push({ id: b.id, h1: hash1(name), h2: hash2(name), c: String(b.category || "").slice(0, 40) });
  // el nombre anterior también cuenta (por si cambió a mitad)
  if (b.name && norm(b.name) !== name) bans.push({ id: b.id, h1: hash1(norm(b.name)), h2: hash2(norm(b.name)), c: String(b.category || "").slice(0, 40) });
}

const roster = { v: 1, gen: Math.floor(Date.now() / 1000), group: process.env.VRC_GROUP_ID || "", members, bans };
fs.mkdirSync("dist", { recursive: true });
fs.writeFileSync("dist/roster.json", JSON.stringify(roster));
console.log(`roster.json: ${members.length} miembros, ${bans.length} registros de ban`);
