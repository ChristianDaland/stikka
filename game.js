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
// Hver mynt har egen fart i userData (velocity, rotVelocity, settled),
// slik at mynter som blir truffet også kan bevege seg
let knockedPlayers = new Set();   // Spillere som fikk mynten sin truffet i dette kastet

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
    clearRoundResult();

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
    keyAimSide = 0;

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
    currentCoinMesh.userData.velocity = new THREE.Vector3();
    currentCoinMesh.userData.rotVelocity = new THREE.Vector3();
    currentCoinMesh.userData.settled = false;
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
    updateAimTrajectory(calculateMouseImpulse());
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
const CHARGE_KEYS = ['Space', 'ArrowUp', 'KeyW'];
const AIM_LEFT_KEYS = ['ArrowLeft', 'KeyA'];
const AIM_RIGHT_KEYS = ['ArrowRight', 'KeyD'];
const AIM_SPEED = 0.5;   // Hvor fort siktet flytter seg (andel av maks per sekund)

let keyPowerDir = 1;      // Kraftmåleren går frem (1) og tilbake (-1)
let keyAimSide = 0;       // -1 (venstre) til 1 (høyre)
const heldAimKeys = new Set();

function isGameKey(code) {
    return CHARGE_KEYS.includes(code) || AIM_LEFT_KEYS.includes(code) || AIM_RIGHT_KEYS.includes(code);
}

function isSetupOpen() {
    return document.getElementById('setup-modal').style.display !== 'none';
}

window.addEventListener('keydown', (e) => {
    if (!isGameKey(e.code) || isSetupOpen()) return;

    // Hindrer at mellomrom/piltaster trykker på en knapp som har fokus, eller scroller
    e.preventDefault();

    if (AIM_LEFT_KEYS.includes(e.code) || AIM_RIGHT_KEYS.includes(e.code)) {
        heldAimKeys.add(e.code);
        return;
    }

    if (isThrown || isChargingKey || isDragging || !currentCoinMesh) return;

    isChargingKey = true;
    keyPower = 0;
    keyPowerDir = 1;
});

window.addEventListener('keyup', (e) => {
    if (!isGameKey(e.code) || isSetupOpen()) return;
    e.preventDefault();

    heldAimKeys.delete(e.code);

    if (!isChargingKey || !currentCoinMesh || !CHARGE_KEYS.includes(e.code)) return;

    isChargingKey = false;

    const impulse = calculateKeyImpulse();
    keyPower = 0;

    playThrowSound(selectedCoinType);
    executeThrow(impulse);
});

// Mister vinduet fokus, slippes alle sikte-taster
window.addEventListener('blur', () => heldAimKeys.clear());


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
    return powerToImpulse(keyPower, keyAimSide);
}


//
// OPPDATER SIKTEKURVE
//
function updateAimTrajectory(impulse) {
    if (!currentCoinMesh || !selectedCoinType) return;

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
    knockedPlayers.clear();
    currentCoinMesh.userData.velocity.copy(impulse);
    currentCoinMesh.userData.rotVelocity.set(
        (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 8,
        12
    );
}

//
// AVSTANDSMÅLING
//
// Avstand fra myntens sentrum til nærmeste punkt på streken (et linjestykke)
function distanceToStrek(pos) {
    const diffZ = pos.z - STREK_Z;
    const sideX = Math.max(0, Math.abs(pos.x) - STREK_HALF_WIDTH);
    return { diffZ, sideX, cm: Math.round(Math.hypot(diffZ, sideX) * 100) };
}

function checkDistance() {
    // Mål alle myntene på nytt – andre mynter kan ha blitt truffet og flyttet
    activeCoinsInScene.forEach(c => {
        roundDistances[c.userData.playerIndex] = distanceToStrek(c.position).cm;
    });

    const { diffZ, sideX, cm: absCm } = distanceToStrek(currentCoinMesh.position);
    const sideText = sideX > 0 ? " (på siden)" : "";

    let text, color;
    if (absCm === 0) {
        text = `PERFEKT TREFF! (0 cm)`;
        color = "#2ecc71";
    } else if (diffZ > 0) {
        text = `${absCm} cm for kort${sideText}`;
        color = "#e74c3c";
    } else {
        text = `${absCm} cm for langt${sideText}`;
        color = "#e67e22";
    }

    if (knockedPlayers.size > 0) {
        const names = [...knockedPlayers].map(i => PLAYER_CONFIGS[i].name).join(' og ');
        text += ` · traff mynten til ${names}!`;
    }
    setDistanceText(text, color);

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
        showRoundResult(winnerIndex, bestDistance, potSize);
    }
}

