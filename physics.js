// Forbedret fysikkmotor for myntene i spillet

const GRAVITY = -9.82;

// Utfør ett fysikksteg
function applyPhysicsStep(dt, state) {
const { selectedCoinType, currentCoinMesh, velocity, rotVelocity } = state;
if (!currentCoinMesh || !selectedCoinType) return;

// Rotasjon – gradvis demping
currentCoinMesh.rotation.x += rotVelocity.x * dt;
currentCoinMesh.rotation.y += rotVelocity.y * dt;
currentCoinMesh.rotation.z += rotVelocity.z * dt;
rotVelocity.multiplyScalar(selectedCoinType.rot);

// Luftmotstand – realistisk demping
velocity.x *= selectedCoinType.air;
velocity.z *= selectedCoinType.air;

// Tyngdekraft – påvirkes av vekt
velocity.y += GRAVITY * selectedCoinType.weight * dt;

// Bevegelse
currentCoinMesh.position.addScaledVector(velocity, dt);
}

// Kollisjon med bakken
function handleGroundCollision(state, onSettled) {
const { selectedCoinType, currentCoinMesh, velocity, rotVelocity } = state;
if (!currentCoinMesh || !selectedCoinType) return;

const groundY = getCoinHeight(selectedCoinType) / 2;

if (currentCoinMesh.position.y <= groundY) {
currentCoinMesh.position.y = groundY;

// Sprett – lavere for tunge mynter
velocity.y = -velocity.y * selectedCoinType.bounce;

// Friksjon – realistisk glid
velocity.x *= selectedCoinType.friction;
velocity.z *= selectedCoinType.friction;

// Rotasjonsdemping ved treff
rotVelocity.multiplyScalar(0.85);

// Sjekk om mynten har stoppet
if (
Math.abs(velocity.y) < 0.05 &&
Math.abs(velocity.z) < 0.08 &&
Math.abs(velocity.x) < 0.08
) {
velocity.set(0, 0, 0);
rotVelocity.set(0, 0, 0);
onSettled();
}
}
}
