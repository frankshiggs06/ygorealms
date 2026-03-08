// Base SVGs for 10 Pets
// These SVGs are styled inside the app
export const PETS_DATA = [
  { id: "pet1", name: "Búho MC", type: "owl", hp: 40, atk: 1.1, def: 0.9, specialty: "Sabiduría", svg: `<svg viewBox="0 0 100 100" class="pet-svg"><circle cx="50" cy="50" r="40" fill="#7c3aed"/><circle cx="35" cy="40" r="10" fill="#fff"/><circle cx="65" cy="40" r="10" fill="#fff"/><circle cx="35" cy="40" r="3" fill="#000"/><circle cx="65" cy="40" r="3" fill="#000"/><path d="M45,55 L55,55 L50,65 Z" fill="#f59e0b"/><rect x="25" y="70" width="10" height="20" fill="#a855f7" rx="5" transform="rotate(-30 25 70)"/><rect x="65" y="70" width="10" height="20" fill="#a855f7" rx="5" transform="rotate(30 65 70)"/><g class="mic" transform="translate(60, 60)"><rect x="0" y="0" width="6" height="15" fill="#94a3b8"/><circle cx="3" cy="0" r="6" fill="#cbd5e1"/></g></svg>` },
  { id: "pet2", name: "Cuervo Lápiz", type: "raven", hp: 40, atk: 1.2, def: 0.8, specialty: "Oscuridad", svg: `<svg viewBox="0 0 100 100" class="pet-svg"><path d="M20,60 C20,30 80,30 80,60 C80,90 20,90 20,60 Z" fill="#1e293b"/><circle cx="30" cy="50" r="8" fill="#fff"/><circle cx="28" cy="50" r="3" fill="#ef4444"/><path d="M10,60 L20,55 L20,65 Z" fill="#facc15"/><path class="feather" d="M80,50 L95,45 L90,60 Z" fill="#0f172a"/><g class="pencil" transform="translate(10, 75) rotate(-45)"><rect width="30" height="6" fill="#fbbf24"/><polygon points="30,0 30,6 40,3" fill="#fcd34d"/><polygon points="38,2 38,4 40,3" fill="#000"/></g></svg>` },
  { id: "pet3", name: "Zorro Poeta", type: "fox", hp: 40, atk: 1.0, def: 1.0, specialty: "Astucia", svg: `<svg viewBox="0 0 100 100" class="pet-svg"><polygon points="20,40 50,80 80,40 60,30 40,30" fill="#ea580c"/><polygon points="20,40 35,10 40,30" fill="#ea580c"/><polygon points="80,40 65,10 60,30" fill="#ea580c"/><polygon points="20,40 50,80 80,40 60,50 40,50" fill="#fff"/><circle cx="40" cy="45" r="4" fill="#000"/><circle cx="60" cy="45" r="4" fill="#000"/><circle cx="50" cy="55" r="3" fill="#000"/><g class="quill" transform="translate(70, 60) rotate(30)"><path d="M0,30 Q10,10 20,0 Q10,20 -5,15" fill="#e2e8f0"/></g></svg>` },
  { id: "pet4", name: "Gato Rítmico", type: "cat", hp: 40, atk: 1.1, def: 1.1, specialty: "Ritmo", svg: `<svg viewBox="0 0 100 100" class="pet-svg"><circle cx="50" cy="60" r="30" fill="#475569"/><polygon points="25,35 35,60 15,60" fill="#475569" transform="rotate(15 25 35)"/><polygon points="75,35 65,60 85,60" fill="#475569" transform="rotate(-15 75 35)"/><path d="M30,55 Q50,45 70,55" stroke="#fff" stroke-width="2" fill="none"/><circle cx="40" cy="55" r="4" fill="#fff"/><circle cx="60" cy="45" r="4" fill="#fff"/><g class="mic" transform="translate(45, 75)"><rect x="0" y="0" width="10" height="20" fill="#1e293b"/><circle cx="5" cy="0" r="8" fill="#e2e8f0"/></g></svg>` },
  { id: "pet5", name: "Lobo Freestyle", type: "wolf", hp: 40, atk: 1.2, def: 0.9, specialty: "Fuerza", svg: `<svg viewBox="0 0 100 100" class="pet-svg"><polygon points="30,50 50,80 70,50 60,30 40,30" fill="#94a3b8"/><polygon points="25,15 40,35 30,50" fill="#94a3b8"/><polygon points="75,15 60,35 70,50" fill="#94a3b8"/><circle cx="40" cy="45" r="3" fill="#000"/><circle cx="60" cy="45" r="3" fill="#000"/><polygon points="45,60 55,60 50,70" fill="#000"/><g class="pencil" transform="translate(15, 65) rotate(45)"><rect width="20" height="5" fill="#ef4444"/><polygon points="20,0 20,5 28,2.5" fill="#fed7aa"/></g></svg>` },
  { id: "pet6", name: "Dragón Verso", type: "dragon", hp: 40, atk: 1.3, def: 0.8, specialty: "Fuego", svg: `<svg viewBox="0 0 100 100" class="pet-svg"><circle cx="50" cy="50" r="35" fill="#10b981"/><path d="M15,50 C10,30 40,20 50,20" stroke="#047857" stroke-width="5" fill="none"/><path d="M85,50 C90,30 60,20 50,20" stroke="#047857" stroke-width="5" fill="none"/><circle cx="35" cy="45" r="6" fill="#fbbf24"/><circle cx="65" cy="45" r="6" fill="#fbbf24"/><polygon points="40,65 60,65 50,75" fill="#ef4444"/><path class="fire" d="M50,75 L45,90 L50,85 L55,90 Z" fill="#f59e0b"/></svg>` },
  { id: "pet7", name: "Panda Flow", type: "panda", hp: 40, atk: 0.8, def: 1.3, specialty: "Zen", svg: `<svg viewBox="0 0 100 100" class="pet-svg"><circle cx="50" cy="55" r="35" fill="#fff"/><circle cx="25" cy="30" r="15" fill="#000"/><circle cx="75" cy="30" r="15" fill="#000"/><circle cx="35" cy="50" r="12" fill="#000"/><circle cx="65" cy="50" r="12" fill="#000"/><circle cx="35" cy="50" r="3" fill="#fff"/><circle cx="65" cy="50" r="3" fill="#fff"/><circle cx="50" cy="65" r="5" fill="#000"/><g class="mic" transform="translate(68, 65) rotate(-20)"><rect width="6" height="15" fill="#64748b"/><circle cx="3" cy="0" r="6" fill="#fbbf24"/></g></svg>` },
  { id: "pet8", name: "Murciélago MC", type: "bat", hp: 40, atk: 1.3, def: 0.9, specialty: "Eco", svg: `<svg viewBox="0 0 100 100" class="pet-svg"><circle cx="50" cy="50" r="25" fill="#334155"/><path d="M25,50 C10,30 10,70 30,60" fill="#1e293b"/><path d="M75,50 C90,30 90,70 70,60" fill="#1e293b"/><polygon points="35,25 45,35 40,50" fill="#334155"/><polygon points="65,25 55,35 60,50" fill="#334155"/><circle cx="43" cy="45" r="4" fill="#ef4444"/><circle cx="57" cy="45" r="4" fill="#ef4444"/><polygon points="45,55 55,55 50,65" fill="#fff"/></svg>` },
  { id: "pet9", name: "Mono Rima", type: "monkey", hp: 40, atk: 1.1, def: 1.0, specialty: "Broma", svg: `<svg viewBox="0 0 100 100" class="pet-svg"><circle cx="50" cy="50" r="30" fill="#8b5cf6"/><circle cx="20" cy="50" r="12" fill="#fb7185"/><circle cx="80" cy="50" r="12" fill="#fb7185"/><circle cx="50" cy="60" r="20" fill="#fb7185"/><circle cx="40" cy="45" r="5" fill="#000"/><circle cx="60" cy="45" r="5" fill="#000"/><path d="M40,65 Q50,75 60,65" stroke="#000" stroke-width="3" fill="none"/><g class="pencil" transform="translate(10, 60) rotate(-30)"><rect width="25" height="6" fill="#2dd4bf"/><polygon points="25,0 25,6 35,3" fill="#fcd34d"/></g></svg>` },
  { id: "pet10", name: "Pingüino Tinta", type: "penguin", hp: 40, atk: 0.9, def: 1.1, specialty: "Frío", svg: `<svg viewBox="0 0 100 100" class="pet-svg"><ellipse cx="50" cy="55" rx="30" ry="40" fill="#0f172a"/><ellipse cx="50" cy="60" rx="20" ry="25" fill="#fff"/><circle cx="40" cy="40" r="4" fill="#fff"/><circle cx="60" cy="40" r="4" fill="#fff"/><polygon points="45,50 55,50 50,60" fill="#f59e0b"/><path d="M15,50 C5,60 10,80 25,65" fill="#0f172a"/><path d="M85,50 C95,60 90,80 75,65" fill="#0f172a"/><g class="quill" transform="translate(75, 45) rotate(15)"><path d="M0,25 Q15,10 25,0 Q10,25 -5,20" fill="#38bdf8"/></g></svg>` },
  { id: "pet11", name: "Tigre Sílaba", type: "tiger", hp: 40, atk: 1.3, def: 0.9, specialty: "Garra", svg: `<svg viewBox="0 0 100 100" class="pet-svg"><circle cx="50" cy="50" r="35" fill="#f97316"/><path d="M30,30 L40,40 M70,30 L60,40 M20,50 L35,55 M80,50 L65,55" stroke="#000" stroke-width="3"/><circle cx="35" cy="45" r="5" fill="#fff"/><circle cx="35" cy="45" r="2" fill="#000"/><circle cx="65" cy="45" r="5" fill="#fff"/><circle cx="65" cy="45" r="2" fill="#000"/><polygon points="45,65 55,65 50,70" fill="#000"/><g class="mic" transform="translate(50, 75)"><rect x="-3" y="0" width="6" height="15" fill="#cbd5e1"/><circle cx="0" cy="0" r="6" fill="#fcd34d"/></g></svg>` },
  { id: "pet12", name: "Serpiente Métrica", type: "snake", hp: 40, atk: 1.4, def: 0.7, specialty: "Veneno", svg: `<svg viewBox="0 0 100 100" class="pet-svg"><path d="M20,80 Q50,20 80,80" stroke="#84cc16" stroke-width="15" fill="none" stroke-linecap="round"/><circle cx="35" cy="40" r="20" fill="#84cc16"/><circle cx="28" cy="35" r="4" fill="#ef4444"/><polygon points="20,40 10,40 15,45" fill="#ef4444"/><circle cx="42" cy="35" r="4" fill="#ef4444"/><g class="pencil" transform="translate(45, 45) rotate(120)"><rect width="20" height="4" fill="#0ea5e9"/><polygon points="20,0 20,4 28,2" fill="#fef08a"/></g></svg>` },
  { id: "pet13", name: "Oso Estrofa", type: "bear", hp: 40, atk: 0.8, def: 1.2, specialty: "Hibernación", svg: `<svg viewBox="0 0 100 100" class="pet-svg"><circle cx="50" cy="60" r="35" fill="#78350f"/><circle cx="25" cy="35" r="12" fill="#78350f"/><circle cx="75" cy="35" r="12" fill="#78350f"/><circle cx="50" cy="65" r="18" fill="#d97706"/><circle cx="40" cy="50" r="4" fill="#000"/><circle cx="60" cy="50" r="4" fill="#000"/><polygon points="45,60 55,60 50,65" fill="#000"/><g class="quill" transform="translate(70, 60) rotate(15)"><path d="M0,25 Q15,10 25,0 Q10,25 -5,20" fill="#fff"/></g></svg>` },
  { id: "pet14", name: "Águila Liríca", type: "eagle", hp: 40, atk: 1.5, def: 0.7, specialty: "Vuelo", svg: `<svg viewBox="0 0 100 100" class="pet-svg"><circle cx="50" cy="40" r="25" fill="#e2e8f0"/><polygon points="50,45 60,65 40,65" fill="#facc15" transform="rotate(180 50 55)"/><path d="M25,40 C10,30 0,60 30,50" fill="#1e293b"/><path d="M75,40 C90,30 100,60 70,50" fill="#1e293b"/><circle cx="40" cy="35" r="4" fill="#000"/><circle cx="60" cy="35" r="4" fill="#000"/><g class="mic" transform="translate(50, 70) rotate(-45)"><rect x="0" y="0" width="8" height="20" fill="#475569"/><circle cx="4" cy="0" r="8" fill="#cbd5e1"/></g></svg>` },
  { id: "pet15", name: "Tortuga Prosa", type: "turtle", hp: 40, atk: 0.7, def: 1.5, specialty: "Coraza", svg: `<svg viewBox="0 0 100 100" class="pet-svg"><ellipse cx="50" cy="50" rx="35" ry="25" fill="#15803d"/><path d="M20,60 Q10,80 30,70 M80,60 Q90,80 70,70" stroke="#22c55e" stroke-width="10" stroke-linecap="round" fill="none"/><circle cx="85" cy="40" r="12" fill="#22c55e"/><circle cx="82" cy="38" r="3" fill="#000"/><circle cx="88" cy="38" r="3" fill="#000"/><g class="pencil" transform="translate(10, 30) rotate(45)"><rect width="25" height="5" fill="#fb923c"/><polygon points="25,0 25,5 33,2.5" fill="#fed7aa"/></g></svg>` },
  { id: "pet16", name: "Capibara Freestyler", type: "capibara", hp: 40, atk: 1.1, def: 1.1, specialty: "Mate", svg: `<svg viewBox="0 0 100 100" class="pet-svg">
    <!-- Body -->
    <path d="M20,60 Q20,30 50,30 Q80,30 80,60 Q80,85 50,85 Q20,85 20,60" fill="#a0522d"/>
    <!-- Head -->
    <path d="M60,35 Q90,35 90,55 Q90,70 75,70" fill="#a0522d"/>
    <!-- Ear -->
    <circle cx="65" cy="35" r="5" fill="#8b4513"/>
    <!-- Eye -->
    <circle cx="75" cy="48" r="3" fill="#000"/>
    <!-- Nose -->
    <circle cx="88" cy="58" r="4" fill="#000"/>
    <!-- Uruguayan Flag Bandana -->
    <path d="M55,30 L75,30 L70,45 L50,45 Z" fill="#fff"/>
    <rect x="55" y="33" width="20" height="2" fill="#0038a8"/>
    <rect x="55" y="38" width="18" height="2" fill="#0038a8"/>
    <rect x="55" y="43" width="16" height="2" fill="#0038a8"/>
    <circle cx="58" cy="36" r="3" fill="#ffcc00"/>
    <!-- Mic -->
    <g transform="translate(30, 70) rotate(-15)">
      <rect x="0" y="0" width="6" height="15" fill="#334155"/>
      <circle cx="3" cy="0" r="6" fill="#94a3b8"/>
    </g>
  </svg>` }
];

