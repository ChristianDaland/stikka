//
// HOVEDSPILLET – binder sammen fysikk, UI, lyd, partikler og kamerabevegelse
//

let selectedCoinType = null;
let totalPlayers = 2;
let currentPlayerIndex = 0;
let coinCounts = [];
let roundDistances = [];
let activeCoinsInScene = [];

let difficultyLevel = 0;   // 🔥 Gradvis økende vanskelighet
let STREK_Z = -12;         // Startposisjon for streken

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.FogExp2(0x87ceeb, 0.015);

const camera = new THREE.PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);

const defaultCamPos = new THREE.Vector3(0, 2.5, 4.5);
camera.position.copy(defaultCamPos);
camera.lookAt(0, 0.8, -10);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Lys
scene.add(new THREE.AmbientLight(0xffffff, 0.5));

const sunLight = new THREE.DirectionalLight(0xfff2cc, 0.9);
sunLight.position.set(-15, 20, 5);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
scene.add(sunLight);

scene.add(new THREE.HemisphereLight(0x87ceeb, 0x5c8a4d, 0.6));

// Teksturer
const textureLoader = new THREE.TextureLoader();

// Grusvei
const gravelTex = textureLoader.load('textures/Gravel.jpg');
gravelTex.wrapS = gravelTex.wrapT = THREE.RepeatWrapping;
gravelTex.repeat.set(6, 40);

const road = new THREE.Mesh(
    new THREE.PlaneGeometry(6, 40),
    new THREE.MeshStandardMaterial({
        map: gravelTex,
        roughness: 1.0,
        bumpMap: gravelTex,
        bumpScale: 0.15
    })
);
road.rotation.x = -Math.PI / 2;
road.position.z = -15;
road.receiveShadow = true;
scene.add(road);

// Gress
const grassTex = textureLoader.load('textures/Grass.jpg');
grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping;
grassTex.repeat.set(50, 50);

const grass = new THREE.Mesh(
    new THREE.PlaneGeometry(100, 100),
    new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1.0 })
);
grass.rotation.x = -Math.PI / 2;
grass.position.y = -0.01;
grass.receiveShadow = true;
scene.add(grass);

//
// TYDELIG H-STREK
//

// Hovedstrek
const mainTrench = new THREE.Mesh(
    new THREE.BoxGeometry(4, 0.02, 0.15),
    new THREE.MeshStandardMaterial({
        color: 0x1a0f06,
        roughness: 0.85,
        metalness: 0.05,
        bumpMap: gravelTex,
        bumpScale: 0.15
    })
);
mainTrench.position.set(0, 0.006, STREK_Z);
scene.add(mainTrench);

// Lysere kant
const mainHighlight = new THREE.Mesh(
    new THREE.BoxGeometry(4, 0.001, 0.15),
    new THREE.MeshStandardMaterial({ color: 0xf6d9a3 })
);
mainHighlight.position.set(0, 0.008, STREK_Z);
scene.add(mainHighlight);

// Skygge
const mainShadow = new THREE.Mesh(
    new THREE.BoxGeometry(4.3, 0.001, 0.18),
    new THREE.MeshStandardMaterial({
        color: 0x000000,
        roughness: 1.0,
        transparent: true,
        opacity: 0.35
    })
);
mainShadow.position.set(0, 0.004, STREK_Z);
scene.add(mainShadow);

// Outline
const outline = new THREE.Mesh(
    new THREE.BoxGeometry(4.4, 0.001, 0.19),
    new THREE.MeshStandardMaterial({
        color: 0x000000,
        roughness: 1.0,
        transparent: true,
        opacity: 0.25
    })
);
outline.position.set(0, 0.009, STREK_Z);
scene.add(outline);

//
// SIKTEPRIKKER
//
const aimDots = [];
const aimDotGeo = new THREE.SphereGeometry(0.04, 8, 8);
const aimDotMat = new THREE.MeshBasicMaterial({ color: 0xf1c40f });

for (let i = 0; i < 20; i++) {
    const dot = new THREE.Mesh(aimDotGeo, aimDotMat);
    dot.visible = false;
    scene.add(dot);
    aimDots.push(dot);
}

//
// KASTLOGIKK – variabler
//
let currentCoinMesh = null;
const startPos = new THREE.Vector3(0, 0.05, 1.8);
let velocity = new THREE.Vector3();
let rotVelocity = new THREE.Vector3();

