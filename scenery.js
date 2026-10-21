//
// OMGIVELSER – himmel, lys, bakke, gress, trær og streken
// Alt som bare er "kulisser" ligger her, så game.js kan handle om selve spillet.
//

// Retning mot sola (ettermiddagssol foran til venstre, ca. 33° over horisonten)
const SUN_DIR = new THREE.Vector3(-0.7, 0.55, -0.45).normalize();

// Farger skrives som vanlige hex-farger (sRGB). Three.js r128 regner i lineære
// farger når renderer.outputEncoding er sRGB, så de må konverteres.
function srgbColor(hex) {
    return new THREE.Color(hex).convertSRGBToLinear();
}

// Enkel tilfeldighetsgenerator med frø, så landskapet blir likt hver gang
function seededRandom(seed) {
    return function () {
        seed |= 0;
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Flislagt "value noise" (0–1) – sømløs når teksturen gjentas
function tileableNoise(size, cells, octaves, rand) {
    const out = new Float32Array(size * size);
    let amp = 1, total = 0;

    for (let o = 0; o < octaves; o++) {
        const n = cells << o;
        const grid = new Float32Array(n * n).map(() => rand());
        const at = (x, y) => grid[((y % n) * n) + (x % n)];

        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const gx = (x / size) * n, gy = (y / size) * n;
                const x0 = Math.floor(gx), y0 = Math.floor(gy);
                const fx = gx - x0, fy = gy - y0;
                const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
                const top = at(x0, y0) * (1 - sx) + at(x0 + 1, y0) * sx;
                const bottom = at(x0, y0 + 1) * (1 - sx) + at(x0 + 1, y0 + 1) * sx;
                out[y * size + x] += (top * (1 - sy) + bottom * sy) * amp;
            }
        }
        total += amp;
        amp *= 0.5;
    }
    return out.map(v => v / total);
}

// Samme som over, men i én dimensjon (for kanter langs veien og streken)
function tileableNoise1D(length, cells, octaves, rand) {
    const out = new Float32Array(length);
    let amp = 1, total = 0;

    for (let o = 0; o < octaves; o++) {
        const n = cells << o;
        const grid = new Float32Array(n).map(() => rand());
        for (let x = 0; x < length; x++) {
            const g = (x / length) * n;
            const x0 = Math.floor(g), f = g - x0;
            const s = f * f * (3 - 2 * f);
            out[x] += (grid[x0 % n] * (1 - s) + grid[(x0 + 1) % n] * s) * amp;
        }
        total += amp;
        amp *= 0.5;
    }
    return out.map(v => v / total);
}

function makeCanvas(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
}

