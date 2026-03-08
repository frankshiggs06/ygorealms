// Base SVGs for 10 Pets
// These SVGs are styled inside the app
export const PETS_DATA = [
  { id: "pet1", name: "Búho MC", type: "owl", svg: `<svg viewBox="0 0 100 100" class="pet-svg"><circle cx="50" cy="50" r="40" fill="#7c3aed"/><circle cx="35" cy="40" r="10" fill="#fff"/><circle cx="65" cy="40" r="10" fill="#fff"/><circle cx="35" cy="40" r="3" fill="#000"/><circle cx="65" cy="40" r="3" fill="#000"/><path d="M45,55 L55,55 L50,65 Z" fill="#f59e0b"/><rect x="25" y="70" width="10" height="20" fill="#a855f7" rx="5" transform="rotate(-30 25 70)"/><rect x="65" y="70" width="10" height="20" fill="#a855f7" rx="5" transform="rotate(30 65 70)"/><g class="mic" transform="translate(60, 60)"><rect x="0" y="0" width="6" height="15" fill="#94a3b8"/><circle cx="3" cy="0" r="6" fill="#cbd5e1"/></g></svg>` },
  { id: "pet2", name: "Cuervo Lápiz", type: "raven", svg: `<svg viewBox="0 0 100 100" class="pet-svg"><path d="M20,60 C20,30 80,30 80,60 C80,90 20,90 20,60 Z" fill="#1e293b"/><circle cx="30" cy="50" r="8" fill="#fff"/><circle cx="28" cy="50" r="3" fill="#ef4444"/><path d="M10,60 L20,55 L20,65 Z" fill="#facc15"/><path class="feather" d="M80,50 L95,45 L90,60 Z" fill="#0f172a"/><g class="pencil" transform="translate(10, 75) rotate(-45)"><rect width="30" height="6" fill="#fbbf24"/><polygon points="30,0 30,6 40,3" fill="#fcd34d"/><polygon points="38,2 38,4 40,3" fill="#000"/></g></svg>` },
  { id: "pet3", name: "Zorro Poeta", type: "fox", svg: `<svg viewBox="0 0 100 100" class="pet-svg"><polygon points="20,40 50,80 80,40 60,30 40,30" fill="#ea580c"/><polygon points="20,40 35,10 40,30" fill="#ea580c"/><polygon points="80,40 65,10 60,30" fill="#ea580c"/><polygon points="20,40 50,80 80,40 60,50 40,50" fill="#fff"/><circle cx="40" cy="45" r="4" fill="#000"/><circle cx="60" cy="45" r="4" fill="#000"/><circle cx="50" cy="55" r="3" fill="#000"/><g class="quill" transform="translate(70, 60) rotate(30)"><path d="M0,30 Q10,10 20,0 Q10,20 -5,15" fill="#e2e8f0"/></g></svg>` },
  { id: "pet4", name: "Gato Rítmico", type: "cat", svg: `<svg viewBox="0 0 100 100" class="pet-svg"><circle cx="50" cy="60" r="30" fill="#475569"/><polygon points="25,35 35,60 15,60" fill="#475569" transform="rotate(15 25 35)"/><polygon points="75,35 65,60 85,60" fill="#475569" transform="rotate(-15 75 35)"/><path d="M30,55 Q50,45 70,55" stroke="#fff" stroke-width="2" fill="none"/><circle cx="40" cy="55" r="4" fill="#fff"/><circle cx="60" cy="55" r="4" fill="#fff"/><g class="mic" transform="translate(45, 75)"><rect x="0" y="0" width="10" height="20" fill="#1e293b"/><circle cx="5" cy="0" r="8" fill="#e2e8f0"/></g></svg>` },
  { id: "pet5", name: "Lobo Freestyle", type: "wolf", svg: `<svg viewBox="0 0 100 100" class="pet-svg"><polygon points="30,50 50,80 70,50 60,30 40,30" fill="#94a3b8"/><polygon points="25,15 40,35 30,50" fill="#94a3b8"/><polygon points="75,15 60,35 70,50" fill="#94a3b8"/><circle cx="40" cy="45" r="3" fill="#000"/><circle cx="60" cy="45" r="3" fill="#000"/><polygon points="45,60 55,60 50,70" fill="#000"/><g class="pencil" transform="translate(15, 65) rotate(45)"><rect width="20" height="5" fill="#ef4444"/><polygon points="20,0 20,5 28,2.5" fill="#fed7aa"/></g></svg>` },
  { id: "pet6", name: "Dragón Verso", type: "dragon", svg: `<svg viewBox="0 0 100 100" class="pet-svg"><circle cx="50" cy="50" r="35" fill="#10b981"/><path d="M15,50 C10,30 40,20 50,20" stroke="#047857" stroke-width="5" fill="none"/><path d="M85,50 C90,30 60,20 50,20" stroke="#047857" stroke-width="5" fill="none"/><circle cx="35" cy="45" r="6" fill="#fbbf24"/><circle cx="65" cy="45" r="6" fill="#fbbf24"/><polygon points="40,65 60,65 50,75" fill="#ef4444"/><path class="fire" d="M50,75 L45,90 L50,85 L55,90 Z" fill="#f59e0b"/></svg>` },
  { id: "pet7", name: "Panda Flow", type: "panda", svg: `<svg viewBox="0 0 100 100" class="pet-svg"><circle cx="50" cy="55" r="35" fill="#fff"/><circle cx="25" cy="30" r="15" fill="#000"/><circle cx="75" cy="30" r="15" fill="#000"/><circle cx="35" cy="50" r="12" fill="#000"/><circle cx="65" cy="50" r="12" fill="#000"/><circle cx="35" cy="50" r="3" fill="#fff"/><circle cx="65" cy="50" r="3" fill="#fff"/><circle cx="50" cy="65" r="5" fill="#000"/><g class="mic" transform="translate(68, 65) rotate(-20)"><rect width="6" height="15" fill="#64748b"/><circle cx="3" cy="0" r="6" fill="#fbbf24"/></g></svg>` },
  { id: "pet8", name: "Murciélago MC", type: "bat", svg: `<svg viewBox="0 0 100 100" class="pet-svg"><circle cx="50" cy="50" r="25" fill="#334155"/><path d="M25,50 C10,30 10,70 30,60" fill="#1e293b"/><path d="M75,50 C90,30 90,70 70,60" fill="#1e293b"/><polygon points="35,25 45,35 40,50" fill="#334155"/><polygon points="65,25 55,35 60,50" fill="#334155"/><circle cx="43" cy="45" r="4" fill="#ef4444"/><circle cx="57" cy="45" r="4" fill="#ef4444"/><polygon points="45,55 55,55 50,65" fill="#fff"/></svg>` },
  { id: "pet9", name: "Mono Rima", type: "monkey", svg: `<svg viewBox="0 0 100 100" class="pet-svg"><circle cx="50" cy="50" r="30" fill="#8b5cf6"/><circle cx="20" cy="50" r="12" fill="#fb7185"/><circle cx="80" cy="50" r="12" fill="#fb7185"/><circle cx="50" cy="60" r="20" fill="#fb7185"/><circle cx="40" cy="45" r="5" fill="#000"/><circle cx="60" cy="45" r="5" fill="#000"/><path d="M40,65 Q50,75 60,65" stroke="#000" stroke-width="3" fill="none"/><g class="pencil" transform="translate(10, 60) rotate(-30)"><rect width="25" height="6" fill="#2dd4bf"/><polygon points="25,0 25,6 35,3" fill="#fcd34d"/></g></svg>` },
  { id: "pet10", name: "Pingüino Tinta", type: "penguin", svg: `<svg viewBox="0 0 100 100" class="pet-svg"><ellipse cx="50" cy="55" rx="30" ry="40" fill="#0f172a"/><ellipse cx="50" cy="60" rx="20" ry="25" fill="#fff"/><circle cx="40" cy="40" r="4" fill="#fff"/><circle cx="60" cy="40" r="4" fill="#fff"/><polygon points="45,50 55,50 50,60" fill="#f59e0b"/><path d="M15,50 C5,60 10,80 25,65" fill="#0f172a"/><path d="M85,50 C95,60 90,80 75,65" fill="#0f172a"/><g class="quill" transform="translate(75, 45) rotate(15)"><path d="M0,25 Q15,10 25,0 Q10,25 -5,20" fill="#38bdf8"/></g></svg>` }
];

