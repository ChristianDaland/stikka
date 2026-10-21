function createCoinMeshForType(coinType) {
const r = coinType.radius;
const h = coinType.height;
const bevel = coinType.edgeBevel;

// Selve mynten (sylinder)
const mainGeo = new THREE.CylinderGeometry(r, r, h, 48);
const mainMat = new THREE.MeshStandardMaterial({
color: coinType.color,
metalness: coinType.name === "Plastmynt" ? 0.1 : 0.85,
roughness: coinType.name === "Plastmynt" ? 0.4 : 0.25
});
const mainMesh = new THREE.Mesh(mainGeo, mainMat);
mainMesh.castShadow = true;

// Kant-ring (tynn torus rundt)
const edgeGeo = new THREE.TorusGeometry(r * 0.98, bevel, 12, 48);
const edgeMat = new THREE.MeshStandardMaterial({
color: 0x000000,
metalness: 0.6,
roughness: 0.4
});
const edgeMesh = new THREE.Mesh(edgeGeo, edgeMat);
edgeMesh.rotation.x = Math.PI / 2;
edgeMesh.position.y = h / 2 - bevel / 2;

// Svak “preging” på toppen (disk)
const topGeo = new THREE.CircleGeometry(r * 0.7, 32);
const topMat = new THREE.MeshStandardMaterial({
color: coinType.color,
metalness: 0.9,
roughness: 0.35
});
const topMesh = new THREE.Mesh(topGeo, topMat);
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

