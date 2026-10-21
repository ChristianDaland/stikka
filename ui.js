// Oppdater scoreboardet i høyre hjørne
function updateScoreboard(totalPlayers, currentPlayerIndex, coinCounts, roundDistances) {
const list = document.getElementById('score-list');
list.innerHTML = "";

for (let i = 0; i < totalPlayers; i++) {
const item = document.createElement('div');

const isEliminated = coinCounts[i] <= 0 && roundDistances[i] === null;
const isActive = (i === currentPlayerIndex);

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
