//
// HOVEDSPILLET – binder sammen fysikk, UI, lyd, partikler og kamerabevegelse
//

let selectedCoinType = null;
let totalPlayers = 2;
let currentPlayerIndex = 0;
let coinCounts = [];
let roundDistances = [];
let activeCoinsInScene = [];
let roundStartPlayer = -1;   // Hvem som startet forrige runde
let roundOrder = [];         // Kasterekkefølgen i denne runden

let difficultyLevel = 0;   // 🔥 Gradvis økende vanskelighet
let STREK_Z = -12;         // Startposisjon for streken
const STREK_MIN_Z = -28;   // Lengst unna streken kan ligge (fullt kast når ca. -32)
const STREK_HALF_WIDTH = 2;   // Streken går fra x = -2 til x = 2

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

// Skyggekameraet må dekke hele kastebanen, ikke bare ±5 m rundt origo
sunLight.target.position.set(0, 0, -14);
sunLight.position.set(-15, 20, -9);
const shadowCam = sunLight.shadow.camera;
shadowCam.left = -22;
shadowCam.right = 22;
shadowCam.top = 22;
shadowCam.bottom = -22;
shadowCam.near = 1;
shadowCam.far = 70;
sunLight.shadow.bias = -0.0005;
scene.add(sunLight);
scene.add(sunLight.target);

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

// Lagene ligger under hverandre, fra bredest nederst til selve streken øverst
// (bakken y=0 → lys kant 0.002 → outline 0.003 → skygge 0.004 → strek)

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

// Lysere kant – bredere enn resten, så den synes rundt streken
const mainHighlight = new THREE.Mesh(
    new THREE.BoxGeometry(4.5, 0.001, 0.25),
    new THREE.MeshStandardMaterial({ color: 0xf6d9a3 })
);
mainHighlight.position.set(0, 0.002, STREK_Z);
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
outline.position.set(0, 0.003, STREK_Z);
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
// LEDER-MARKERING – ring på bakken rundt mynten som ligger nærmest streken
//
const LEADER_MARKER_Y = 0.02;   // Over strek-lagene (toppen av streken er 0.016)
const leaderMarker = new THREE.Mesh(
    new THREE.RingGeometry(0.36, 0.43, 40),
    new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        depthWrite: false
    })
);
leaderMarker.rotation.x = -Math.PI / 2;
leaderMarker.visible = false;
scene.add(leaderMarker);

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
let shakeDuration = 0.18;
let shakeIntensity = 0;
const shakeOffset = new THREE.Vector3();

function triggerCameraShake(intensity = 0.12, duration = 0.18) {
    shakeIntensity = intensity;
    shakeDuration = duration;
    shakeTime = duration;
}

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
    roundStartPlayer = -1; // Første runde starter med Spiller 1

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
    leaderMarker.visible = false;

    // 🔥 Øk vanskelighetsgrad for hver runde
    difficultyLevel++;

    // 🔥 Flytt streken gradvis lenger bort
    // Basis: -10 til -12
    // Økning per runde: 0.8 meter
    // Litt random variasjon: 0–2 meter
    // Maks STREK_MIN_Z, slik at streken blir liggende på veien og innen rekkevidde
    STREK_Z = Math.max(
        STREK_MIN_Z,
        (-10 - Math.random() * 2) - (difficultyLevel * 0.8)
    );

    // 🔥 Oppdater strek-objektene
    mainTrench.position.z = STREK_Z;
    mainHighlight.position.z = STREK_Z;
    mainShadow.position.z = STREK_Z;
    outline.position.z = STREK_Z;

    // Startspilleren går på rundgang, så ingen alltid kaster først (eller sist)
    const starter = nextPlayerWithCoins(roundStartPlayer);

    if (starter === -1) {
        alert("Ingen spillere har mynter igjen. Start på nytt.");
        document.getElementById('setup-modal').style.display = 'flex';
        return;
    }

    roundStartPlayer = starter;

    // Kasterekkefølgen for runden: fra startspilleren og rundt, bare de med mynter
    roundOrder = [];
    for (let k = 0; k < totalPlayers; k++) {
        const i = (starter + k) % totalPlayers;
        if (coinCounts[i] > 0) roundOrder.push(i);
    }

    currentPlayerIndex = starter;
    setupTurn();
}

// Neste spiller med mynter etter `after`, rundt bordet (-1 gir første spiller)
function nextPlayerWithCoins(after) {
    for (let k = 1; k <= totalPlayers; k++) {
        const i = (after + k) % totalPlayers;
        if (coinCounts[i] > 0) return i;
    }
    return -1;
}

