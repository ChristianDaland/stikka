//
// Avanserte partikler ved treff
// - Fargede støvpartikler basert på mynttype
// - Glød-flash
// - Fading og hastighetsdemping
//

function spawnParticles(scene, position, type) {
const group = new THREE.Group();

// Fargevalg basert på mynttype
const baseColor =
type === "plast" ? 0xffa64d :
type === "gull" ? 0xffd700 :
type === "sølv" ? 0xdfe6e9 :
type === "bronse" ? 0xcd7f32 :
0xaaaaaa;

const glowColor =
type === "gull" ? 0xfff4b2 :
type === "stål" ? 0x9fb3ff :
0xffffff;

// Små partikler
for (let i = 0; i < 28; i++) {
const geo = new THREE.SphereGeometry(0.012, 6, 6);
const mat = new THREE.MeshBasicMaterial({
color: baseColor,
transparent: true,
opacity: 0.9
});

const p = new THREE.Mesh(geo, mat);
p.position.copy(position);

// Tilfeldig retning
p.velocity = new THREE.Vector3(
(Math.random() - 0.5) * 0.5,
Math.random() * 0.7,
(Math.random() - 0.5) * 0.5
);

// Demping
p.decay = 0.9 + Math.random() * 0.08;

group.add(p);
}

// Glød-flash
const flashGeo = new THREE.SphereGeometry(0.08, 12, 12);
const flashMat = new THREE.MeshBasicMaterial({
color: glowColor,
transparent: true,
opacity: 0.7
});

const flash = new THREE.Mesh(flashGeo, flashMat);
flash.position.copy(position);
group.add(flash);

scene.add(group);

// Livstid
const lifetime = 0.5;
let elapsed = 0;

function animateParticles(dt) {
elapsed += dt;
const t = elapsed / lifetime;

group.children.forEach(p => {
if (p === flash) {
// Fade ut glød
flash.material.opacity = Math.max(0, 0.7 * (1 - t));
return;
}

// Bevegelse
p.position.addScaledVector(p.velocity, dt);

// Demp hastighet
p.velocity.multiplyScalar(p.decay);

// Fade ut
p.material.opacity = Math.max(0, p.material.opacity - dt * 2.0);
});

if (elapsed >= lifetime) {
scene.remove(group);
return;
}

requestAnimationFrame(() => animateParticles(0.016));
}

animateParticles(0.016);
}
