// Myntmodeller: avrundet kropp med opphøyd rand, preget motiv på begge sider
// og emaljering i spillerens farge.
// Geometri deles per mynttype, materialer per mynttype + spillerfarge.
const coinGeoCache = {};
const coinBodyMatCache = {};
const coinFaceMatCache = {};

// Profilen til mynten: fra kanten av preget ut til randen og rundt kanten
function createCoinBodyGeometry(coinType) {
const r = coinType.radius;
const t = coinType.height / 2;
const rim = r * 0.13;          // Bredden på den opphøyde randen
const depth = t * 0.22;        // Hvor dypt preget ligger under randen
const bevel = t * 0.45;        // Avrunding ytterst

const profile = [
[r - rim, t - depth],
[r - rim * 0.8, t],
[r - bevel, t],
[r - bevel * 0.3, t - bevel * 0.3],
[r, t - bevel],
[r, -t + bevel],
[r - bevel * 0.3, -t + bevel * 0.3],
[r - bevel, -t],
[r - rim * 0.8, -t],
[r - rim, -t + depth]
].map(([x, y]) => new THREE.Vector2(x, y)).reverse();   // Nedenfra og opp gir normaler som peker utover

return new THREE.LatheGeometry(profile, 64);
}

function getCoinGeometries(coinType) {
if (!coinGeoCache[coinType.id]) {
const r = coinType.radius;
coinGeoCache[coinType.id] = {
body: createCoinBodyGeometry(coinType),
face: new THREE.CircleGeometry(r * 0.87 + 0.0005, 64),
faceY: coinType.height / 2 * (1 - 0.22)
};
}
return coinGeoCache[coinType.id];
}

function getCoinBodyMaterial(coinType) {
if (!coinBodyMatCache[coinType.id]) {
coinBodyMatCache[coinType.id] = new THREE.MeshStandardMaterial({
color: srgbColor(coinType.color),
metalness: coinType.metalness,
roughness: coinType.roughness
});
}
return coinBodyMatCache[coinType.id];
}

function hexString(hex) {
return '#' + hex.toString(16).padStart(6, '0');
}

// Tegner motivet på mynten: perlekant, tekst rundt og et stort ettall i midten.
// fill = farge på det som er opphøyd, i hver av de tre teksturene.
function drawCoinRelief(ctx, size, fill) {
const c = size / 2;
ctx.fillStyle = fill;
ctx.strokeStyle = fill;

// Perlekant
for (let i = 0; i < 72; i++) {
const a = (i / 72) * Math.PI * 2;
ctx.beginPath();
ctx.arc(c + Math.cos(a) * size * 0.465, c + Math.sin(a) * size * 0.465, size * 0.009, 0, Math.PI * 2);
ctx.fill();
}

// Tekst langs kanten
const text = 'KASTE PÅ STIKKA ✦ KASTE PÅ STIKKA ✦ ';
ctx.font = `bold ${Math.round(size * 0.058)}px Georgia, serif`;
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
for (let i = 0; i < text.length; i++) {
const a = (i / text.length) * Math.PI * 2 - Math.PI / 2;
ctx.save();
ctx.translate(c + Math.cos(a) * size * 0.4, c + Math.sin(a) * size * 0.4);
ctx.rotate(a + Math.PI / 2);
ctx.fillText(text[i], 0, 0);
ctx.restore();
}

// Indre ring rundt emaljen
ctx.lineWidth = size * 0.012;
ctx.beginPath();
ctx.arc(c, c, size * 0.335, 0, Math.PI * 2);
ctx.stroke();

// Tallet i midten
ctx.font = `bold ${Math.round(size * 0.26)}px Georgia, serif`;
ctx.fillText('1', c, c + size * 0.01);
}

const ENAMEL_OUTER = 0.32;
const ENAMEL_INNER = 0.22;

function drawEnamelRing(ctx, size, fill) {
const c = size / 2;
ctx.fillStyle = fill;
ctx.beginPath();
ctx.arc(c, c, size * ENAMEL_OUTER, 0, Math.PI * 2);
ctx.arc(c, c, size * ENAMEL_INNER, 0, Math.PI * 2, true);
ctx.fill();
}

function canvasTexture(canvas, isColor) {
const tex = new THREE.CanvasTexture(canvas);
if (isColor) tex.encoding = THREE.sRGBEncoding;
tex.anisotropy = 8;
return tex;
}