//
// RUNDERESULTAT – kameraet glir ned til streken og viser vinneren
//
const overviewCamPos = new THREE.Vector3();
const overviewLookTarget = new THREE.Vector3();
const overviewLook = new THREE.Vector3();
let overviewActive = false;

// Stripe på bakken fra vinnermynten til nærmeste punkt på streken
const measureLine = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
);
measureLine.visible = false;
scene.add(measureLine);

function showMeasureLine(coin, hex) {
    const from = coin.position;
    const toX = Math.min(STREK_HALF_WIDTH, Math.max(-STREK_HALF_WIDTH, from.x));
    const dx = toX - from.x;
    const dz = STREK_Z - from.z;
    const length = Math.hypot(dx, dz);

    measureLine.scale.set(0.04, 0.004, Math.max(length, 0.001));
    measureLine.position.set(from.x + dx / 2, LEADER_MARKER_Y, from.z + dz / 2);
    measureLine.rotation.y = Math.atan2(dx, dz);
    measureLine.material.color.set(hex);
    measureLine.visible = length > 0;
}

function showRoundResult(winnerIndex, bestDistance, potSize) {
    document.getElementById('next-btn').style.display = 'none';

    const winner = PLAYER_CONFIGS[winnerIndex];
    const winnerCoin = activeCoinsInScene.find(c => c.userData.playerIndex === winnerIndex);

    // Kameraet glir fra der det er til et punkt over vinnermynten og streken
    overviewLookTarget.set(winnerCoin.position.x / 2, 0, (winnerCoin.position.z + STREK_Z) / 2);
    overviewCamPos.copy(overviewLookTarget).add(new THREE.Vector3(0, 3.2, 4.2));
    overviewLook.set(currentCoinMesh.position.x * 0.3, 0.5, currentCoinMesh.position.z);
    overviewActive = true;

    showMeasureLine(winnerCoin, winner.hex);

    // Resultatliste, nærmest først
    const rows = roundOrder
        .filter(i => roundDistances[i] !== null)
        .sort((a, b) => roundDistances[a] - roundDistances[b])
        .map(i => ({
            name: PLAYER_CONFIGS[i].name,
            hex: PLAYER_CONFIGS[i].hex,
            value: `${roundDistances[i]} cm`,
            highlight: i === winnerIndex
        }));

    const subtitle = `${bestDistance} cm fra streken · vinner ${potSize} mynter`;
    const isGameOver = coinCounts.filter(c => c > 0).length <= 1;

    if (isGameOver) {
        const overallWinner = PLAYER_CONFIGS[coinCounts.findIndex(c => c > 0)];
        showRoundOverlay(
            `🏆 ${overallWinner.name} har vunnet spillet!`,
            `${winner.name}: ${subtitle}`,
            rows,
            "Nytt spill",
            () => {
                hideRoundOverlay();
                document.getElementById('setup-modal').style.display = 'flex';
            }
        );
    } else {
        showRoundOverlay(
            `${winner.name} vinner runden!`,
            subtitle,
            rows,
            "Neste runde",
            () => startNewRound()
        );
    }
}

// Skjul alt fra rundeoppsummeringen
function clearRoundResult() {
    hideRoundOverlay();
    overviewActive = false;
    measureLine.visible = false;
}

//
// FYSIKK FOR ALLE MYNTER I BEVEGELSE
//
const MAX_SUBSTEP_MOVE = 0.1;   // Maks forflytning per delsteg, så raske mynter ikke går gjennom andre
const MAX_SUBSTEPS = 12;

