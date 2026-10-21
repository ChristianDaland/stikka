// Geometri deles mellom alle mynter av samme type, og materialer mellom
// alle mynter med samme type og spillerfarge, så minnet ikke fylles opp
const coinGeoCache = {};
const coinMatCache = {};

function getCoinGeometries(coinType) {
if (!coinGeoCache[coinType.id]) {
const r = coinType.radius;
coinGeoCache[coinType.id] = {
mainGeo: new THREE.CylinderGeometry(r, r, coinType.height, 48),
edgeGeo: new THREE.TorusGeometry(r * 0.98, coinType.edgeBevel, 12, 48),
topGeo: new THREE.CircleGeometry(r * 0.75, 32)
};
}
return coinGeoCache[coinType.id];
}

function getCoinMaterials(coinType, playerHex) {
const key = coinType.id + playerHex;
if (!coinMatCache[key]) {
const isPlastic = coinType.id === "plast";
const playerColor = new THREE.Color(playerHex);

coinMatCache[key] = {
// Selve mynten har mynttypens farge
mainMat: new THREE.MeshStandardMaterial({
color: coinType.color,
metalness: isPlastic ? 0.1 : 0.85,
roughness: isPlastic ? 0.4 : 0.25
}),

// Kant og preging har spillerens farge, så man ser hvem mynten tilhører.
// Litt glød gjør fargen synlig også langt unna og i skygge.
edgeMat: new THREE.MeshStandardMaterial({
color: playerColor,
emissive: playerColor,
emissiveIntensity: 0.3,
metalness: 0.4,
roughness: 0.5
}),
topMat: new THREE.MeshStandardMaterial({
color: playerColor,
emissive: playerColor,
emissiveIntensity: 0.25,
metalness: 0.4,
roughness: 0.5
})
};
}
return coinMatCache[key];
}

function createCoinMeshForType(coinType, playerHex) {
const h = coinType.height;
const bevel = coinType.edgeBevel;
const geo = getCoinGeometries(coinType);
const mat = getCoinMaterials(coinType, playerHex);

// Selve mynten (sylinder)
const mainMesh = new THREE.Mesh(geo.mainGeo, mat.mainMat);
mainMesh.castShadow = true;

// Kant-ring (tynn torus rundt)
const edgeMesh = new THREE.Mesh(geo.edgeGeo, mat.edgeMat);
edgeMesh.rotation.x = Math.PI / 2;
edgeMesh.position.y = h / 2 - bevel / 2;

// Preging (disk) i spillerens farge – på begge sider, siden mynten kan lande opp ned
const topMesh = new THREE.Mesh(geo.topGeo, mat.topMat);
topMesh.rotation.x = -Math.PI / 2;
topMesh.position.y = h / 2 + 0.0005;

const bottomMesh = new THREE.Mesh(geo.topGeo, mat.topMat);
bottomMesh.rotation.x = Math.PI / 2;
bottomMesh.position.y = -h / 2 - 0.0005;

// Gruppe
const group = new THREE.Group();
group.add(mainMesh);
group.add(edgeMesh);
group.add(topMesh);
group.add(bottomMesh);

return group;
}

function getCoinHeight(selectedCoinType) {
return selectedCoinType ? selectedCoinType.height : 0.05;
}