// Neste spiller i runden som ikke har kastet ennå, eller -1
function nextPlayerInRound() {
    const pos = roundOrder.indexOf(currentPlayerIndex);
    for (let k = pos + 1; k < roundOrder.length; k++) {
        if (roundDistances[roundOrder[k]] === null) return roundOrder[k];
    }
    return -1;
}

// Hvem ligger nærmest streken nå? Ved likt vinner den som kastet først.
function findRoundLeader() {
    let leader = -1;
    roundOrder.forEach(i => {
        const d = roundDistances[i];
        if (d !== null && (leader === -1 || d < roundDistances[leader])) leader = i;
    });
    return leader;
}

function refreshScoreboard() {
    updateScoreboard(totalPlayers, currentPlayerIndex, coinCounts, roundDistances, findRoundLeader());
}

// Flytt ringen til mynten som leder runden
function updateLeaderMarker() {
    const leader = findRoundLeader();
    const coin = activeCoinsInScene.find(c => c.userData.playerIndex === leader);

    if (!coin) {
        leaderMarker.visible = false;
        return;
    }

    leaderMarker.position.set(coin.position.x, LEADER_MARKER_Y, coin.position.z);
    leaderMarker.material.color.set(PLAYER_CONFIGS[leader].hex);
    leaderMarker.visible = true;
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
    badge.style.color = readableTextColor(cfg.hex);

    coinCounts[currentPlayerIndex]--;

    currentCoinMesh = createCoinMeshForType(selectedCoinType, cfg.hex);
    currentCoinMesh.userData.playerIndex = currentPlayerIndex;
    currentCoinMesh.position.copy(startPos);
    scene.add(currentCoinMesh);
    activeCoinsInScene.push(currentCoinMesh);

    camera.position.copy(defaultCamPos);
    camera.lookAt(0, 0.8, -10);

    refreshScoreboard();
}


//
// 🎯 INPUT — MUS OG TOUCH (pointer events på selve canvaset)
// Klikk på knapper og paneler går dermed ikke til kastet.
//
const MIN_DRAG_PX = 12;   // Kortere drag bakover regnes som et vanlig klikk
const canvas = renderer.domElement;
let activePointerId = null;

function cancelDrag() {
    isDragging = false;
    activePointerId = null;
    aimDots.forEach(d => d.visible = false);
    setPowerBar(0);
}

canvas.addEventListener('pointerdown', (e) => {
    if (isThrown || isDragging || isChargingKey || !currentCoinMesh || !e.isPrimary) return;

    isDragging = true;
    activePointerId = e.pointerId;
    canvas.setPointerCapture(e.pointerId);   // Får pointerup selv om man slipper utenfor vinduet
    dragStart = { x: e.clientX, y: e.clientY };
    dragCurrent = { x: e.clientX, y: e.clientY };
});

canvas.addEventListener('pointermove', (e) => {
    if (!isDragging || e.pointerId !== activePointerId) return;
    dragCurrent = { x: e.clientX, y: e.clientY };
    updateAimTrajectory();
});

canvas.addEventListener('pointerup', (e) => {
    if (!isDragging || e.pointerId !== activePointerId) return;

    if (dragCurrent.y - dragStart.y < MIN_DRAG_PX) {
        cancelDrag();
        return;
    }

    isDragging = false;
    activePointerId = null;
    const impulse = calculateMouseImpulse();
    playThrowSound(selectedCoinType);
    executeThrow(impulse);
});

canvas.addEventListener('pointercancel', (e) => {
    if (e.pointerId === activePointerId) cancelDrag();
});


