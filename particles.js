//
// Avanserte partikler ved treff
// - Fargede støvpartikler basert på mynttype
// - Glød-flash
// - Fading, tyngdekraft og hastighetsdemping
//

// Geometri deles mellom alle treff
const particleGeo = new THREE.SphereGeometry(0.022, 6, 6);
const flashGeo = new THREE.SphereGeometry(0.12, 12, 12);

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

// Alle støvpartiklene fader likt, så de kan dele ett materiale
const particleMat = new THREE.MeshBasicMaterial({
color: baseColor,
transparent: true,
opacity: 0.9
});

// Små partikler
const particles = [];
for (let i = 0; i < 28; i++) {
const p = new THREE.Mesh(particleGeo, particleMat);
p.position.copy(position);

// Tilfeldig retning – mest oppover og utover
p.velocity = new THREE.Vector3(
(Math.random() - 0.5) * 1.6,
0.6 + Math.random() * 1.4,
(Math.random() - 0.5) * 1.6
);

group.add(p);
particles.push(p);
}

// Glød-flash
const flashMat = new THREE.MeshBasicMaterial({
color: glowColor,
transparent: true,
opacity: 0.7
});

const flash = new THREE.Mesh(flashGeo, flashMat);
flash.position.copy(position);
group.add(flash);

scene.add(group);

// Livstid i sekunder (reell tid, uavhengig av bildefrekvens)
const lifetime = 0.6;
const startTime = performance.now();
let lastTime = startTime;

function animateParticles(now) {
const dt = Math.min((now - lastTime) / 1000, 0.05);
lastTime = now;
const t = Math.min(1, (now - startTime) / 1000 / lifetime);

const drag = frameDamping(0.92, dt);
particles.forEach(p => {
p.velocity.y += GRAVITY * 0.6 * dt;
p.velocity.multiplyScalar(drag);
p.position.addScaledVector(p.velocity, dt);

// Ikke under bakken
if (p.position.y < 0.01) p.position.y = 0.01;
});

// Fade ut
particleMat.opacity = 0.9 * (1 - t);
flashMat.opacity = 0.7 * (1 - t) * (1 - t);

if (t >= 1) {
scene.remove(group);
particleMat.dispose();
flashMat.dispose();
return;
}

requestAnimationFrame(animateParticles);
}

requestAnimationFrame(animateParticles);
}