export const SHOP_ITEMS = [
  { id: "food1", name: "Alpiste Tipográfico", type: "food", cost: 10, effect: { attribute: "hunger", amount: 30 }, icon: "🌰", desc: "Restaura 30 de Hambre" },
  { id: "food2", name: "Tinta Nutritiva", type: "food", cost: 25, effect: { attribute: "hunger", amount: 60 }, icon: "🍲", desc: "Restaura 60 de Hambre" },
  { id: "water1", name: "Brebaje de Rimas", type: "water", cost: 10, effect: { attribute: "thirst", amount: 30 }, icon: "💧", desc: "Restaura 30 de Sed" },
  { id: "water2", name: "Agua de Manantial", type: "water", cost: 25, effect: { attribute: "thirst", amount: 60 }, icon: "🍹", desc: "Restaura 60 de Sed" },
  { id: "health1", name: "Poción Estructural", type: "health", cost: 50, effect: { attribute: "health", amount: 40 }, icon: "💖", desc: "Cura 40 de Vida" },
  { id: "acc1", name: "Pluma Dorada", type: "accessory", cost: 150, effect: null, icon: "✒️", desc: "Accesorio puramente estético" },
  { id: "acc2", name: "Micrófono de Rubí", type: "accessory", cost: 200, effect: null, icon: "🎤", desc: "Para que tu mascota presuma" }
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
