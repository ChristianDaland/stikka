//
// Syntetisk lydmotor for kast og treff
// Bruker Web Audio API til å generere lyder direkte i nettleseren
//

// Generisk "impact" lyd (treff)
function playSyntheticImpact(frequency = 400, duration = 0.12, volume = 0.8) {
const AudioCtx = window.AudioContext || window.webkitAudioContext;
if (!AudioCtx) return;

const ctx = new AudioCtx();
const osc = ctx.createOscillator();
const gain = ctx.createGain();

// Square gir en "klikkete" metallisk lyd
osc.type = "square";
osc.frequency.setValueAtTime(frequency, ctx.currentTime);

gain.gain.setValueAtTime(volume, ctx.currentTime);
gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

osc.connect(gain);
gain.connect(ctx.destination);

osc.start();
osc.stop(ctx.currentTime + duration);
}

// Generisk "throw" lyd (kast)
function playSyntheticThrow(frequency = 220, duration = 0.08, volume = 0.6) {
const AudioCtx = window.AudioContext || window.webkitAudioContext;
if (!AudioCtx) return;

const ctx = new AudioCtx();
const osc = ctx.createOscillator();
const gain = ctx.createGain();

// Sawtooth gir en "svisj" lyd som passer kast
osc.type = "sawtooth";
osc.frequency.setValueAtTime(frequency, ctx.currentTime);

gain.gain.setValueAtTime(volume, ctx.currentTime);
gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

osc.connect(gain);
gain.connect(ctx.destination);

osc.start();
osc.stop(ctx.currentTime + duration);
}

// Spill lyd når du kaster
function playThrowSound(selectedCoinType) {
if (!selectedCoinType) return;

const name = selectedCoinType.name.toLowerCase();

if (name.includes("gull") || name.includes("stål")) {
playSyntheticThrow(180, 0.09, 0.7);
} else if (name.includes("sølv") || name.includes("bronse")) {
playSyntheticThrow(260, 0.08, 0.6);
} else {
playSyntheticThrow(320, 0.07, 0.5);
}
}

// Spill lyd når mynten treffer bakken
function playHitSound(selectedCoinType) {
if (!selectedCoinType) return;

const name = selectedCoinType.name.toLowerCase();

if (name.includes("gull") || name.includes("stål")) {
playSyntheticImpact(220, 0.16, 0.9);
} else if (name.includes("sølv") || name.includes("bronse")) {
playSyntheticImpact(420, 0.12, 0.8);
} else {
playSyntheticImpact(650, 0.10, 0.7);
}
}