function getCoinFaceMaterial(coinType, playerHex) {
const key = coinType.id + playerHex;
if (coinFaceMatCache[key]) return coinFaceMatCache[key];

const size = 512;
const make = () => {
const canvas = document.createElement('canvas');
canvas.width = canvas.height = size;
return [canvas, canvas.getContext('2d')];
};

// Farge: litt mørkere bunn (patina), lysere opphøyde detaljer, emalje i spillerfarge
const [colorCanvas, color] = make();
const base = new THREE.Color(coinType.color);
color.fillStyle = '#' + base.clone().multiplyScalar(0.82).getHexString();
color.fillRect(0, 0, size, size);
drawCoinRelief(color, size, hexString(coinType.color));
drawEnamelRing(color, size, playerHex);

// Høyde: grå bunn, hvite detaljer, emaljen litt nedsenket
const [bumpCanvas, bump] = make();
bump.fillStyle = '#808080';
bump.fillRect(0, 0, size, size);
drawEnamelRing(bump, size, '#6a6a6a');
drawCoinRelief(bump, size, '#ffffff');
if ('filter' in bump) {
// Mykere kanter på preget
const soft = make();
soft[1].filter = 'blur(1.5px)';
soft[1].drawImage(bumpCanvas, 0, 0);
bump.drawImage(soft[0], 0, 0);
}

// Ruhet (grønn) og metall (blå): metall overalt unntatt emaljen
const [mrCanvas, mr] = make();
const metal = Math.round(coinType.metalness * 255);
mr.fillStyle = `rgb(0, ${Math.round(coinType.roughness * 255)}, ${metal})`;
mr.fillRect(0, 0, size, size);
drawEnamelRing(mr, size, 'rgb(0, 90, 0)');

const roughMetal = canvasTexture(mrCanvas, false);
coinFaceMatCache[key] = new THREE.MeshStandardMaterial({
map: canvasTexture(colorCanvas, true),
bumpMap: canvasTexture(bumpCanvas, false),
bumpScale: 0.012,
roughnessMap: roughMetal,
metalnessMap: roughMetal,
roughness: 1,
metalness: 1
});
return coinFaceMatCache[key];
}

function createCoinMeshForType(coinType, playerHex) {
const geo = getCoinGeometries(coinType);
const faceMat = getCoinFaceMaterial(coinType, playerHex);

const body = new THREE.Mesh(geo.body, getCoinBodyMaterial(coinType));
body.castShadow = true;
body.receiveShadow = true;

// Preg på begge sider, siden mynten kan lande opp ned
const top = new THREE.Mesh(geo.face, faceMat);
top.rotation.x = -Math.PI / 2;
top.position.y = geo.faceY;
top.castShadow = true;
top.receiveShadow = true;

const bottom = new THREE.Mesh(geo.face, faceMat);
bottom.rotation.x = Math.PI / 2;
bottom.scale.x = -1;   // Ikke speilvendt sett nedenfra
bottom.position.y = -geo.faceY;
bottom.castShadow = true;

// Gruppe
const group = new THREE.Group();
group.add(body);
group.add(top);
group.add(bottom);

return group;
}

function getCoinHeight(selectedCoinType) {
return selectedCoinType ? selectedCoinType.height : 0.05;
}

//
// KONTAKTSKYGGE – myk mørk flekk under mynten når den er nær bakken
//
let contactShadowTex = null;

function getContactShadowTexture() {
if (!contactShadowTex) {
const size = 128;
const canvas = document.createElement('canvas');
canvas.width = canvas.height = size;
const ctx = canvas.getContext('2d');
const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
// Myntkanten ligger ved ca. 60 % av radien
g.addColorStop(0, 'rgba(0,0,0,0.9)');
g.addColorStop(0.55, 'rgba(0,0,0,0.75)');
g.addColorStop(0.75, 'rgba(0,0,0,0.3)');
g.addColorStop(1, 'rgba(0,0,0,0)');
ctx.fillStyle = g;
ctx.fillRect(0, 0, size, size);
contactShadowTex = new THREE.CanvasTexture(canvas);
}
return contactShadowTex;
}

function createContactShadow(coinType) {
const size = coinType.radius * 3.4;
const shadow = new THREE.Mesh(
new THREE.PlaneGeometry(size, size),
new THREE.MeshBasicMaterial({
map: getContactShadowTexture(),
transparent: true,
depthWrite: false,
polygonOffset: true,
polygonOffsetFactor: -3,
polygonOffsetUnits: -3
})
);
shadow.rotation.x = -Math.PI / 2;
return shadow;
}

// Flekken blir svakere og større jo høyere mynten er
function updateContactShadow(coin, coinType) {
const shadow = coin.userData.contactShadow;
if (!shadow) return;

const height = Math.max(0, coin.position.y - coinType.height / 2);
shadow.position.set(coin.position.x, 0.003, coin.position.z);
shadow.scale.setScalar(1 + height * 1.5);
shadow.material.opacity = 0.7 * Math.max(0, 1 - height * 2.5);
}

function removeContactShadow(coin) {
const shadow = coin.userData.contactShadow;
if (!shadow) return;
shadow.parent && shadow.parent.remove(shadow);
shadow.geometry.dispose();
shadow.material.dispose();
}
