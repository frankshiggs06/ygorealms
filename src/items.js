// items.js
// 30 Objetos para la tienda: Equipamiento y Consumibles para Batalla

export const EQUIPMENT_DATA = [
    // --- Cabeza ---
    { id: "eq_head_1", name: 'Gorra "Underground"', type: "head", price: 200, stats: { atk: 1.05, def: 1.0 }, desc: "+5% ATK | Rimas crudas" },
    { id: "eq_head_2", name: "Corona de Laureles", type: "head", price: 300, stats: { atk: 1.0, def: 1.10 }, desc: "+10% DEF | Defensa Clásica" },
    { id: "eq_head_3", name: "Auriculares Estudio", type: "head", price: 400, stats: { atk: 1.05, def: 1.05 }, desc: "+5% ATK, +5% DEF | Aísla el ruido" },
    { id: "eq_head_4", name: "Sombrero de Copa", type: "head", price: 500, stats: { atk: 1.0, def: 1.15 }, desc: "+15% DEF | Minimiza daño recibido" },
    { id: "eq_head_5", name: "Bandana Neón", type: "head", price: 600, stats: { atk: 1.08, def: 1.0 }, desc: "+8% ATK | Estilo puro" },

    // --- Pecho ---
    { id: "eq_chest_1", name: "Sudadera Oversize", type: "chest", price: 250, stats: { atk: 1.0, def: 1.05 }, desc: "+5% DEF | Mayor resistencia", hpBonus: 10 },
    { id: "eq_chest_2", name: "Chaleco Táctico MC", type: "chest", price: 450, stats: { atk: 1.0, def: 1.15 }, desc: "+15% DEF | Blindaje punchlines" },
    { id: "eq_chest_3", name: 'Chaqueta "Rockstar"', type: "chest", price: 500, stats: { atk: 1.10, def: 1.0 }, desc: "+10% ATK | Agresividad literaria" },
    { id: "eq_chest_4", name: "Armadura de Placas", type: "chest", price: 750, stats: { atk: 0.95, def: 1.25 }, desc: "+25% DEF, -5% ATK | Impenetrable" },
    { id: "eq_chest_5", name: "Túnica de Trovador", type: "chest", price: 600, stats: { atk: 1.05, def: 1.05 }, desc: "+5% ATK, +5% DEF | Equilibrio místico" },

    // --- Manos ---
    { id: "eq_hands_1", name: "Guanteletes de Tinta", type: "hands", price: 300, stats: { atk: 1.10, def: 1.0 }, desc: "+10% ATK | Golpean duro" },
    { id: "eq_hands_2", name: "Anillos Macizos", type: "hands", price: 600, stats: { atk: 1.0, def: 1.0 }, desc: "10% Prob Crítico x1.5 | Bling bling", effect: "crit_10" },
    { id: "eq_hands_3", name: "Mitones Frios", type: "hands", price: 500, stats: { atk: 1.0, def: 1.0 }, desc: "Rival pierde -1 daño fijo", effect: "flat_dmg_red_1" },
    { id: "eq_hands_4", name: "Vendas Liricas", type: "hands", price: 450, stats: { atk: 1.12, def: 1.0 }, desc: "+12% ATK | Preparado para ring" },
    { id: "eq_hands_5", name: "Guantes de Seda", type: "hands", price: 400, stats: { atk: 1.0, def: 1.10 }, desc: "+10% DEF | Desvía insultos" },

    // --- Pies ---
    { id: "eq_feet_1", name: 'Zapatillas "Air Verse"', type: "feet", price: 800, stats: { atk: 1.0, def: 1.0 }, desc: "10% Evadir Daño | Agilidad pura", effect: "dodge_10" },
    { id: "eq_feet_2", name: "Botas de Combate", type: "feet", price: 400, stats: { atk: 1.0, def: 1.15 }, desc: "+15% DEF | Firme en suelo" },
    { id: "eq_feet_3", name: "Zapatos de Claqué", type: "feet", price: 350, stats: { atk: 1.08, def: 1.0 }, desc: "+8% ATK | Ritmo perfecto" },
    { id: "eq_feet_4", name: "Sandalias Ermitañas", type: "feet", price: 450, stats: { atk: 1.05, def: 1.10 }, desc: "+5% ATK, +10% DEF | Ancestral" },
    { id: "eq_feet_5", name: "Tenis LED", type: "feet", price: 550, stats: { atk: 1.0, def: 1.0 }, desc: "Rival -5% DEF | Molestia visual", effect: "enemy_def_minus_5" },

    // --- Arma ---
    { id: "eq_weap_1", name: "Micrófono Dorado", type: "weapon", price: 1000, stats: { atk: 1.20, def: 1.0 }, desc: "+20% ATK | Limitado" },
    { id: "eq_weap_2", name: "Pluma Fénix", type: "weapon", price: 900, stats: { atk: 1.10, def: 1.0 }, desc: "+10% ATK | +1 HP residual rival", effect: "burn_1" },
    { id: "eq_weap_3", name: "Lápiz Delineador", type: "weapon", price: 500, stats: { atk: 1.15, def: 1.0 }, desc: "+15% ATK | Precisión lírica" },
    { id: "eq_weap_4", name: "Megáfono Protesta", type: "weapon", price: 800, stats: { atk: 1.12, def: 1.0 }, desc: "+12% ATK | Evade Primer Escudo", effect: "pierce_shield" },
    { id: "eq_weap_5", name: "Tintero Veneno", type: "weapon", price: 750, stats: { atk: 1.05, def: 1.0 }, desc: "+5% ATK | Rival -2% DEF x ronda", effect: "poison_2" }
];

export const CONSUMABLES_DATA = [
    { id: "cons_1", name: 'Bebida "Flow Bull"', type: "consumable", price: 150, desc: "Restaura 15 HP al instante.", effect: "heal_15", maxStack: 3 },
    { id: "cons_2", name: "Diccionario Rimas", type: "consumable", price: 200, desc: "Garantiza +2 ptos base a tu IA.", effect: "ia_plus_2", maxStack: 1 },
    { id: "cons_3", name: "Escudo Semántico", type: "consumable", price: 250, desc: "Bloquea 50% del prox daño recibido.", effect: "shield_50", maxStack: 1 },
    { id: "cons_4", name: "Café Doble Expreso", type: "consumable", price: 300, desc: "Multiplica +30% ATK por 1 turno.", effect: "atk_30", maxStack: 1 },
    { id: "cons_5", name: "Reloj Arena Rota", type: "consumable", price: 400, desc: "Agrega 15s al temporizador de ronda.", effect: "time_15", maxStack: 1 }
];
