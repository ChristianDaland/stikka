//
// Støv og grus ved treff
// - Små grus- og jordkorn som spruter opp og faller ned igjen
// - En myk støvsky som brer seg og forsvinner
// strength (0–1) styrer hvor mye det spruter
//

// Geometri og støvtekstur deles mellom alle treff
const grainGeo = new THREE.IcosahedronGeometry(1, 0);
let dustTexture = null;

function getDustTexture() {
if (!dustTexture) {
const size = 128;
const canvas = document.createElement('canvas');
canvas.width = canvas.height = size;
const ctx = canvas.getContext('2d');
const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
g.addColorStop(0, 'rgba(255,255,255,0.9)');
g.addColorStop(0.4, 'rgba(255,255,255,0.45)');
g.addColorStop(1, 'rgba(255,255,255,0)');
ctx.fillStyle = g;
ctx.fillRect(0, 0, size, size);
dustTexture = new THREE.CanvasTexture(canvas);
}
return dustTexture;
}

function spawnParticles(scene, position, strength = 1) {
const group = new THREE.Group();

// Grus i to nyanser – alle kornene fader likt, så de deler materiale per nyanse
const grainMats = [0x7d7264, 0xa59a88].map(hex => new THREE.MeshStandardMaterial({
color: srgbColor(hex),
roughness: 1,
transparent: true,
opacity: 1
}));

const grains = [];
const count = Math.round(6 + 18 * strength);
for (let i = 0; i < count; i++) {
const p = new THREE.Mesh(grainGeo, grainMats[i % 2]);
p.position.copy(position);
p.scale.setScalar(0.004 + Math.random() * 0.008);
p.rotation.set(Math.random() * 3, Math.random() * 3, 0);

// Tilfeldig retning – mest oppover og utover
const speed = 0.4 + strength * 1.4;
p.velocity = new THREE.Vector3(
(Math.random() - 0.5) * speed,
(0.4 + Math.random()) * speed,
(Math.random() - 0.5) * speed
);

group.add(p);
grains.push(p);
}

// Støvsky
const dustMat = new THREE.SpriteMaterial({
map: getDustTexture(),
color: srgbColor(0xb9ab92),
transparent: true,
opacity: 0.5 * strength,
depthWrite: false
});
const dust = new THREE.Sprite(dustMat);
dust.position.copy(position);
dust.position.y += 0.03;
group.add(dust);

scene.add(group);

// Livstid i sekunder (reell tid, uavhengig av bildefrekvens)
const lifetime = 1.1;
const startTime = performance.now();
let lastTime = startTime;
const dustSize = 0.25 + 0.6 * strength;

function animateParticles(now) {
const dt = Math.min((now - lastTime) / 1000, 0.05);
lastTime = now;
const t = Math.min(1, (now - startTime) / 1000 / lifetime);

const drag = frameDamping(0.95, dt);
grains.forEach(p => {
p.velocity.y += GRAVITY * dt;
p.velocity.multiplyScalar(drag);
p.position.addScaledVector(p.velocity, dt);

// Kornene blir liggende på bakken
if (p.position.y < 0.004) {
p.position.y = 0.004;
p.velocity.set(0, 0, 0);
}
});

// Kornene fader mot slutten, støvet brer seg og løser seg opp
const grainFade = Math.min(1, (1 - t) * 3);
grainMats.forEach(m => { m.opacity = grainFade; });

const ease = 1 - Math.pow(1 - t, 3);
dust.scale.setScalar(dustSize * (0.3 + ease));
dust.position.y += dt * 0.08;
dustMat.opacity = 0.5 * strength * (1 - t) * (1 - t);

if (t >= 1) {
scene.remove(group);
grainMats.forEach(m => m.dispose());
dustMat.dispose();
return;
}

requestAnimationFrame(animateParticles);
}

requestAnimationFrame(animateParticles);
}