export const SHOP_ITEMS = [
  { id: "food1", name: "Alpiste Tipográfico", type: "food", cost: 10, effect: { attribute: "hunger", amount: 30 }, icon: "🌰", desc: "Restaura 30 de Hambre" },
  { id: "food2", name: "Tinta Nutritiva", type: "food", cost: 25, effect: { attribute: "hunger", amount: 60 }, icon: "🍲", desc: "Restaura 60 de Hambre" },
  { id: "water1", name: "Brebaje de Rimas", type: "water", cost: 10, effect: { attribute: "thirst", amount: 30 }, icon: "💧", desc: "Restaura 30 de Sed" },
  { id: "water2", name: "Agua de Manantial", type: "water", cost: 25, effect: { attribute: "thirst", amount: 60 }, icon: "🍹", desc: "Restaura 60 de Sed" },
  { id: "health1", name: "Poción Estructural", type: "health", cost: 50, effect: { attribute: "health", amount: 40 }, icon: "💖", desc: "Cura 40 de Vida" },
  { id: "acc1", name: "Pluma Dorada", type: "accessory", cost: 150, effect: null, icon: "✒️", desc: "Accesorio puramente estético" },
  { id: "acc2", name: "Micrófono de Rubí", type: "accessory", cost: 200, effect: null, icon: "🎤", desc: "Para que tu mascota presuma" },
  { id: "pet_capibara", name: "Adopción: Capibara", type: "adoption", cost: 300, effect: { attribute: "pet", value: "pet16" }, icon: "🐾", desc: "Cambia tu mascota actual por el Capibara Uruguayo" }
];

