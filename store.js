// --- IMPORTACIONES ---
import { 
    db, dbHistoryRef, dbPlayersRef, localPlayersCache, loggedInPlayerId, 
    showFeedback, packButtons, purchaseFeedback 
} from './main.js';
import { addDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

// --- DOM ELEMENTS ---
const packOpeningModal = document.getElementById('pack-opening-modal');
const packCardList = document.getElementById('pack-card-list');
const modalClosePackButton = document.getElementById('modal-close-pack-button');

// --- DEFINICIÓN DE CARTAS ---
const customPacks = {
    "buy-pack-1": {
        common: ["Kuriboh", "Feral Imp", "Mystical Elf", "Man-Eater Bug", "Book of Secret Arts", "Dark Hole", "Dian Keto the Cure Master", "Spellbinding Circle", "Toon World", "Hane-Hane", "Waboku"],
        rare: ["Magician of Faith", "Mask of Darkness", "Sangan", "Relinquished", "Black Illusion Ritual", "Monster Reborn", "Change of Heart", "Swords of Revealing Light", "Multiply"]
    },
    "buy-pack-2": {
        common: ["La Jinn the Mystical Genie of the Lamp", "Battle Ox", "Ryu-Kishin Powered", "Axe Raider", "Baby Dragon", "Stop Defense", "Reinforcements", "Trap Hole", "Polymerization", "Alligator's Sword", "Time Wizard"],
        rare: ["Lord of D.", "The Flute of Summoning Dragon", "Crush Card Virus", "Red-Eyes B. Dragon", "Kunai with Chain", "Mirror Force", "Blue-Eyes White Dragon", "Enemy Controller", "Scapegoat", "Thousand Dragon"]
    },
    "buy-pack-3": {
        common: ["Giant Soldier of Stone", "Witch of the Black Forest", "Mystic Tomato", "Fissure", "Remove Trap", "De-Spell", "Last Will", "Card Destruction"],
        rare: ["Pot of Greed", "Raigeki", "Heavy Storm", "Mystical Space Typhoon", "Magic Cylinder", "Call of the Haunted", "Seven Tools of the Bandit"],
        superRare: ["Jinzo", "Torrential Tribute", "Imperial Order", "Ceasefire", "Exodia the Forbidden One", "Left Arm of the Forbidden One", "Right Arm of the Forbidden One", "Left Leg of the Forbidden One", "Right Leg of the Forbidden One"]
    },
    "buy-pack-4": {
        common: ["Kuriboh", "Man-Eater Bug", "Hane-Hane", "Battle Ox", "Axe Raider", "Fissure", "Stop Defense", "Reinforcements", "Trap Hole", "Remove Trap", "De-Spell", "Dian Keto the Cure Master", "Giant Soldier of Stone"],
        rare: ["Magician of Faith", "Mask of Darkness", "Sangan", "Witch of the Black Forest", "Mystic Tomato", "Lord of D.", "The Flute of Summoning Dragon", "EnemyController", "Scapegoat", "Polymerization"],
        superRare: ["Jinzo", "Torrential Tribute", "Imperial Order", "Ceasefire", "Exodia the Forbidden One", "Left Arm of the Forbidden One", "Right Arm of the Forbidden One", "Left Leg of the Forbidden One", "Right Leg of the Forbidden One"]
    },
    "buy-pack-5": {
        common: ["La Jinn the Mystical Genie of the Lamp", "Battle Ox", "Ryu-Kishin Powered", "Vorse Raider", "XYZ-Dragon Cannon", "Y-Dragon Head", "Z-Metal Tank", "Kaibaman", "Paladin of White Dragon"],
        rare: ["Lord of D.", "The Flute of Summoning Dragon", "Blue-Eyes White Dragon", "Crush Card Virus", "Enemy Controller", "Polymerization", "Monster Reborn", "Change of Heart"],
        superRare: ["Blue-Eyes Ultimate Dragon", "Chaos Emperor Dragon - Envoy of the End", "Black Luster Soldier - Envoy of the Beginning", "Ring of Destruction", "Mirror Force", "Heavy Storm", "Pot of Greed", "Raigeki"]
    },
    "buy-pack-6": {
        rare: ["Magician of Faith", "Mask of Darkness", "Sangan", "Witch of the Black Forest", "Mystic Tomato", "Lord of D.", "The Flute of Summoning Dragon", "Enemy Controller", "Scapegoat", "Polymerization", "Monster Reborn", "Change of Heart", "Swords of Revealing Light", "Multiply", "Red-Eyes B. Dragon", "Kunai with Chain", "Time Wizard"],
        superRare: ["Jinzo", "Torrential Tribute", "Imperial Order", "Ceasefire", "Blue-Eyes Ultimate Dragon", "Ring of Destruction", "Mirror Force", "Heavy Storm", "Pot of Greed", "Raigeki", "Magic Cylinder", "Call of the Haunted", "Seven Tools of the Bandit"],
        ultraRare: ["Exodia the Forbidden One", "Left Arm of the Forbidden One", "Right Arm of the Forbidden One", "Left Leg of the Forbidden One", "Right Leg of the Forbidden One", "Chaos Emperor Dragon - Envoy of the End", "Black Luster Soldier - Envoy of the Beginning"]
    }
};

// --- INICIALIZACIÓN ---
export function initStore() {
    packButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const cost = parseInt(e.currentTarget.dataset.cost);
            const packName = e.currentTarget.dataset.name;
            const packId = e.currentTarget.id; 
            handlePurchase(packId, packName, cost);
        });
    });

    modalClosePackButton.addEventListener('click', () => {
        packOpeningModal.classList.add('hidden', 'opacity-0', 'visibility-hidden');
    });
}

