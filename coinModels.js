// Geometri og materialer deles mellom alle mynter av samme type,
// så nye mynter ikke fyller opp minnet på skjermkortet
const coinPartsCache = {};

function getCoinParts(coinType) {
if (coinPartsCache[coinType.id]) return coinPartsCache[coinType.id];

const r = coinType.radius;
const bevel = coinType.edgeBevel;
const isPlastic = coinType.id === "plast";

const parts = {
// Selve mynten (sylinder)
mainGeo: new THREE.CylinderGeometry(r, r, coinType.height, 48),
mainMat: new THREE.MeshStandardMaterial({
color: coinType.color,
metalness: isPlastic ? 0.1 : 0.85,
roughness: isPlastic ? 0.4 : 0.25
}),

// Kant-ring (tynn torus rundt)
edgeGeo: new THREE.TorusGeometry(r * 0.98, bevel, 12, 48),
edgeMat: new THREE.MeshStandardMaterial({
color: 0x000000,
metalness: 0.6,
roughness: 0.4
}),

// Svak “preging” på toppen (disk)
topGeo: new THREE.CircleGeometry(r * 0.7, 32),
topMat: new THREE.MeshStandardMaterial({
color: coinType.color,
metalness: 0.9,
roughness: 0.35
})
};

coinPartsCache[coinType.id] = parts;
return parts;
}

function createCoinMeshForType(coinType) {
const h = coinType.height;
const bevel = coinType.edgeBevel;
const parts = getCoinParts(coinType);

const mainMesh = new THREE.Mesh(parts.mainGeo, parts.mainMat);
mainMesh.castShadow = true;

const edgeMesh = new THREE.Mesh(parts.edgeGeo, parts.edgeMat);
edgeMesh.rotation.x = Math.PI / 2;
edgeMesh.position.y = h / 2 - bevel / 2;

const topMesh = new THREE.Mesh(parts.topGeo, parts.topMat);
topMesh.rotation.x = -Math.PI / 2;
topMesh.position.y = h / 2 + 0.0005;

// Gruppe
const group = new THREE.Group();
group.add(mainMesh);
group.add(edgeMesh);
group.add(topMesh);

return group;
}

function getCoinHeight(selectedCoinType) {
return selectedCoinType ? selectedCoinType.height : 0.05;
}