// Tekstur som blander to farger etter støy – brukes til å bryte opp gjentakelser
function createVariationTexture(rand, low, high) {
    const size = 256;
    const noise = tileableNoise(size, 4, 4, rand);
    const canvas = makeCanvas(size, size);
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(size, size);

    for (let i = 0; i < noise.length; i++) {
        const t = Math.min(1, Math.max(0, (noise[i] - 0.3) / 0.4));
        img.data[i * 4] = (low[0] + (high[0] - low[0]) * t) * 255;
        img.data[i * 4 + 1] = (low[1] + (high[1] - low[1]) * t) * 255;
        img.data[i * 4 + 2] = (low[2] + (high[2] - low[2]) * t) * 255;
        img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
}

// Ganger fargen med en stor, langsom variasjonstekstur i tillegg til den vanlige
// teksturen, så bakken ikke ser flislagt ut
function addLargeScaleVariation(material, variationTex, scale) {
    material.onBeforeCompile = (shader) => {
        shader.uniforms.variationMap = { value: variationTex };
        shader.uniforms.variationScale = { value: scale };
        shader.fragmentShader =
            'uniform sampler2D variationMap;\nuniform vec2 variationScale;\n' +
            shader.fragmentShader.replace(
                '#include <map_fragment>',
                '#include <map_fragment>\n\tdiffuseColor.rgb *= texture2D(variationMap, vUv * variationScale).rgb;'
            );
    };
}

// Slår sammen flere geometrier til én (uten indekser)
function mergeGeometries(geometries) {
    const parts = geometries.map(g => g.index ? g.toNonIndexed() : g);
    const merged = new THREE.BufferGeometry();

    ['position', 'normal'].forEach(name => {
        const total = parts.reduce((n, g) => n + g.attributes[name].array.length, 0);
        const array = new Float32Array(total);
        let offset = 0;
        parts.forEach(g => {
            array.set(g.attributes[name].array, offset);
            offset += g.attributes[name].array.length;
        });
        merged.setAttribute(name, new THREE.BufferAttribute(array, 3));
    });
    return merged;
}

//
// HIMMEL – fargeovergang, solskive og glød. Brukes også som omgivelseslys
// og speilbilde for myntene (scene.environment).
//
const SKY_ZENITH = 0x4f86c6;
const SKY_HORIZON = 0xc8d8e4;
const SKY_GROUND = 0x5d6b48;

function createSky() {
    const material = new THREE.ShaderMaterial({
        uniforms: {
            zenith: { value: srgbColor(SKY_ZENITH) },
            horizon: { value: srgbColor(SKY_HORIZON) },
            ground: { value: srgbColor(SKY_GROUND) },
            sunColor: { value: srgbColor(0xfff1dc) },
            sunDir: { value: SUN_DIR }
        },
        vertexShader: `
            varying vec3 vDir;
            void main() {
                vDir = position;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }`,
        fragmentShader: `
            uniform vec3 zenith;
            uniform vec3 horizon;
            uniform vec3 ground;
            uniform vec3 sunColor;
            uniform vec3 sunDir;
            varying vec3 vDir;
            void main() {
                vec3 dir = normalize(vDir);
                float h = dir.y;
                vec3 col = mix(horizon, zenith, pow(clamp(h, 0.0, 1.0), 0.45));
                col = mix(col, ground, smoothstep(0.0, -0.06, h));
                float s = max(dot(dir, sunDir), 0.0);
                col += sunColor * (pow(s, 2000.0) * 40.0 + pow(s, 24.0) * 0.5 + pow(s, 4.0) * 0.12);
                gl_FragColor = vec4(col, 1.0);
                #include <tonemapping_fragment>
                #include <encodings_fragment>
            }`,
        side: THREE.BackSide,
        depthWrite: false
    });

    const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), material);
    sky.renderOrder = -1;
    return sky;
}

//
// LYS – sol med skygger. Resten av lyset kommer fra himmelen (scene.environment).
//
function createSunLight(scene) {
    const sunLight = new THREE.DirectionalLight(srgbColor(0xfff1dc), 2.6);
    sunLight.target.position.set(0, 0, -16);
    sunLight.position.copy(sunLight.target.position).addScaledVector(SUN_DIR, 50);

    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(2048, 2048);
    const cam = sunLight.shadow.camera;
    cam.left = -26;
    cam.right = 26;
    cam.top = 26;
    cam.bottom = -26;
    cam.near = 5;
    cam.far = 110;
    sunLight.shadow.bias = -0.0003;
    sunLight.shadow.normalBias = 0.02;
    cam.updateProjectionMatrix();   // Ellers brukes standardutsnittet på ±5 m

    scene.add(sunLight);
    scene.add(sunLight.target);

    // Litt ekstra fylllys fra himmel/bakke, så skyggene ikke blir helt svarte
    scene.add(new THREE.HemisphereLight(srgbColor(0xbcd4ea), srgbColor(0x6b6a4a), 0.12));
    return sunLight;
}

//
// BAKKE – grusvei, gress og myke kanter mellom dem
//
const ROAD_WIDTH = 6;
const ROAD_LENGTH = 80;
const ROAD_CENTER_Z = -34;   // Veien går fra z = 6 til z = -74

function loadGroundTexture(loader, renderer, url, repeatX, repeatY) {
    const tex = loader.load(url);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return tex;
}

// Kant der grusen gradvis går over i gress: tilfeldig, ujevn overgang
function createRoadEdgeAlpha(rand) {
    const w = 64, h = 512;
    const noise = tileableNoise1D(h, 16, 3, rand);   // Sømløs langs veien
    const canvas = makeCanvas(w, h);
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(w, h);

    for (let y = 0; y < h; y++) {
        const edge = 0.35 + noise[y] * 0.45;
        for (let x = 0; x < w; x++) {
            const u = x / (w - 1);
            const fine = rand() * 0.12;
            const a = Math.min(1, Math.max(0, (edge - u) / 0.25 + 0.5 - fine));
            const i = (y * w + x) * 4;
            img.data[i] = img.data[i + 1] = img.data[i + 2] = a * 255;
            img.data[i + 3] = 255;
        }
    }
    ctx.putImageData(img, 0, 0);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.ClampToEdgeWrapping;   // Ellers bretter kanten rundt og gir en lys strek
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
}