function stepCoins(dt) {
    const moving = activeCoinsInScene.filter(c => !c.userData.settled);
    if (moving.length === 0) return;

    const maxSpeed = Math.max(...moving.map(c => c.userData.velocity.length()));
    const substeps = Math.min(MAX_SUBSTEPS, Math.max(1, Math.ceil(maxSpeed * dt / MAX_SUBSTEP_MOVE)));
    const subDt = dt / substeps;

    for (let s = 0; s < substeps; s++) {
        activeCoinsInScene.forEach(coin => {
            if (coin.userData.settled) return;

            const state = {
                selectedCoinType,
                currentCoinMesh: coin,
                velocity: coin.userData.velocity,
                rotVelocity: coin.userData.rotVelocity
            };

            applyPhysicsStep(subDt, state);
            handleGroundCollision(subDt, state, {
                onImpact: (speed) => onCoinImpact(coin, speed),
                onSettled: () => { coin.userData.settled = true; }
            });
        });

        resolveCoinCollisions(activeCoinsInScene, selectedCoinType, onCoinCollision);
    }
}

// Treff i bakken – effektene skaleres etter fallfarten
function onCoinImpact(coin, speed) {
    const strength = Math.min(1, speed / 6);

    playHitSound(selectedCoinType, strength);
    spawnParticles(scene, coin.position.clone(), selectedCoinType.id);

    triggerCameraShake(
        (selectedCoinType.weight > 1.0 ? 0.16 :
        selectedCoinType.weight < 0.5 ? 0.08 :
        0.12) * strength
    );
}

// Mynt mot mynt
function onCoinCollision(a, b, speed, point) {
    [a, b].forEach(c => {
        if (c !== currentCoinMesh) knockedPlayers.add(c.userData.playerIndex);
    });

    if (speed < 0.3) return;   // Små dytt gir ingen effekt
    playCoinClink(selectedCoinType, Math.min(1, speed / 5));
    spawnParticles(scene, new THREE.Vector3(point.x, point.y, point.z), selectedCoinType.id);
}

//
// ANIMASJON OG FYSIKK
//
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);

    const dt = Math.min(clock.getDelta(), 0.05);

    // Sikting med tastaturet (A/D eller piltaster)
    if (!isThrown && !isDragging && currentCoinMesh) {
        const aimDir =
            (AIM_RIGHT_KEYS.some(k => heldAimKeys.has(k)) ? 1 : 0) -
            (AIM_LEFT_KEYS.some(k => heldAimKeys.has(k)) ? 1 : 0);
        keyAimSide = Math.min(1, Math.max(-1, keyAimSide + aimDir * AIM_SPEED * dt));
    }

    // Lading av tastaturkast – kraften går frem og tilbake mellom 0 og 100
    if (isChargingKey && !isThrown) {
        keyPower += keyPowerDir * dt * 120;
        if (keyPower >= 100) { keyPower = 100; keyPowerDir = -1; }
        if (keyPower <= 0) { keyPower = 0; keyPowerDir = 1; }
    }

    // Siktekurve for tastaturet: mens man lader, eller når siktet er flyttet til siden
    if (!isThrown && !isDragging && currentCoinMesh && (isChargingKey || keyAimSide !== 0)) {
        updateAimTrajectory(calculateKeyImpulse());
    }

    // Fysikk når mynten er kastet
    if (isThrown && !isSettled && currentCoinMesh) {

        stepCoins(dt);

        // Kastet er ferdig når alle myntene ligger i ro
        if (activeCoinsInScene.every(c => c.userData.settled)) {
            isSettled = true;
            checkDistance();
        }

        // Kamera følger mynten
        const targetCamZ = Math.min(defaultCamPos.z, currentCoinMesh.position.z + 3.5);
        camera.position.z += (targetCamZ - camera.position.z) * 0.08;

        camera.lookAt(
            currentCoinMesh.position.x * 0.3,
            0.5,
            currentCoinMesh.position.z
        );
    }

    // Rundeoppsummering: kameraet glir mykt ned til vinnermynten
    if (overviewActive) {
        const ease = 1 - frameDamping(0.94, dt);
        camera.position.lerp(overviewCamPos, ease);
        overviewLook.lerp(overviewLookTarget, ease);
        camera.lookAt(overviewLook);
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