//
// 🎯 INPUT — TASTATUR
//
window.addEventListener('keydown', (e) => {
    if (isThrown || isChargingKey || isDragging || !currentCoinMesh) return;

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
// FELLES KRAFTBEREGNING (0–100 %) – brukes av både mus og tastatur
// side: -1 (venstre) til 1 (høyre)
//
function powerToImpulse(power, side = 0) {
    const pct = Math.min(100, Math.max(0, power));
    const baseZ = (pct / 100) * 22 + 4;
    const powerZ = baseZ * selectedCoinType.powerMul;
    const powerY = powerZ * 0.22;
    const powerX = powerZ * side * 0.3;

    setPowerBar(pct);
    return new THREE.Vector3(powerX, powerY, -powerZ);
}

// Hvor langt man må dra for fullt kast
function maxDragDistance() {
    return Math.min(300, window.innerHeight * 0.4);
}


//
// BEREGN MUS-KAST
//
function calculateMouseImpulse() {
    const dx = dragStart.x - dragCurrent.x;
    const dy = dragCurrent.y - dragStart.y;
    const maxDrag = maxDragDistance();

    const power = (dy / maxDrag) * 100;
    const side = Math.min(1, Math.max(-1, dx / maxDrag));

    return powerToImpulse(power, side);
}


//
// BEREGN TASTATUR-KAST
//
function calculateKeyImpulse() {
    return powerToImpulse(keyPower);
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

    const air = frameDamping(selectedCoinType.air, dt);
    const friction = frameDamping(selectedCoinType.friction, dt);
    const groundY = getCoinHeight(selectedCoinType) / 2;

    for (let i = 0; i < aimDots.length; i++) {
        simVel.y += GRAVITY * selectedCoinType.weight * dt;
        simVel.x *= air;
        simVel.z *= air;

        simPos.addScaledVector(simVel, dt);

        if (simPos.y < groundY) {
            simPos.y = groundY;
            simVel.y = -simVel.y * selectedCoinType.bounce;
            simVel.x *= friction;
            simVel.z *= friction;
        }

        aimDots[i].position.copy(simPos);
        aimDots[i].visible = true;
    }
}
//
// UTFØR KAST
//
function executeThrow(impulse) {
    if (isThrown) return;
    isThrown = true;
    isDragging = false;
    isChargingKey = false;
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
// Avstand fra myntens sentrum til nærmeste punkt på streken (et linjestykke)
function checkDistance() {
    const pos = currentCoinMesh.position;
    const diffZ = pos.z - STREK_Z;
    const sideX = Math.max(0, Math.abs(pos.x) - STREK_HALF_WIDTH);
    const absCm = Math.round(Math.hypot(diffZ, sideX) * 100);
    roundDistances[currentPlayerIndex] = absCm;

    const sideText = sideX > 0 ? " (på siden)" : "";

    if (absCm === 0) {
        setDistanceText(`PERFEKT TREFF! (0 cm)`, "#2ecc71");
    } else if (diffZ > 0) {
        setDistanceText(`${absCm} cm for kort${sideText}`, "#e74c3c");
    } else {
        setDistanceText(`${absCm} cm for langt${sideText}`, "#e67e22");
    }

    updateLeaderMarker();
    refreshScoreboard();

    const btn = document.getElementById('next-btn');
    const hasMorePlayers = nextPlayerInRound() !== -1;

    btn.textContent = hasMorePlayers ? "Neste spiller" : "Kår rundevinner!";
    btn.style.display = 'inline-block';
}

//
// NESTE SPILLER / RUNDE
//
function nextTurn() {
    const nextIndex = nextPlayerInRound();

    if (nextIndex !== -1) {
        currentPlayerIndex = nextIndex;
        setupTurn();
    } else {
        const winnerIndex = findRoundLeader();
        const potSize = roundDistances.filter(d => d !== null).length;

        if (winnerIndex === -1) {
            alert("Ingen gyldige kast i runden.");
            startNewRound();
            return;
        }

        const bestDistance = roundDistances[winnerIndex];
        coinCounts[winnerIndex] += potSize;
        refreshScoreboard();

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

        handleGroundCollision(dt, {
            selectedCoinType,
            currentCoinMesh,
            velocity,
            rotVelocity
        }, {
            // Treff i bakken – effektene skaleres etter fallfarten
            onImpact: (speed) => {
                const strength = Math.min(1, speed / 6);

                playHitSound(selectedCoinType, strength);

                spawnParticles(
                    scene,
                    currentCoinMesh.position.clone(),
                    selectedCoinType.id
                );

                triggerCameraShake(
                    (selectedCoinType.weight > 1.0 ? 0.16 :
                    selectedCoinType.weight < 0.5 ? 0.08 :
                    0.12) * strength
                );
            },

            // Mynten ligger i ro
            onSettled: () => {
                isSettled = true;
                checkDistance();
            }
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

    // Leder-ringen pulserer svakt
    if (leaderMarker.visible) {
        leaderMarker.material.opacity = 0.6 + 0.3 * Math.sin(clock.elapsedTime * 5);
    }

    // Kamera-rystelser – legges på bare under tegningen, så kameraet ikke driver
    shakeOffset.set(0, 0, 0);
    if (shakeTime > 0) {
        const shakeStrength = shakeIntensity * (shakeTime / shakeDuration);
        shakeOffset.set(
            (Math.random() - 0.5) * shakeStrength,
            (Math.random() - 0.5) * shakeStrength * 0.5,
            0
        );
        shakeTime -= dt;
    }

    camera.position.add(shakeOffset);
    renderer.render(scene, camera);
    camera.position.sub(shakeOffset);
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