function createGround(scene, renderer, rand) {
    const loader = new THREE.TextureLoader();

    // Grusvei – 1 m per teksturflis
    const gravelTex = loadGroundTexture(loader, renderer, 'textures/Gravel.jpg', ROAD_WIDTH, ROAD_LENGTH);
    const roadVariation = createVariationTexture(rand, [0.8, 0.77, 0.72], [1.0, 0.98, 0.95]);
    const roadMat = new THREE.MeshStandardMaterial({
        map: gravelTex,
        color: srgbColor(0xd9cfc0),   // Varmere, mer jordete grus
        roughness: 1.0,
        bumpMap: gravelTex,
        bumpScale: 0.02
    });
    addLargeScaleVariation(roadMat, roadVariation, new THREE.Vector2(1 / 6, 1 / 9));

    const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_WIDTH, ROAD_LENGTH), roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.z = ROAD_CENTER_Z;
    road.receiveShadow = true;
    scene.add(road);

    // Gress – 2 m per teksturflis
    const grassTex = loadGroundTexture(loader, renderer, 'textures/Grass.jpg', 200, 200);
    const grassMat = new THREE.MeshStandardMaterial({
        map: grassTex,
        color: srgbColor(0xc4cca4),
        roughness: 1.0
    });
    addLargeScaleVariation(
        grassMat,
        createVariationTexture(rand, [0.62, 0.66, 0.48], [1.0, 0.96, 0.82]),
        new THREE.Vector2(1 / 14, 1 / 14)
    );

    const grass = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), grassMat);
    grass.rotation.x = -Math.PI / 2;
    grass.position.set(0, -0.01, -50);
    grass.receiveShadow = true;
    scene.add(grass);

    // Myke kanter: grus som tynnes ut utover i gresset på begge sider
    // Egen tekstur: gravelTex.clone() før bildet er lastet gir en kopi uten bilde
    const edgeAlpha = createRoadEdgeAlpha(rand);
    const edgeGravel = loadGroundTexture(loader, renderer, 'textures/Gravel.jpg', 1, ROAD_LENGTH);

    // Samme utseende som veien (farge, ruhet og variasjon), bare med uttynnet kant
    const edgeMat = new THREE.MeshStandardMaterial({
        map: edgeGravel,
        alphaMap: edgeAlpha,
        color: srgbColor(0xd9cfc0),
        roughness: 1.0,
        bumpMap: edgeGravel,
        bumpScale: 0.02,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1
    });

    addLargeScaleVariation(edgeMat, roadVariation, new THREE.Vector2(1 / 6, 1 / 9));

    [-1, 1].forEach(side => {
        const geometry = new THREE.PlaneGeometry(1, ROAD_LENGTH);
        if (side < 0) {
            // Speilvendt på tvers, så overgangen alltid går utover fra veien
            const uv = geometry.attributes.uv;
            for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i));
        }
        const edge = new THREE.Mesh(geometry, edgeMat);
        edge.rotation.x = -Math.PI / 2;
        edge.position.set(side * (ROAD_WIDTH / 2 + 0.3), 0.001, ROAD_CENTER_Z);
        edge.receiveShadow = true;
        scene.add(edge);
    });
}