let isDragging = false;
let isChargingKey = false;
let keyPower = 0;
let isThrown = false;
let isSettled = false;
let dragStart = { x: 0, y: 0 };
let dragCurrent = { x: 0, y: 0 };

let shakeTime = 0;
let shakeIntensity = 0;

function triggerCameraShake(intensity = 0.12, duration = 0.18) {
    shakeIntensity = intensity;
    shakeTime = duration;
}

//
// 🔥 HOVEDMENY-KNAPP — CAPTURE-MODE FIX
//
const backBtn = document.getElementById('back-btn');

function stopAll(e) {
    e.stopPropagation();
    e.preventDefault();
}

// Stopper kast-hendelser, men lar klikk gå videre
['mousedown', 'mouseup', 'touchstart', 'touchend'].forEach(evt => {
    backBtn.addEventListener(evt, stopAll, true);
});
//
// START-KNAPP
//
document.getElementById('start-btn').addEventListener('click', () => {
    totalPlayers = parseInt(document.getElementById('player-count-select').value, 10);
    selectedCoinType = COIN_TYPES[
        document.getElementById('coin-type-select').value
    ];

    document.getElementById('setup-modal').style.display = 'none';
    coinCounts = new Array(totalPlayers).fill(10);

    difficultyLevel = 0;   // 🔥 Nullstill vanskelighetsgrad ved nytt spill

    startNewRound();
});


//
// NESTE-KNAPP
//
document.getElementById('next-btn').addEventListener('click', () => {
    nextTurn();
});


//
// NY RUNDE
//
function startNewRound() {
    // Fjern gamle mynter
    activeCoinsInScene.forEach(c => scene.remove(c));
    activeCoinsInScene = [];

    // Nullstill rundedata
    roundDistances = new Array(totalPlayers).fill(null);
    currentPlayerIndex = 0;

    // 🔥 Øk vanskelighetsgrad for hver runde
    difficultyLevel++;

    // 🔥 Flytt streken gradvis lenger bort
    // Basis: -10 til -12
    // Økning per runde: 0.8 meter
    // Litt random variasjon: ±0.5 meter
    STREK_Z = (-10 - Math.random() * 2) - (difficultyLevel * 0.8);

    // 🔥 Oppdater strek-objektene
    mainTrench.position.z = STREK_Z;
    mainHighlight.position.z = STREK_Z;
    mainShadow.position.z = STREK_Z;
    outline.position.z = STREK_Z;

    // Finn første spiller med mynter
    while (currentPlayerIndex < totalPlayers && coinCounts[currentPlayerIndex] <= 0) {
        currentPlayerIndex++;
    }

    if (currentPlayerIndex >= totalPlayers) {
        alert("Ingen spillere har mynter igjen. Start på nytt.");
        document.getElementById('setup-modal').style.display = 'flex';
        return;
    }

    setupTurn();
}


//
// SETT OPP SPILLERENS TUR
//
function setupTurn() {
    isThrown = false;
    isDragging = false;
    isChargingKey = false;
    isSettled = false;
    keyPower = 0;

    document.getElementById('next-btn').style.display = 'none';
    setDistanceText('-', "#f1c40f");
    setPowerBar(0);

    const cfg = PLAYER_CONFIGS[currentPlayerIndex];
    const badge = document.getElementById('player-badge');
    badge.textContent = cfg.name;
    badge.style.background = cfg.hex;
    badge.style.color = (currentPlayerIndex === 1 || currentPlayerIndex === 4) ? '#fff' : '#111';

    coinCounts[currentPlayerIndex]--;

    currentCoinMesh = createCoinMeshForType(selectedCoinType);
    currentCoinMesh.position.copy(startPos);
    scene.add(currentCoinMesh);
    activeCoinsInScene.push(currentCoinMesh);

    camera.position.copy(defaultCamPos);
    camera.lookAt(0, 0.8, -10);

    updateScoreboard(totalPlayers, currentPlayerIndex, coinCounts, roundDistances);
}


//
// 🎯 INPUT — MUS
//
window.addEventListener('mousedown', (e) => {
    if (isThrown || !currentCoinMesh) return;

    isDragging = true;
    dragStart = { x: e.clientX, y: e.clientY };
    dragCurrent = { x: e.clientX, y: e.clientY };
});

