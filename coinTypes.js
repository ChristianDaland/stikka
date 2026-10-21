// Spillere (navn + farge til scoreboard)
const PLAYER_CONFIGS = [
{ name: "Spiller 1", hex: "#f39c12" },
{ name: "Spiller 2", hex: "#bdc3c7" },
{ name: "Spiller 3", hex: "#d35400" },
{ name: "Spiller 4", hex: "#e74c3c" },
{ name: "Spiller 5", hex: "#34495e" }
];

// Mynttyper med finjustert fysikk
// powerMul er kalibrert slik at fullt kast når ca. 32 m (tunge) til 38 m (lette)
const COIN_TYPES = {
gull: {
name: "Gullmynt",
id: "gull",
weight: 1.25,
bounce: 0.03,
friction: 0.90,
air: 0.982,
rot: 0.92,
powerMul: 1.69,
color: 0xf1c40f,
radius: 0.27,
height: 0.06,
edgeBevel: 0.015
},

sølv: {
name: "Sølvmynt",
id: "sølv",
weight: 0.95,
bounce: 0.07,
friction: 0.89,
air: 0.986,
rot: 0.94,
powerMul: 1.44,
color: 0xbdc3c7,
radius: 0.26,
height: 0.05,
edgeBevel: 0.012
},

bronse: {
name: "Bronsemynt",
id: "bronse",
weight: 0.55,
bounce: 0.12,
friction: 0.84,
air: 0.990,
rot: 0.95,
powerMul: 1.11,
color: 0xd35400,
radius: 0.25,
height: 0.05,
edgeBevel: 0.010
},

stål: {
name: "Stålmynt",
id: "stål",
weight: 1.45,
bounce: 0.02,
friction: 0.93,
air: 0.980,
rot: 0.90,
powerMul: 1.84,
color: 0x34495e,
radius: 0.28,
height: 0.06,
edgeBevel: 0.018
},

plast: {
name: "Plastmynt",
id: "plast",
weight: 0.30,
bounce: 0.28,
friction: 0.78,
air: 0.993,
rot: 0.97,
powerMul: 0.80,
color: 0xe67e22,
radius: 0.24,
height: 0.045,
edgeBevel: 0.008
}
};
