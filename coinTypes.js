// Spillere (navn + farge til scoreboard)
const PLAYER_CONFIGS = [
{ name: "Spiller 1", hex: "#f39c12" },
{ name: "Spiller 2", hex: "#bdc3c7" },
{ name: "Spiller 3", hex: "#d35400" },
{ name: "Spiller 4", hex: "#e74c3c" },
{ name: "Spiller 5", hex: "#34495e" }
];

// Mynttyper med finjustert fysikk
const COIN_TYPES = {
gull: {
name: "Gullmynt",
weight: 1.25,
bounce: 0.03,
friction: 0.90,
air: 0.982,
rot: 0.92,
powerMul: 0.70,
color: 0xf1c40f,
radius: 0.27,
height: 0.06,
edgeBevel: 0.015
},

sølv: {
name: "Sølvmynt",
weight: 0.95,
bounce: 0.07,
friction: 0.89,
air: 0.986,
rot: 0.94,
powerMul: 0.90,
color: 0xbdc3c7,
radius: 0.26,
height: 0.05,
edgeBevel: 0.012
},

bronse: {
name: "Bronsemynt",
weight: 0.55,
bounce: 0.12,
friction: 0.84,
air: 0.990,
rot: 0.95,
powerMul: 1.25,
color: 0xd35400,
radius: 0.25,
height: 0.05,
edgeBevel: 0.010
},

stål: {
name: "Stålmynt",
weight: 1.45,
bounce: 0.02,
friction: 0.93,
air: 0.980,
rot: 0.90,
powerMul: 0.65,
color: 0x34495e,
radius: 0.28,
height: 0.06,
edgeBevel: 0.018
},

plast: {
name: "Plastmynt",
weight: 0.30,
bounce: 0.28,
friction: 0.78,
air: 0.993,
rot: 0.97,
powerMul: 1.45,
color: 0xe67e22,
radius: 0.24,
height: 0.045,
edgeBevel: 0.008
}
};
