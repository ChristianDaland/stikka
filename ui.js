// Oppdater scoreboardet i høyre hjørne
function updateScoreboard(totalPlayers, currentPlayerIndex, coinCounts, roundDistances) {
const list = document.getElementById('score-list');
list.innerHTML = "";

for (let i = 0; i < totalPlayers; i++) {
const item = document.createElement('div');

const isActive = (i === currentPlayerIndex);
// Den som kaster sin siste mynt akkurat nå, er ikke ute ennå
const isEliminated = coinCounts[i] <= 0 && roundDistances[i] === null && !isActive;

item.className =
'score-item' +
(isActive ? ' active' : '') +
(isEliminated ? ' eliminated' : '');

item.style.color = PLAYER_CONFIGS[i].hex;

item.innerHTML =
`<span>${PLAYER_CONFIGS[i].name}:</span> <span>${coinCounts[i]}</span>`;

list.appendChild(item);
}
}

// Svart eller hvit tekst, avhengig av hvor lys bakgrunnsfargen er
function readableTextColor(hex) {
const r = parseInt(hex.slice(1, 3), 16);
const g = parseInt(hex.slice(3, 5), 16);
const b = parseInt(hex.slice(5, 7), 16);
const brightness = (r * 299 + g * 587 + b * 114) / 1000;
return brightness > 125 ? '#111' : '#fff';
}

// Oppdater kraftmåleren
function setPowerBar(pct) {
document.getElementById('power-bar').style.width =
Math.min(100, Math.max(0, pct)) + '%';
}

// Oppdater avstandsteksten
function setDistanceText(text, color) {
const el = document.getElementById('distance');
el.textContent = text;
el.style.color = color;
}