//
// GRESSTUSTER – mange små strå langs veien, slått sammen til én geometri
//
function createGrassBlades(scene, rand) {
    const positions = [];
    const colors = [];
    const baseCol = srgbColor(0x2f4220);
    const tipCol = srgbColor(0x6f8a3c);
    const dryCol = srgbColor(0xa89d62);

    function addBlade(x, z, height, width, angle, lean, dryness) {
        const cos = Math.cos(angle), sin = Math.sin(angle);
        const bx = cos * width / 2, bz = sin * width / 2;
        positions.push(
            x - bx, 0, z - bz,
            x + bx, 0, z + bz,
            x - sin * lean, height, z + cos * lean
        );
        const tip = tipCol.clone().lerp(dryCol, dryness);
        colors.push(
            baseCol.r, baseCol.g, baseCol.b,
            baseCol.r, baseCol.g, baseCol.b,
            tip.r, tip.g, tip.b
        );
    }

    // Færre tuster på mobil (berøringsskjerm), så svakere telefoner holder bildefrekvensen
    const isTouchDevice = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    const clumps = isTouchDevice ? 8000 : 16000;

    const halfRoad = ROAD_WIDTH / 2;
    for (let i = 0; i < clumps; i++) {
        // Tettest nær veikanten, glissent lenger ut
        const side = rand() < 0.5 ? -1 : 1;
        const dist = halfRoad + 0.2 + Math.pow(rand(), 2.2) * 13;
        const cx = side * dist;
        const cz = 8 - rand() * 72;
        const blades = 5 + Math.floor(rand() * 10);
        const dryness = Math.pow(rand(), 3);

        for (let b = 0; b < blades; b++) {
            const a = rand() * Math.PI * 2;
            const r = rand() * 0.1;
            addBlade(
                cx + Math.cos(a) * r,
                cz + Math.sin(a) * r,
                0.03 + Math.pow(rand(), 2) * 0.11,
                0.006 + rand() * 0.008,
                rand() * Math.PI,
                (rand() - 0.5) * 0.08,
                dryness
            );
        }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    // Alle strå belyses som om de peker opp – gir mykt, jevnt gresslys
    const normals = new Float32Array(positions.length);
    for (let i = 1; i < normals.length; i += 3) normals[i] = 1;
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));

    const blades = new THREE.Mesh(
        geometry,
        new THREE.MeshStandardMaterial({
            vertexColors: true,
            side: THREE.DoubleSide,
            roughness: 0.9
        })
    );
    scene.add(blades);
}

//
// TRÆR – granskog og noen bjørker i det fjerne
//
function createTrees(scene, rand) {
    // Gran: fire kjegler oppå hverandre, stamme under
    const spruceCrown = mergeGeometries([
        new THREE.ConeGeometry(1.0, 1.6, 10).translate(0, 1.5, 0),
        new THREE.ConeGeometry(0.82, 1.4, 10).translate(0, 2.2, 0),
        new THREE.ConeGeometry(0.62, 1.25, 10).translate(0, 2.9, 0),
        new THREE.ConeGeometry(0.4, 1.1, 10).translate(0, 3.6, 0)
    ]);
    // Bjørk: tre klumper gir en ujevn, naturlig krone
    const birchCrown = mergeGeometries([
        new THREE.IcosahedronGeometry(0.85, 1).translate(0, 2.7, 0),
        new THREE.IcosahedronGeometry(0.65, 1).translate(0.45, 3.3, 0.2),
        new THREE.IcosahedronGeometry(0.6, 1).translate(-0.4, 3.2, -0.25)
    ]).scale(0.95, 1.15, 0.95);
    const trunkGeo = new THREE.CylinderGeometry(0.09, 0.13, 2.2, 6).translate(0, 1.1, 0);

    const spruceMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 });
    const birchMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true });
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1.0 });

    const SPRUCES = 220, BIRCHES = 60;
    const spruces = new THREE.InstancedMesh(spruceCrown, spruceMat, SPRUCES);
    const birches = new THREE.InstancedMesh(birchCrown, birchMat, BIRCHES);
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, SPRUCES + BIRCHES);

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const pos = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);

    // Plassering: i et belte rundt banen, aldri nær veien eller bak kameraet
    function randomSpot() {
        for (;;) {
            const x = (rand() - 0.5) * 240;
            const z = 25 - rand() * 200;
            if (Math.abs(x) > 26 + Math.max(0, z + 20) * 0.3 && z < 15) return [x, z];
        }
    }

    function place(mesh, index, trunkIndex, s, color, trunkColor) {
        const [x, z] = randomSpot();
        q.setFromAxisAngle(up, rand() * Math.PI * 2);
        pos.set(x, 0, z);
        scale.set(s, s * (0.9 + rand() * 0.3), s);
        m.compose(pos, q, scale);
        mesh.setMatrixAt(index, m);
        mesh.setColorAt(index, color);
        trunks.setMatrixAt(trunkIndex, m);
        trunks.setColorAt(trunkIndex, trunkColor);
    }

    const spruceGreen = srgbColor(0x2c4428);
    const birchGreen = srgbColor(0x5f7f3a);
    const darkTrunk = srgbColor(0x4a3626);
    const birchTrunk = srgbColor(0xbdb8aa);

    for (let i = 0; i < SPRUCES; i++) {
        const shade = 0.75 + rand() * 0.4;
        place(spruces, i, i, 2.2 + rand() * 2.6, spruceGreen.clone().multiplyScalar(shade), darkTrunk);
    }
    for (let i = 0; i < BIRCHES; i++) {
        const shade = 0.8 + rand() * 0.35;
        place(birches, i, SPRUCES + i, 2.0 + rand() * 1.6, birchGreen.clone().multiplyScalar(shade), birchTrunk);
    }

    [spruces, birches, trunks].forEach(mesh => {
        mesh.castShadow = false;
        scene.add(mesh);
    });
}