window.addEventListener('mousemove', (e) => {
    if (!isDragging || !currentCoinMesh) return;
    dragCurrent = { x: e.clientX, y: e.clientY };
    updateAimTrajectory();
});

window.addEventListener('mouseup', (e) => {
    if (!isDragging || !currentCoinMesh) return;

    isDragging = false;
    const impulse = calculateMouseImpulse();
    playThrowSound(selectedCoinType);
    executeThrow(impulse);
});


//
// 🎯 INPUT — TOUCH
//
window.addEventListener('touchstart', (e) => {
    if (isThrown || !currentCoinMesh) return;

    isDragging = true;
    const touch = e.touches[0];
    dragStart = { x: touch.clientX, y: touch.clientY };
    dragCurrent = { x: touch.clientX, y: touch.clientY };
});

window.addEventListener('touchmove', (e) => {
    if (!isDragging || !currentCoinMesh) return;

    const touch = e.touches[0];
    dragCurrent = { x: touch.clientX, y: touch.clientY };
    updateAimTrajectory();
});

window.addEventListener('touchend', (e) => {
    if (!isDragging || !currentCoinMesh) return;

    isDragging = false;
    const impulse = calculateMouseImpulse();
    playThrowSound(selectedCoinType);
    executeThrow(impulse);
});


//
// 🎯 INPUT — TASTATUR
//
window.addEventListener('keydown', (e) => {
    if (isThrown || isChargingKey || !currentCoinMesh) return;

    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        isChargingKey = true;
    }
});

window.addEventListener('keyup', (e) => {
    if (!isChargingKey || !currentCoinMesh) return;

    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        isChargingKey = false;

        const impulse = calculateKeyImpulse();
        keyPower = 0;

        playThrowSound(selectedCoinType);
        executeThrow(impulse);
    }
});


//
// BEREGN MUS-KAST
//
function calculateMouseImpulse() {
    const dx = dragStart.x - dragCurrent.x;
    const dy = dragCurrent.y - dragStart.y;

    const baseZ = dy * 0.55;
    const baseY = dy * 0.22;

    const powerZ = Math.max(0.8, baseZ * selectedCoinType.powerMul);
    const powerY = Math.max(1.2, baseY * selectedCoinType.powerMul);
    const powerX = dx * 0.15 * selectedCoinType.powerMul;

    setPowerBar((powerZ / 25) * 100);
    return new THREE.Vector3(powerX, powerY, -powerZ);
}


//
// BEREGN TASTATUR-KAST
//
function calculateKeyImpulse() {
    const baseZ = (keyPower / 100) * 22 + 4;
    const powerZ = baseZ * selectedCoinType.powerMul;
    const powerY = powerZ * 0.22;

    setPowerBar(keyPower);
    return new THREE.Vector3(0, powerY, -powerZ);
}


