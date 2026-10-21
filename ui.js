// Oppdater scoreboardet i høyre hjørne
// Viser mynter, avstanden i denne runden og en stjerne ved den som leder
function updateScoreboard(totalPlayers, currentPlayerIndex, coinCounts, roundDistances, leaderIndex = -1) {
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

const star = i === leaderIndex ? ' ★' : '';
const dist = roundDistances[i] !== null
? `<span class="score-dist">${roundDistances[i]} cm</span>`
: '';

item.innerHTML =
`<span>${PLAYER_CONFIGS[i].name}${star}:</span>${dist}<span class="score-coins">${coinCounts[i]}</span>`;

list.appendChild(item);
}
}

// Vis rundeoppsummeringen nederst på skjermen
// rows: [{ name, hex, value, highlight }]
function showRoundOverlay(title, subtitle, rows, buttonText, onButton) {
document.getElementById('round-title').textContent = title;
document.getElementById('round-subtitle').textContent = subtitle;

const list = document.getElementById('round-results');
list.innerHTML = "";

rows.forEach(row => {
const item = document.createElement('div');
item.className = 'round-row' + (row.highlight ? ' winner' : '');
item.style.color = row.hex;

const name = document.createElement('span');
name.textContent = row.name;
const value = document.createElement('span');
value.textContent = row.value;

item.append(name, value);
list.appendChild(item);
});

const btn = document.getElementById('round-btn');
btn.textContent = buttonText;
btn.onclick = onButton;

document.getElementById('round-overlay').style.display = 'block';
document.getElementById('instructions').style.display = 'none';
btn.focus();   // Enter går videre
}

function hideRoundOverlay() {
document.getElementById('round-overlay').style.display = 'none';
document.getElementById('instructions').style.display = '';
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