//
// STREKEN – risset i grusen, med en pinne i hver ende
//
const STREK_LENGTH = 4;

function createStrekTexture(rand) {
    const w = 1024, h = 64;
    const edgeNoise = tileableNoise1D(w, 24, 3, rand);   // Ujevn kant langs streken
    const canvas = makeCanvas(w, h);
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(w, h);

    const soil = [48, 34, 24];
    const churned = [128, 112, 92];

    for (let y = 0; y < h; y++) {
        const v = Math.abs((y / (h - 1)) * 2 - 1);   // 0 i midten, 1 i kanten
        for (let x = 0; x < w; x++) {
            const edge = 0.62 + edgeNoise[x] * 0.3;
            const t = Math.min(1, v / edge);
            const grain = 0.85 + rand() * 0.3;
            const speck = rand() < 0.03 ? 1.6 : 1;   // Små grusbiter i fura
            const i = (y * w + x) * 4;
            for (let c = 0; c < 3; c++) {
                img.data[i + c] = Math.min(255, (soil[c] + (churned[c] - soil[c]) * t * t) * grain * speck);
            }
            // Myk, ujevn overgang til grusen rundt
            const ends = Math.min(1, Math.min(x, w - 1 - x) / 24);
            img.data[i + 3] = Math.max(0, Math.min(1, (1 - v / edge) * 3)) * ends * 250;
        }
    }
    ctx.putImageData(img, 0, 0);

    const tex = new THREE.CanvasTexture(canvas);
    tex.encoding = THREE.sRGBEncoding;
    return tex;
}

function createStrek(scene, renderer, rand) {
    const strek = new THREE.Group();

    const map = createStrekTexture(rand);
    map.anisotropy = renderer.capabilities.getMaxAnisotropy();

    const groove = new THREE.Mesh(
        new THREE.PlaneGeometry(STREK_LENGTH + 0.2, 0.24),
        new THREE.MeshStandardMaterial({
            map,
            roughness: 1.0,
            transparent: true,
            depthWrite: false,
            polygonOffset: true,
            polygonOffsetFactor: -2,
            polygonOffsetUnits: -2
        })
    );
    groove.rotation.x = -Math.PI / 2;
    groove.position.y = 0.002;
    groove.receiveShadow = true;
    strek.add(groove);

    // Pinner som markerer endene av streken
    const pegGeo = new THREE.CylinderGeometry(0.014, 0.02, 0.32, 8);
    const pegMat = new THREE.MeshStandardMaterial({ color: srgbColor(0x8a6a45), roughness: 0.85 });
    [-1, 1].forEach(side => {
        const peg = new THREE.Mesh(pegGeo, pegMat);
        peg.position.set(side * (STREK_LENGTH / 2 + 0.12), 0.12, 0);
        peg.rotation.set((rand() - 0.5) * 0.15, 0, side * -0.08);
        peg.castShadow = true;
        strek.add(peg);
    });

    scene.add(strek);
    return strek;
}

//
// BYGG HELE SCENEN
//
function createScenery(scene, renderer) {
    const rand = seededRandom(1337);

    const sky = createSky();
    scene.add(sky);
    scene.fog = new THREE.FogExp2(srgbColor(SKY_HORIZON), 0.011);

    // Himmelen gir omgivelseslys og speilbilder til alle PBR-materialer
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    envScene.add(new THREE.Mesh(sky.geometry, sky.material));
    scene.environment = pmrem.fromScene(envScene, 0.02, 0.1, 1000).texture;
    pmrem.dispose();

    const sunLight = createSunLight(scene);
    createGround(scene, renderer, rand);
    createGrassBlades(scene, rand);
    createTrees(scene, rand);
    const strek = createStrek(scene, renderer, rand);

    return {
        sunLight,
        strek,
        // Himmelen følger kameraet, så horisonten alltid ligger riktig
        update(camera) {
            sky.position.copy(camera.position);
        }
    };
}