//
// OPPDATER SIKTEKURVE
//
function updateAimTrajectory() {
    if (!currentCoinMesh || !selectedCoinType) return;

    const impulse = calculateMouseImpulse();
    let simPos = currentCoinMesh.position.clone();
    let simVel = impulse.clone();
    const dt = 0.04;

    for (let i = 0; i < aimDots.length; i++) {
        simVel.y += GRAVITY * selectedCoinType.weight * dt;
        simVel.x *= selectedCoinType.air;
        simVel.z *= selectedCoinType.air;

        simPos.addScaledVector(simVel, dt);

        const groundY = getCoinHeight(selectedCoinType) / 2;
        if (simPos.y < groundY) {
            simPos.y = groundY;
            simVel.y = -simVel.y * selectedCoinType.bounce;
            simVel.x *= selectedCoinType.friction;
            simVel.z *= selectedCoinType.friction;
        }

        aimDots[i].position.copy(simPos);
        aimDots[i].visible = true;
    }
}
//
// UTFØR KAST
//
function executeThrow(impulse) {
    isThrown = true;
    aimDots.forEach(d => d.visible = false);
    velocity.copy(impulse);
    rotVelocity.set(
        (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 8,
        12
    );
}

//
// AVSTANDSMÅLING
//
function checkDistance() {
    const diffZ = currentCoinMesh.position.z - STREK_Z;
    const cm = Math.round(diffZ * 100);
    const absCm = Math.abs(cm);
    roundDistances[currentPlayerIndex] = absCm;

    if (absCm === 0) {
        setDistanceText(`PERFEKT TREFF! (0 cm)`, "#2ecc71");
    } else if (cm > 0) {
        setDistanceText(`${cm} cm for kort`, "#e74c3c");
    } else {
        setDistanceText(`${absCm} cm for langt`, "#e67e22");
    }

    const btn = document.getElementById('next-btn');
    let hasMorePlayers = false;

    for (let i = currentPlayerIndex + 1; i < totalPlayers; i++) {
        if (coinCounts[i] > 0 && roundDistances[i] === null) {
            hasMorePlayers = true;
            break;
        }
    }

    btn.textContent = hasMorePlayers ? "Neste spiller" : "Kår rundevinner!";
    btn.style.display = 'inline-block';
}

//
// NESTE SPILLER / RUNDE
//
function nextTurn() {
    let nextIndex = -1;

    for (let i = currentPlayerIndex + 1; i < totalPlayers; i++) {
        if (coinCounts[i] > 0 && roundDistances[i] === null) {
            nextIndex = i;
            break;
        }
    }

    if (nextIndex !== -1) {
        currentPlayerIndex = nextIndex;
        setupTurn();
    } else {
        let bestDistance = Infinity;
        let winnerIndex = -1;
        let potSize = 0;

        for (let i = 0; i < totalPlayers; i++) {
            if (roundDistances[i] !== null) {
                potSize++;
                if (roundDistances[i] < bestDistance) {
                    bestDistance = roundDistances[i];
                    winnerIndex = i;
                }
            }
        }

        if (winnerIndex === -1) {
            alert("Ingen gyldige kast i runden.");
            startNewRound();
            return;
        }

        coinCounts[winnerIndex] += potSize;
        updateScoreboard(totalPlayers, currentPlayerIndex, coinCounts, roundDistances);

        alert(`${PLAYER_CONFIGS[winnerIndex].name} var nærmest streken (${bestDistance} cm) og vinner ${potSize} mynter!`);

        const activePlayersCount = coinCounts.filter(c => c > 0).length;

        if (activePlayersCount <= 1) {
            const overallWinner = coinCounts.findIndex(c => c > 0);
            alert(`GAME OVER!\n${PLAYER_CONFIGS[overallWinner].name} har samlet alle myntene og vunnet spillet!`);
            document.getElementById('setup-modal').style.display = 'flex';
        } else {
            startNewRound();
        }
    }
}

//
// ANIMASJON OG FYSIKK
//
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);

    const dt = Math.min(clock.getDelta(), 0.05);

    // Lading av tastaturkast
    if (isChargingKey && !isThrown) {
        keyPower = (keyPower + dt * 120) % 100;
        setPowerBar(keyPower);
    }

    // Fysikk når mynten er kastet
    if (isThrown && !isSettled && currentCoinMesh) {

        applyPhysicsStep(dt, {
            selectedCoinType,
            currentCoinMesh,
            velocity,
            rotVelocity
        });

        handleGroundCollision({
            selectedCoinType,
            currentCoinMesh,
            velocity,
            rotVelocity
        }, () => {

            playHitSound(selectedCoinType);

            spawnParticles(
                scene,
                currentCoinMesh.position.clone(),
                selectedCoinType.name.toLowerCase()
            );

            triggerCameraShake(
                selectedCoinType.weight > 1.0 ? 0.16 :
                selectedCoinType.weight < 0.5 ? 0.08 :
                0.12
            );

            isSettled = true;
            checkDistance();
        });

        // Kamera følger mynten
        const targetCamZ = Math.min(defaultCamPos.z, currentCoinMesh.position.z + 3.5);
        camera.position.z += (targetCamZ - camera.position.z) * 0.08;

        camera.lookAt(
            currentCoinMesh.position.x * 0.3,
            0.5,
            currentCoinMesh.position.z
        );
    }

    // Kamera-rystelser
    if (shakeTime > 0) {
        const shakeStrength = shakeIntensity * (shakeTime / 0.18);
        camera.position.x += (Math.random() - 0.5) * shakeStrength;
        camera.position.y += (Math.random() - 0.5) * shakeStrength * 0.5;
        shakeTime -= dt;
    }

    renderer.render(scene, camera);
}

animate();

//
// VINDUSTILPASNING
//
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

//
// 🔥 HOVEDMENY-KNAPP — NAVIGERER TIL HOVEDSIDEN
//
document.getElementById('back-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();

    window.location.href = "https://daland.neocities.org/";
});