export function calculatePetStats(petData) {
    if (!petData) return null;
    
    const now = Date.now();
    const elapsedMinutes = (now - (petData.lastInteraction || now)) / (1000 * 60);
    
    // Decay rates: drops X point per minute
    const hungerDecayRate = 0.5; // Loses 0.5 hunger per min
    const thirstDecayRate = 0.8; // Loses 0.8 thirst per min
    
    let currentHunger = Math.max(0, petData.hunger - (elapsedMinutes * hungerDecayRate));
    let currentThirst = Math.max(0, petData.thirst - (elapsedMinutes * thirstDecayRate));
    
    let currentHealth = petData.health;
    // Base damage if starving or dehydrated
    if (currentHunger <= 0 || currentThirst <= 0) {
        const damageRate = 0.5; // Loses 0.5 health per min when empty
        const timeDamaging = elapsedMinutes; // Approx fallback for empty duration difference
        currentHealth = Math.max(0, currentHealth - (timeDamaging * damageRate));
    }
    
    // Life time in hours
    const aliveHours = (now - petData.adoptedAt) / (1000 * 60 * 60);
    
    return {
        ...petData,
        hunger: Math.min(100, currentHunger),
        thirst: Math.min(100, currentThirst),
        health: Math.min(100, currentHealth),
        ageHours: aliveHours.toFixed(1)
    };
}