// --- LÓGICA DE COMPRA ---
async function handlePurchase(packId, packName, cost) {
    if (!loggedInPlayerId) {
        return showFeedback(purchaseFeedback, "Debes iniciar sesión para comprar.", true);
    }

    const player = localPlayersCache.get(loggedInPlayerId);
    if (!player) {
        return showFeedback(purchaseFeedback, "Error: No se encontró tu usuario.", true);
    }

    if (player.dp < cost) {
        return showFeedback(purchaseFeedback, `DP insuficientes. Necesitas ${cost} DP.`, true);
    }

    const newDp = player.dp - cost;
    try {
        const pulledCards = openPack(packId);
        const currentCollection = player.card_collection || {};
        pulledCards.forEach(cardName => {
            const currentQty = currentCollection[cardName] || 0;
            currentCollection[cardName] = currentQty + 1;
        });

        const playerRef = doc(dbPlayersRef, loggedInPlayerId);
        await updateDoc(playerRef, { 
            dp: newDp,
            card_collection: currentCollection
        });

        const historyEntry = {
            text: `${player.name} compró "${packName}" por ${cost} DP. (DP restantes: ${newDp})`,
            timestamp: Date.now(),
            type: 'buy'
        };
        await addDoc(dbHistoryRef, historyEntry);
        
        showFeedback(purchaseFeedback, `¡Compra exitosa! ${packName} adquirido.`);
        showPackOpeningModal(pulledCards);

    } catch (error) {
        console.error("Error al comprar pack:", error);
        showFeedback(purchaseFeedback, "Error al procesar la compra.", true);
    }
}

// --- FUNCIONES DE AYUDA (HELPERS) ---
function getRandomCards(arr, n) {
    const result = new Array(n);
    let len = arr.length;
    const taken = new Array(len);
    if (n > len) n = len;
    while (n--) {
        const x = Math.floor(Math.random() * len);
        result[n] = arr[x in taken ? taken[x] : x];
        taken[x] = --len in taken ? taken[len] : len;
    }
    return result;
}

function openPack(packId) {
    const pools = customPacks[packId];
    if (!pools) return ["Error: Pack no definido"];
    let pulledCards = [];

    if (packId === "buy-pack-1" || packId === "buy-pack-2") {
        pulledCards = [...getRandomCards(pools.common, 4), ...getRandomCards(pools.rare, 1)];
    } else if (packId === "buy-pack-3") {
        pulledCards = [...getRandomCards(pools.common, 3), ...getRandomCards(pools.rare, 1), ...getRandomCards(pools.superRare, 1)];
    } else if (packId === "buy-pack-4") {
        pulledCards = [...getRandomCards(pools.common, 4)];
        pulledCards.push(...getRandomCards(Math.random() < 0.10 ? pools.superRare : pools.rare, 1));
    } else if (packId === "buy-pack-5") {
        pulledCards = [...getRandomCards(pools.common, 4), ...getRandomCards(pools.rare, 2), ...getRandomCards(pools.superRare, 1)];
    } else if (packId === "buy-pack-6") {
        pulledCards = [...getRandomCards(pools.rare, 4), ...getRandomCards(pools.superRare, 2), ...getRandomCards(pools.ultraRare, 1)];
    }
    return pulledCards;
}

function showPackOpeningModal(cards) {
    packCardList.innerHTML = '';
    cards.forEach(cardName => {
        const li = document.createElement('li');
        li.className = "text-lg text-gray-200 font-medium";
        li.textContent = cardName;
        packCardList.appendChild(li);
    });
    packOpeningModal.classList.remove('hidden', 'opacity-0', 'visibility-hidden');
    modalClosePackButton.focus();
}
