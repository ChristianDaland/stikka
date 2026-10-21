// Forbedret fysikkmotor for myntene i spillet

const GRAVITY = -9.82;

// Dempingsfaktorene i COIN_TYPES er angitt per bilde ved 60 FPS.
// Skaler dem etter dt slik at fysikken blir lik uansett oppdateringsfrekvens.
function frameDamping(factor, dt) {
return Math.pow(factor, dt * 60);
}

// Utfør ett fysikksteg
function applyPhysicsStep(dt, state) {
const { selectedCoinType, currentCoinMesh, velocity, rotVelocity } = state;
if (!currentCoinMesh || !selectedCoinType) return;

// Rotasjon – gradvis demping
currentCoinMesh.rotation.x += rotVelocity.x * dt;
currentCoinMesh.rotation.y += rotVelocity.y * dt;
currentCoinMesh.rotation.z += rotVelocity.z * dt;
rotVelocity.multiplyScalar(frameDamping(selectedCoinType.rot, dt));

// Luftmotstand – realistisk demping
const air = frameDamping(selectedCoinType.air, dt);
velocity.x *= air;
velocity.z *= air;

// Tyngdekraft – påvirkes av vekt
velocity.y += GRAVITY * selectedCoinType.weight * dt;

// Bevegelse
currentCoinMesh.position.addScaledVector(velocity, dt);
}

// Minste fallfart (m/s) som regnes som et treff med lyd og effekter
const IMPACT_MIN_SPEED = 1.0;

// Nærmeste vinkel der mynten ligger flatt (0, π, 2π …)
function flatAngle(angle) {
return Math.round(angle / Math.PI) * Math.PI;
}

// Kollisjon med bakken
// callbacks.onImpact(fart) kalles ved hvert treff, callbacks.onSettled når mynten har stoppet
function handleGroundCollision(dt, state, callbacks) {
const { selectedCoinType, currentCoinMesh, velocity, rotVelocity } = state;
if (!currentCoinMesh || !selectedCoinType) return;

const groundY = getCoinHeight(selectedCoinType) / 2;

if (currentCoinMesh.position.y <= groundY) {
currentCoinMesh.position.y = groundY;

const impactSpeed = -velocity.y;
if (impactSpeed > IMPACT_MIN_SPEED) callbacks.onImpact(impactSpeed);

// Sprett – lavere for tunge mynter
velocity.y = -velocity.y * selectedCoinType.bounce;

// Friksjon – realistisk glid
const friction = frameDamping(selectedCoinType.friction, dt);
velocity.x *= friction;
velocity.z *= friction;

// Rotasjonsdemping ved treff – velting dempes kraftig, snurring rundt y litt
rotVelocity.x *= frameDamping(0.6, dt);
rotVelocity.z *= frameDamping(0.6, dt);
rotVelocity.y *= frameDamping(0.85, dt);

// Mynten legger seg flatt mot bakken
const rot = currentCoinMesh.rotation;
const ease = 1 - frameDamping(0.75, dt);
rot.x += (flatAngle(rot.x) - rot.x) * ease;
rot.z += (flatAngle(rot.z) - rot.z) * ease;

// Sjekk om mynten har stoppet
if (
Math.abs(velocity.y) < 0.05 &&
Math.abs(velocity.z) < 0.08 &&
Math.abs(velocity.x) < 0.08
) {
velocity.set(0, 0, 0);
rotVelocity.set(0, 0, 0);
rot.x = flatAngle(rot.x);
rot.z = flatAngle(rot.z);
callbacks.onSettled();
}
}
}

// Kollisjon mellom mynter som ligger/glir på bakken (sirkel mot sirkel i x/z-planet)
// onHit(myntA, myntB, fart, kontaktpunkt) kalles for hvert nytt sammenstøt
function resolveCoinCollisions(coins, coinType, onHit) {
const minDist = coinType.radius * 2;
const maxDy = coinType.height * 1.5;   // En mynt i luften over en annen kolliderer ikke
const restitution = 0.5 + coinType.bounce;

for (let i = 0; i < coins.length; i++) {
for (let j = i + 1; j < coins.length; j++) {
const a = coins[i];
const b = coins[j];
if (Math.abs(a.position.y - b.position.y) > maxDy) continue;

const dx = b.position.x - a.position.x;
const dz = b.position.z - a.position.z;
const dist = Math.hypot(dx, dz);
if (dist >= minDist || dist === 0) continue;

const nx = dx / dist;
const nz = dz / dist;

// Skyv myntene fra hverandre så de ikke overlapper
const push = (minDist - dist) / 2;
a.position.x -= nx * push;
a.position.z -= nz * push;
b.position.x += nx * push;
b.position.z += nz * push;

// Relativ fart langs normalen – bare mynter som nærmer seg hverandre støter
const va = a.userData.velocity;
const vb = b.userData.velocity;
const relSpeed = (vb.x - va.x) * nx + (vb.z - va.z) * nz;
if (relSpeed >= 0) continue;

// Like tunge mynter: impulsen deles likt
const impulse = -(1 + restitution) * relSpeed / 2;
va.x -= impulse * nx;
va.z -= impulse * nz;
vb.x += impulse * nx;
vb.z += impulse * nz;

// Begge myntene kommer i bevegelse igjen
a.userData.settled = false;
b.userData.settled = false;

onHit(a, b, -relSpeed, {
x: a.position.x + nx * coinType.radius,
y: a.position.y,
z: a.position.z + nz * coinType.radius
});
}
}
}
