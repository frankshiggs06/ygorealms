import { setupFirebase, createOrJoinLobby, listenToMatch, updateMatchStatus, submitText, updateScore, updateBattleDamage, updateWeeklyLeaderboard, getWeeklyLeaderboard, getUserProfile, updateUserProfile, awardSkillPoints, setupDisconnectHook, cancelDisconnectHook, healPlayer } from './firebase.js';
import { getRandomWord } from './words.js';
import { evaluateMetaphor, evaluateFinalMatch, evaluateMemoryRound } from './groq.js';
import { petTalkToAI, petThoughtsToAI } from './groq.js';
import { ParticleSystem } from './particles.js';
import { PETS_DATA, SHOP_ITEMS, calculatePetStats } from './pets.js';
import { EQUIPMENT_DATA, CONSUMABLES_DATA } from './items.js';
import './VirtualWorld.js';

// Main screen definitions
const screens = {
  login: document.getElementById('login-screen'),
  menu: document.getElementById('menu-screen'),
  leaderboard: document.getElementById('leaderboard-screen'),
  lobby: document.getElementById('lobby-screen'),
  game: document.getElementById('game-screen'),
  results: document.getElementById('results-screen'),
  bonus: document.getElementById('bonus-screen'),
  recap: document.getElementById('recap-screen'),
  end: document.getElementById('end-screen'),
  pet: document.getElementById('pet-screen'),
  shop: document.getElementById('shop-screen'),
  battle: document.getElementById('battle-screen'),
  solitario: document.getElementById('solitario-screen'),
  virtualWorld: document.getElementById('virtual-world-screen')
};

const particles = new ParticleSystem('particles-canvas');

// State
let appState = {
  username: "",
  roomId: null,
  userId: null,
  isHost: false,
  players: [], // {id, name, score, slot}
  playersCount: 2,
  currentRound: 0,
  currentWord: "",
  timerInterval: null,
  roundTime: 30, 
  lastStatus: "",
  lastRound: 0,
  isTimerActive: false,
  isRecapShown: false,
  bonusWords: [],
  hasBonusPlayed: false,
  profile: null, // Will hold the whole node from getUserProfile
  activeBuffs: {
      atkMulti: 1.0,
      iaBonus: 0,
      shield: false,
      enemyDefMinus: 0, 
      dmgFlatRed: 0
  }
};

// Elements
const usernameInput = document.getElementById('username-input');
const waitTimeSelect = document.getElementById('wait-time-select');
const playerCountSelect = document.getElementById('player-count-select');
const loginBtn = document.getElementById('login-btn');
const loginError = document.getElementById('login-error');

// Menu Elements
const menuPlayBtn = document.getElementById('menu-play-btn');
const menuLeaderboardBtn = document.getElementById('menu-leaderboard-btn');
const menuPetBtn = document.getElementById('menu-pet-btn');
const menuShopBtn = document.getElementById('menu-shop-btn');
const menuWorldBtn = document.getElementById('menu-world-btn');
const menuWelcomeText = document.getElementById('menu-welcome-text');
const leaderboardBackBtn = document.getElementById('leaderboard-back-btn');
const leaderboardList = document.getElementById('leaderboard-list');

// Lobby Elements
const lobbyUsername = document.getElementById('lobby-username');
const matchStatus = document.getElementById('match-status');
const playersFoundPanel = document.getElementById('players-found-panel');

const timerText = document.getElementById('timer-text');
const timerCircle = document.querySelector('.timer-circle');
const currentWordEl = document.getElementById('current-word');
const gameInputEl = document.getElementById('game-input');
const wordCountEl = document.getElementById('word-count');
const roundNumberEl = document.getElementById('round-number');
const waitingOverlay = document.getElementById('waiting-overlay');

// Pet & Shop Elements
const petBackBtn = document.getElementById('pet-back-btn');
const shopBackBtn = document.getElementById('shop-back-btn');

function showScreen(screenKey) {
  Object.keys(screens).forEach(k => {
    const s = screens[k];
    if (!s) return; // Safety check
    
    if (k !== screenKey) {
        s.classList.add('hidden');
        s.classList.remove('active');
    } else {
        s.classList.remove('hidden');
        s.classList.add('active');
    }
  });
  
  // Dynamically update the main menu SP whenever it comes into view
  if (screenKey === 'menu' && appState && appState.profile) {
      const spEl = document.getElementById('navbar-sp');
      if (spEl) spEl.innerText = appState.profile.skillPoints;
  }
}

// 1. INIT / LOGIN
setupFirebase();

loginBtn.addEventListener('click', async () => {
    const username = usernameInput.value.trim();
    if (username.length < 3) {
        loginError.innerText = "Mínimo 3 caracteres";
        return;
    }
    
    // Step 1: Check if we are starting or already in PIN mode
    const pinSection = document.getElementById('pin-section');
    const isPinVisible = !pinSection.classList.contains('hidden');
    
    if (!isPinVisible) {
        loginBtn.innerText = "Verificando...";
        loginBtn.disabled = true;
        
        try {
            const profile = await getUserProfile(username);
            loginBtn.disabled = false;
            loginBtn.innerText = "Entrar";
            
            pinSection.classList.remove('hidden');
            const pinLabel = document.getElementById('pin-label');
            
            // If user is new (only base fields) or legacy (no pin property)
            if (!profile || !profile.pin) {
                pinLabel.innerText = "Crea tu PIN de 4 dígitos:";
                appState._loginMode = "setting";
                appState._tempProfile = profile; 
            } else {
                pinLabel.innerText = "Ingresa tu PIN:";
                appState._loginMode = "verify";
                appState._tempProfile = profile;
            }
            
            document.getElementById('pin-input-direct').focus();
            usernameInput.disabled = true; // Lock username
        } catch(err) {
            console.error(err);
            loginError.innerText = "Error de conexión.";
            loginBtn.disabled = false;
            loginBtn.innerText = "Entrar";
        }
    } else {
        // Step 2: Handle PIN entry
        const pin = document.getElementById('pin-input-direct').value;
        
        if (pin.length < 4) {
            loginError.innerText = "PIN incompleto";
            return;
        }

        loginBtn.innerText = "Cargando...";
        loginBtn.disabled = true;

        try {
            const p = appState._tempProfile;
            if (appState._loginMode === "setting") {
                // Update or create with PIN
                const updates = { pin: pin };
                if (!p) {
                    // New user creation (default fields + PIN)
                    const defaultProfile = {
                        username: username,
                        skillPoints: 100,
                        inventory: { "food1": 0, "food2": 0, "water1": 0, "water2": 0, "health1":0, "acc1": 0, "acc2": 0 },
                        equipment: { head: null, chest: null, hands: null, feet: null, weapon: null },
                        consumables: [], // up to 3 keys "cons_1"
                        pet: null,
                        pin: pin
                    };
                    await updateUserProfile(username, defaultProfile);
                    appState.profile = defaultProfile;
                } else {
                    await updateUserProfile(username, updates);
                    appState.profile = { ...p, ...updates };
                }
            } else {
                // Verification
                if (p.pin !== pin) {
                    loginError.innerText = "PIN incorrecto";
                    loginBtn.innerText = "Entrar";
                    loginBtn.disabled = false;
                    // Clear pin
                    document.getElementById('pin-input-direct').value = "";
                    document.getElementById('pin-input-direct').focus();
                    return;
                }
                
                // Backwards compatibility for early accounts
                if (!p.equipment) p.equipment = { head: null, chest: null, hands: null, feet: null, weapon: null };
                if (!p.consumables) p.consumables = [];
                
                appState.profile = p;
            }

            appState.username = username;
            
            // UI Sync
            const spEl = document.getElementById('navbar-sp');
            if(spEl) spEl.innerText = appState.profile.skillPoints;
            menuWelcomeText.innerText = `Bienvenido, ${username}`;
            
            sessionStorage.setItem('rhymestrain_user', username);
            showScreen('menu');
            particles.start();
        } catch(err) {
            console.error(err);
            loginError.innerText = "Error al iniciar sesión.";
        } finally {
            loginBtn.innerText = "Entrar";
            loginBtn.disabled = false;
        }
    }
});

// Simplified PIN cleanup
document.addEventListener('DOMContentLoaded', () => {
    const pinIn = document.getElementById('pin-input-direct');
    if (pinIn) {
        pinIn.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4);
        });
    }
});


// -- RE-LOGIN CHECK --
async function checkExistingSession() {
    const savedUser = sessionStorage.getItem('rhymestrain_user');
    if (savedUser) {
        try {
            const profile = await getUserProfile(savedUser);
            
            // Backwards compatibility for early accounts
            if (!profile.equipment) profile.equipment = { head: null, chest: null, hands: null, feet: null, weapon: null };
            if (!profile.consumables) profile.consumables = [];
            
            appState.profile = profile;
            appState.username = savedUser;
            const spEl = document.getElementById('navbar-sp');
            if(spEl) spEl.innerText = profile.skillPoints;
            menuWelcomeText.innerText = `Bienvenido, ${savedUser}`;
            showScreen('menu');
            particles.start();
        } catch(e) {
            console.error("Session restoration failed", e);
        }
    }
}
checkExistingSession();

// -- MENU INTERACTIONS --
const modeModalOverlay = document.getElementById('mode-modal-overlay');
const closeModalBtn = document.getElementById('close-modal-btn');
const modeRetoBtn = document.getElementById('mode-reto-btn');
const modeBatallaBtn = document.getElementById('mode-batalla-btn');
const modeSolitarioBtn = document.getElementById('mode-solitario-btn');
const waitTimeGroup = document.getElementById('wait-time-group');

menuPlayBtn.addEventListener('click', () => {
    // Open the epic modal
    modeModalOverlay.classList.remove('hidden');
});

closeModalBtn.addEventListener('click', () => {
    modeModalOverlay.classList.add('hidden');
});

modeRetoBtn.addEventListener('click', async () => {
    modeModalOverlay.classList.add('hidden');
    appState.roundTime = parseInt(waitTimeSelect.value);
    appState.playersCount = parseInt(playerCountSelect.value);
    
    lobbyUsername.innerText = appState.username;
    showScreen('lobby');
    
    try {
        const { roomId, userId, isHost } = await createOrJoinLobby(appState.username, appState.roundTime, appState.playersCount, "reto", null, appState.profile.equipment, appState.profile.consumables, onGameStartRequested);

        appState.roomId = roomId;
        appState.userId = userId;
        appState.isHost = isHost;

        setupDisconnectHook(roomId);
        listenToMatch(roomId, handleMatchStateChange);
    } catch (e) {
        console.error("Matchmaking Error (Reto):", e);
        alert("Error de conexión: " + e.message);
        showScreen('menu');
    }
});

modeBatallaBtn.addEventListener('click', async () => {
    if (!appState.profile.pet) {
        alert("Necesitas una mascota para jugar el Modo Batalla. ¡Ve a Personaje para elegir una!");
        return;
    }
    
    const stats = calculatePetStats(appState.profile.pet);
    if (stats.health <= 0) {
        alert("Tu mascota está exhausta (Salud: 0). Dale medicina o comida desde el inventario antes de combatir.");
        return;
    }

    modeModalOverlay.classList.add('hidden');
    appState.roundTime = parseInt(waitTimeSelect.value);
    appState.playersCount = 2; // Forced to 2 players for battles
    
    const myPetDef = PETS_DATA.find(p => p.id === appState.profile.pet.id) || { name: "Desconocido" };
    lobbyUsername.innerText = appState.username + " & " + myPetDef.name;
    showScreen('lobby');
    
    try {
        const { roomId, userId, isHost } = await createOrJoinLobby(appState.username, appState.roundTime, 2, "batalla", appState.profile.pet, appState.profile.equipment, appState.profile.consumables, onGameStartRequested);

        appState.roomId = roomId;
        appState.userId = userId;
        appState.isHost = isHost;

        setupDisconnectHook(roomId);
        listenToMatch(roomId, handleMatchStateChange);
    } catch (e) {
        console.error("Matchmaking Error (Batalla):", e);
        alert("Error de conexión: " + e.message);
        showScreen('menu');
    }
});

modeSolitarioBtn.addEventListener('click', async () => {
    modeModalOverlay.classList.add('hidden');
    appState.roundTime = 60; // Fixed time for memory mode
    appState.playersCount = parseInt(playerCountSelect.value); // Support 2 or 3
    
    lobbyUsername.innerText = appState.username;
    showScreen('lobby');
    
    try {
        const { roomId, userId, isHost } = await createOrJoinLobby(appState.username, appState.roundTime, appState.playersCount, "solitario", null, appState.profile.equipment, appState.profile.consumables, onGameStartRequested);

        appState.roomId = roomId;
        appState.userId = userId;
        appState.isHost = isHost;

        setupDisconnectHook(roomId);
        listenToMatch(roomId, handleMatchStateChange);
    } catch (e) {
        console.error("Matchmaking Error (Solitario):", e);
        alert("Error de conexión: " + e.message);
        showScreen('menu');
    }
});

menuLeaderboardBtn.addEventListener('click', async () => {
    showScreen('leaderboard');
    leaderboardList.innerHTML = '<div class="spinner"></div><p style="text-align: center;">Cargando...</p>';
    
    const data = await getWeeklyLeaderboard();
    leaderboardList.innerHTML = "";
    
    if (data.length === 0) {
        leaderboardList.innerHTML = '<p style="text-align: center; color: var(--text-muted);">Aún no hay puntuaciones esta semana. ¡Sé el primero!</p>';
        return;
    }
    
    data.forEach((entry, index) => {
        const div = document.createElement('div');
        div.className = 'leaderboard-item';
        let rankColor = "var(--secondary-color)";
        if (index === 0) rankColor = "#FFD700";
        if (index === 1) rankColor = "#C0C0C0";
        if (index === 2) rankColor = "#CD7F32";
        
        div.innerHTML = `
            <div class="leaderboard-rank" style="color: ${rankColor}">#${index + 1}</div>
            <div class="leaderboard-name">${entry.username}</div>
            <div class="leaderboard-score">${entry.score} pts</div>
        `;
        leaderboardList.appendChild(div);
    });
});

leaderboardBackBtn.addEventListener('click', () => {
    showScreen('menu');
});

// -- PET & SHOP & WORLD INTERACTIONS --

menuShopBtn.addEventListener('click', () => {
    showScreen('shop');
    document.getElementById('shop-navbar-sp').innerText = appState.profile.skillPoints;
    renderShop();
});

menuPetBtn.addEventListener('click', () => {
    showScreen('pet');
    document.getElementById('pet-navbar-sp').innerText = appState.profile.skillPoints;
    renderPetScreen();
});

menuWorldBtn.addEventListener('click', () => {
    showScreen('virtualWorld');
    document.getElementById('world-username-hud').innerText = appState.username;
    // We will initialize the VirtualWorld module here later once it's imported
    if (window.initVirtualWorld) {
        window.initVirtualWorld(appState.username, appState.profile.pet);
    }
});

petBackBtn.addEventListener('click', () => showScreen('menu'));
shopBackBtn.addEventListener('click', () => showScreen('menu'));
document.getElementById('world-back-btn').addEventListener('click', () => {
    showScreen('menu');
    if (window.exitVirtualWorld) window.exitVirtualWorld();
});

// -- PET CHAT UI EVENTS --
const petChatPanel = document.getElementById('pet-chat-panel');
const petChatOpenBtn = document.getElementById('pet-chat-open-btn');
const petChatCloseBtn = document.getElementById('chat-close-btn');
const chatMsgsContainer = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const chatSendBtn = document.getElementById('chat-send-btn');
let currentChatHistory = [];

async function renderChatMessages() {
    chatMsgsContainer.innerHTML = "";
    currentChatHistory.forEach(msg => {
        const div = document.createElement('div');
        div.className = `chat-message ${msg.sender}`;
        div.innerHTML = `
            <div>${msg.content}</div>
            <div class="chat-meta">${new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
        `;
        chatMsgsContainer.appendChild(div);
    });
    // Scroll to bottom
    chatMsgsContainer.scrollTop = chatMsgsContainer.scrollHeight;
}

petChatOpenBtn.addEventListener('click', async () => {
    petChatPanel.classList.remove('hidden');
    chatInput.value = "";
    chatMsgsContainer.innerHTML = '<div style="text-align:center; color:gray;">Cargando chat...</div>';
    
    // Load history
    currentChatHistory = await getPetChatHistory(appState.username);
    
    const petName = appState.profile.pet ? PETS_DATA.find(p => p.id === appState.profile.pet.id)?.name : "Mascota";
    document.getElementById('chat-pet-name').innerText = petName || "Mascota";
    
    renderChatMessages();
});

petChatCloseBtn.addEventListener('click', () => {
    petChatPanel.classList.add('hidden');
});

chatSendBtn.addEventListener('click', async () => {
    const text = chatInput.value.trim();
    if (!text || !appState.profile.pet) return;
    
    // Disable input while processing
    chatInput.disabled = true;
    chatSendBtn.disabled = true;
    chatInput.value = "";
    
    // Create User Message
    const userMsg = { sender: 'user', content: text, timestamp: Date.now() };
    currentChatHistory.push(userMsg);
    renderChatMessages();
    
    // Show typing indicator
    const typingInd = document.createElement('div');
    typingInd.className = 'typing-indicator';
    typingInd.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
    chatMsgsContainer.appendChild(typingInd);
    chatMsgsContainer.scrollTop = chatMsgsContainer.scrollHeight;
    
    // Call AI
    const petDef = PETS_DATA.find(p => p.id === appState.profile.pet.id);
    const aiResponseText = await chatWithPet(petDef, appState.profile.stats, currentChatHistory, text);
    
    // Remove typing indicator
    typingInd.remove();
    
    // Add AI Response
    const aiMsg = { sender: 'pet', content: aiResponseText, timestamp: Date.now() };
    currentChatHistory.push(aiMsg);
    renderChatMessages();
    
    // Save to Firebase
    await savePetChatHistory(appState.username, currentChatHistory);
    
    // Re-enable input
    chatInput.disabled = false;
    chatSendBtn.disabled = false;
    chatInput.focus();
});

let currentShopTab = 'food';

document.querySelectorAll('.shop-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
        document.querySelectorAll('.shop-tab').forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');
        currentShopTab = e.target.getAttribute('data-tab');
        renderShop();
    });
});

function renderShop() {
    const grid = document.getElementById('shop-items-grid');
    grid.innerHTML = "";
    
    let itemsToRender = [];
    if (currentShopTab === 'food') {
        itemsToRender = SHOP_ITEMS;
    } else if (currentShopTab === 'equip') {
        itemsToRender = EQUIPMENT_DATA;
    } else if (currentShopTab === 'cons') {
        itemsToRender = CONSUMABLES_DATA;
    }

    itemsToRender.forEach(item => {
        // legacy items have "cost", new ones have "price"
        const finalPrice = item.cost || item.price;
        const icon = item.icon || (item.type === 'head' ? '🧢' : item.type === 'chest' ? '👕' : item.type === 'hands' ? '🧤' : item.type === 'feet' ? '👟' : item.type === 'weapon' ? '🎤' : '🧪');
        
        const canAfford = appState.profile.skillPoints >= finalPrice;
        const div = document.createElement('div');
        div.className = 'shop-item-card glass-panel';
        div.innerHTML = `
            <div class="shop-icon" style="font-size: 2rem;">${icon}</div>
            <div class="shop-name">${item.name}</div>
            <div class="shop-desc">${item.desc}</div>
            <button class="shop-btn" ${canAfford ? '' : 'disabled'}>${finalPrice} SP</button>
        `;
        div.querySelector('.shop-btn').addEventListener('click', () => buyItem(item));
        grid.appendChild(div);
    });
}

async function buyItem(item) {
    const finalPrice = item.cost || item.price;
    if (appState.profile.skillPoints < finalPrice) return;
    
    appState.profile.skillPoints -= finalPrice;
    
    const updates = {
        skillPoints: appState.profile.skillPoints,
        inventory: appState.profile.inventory
    };

    if (item.type === 'adoption') {
        const petDef = PETS_DATA.find(p => p.id === item.effect.value);
        const newPet = {
            id: petDef.id,
            hunger: 100, thirst: 100, health: 100,
            adoptedAt: Date.now(),
            lastInteraction: Date.now()
        };
        appState.profile.pet = newPet;
        updates.pet = newPet;
        alert(`¡Felicidades! Has adoptado a ${petDef.name}.`);
    } else {
        // Check if item is food, equipment, or consumable
        if (item.type === 'consumable') {
            appState.profile.inventory[item.id] = (appState.profile.inventory[item.id] || 0) + 1;
            updates.inventory = appState.profile.inventory;
        } else if (['head','chest','hands','feet','weapon'].includes(item.type)) {
            // Equipment goes to inventory
            appState.profile.inventory[item.id] = (appState.profile.inventory[item.id] || 0) + 1;
            updates.inventory = appState.profile.inventory;
        } else {
            // Legacy food
            appState.profile.inventory[item.id] = (appState.profile.inventory[item.id] || 0) + 1;
            updates.inventory = appState.profile.inventory;
        }
    }
    
    document.getElementById('shop-navbar-sp').innerText = appState.profile.skillPoints;
    if(document.getElementById('navbar-sp')) document.getElementById('navbar-sp').innerText = appState.profile.skillPoints;
    
    await updateUserProfile(appState.username, updates);
    
    renderShop(); 
}

function renderPetScreen() {
    const selPanel = document.getElementById('pet-selection-panel');
    const actPanel = document.getElementById('pet-active-panel');
    const petSpEl = document.getElementById('pet-navbar-sp');
    petSpEl.innerText = appState.profile.skillPoints;
    
    if (!appState.profile.pet) {
        selPanel.classList.remove('hidden');
        actPanel.classList.add('hidden');
        
        const grid = document.getElementById('pet-grid');
        grid.innerHTML = "";
        PETS_DATA.forEach(petDef => {
            const div = document.createElement('div');
            div.className = 'shop-item-card glass-panel';
            div.style.cursor = 'pointer';
            div.innerHTML = `
                <div style="width:60px; height:60px;">${petDef.svg}</div>
                <div class="shop-name">${petDef.name}</div>
            `;
            div.addEventListener('click', async () => {
                const newPet = {
                    id: petDef.id,
                    hunger: 100, thirst: 100, health: 100,
                    adoptedAt: Date.now(),
                    lastInteraction: Date.now()
                };
                appState.profile.pet = newPet;
                await updateUserProfile(appState.username, { pet: newPet });
                renderPetScreen();
            });
            grid.appendChild(div);
        });
    } else {
        selPanel.classList.add('hidden');
        actPanel.classList.remove('hidden');
        
        const stats = calculatePetStats(appState.profile.pet);
        const petDef = PETS_DATA.find(p => p.id === stats.id);
        
        document.getElementById('active-pet-name').innerText = petDef.name;
        document.getElementById('active-pet-age').innerText = `Edad: ${stats.ageHours} horas`;
        document.getElementById('active-pet-svg').innerHTML = petDef.svg;
        
        let localFun = appState.profile.pet.fun || 0;
        
        document.getElementById('active-pet-svg').onclick = async (e) => {
            // Heart float animation
            const heart = document.createElement('div');
            heart.innerText = ['❤️','💖','✨'][Math.floor(Math.random() * 3)];
            heart.className = 'floating-heart';
            // Position near the click
            const rect = e.currentTarget.getBoundingClientRect();
            heart.style.left = (e.clientX - rect.left) + 'px';
            heart.style.top = (e.clientY - rect.top) + 'px';
            e.currentTarget.appendChild(heart);
            setTimeout(() => heart.remove(), 800);
            
            // Bounce pet
            e.currentTarget.classList.remove('pet-bounce');
            void e.currentTarget.offsetWidth; // trigger reflow
            e.currentTarget.classList.add('pet-bounce');
            
            // Logic
            localFun += 5;
            appState.profile.pet.fun = localFun;
            document.getElementById('stat-fun-bar').style.width = `${Math.min(100, localFun)}%`;
            
            await updateUserProfile(appState.username, { pet: appState.profile.pet });
        };
        
        document.getElementById('stat-hunger-bar').style.width = `${stats.hunger}%`;
        document.getElementById('stat-thirst-bar').style.width = `${stats.thirst}%`;
        document.getElementById('stat-health-bar').style.width = `${stats.health}%`;
        const funBar = document.getElementById('stat-fun-bar');
        if(funBar) funBar.style.width = `${Math.min(100, localFun)}%`;

        // Load Equipment Slots
        let totalAtkMulti = 1.0;
        let totalDefMulti = 1.0;
        
        const slots = ['head', 'chest', 'hands', 'feet', 'weapon'];
        slots.forEach(slot => {
            const slotEl = document.getElementById(`slot-${slot}`);
            const equipId = appState.profile.equipment ? appState.profile.equipment[slot] : null;
            
            if (equipId) {
                const eqItem = EQUIPMENT_DATA.find(e => e.id === equipId);
                if (eqItem) {
                    const icon = eqItem.icon || (eqItem.type === 'head' ? '🧢' : eqItem.type === 'chest' ? '👕' : eqItem.type === 'hands' ? '🧤' : eqItem.type === 'feet' ? '👟' : eqItem.type === 'weapon' ? '🎤' : '❓');
                    slotEl.innerHTML = `<span style="font-size:1.5rem;">${icon}</span>`;
                    slotEl.setAttribute('data-filled', 'true');
                    slotEl.title = eqItem.name;
                    slotEl.onclick = () => unequipItem(slot);
                    
                    if(eqItem.stats) {
                        totalAtkMulti *= eqItem.stats.atk || 1.0;
                        totalDefMulti *= eqItem.stats.def || 1.0;
                    }
                }
            } else {
                const placeholders = {head:'🧢', chest:'👕', hands:'🧤', feet:'👟', weapon:'🎤'};
                slotEl.innerHTML = `<span class="slot-placeholder">${placeholders[slot]}</span>`;
                slotEl.setAttribute('data-filled', 'false');
                slotEl.title = `Ranura ${slot} vacía`;
                slotEl.onclick = null;
            }
        });
        
        document.getElementById('stand-atk-total').innerText = totalAtkMulti.toFixed(2) + 'x';
        document.getElementById('stand-def-total').innerText = totalDefMulti.toFixed(2) + 'x';
        
        // Render Inventory inside pet screen
        const invGrid = document.getElementById('inventory-grid');
        invGrid.innerHTML = "";
        
        const allItemsFlat = [...SHOP_ITEMS, ...EQUIPMENT_DATA, ...CONSUMABLES_DATA];
        
        for (const [id, amount] of Object.entries(appState.profile.inventory || {})) {
            if (amount > 0) {
                const item = allItemsFlat.find(i => i.id === id);
                if (!item) continue;
                
                const icon = item.icon || (item.type === 'head' ? '🧢' : item.type === 'chest' ? '👕' : item.type === 'hands' ? '🧤' : item.type === 'feet' ? '👟' : item.type === 'weapon' ? '🎤' : '🧪');
                const isEquip = ['head','chest','hands','feet','weapon'].includes(item.type);
                const isConsumable = item.type === 'consumable';
                
                let actionBtnHTML = '';
                if (isEquip) {
                    actionBtnHTML = `<button class="shop-btn" style="padding:0.2rem 0.5rem; font-size:0.8rem; margin-top:5px; background:var(--secondary-color);">Equipar</button>`;
                } else if (isConsumable) {
                    actionBtnHTML = `<button class="shop-btn" style="padding:0.2rem 0.5rem; font-size:0.8rem; margin-top:5px; background:#f59e0b;">A Mochila</button>`;
                } else if (item.type !== 'accessory') {
                    actionBtnHTML = `<button class="shop-btn" style="padding:0.2rem 0.5rem; font-size:0.8rem; margin-top:5px;">Usar</button>`;
                } else {
                    actionBtnHTML = `<div style="font-size:0.7rem; color:var(--text-muted); margin-top:5px;">Accesorio</div>`;
                }

                const div = document.createElement('div');
                div.className = 'shop-item-card';
                div.innerHTML = `
                    <div style="font-size:1.5rem" title="${item.name}">${icon}</div>
                    <div style="font-size:0.8rem; font-weight:bold;">x${amount}</div>
                    ${actionBtnHTML}
                `;
                
                if (isEquip) {
                    div.querySelector('button').addEventListener('click', () => equipItem(item));
                } else if (isConsumable) {
                    div.querySelector('button').addEventListener('click', () => equipConsumable(item));
                } else if (item.type !== 'accessory') {
                    div.querySelector('button').addEventListener('click', () => useItem(item));
                }
                invGrid.appendChild(div);
            }
        }
        
        if (invGrid.innerHTML === "") {
            invGrid.innerHTML = `<p style="grid-column: 1 / -1; text-align:center; color: var(--text-muted);">Tu inventario está vacío. Ve a la Tienda.</p>`;
        }
    }
}

async function equipItem(item) {
    if ((appState.profile.inventory[item.id] || 0) <= 0) return;
    
    // Unequip current item in slot if exists
    if (appState.profile.equipment[item.type]) {
        const currentItemId = appState.profile.equipment[item.type];
        appState.profile.inventory[currentItemId] = (appState.profile.inventory[currentItemId] || 0) + 1;
    }
    
    // Equip new item
    appState.profile.equipment[item.type] = item.id;
    appState.profile.inventory[item.id] -= 1;
    
    await updateUserProfile(appState.username, {
        inventory: appState.profile.inventory,
        equipment: appState.profile.equipment
    });
    
    renderPetScreen();
}

async function unequipItem(slot) {
    const equipId = appState.profile.equipment[slot];
    if (!equipId) return;
    
    appState.profile.equipment[slot] = null;
    appState.profile.inventory[equipId] = (appState.profile.inventory[equipId] || 0) + 1;
    
    await updateUserProfile(appState.username, {
        inventory: appState.profile.inventory,
        equipment: appState.profile.equipment
    });
    
    renderPetScreen();
}

async function equipConsumable(item) {
    if ((appState.profile.inventory[item.id] || 0) <= 0) return;
    
    if (!appState.profile.consumables) appState.profile.consumables = [];
    
    if (appState.profile.consumables.length >= 3) {
        alert("¡Tu mochila de consumibles ya está llena (Max 3)! Úsalos en batalla.");
        return;
    }
    
    appState.profile.consumables.push(item.id);
    appState.profile.inventory[item.id] -= 1;
    
    await updateUserProfile(appState.username, {
        inventory: appState.profile.inventory,
        consumables: appState.profile.consumables
    });
    
    renderPetScreen();
    alert(`¡${item.name} añadido a la mochila de combate!`);
}

async function useItem(item) {
    if ((appState.profile.inventory[item.id] || 0) <= 0 || !appState.profile.pet) return;
    
    appState.profile.inventory[item.id] -= 1;
    
    const stats = calculatePetStats(appState.profile.pet);
    if(item.effect) {
        stats[item.effect.attribute] = Math.min(100, stats[item.effect.attribute] + item.effect.amount);
    }
    stats.lastInteraction = Date.now();
    
    appState.profile.pet = stats;
    
    await updateUserProfile(appState.username, {
        inventory: appState.profile.inventory,
        pet: appState.profile.pet
    });
    
    renderPetScreen();
}

function onGameStartRequested() {
    matchStatus.innerText = "¡Partida lista!";
    matchStatus.parentElement.querySelector('.spinner').classList.add('hidden');
    
    playersFoundPanel.classList.remove('hidden');
    playersFoundPanel.classList.add('epic-vs-reveal');

    setTimeout(() => {
        if(appState.isHost) {
            startNextRound();
        }
    }, 4000);
}

function handleMatchStateChange(roomData) {
    if (!roomData) return;
    
    appState.roomData = roomData;
    // Determine player list from roomData
    const playerSlots = Object.keys(roomData).filter(k => /^player\d+$/.test(k));
    appState.playersCount = roomData.playersCount || playerSlots.length;
    
    appState.players = playerSlots.map(slot => ({
        ...roomData[slot],
        slot: slot
    }));
    appState.gameMode = roomData.gameMode;

    const myPlayer = appState.players.find(p => p.id === appState.userId);
    if (myPlayer) {
        appState.myScore = myPlayer.score;
    }

    // Update Lobby VS view
    const vsContainer = document.getElementById('vs-container');
    if (vsContainer) {
        vsContainer.innerHTML = "";
        appState.players.forEach((p, idx) => {
            const span = document.createElement('span');
            span.className = 'player-name' + (p.id === appState.userId ? ' highlight' : '');
            span.innerText = p.name;
            span.classList.add(`epic-player-${idx + 1}`);
            vsContainer.appendChild(span);
            
            if (idx < appState.players.length - 1) {
                const vs = document.createElement('span');
                vs.className = 'vs-text epic-vs-text';
                vs.innerText = 'VS';
                vsContainer.appendChild(vs);
            }
        });
    }
    
    const statusChanged = roomData.status !== appState.lastStatus;
    const roundChanged = roomData.currentRound !== appState.lastRound;

    appState.currentRound = roomData.currentRound;
    
    if (roomData.waitTime) {
        appState.roundTime = roomData.waitTime;
    }

    if (statusChanged || roundChanged) {
        appState.lastStatus = roomData.status;
        appState.lastRound = roomData.currentRound;

        if (roomData.status === "playing") {
            appState.currentWord = roomData.word;
            if (roomData.gameMode === "batalla") enterBattleScreen(roomData);
            else enterGameScreen(roomData);
        } else if (roomData.status === "grading") {
            if (roomData.gameMode === "batalla") enterBattleGradingScreen(roomData);
            else enterGradingScreen(roomData);
        } else if (roomData.status === "bonus") {
            enterBonusScreen(roomData);
        } else if (roomData.status === "results") {
            if (roomData.gameMode === "batalla") {
                if (statusChanged) playBattleResultsAnimation(roomData);
            } else {
                updateResultsUI(roomData);
                if (statusChanged) startResultsCountdown(); 
            }
        } else if (roomData.status === "recap") {
            if (!appState.isRecapShown) {
                appState.isRecapShown = true;
                if (roomData.gameMode !== "batalla") startRecapShow(roomData);
                else {
                    // Skip recap in battle mode, go straight to finished
                    if(appState.isHost) updateMatchStatus(appState.roomId, "finished");
                }
            }
        } else if (roomData.status === "finished") {
            if (roomData.gameMode === "batalla") endBattleScreen(roomData);
            else if (roomData.gameMode === "solitario") endSolitarioScreen(roomData);
            else showEndScreen(roomData);
        } else if (roomData.status.startsWith("solitario_")) {
            if (roomData.status === "solitario_mem") enterSolitarioMemPhase(roomData);
            else if (roomData.status === "solitario_write") enterSolitarioWritePhase(roomData);
            else if (roomData.status === "solitario_grading") enterSolitarioGradingPhase(roomData);
            else if (roomData.status === "solitario_review") enterSolitarioReviewPhase(roomData);
        } else if (roomData.status === "abandoned") {
            cancelDisconnectHook();
            alert("Un jugador se desconectó. Has ganado la partida por abandono.\n¡Recibes 50 SP extra!");
            awardSkillPoints(appState.username, 50);
            if(appState.profile) appState.profile.skillPoints += 50; // Sync local balance
            
            // Full state reset to prevent phantom matches
            clearInterval(appState.timerInterval);
            if (appState.resultsTimer) clearInterval(appState.resultsTimer);
            
            appState.roomId = null;
            appState.userId = null;
            appState.isHost = false;
            appState.players = [];
            appState.currentRound = 0;
            appState.lastStatus = "";
            appState.lastRound = 0;
            appState.isTimerActive = false;
            appState.isRecapShown = false;
            appState.hasBonusPlayed = false;
            
            showScreen('menu');
        }
    } else if (roomData.status === "results" && roomData.gameMode !== "batalla") {
        updateResultsUI(roomData);
    }
}

async function startNextRound() {
    if (appState.currentRound === 3 && !appState.hasBonusPlayed && appState.gameMode !== "batalla") {
        appState.hasBonusPlayed = true;
        const bonusWords = [getRandomWord(), getRandomWord(), getRandomWord(), getRandomWord(), getRandomWord(), getRandomWord()];
        await updateMatchStatus(appState.roomId, "bonus", { bonusWords });
        return;
    }
    
    if (appState.gameMode === "solitario" && appState.currentRound === 0) {
        // Solitario ONLY has one long round.
        const memWords = [];
        for(let i=0; i<8; i++) memWords.push(getRandomWord()); // 8 pairs = 16 cards
        
        await updateMatchStatus(appState.roomId, "solitario_mem", { 
            currentRound: 1, 
            memWords: memWords
        });
        return;
    }
    
    const nextRound = appState.currentRound + 1;
    const isBattle = appState.gameMode === "batalla";

    if (!isBattle && nextRound > 5) {
        await updateMatchStatus(appState.roomId, "recap");
        return;
    }

    const nextWord = getRandomWord();
    const roundUpdates = {
        word: nextWord,
        currentRound: nextRound,
        status: "playing"
    };
    
    for (let i = 1; i <= appState.playersCount; i++) {
        roundUpdates[`player${i}/text`] = "";
        roundUpdates[`player${i}/evalScore`] = 0;
        roundUpdates[`player${i}/feedback`] = "";
    }
    
    await updateMatchStatus(appState.roomId, "playing", roundUpdates);
}

function enterGameScreen(roomData) {
    showScreen('game');
    particles.stop();
    appState.isRecapShown = false; 
    waitingOverlay.classList.add('hidden');
    roundNumberEl.innerText = appState.currentRound;
    currentWordEl.innerText = appState.currentWord;
    
    gameInputEl.value = "";
    gameInputEl.disabled = false;
    wordCountEl.innerText = "0";
    gameInputEl.focus();
    
    if (!appState.isTimerActive) {
        startTimer(appState.roundTime);
    }
}

gameInputEl.addEventListener('input', () => {
   const words = gameInputEl.value.trim().split(/\s+/).filter(w => w.length > 0);
   if (words.length > 15) {
       wordCountEl.style.color = "var(--error)";
   } else {
       wordCountEl.style.color = "var(--text-muted)";
   }
   wordCountEl.innerText = words.length;
});

function startTimer(seconds) {
    clearInterval(appState.timerInterval);
    let timeLeft = seconds;
    timerText.innerText = timeLeft;
    document.getElementById('battle-timer-text').innerText = timeLeft; // Update battle timer too
    timerCircle.classList.remove('danger');
    document.querySelector('.timer-circle-small').style.borderColor = "var(--primary-color)";
    
    appState.isTimerActive = true;
    appState.timerInterval = setInterval(() => {
        timeLeft--;
        timerText.innerText = timeLeft;
        document.getElementById('battle-timer-text').innerText = timeLeft;
        if (timeLeft <= 5) {
            timerCircle.classList.add('danger');
            document.querySelector('.timer-circle-small').style.borderColor = "var(--error)";
        }
        if (timeLeft <= 0) {
            clearInterval(appState.timerInterval);
            appState.isTimerActive = false;
            finishGameInput();
        }
    }, 1000);
}

async function finishGameInput() {
    gameInputEl.disabled = true;
    const battleInputEl = document.getElementById('battle-input');
    battleInputEl.disabled = true;

    // Check which input to read depending on mode
    let myText = gameInputEl.value.trim();
    if (!document.getElementById('game-screen').classList.contains('active')) {
        myText = battleInputEl.value.trim();
        document.getElementById('battle-waiting-overlay').classList.remove('hidden');
    } else {
        waitingOverlay.classList.remove('hidden');
    }
    
    await submitText(appState.roomId, appState.userId, myText);
    
    if(appState.isHost) {
        setTimeout(async () => {
             await updateMatchStatus(appState.roomId, "grading");
        }, 1500); 
    }
}

async function enterGradingScreen(roomData) {
    showScreen('game');
    waitingOverlay.classList.remove('hidden');
    waitingOverlay.querySelector('p').innerText = "La IA está evaluando tu texto...";

    const myPlayer = appState.players.find(p => p.id === appState.userId);
    const mySlot = myPlayer.slot;
    const word = roomData.word;
    let myText = roomData[mySlot].text;
    
    if (!myText || myText.trim() === "") {
        myText = gameInputEl.value.trim();
    }
    
    const aiResult = await evaluateMetaphor(word, myText);
    await updateScore(appState.roomId, mySlot, myPlayer.score + aiResult.score, aiResult.feedback, appState.currentRound);
    
    if(appState.isHost) {
        const waitTime = roomData.status === "bonus" ? 4000 : 8000;
        setTimeout(async () => {
            await updateMatchStatus(appState.roomId, "results");
        }, waitTime); 
    }
}

async function enterBonusScreen(roomData) {
    showScreen('bonus');
    const display = document.getElementById('bonus-word-display');
    const inputs = document.getElementById('bonus-input-panel');
    const wordEl = document.getElementById('bonus-current-word');
    const waiting = document.getElementById('bonus-waiting');
    
    for(let i=1; i<=6; i++) {
        document.getElementById(`bonus-in-${i}`).value = "";
    }
    
    display.classList.remove('hidden');
    inputs.classList.add('hidden');
    waiting.classList.add('hidden');

    const words = roomData.bonusWords || [];
    appState.bonusWords = words;

    for (let i = 0; i < words.length; i++) {
        wordEl.innerText = words[i];
        await new Promise(r => setTimeout(r, 1000));
    }

    display.classList.add('hidden');
    inputs.classList.remove('hidden');
    
    let bonusTime = 15;
    const btEl = document.getElementById('bonus-timer-text');
    btEl.innerText = bonusTime;
    
    const bInterval = setInterval(async () => {
        bonusTime--;
        btEl.innerText = bonusTime;
        if (bonusTime <= 0) {
            clearInterval(bInterval);
            inputs.classList.add('hidden');
            waiting.classList.remove('hidden');
            
            const answers = [
                document.getElementById('bonus-in-1').value.trim(),
                document.getElementById('bonus-in-2').value.trim(),
                document.getElementById('bonus-in-3').value.trim(),
                document.getElementById('bonus-in-4').value.trim(),
                document.getElementById('bonus-in-5').value.trim(),
                document.getElementById('bonus-in-6').value.trim(),
            ];
            
            const aiResult = await evaluateMemoryRound(appState.bonusWords, answers);
            const ansText = `MEMORIA: ${answers.join(", ")}`;
            await submitText(appState.roomId, appState.userId, ansText);
            
            const myPlayer = appState.players.find(p => p.id === appState.userId);
            await updateScore(appState.roomId, myPlayer.slot, myPlayer.score + aiResult.score, aiResult.feedback, "BONUS");
            
            if (appState.isHost) {
                setTimeout(async () => {
                    await updateMatchStatus(appState.roomId, "results");
                }, 8000);
            }
        }
    }, 1000);
}

function updateResultsUI(roomData) {
    showScreen('results');
    const container = document.getElementById('results-boards-container');
    container.innerHTML = "";

    appState.players.forEach(p => {
        const board = document.createElement('div');
        board.className = 'player-board';
        board.innerHTML = `
            <h3>${p.name}${p.feedback ? ': ' + p.feedback : ''}</h3>
            <p class="res-text blur-text">${p.text || "(No escribió nada)"}</p>
            <div class="score-badge">${p.evalScore || 0} pts</div>
        `;
        container.appendChild(board);
    });
}

function startResultsCountdown() {
    const countdownPanel = document.getElementById('next-round-countdown');
    const timerSpan = document.getElementById('next-timer');
    const finishBtn = document.getElementById('finish-btn');
    
    if (appState.currentRound < 5) {
        countdownPanel.classList.remove('hidden');
        finishBtn.classList.add('hidden');
        let cd = 7; 
        timerSpan.innerText = cd;
        appState.resultsTimer = setInterval(() => {
            cd--;
            timerSpan.innerText = cd;
            if (cd <= 0) {
                clearInterval(appState.resultsTimer);
                if(appState.isHost) startNextRound();
            }
            if (appState.lastStatus !== "results") clearInterval(appState.resultsTimer);
        }, 1000);
    } else {
        countdownPanel.classList.add('hidden');
        if(appState.isHost) {
            setTimeout(() => {
                updateMatchStatus(appState.roomId, "recap");
            }, 2000);
        }
    }
}

async function startRecapShow(roomData) {
    showScreen('recap');
    const timeline = document.getElementById('recap-timeline');
    timeline.innerHTML = "";
    
    const history = roomData.history || {};
    const rounds = Object.keys(history).sort((a, b) => {
        const valA = a === "BONUS" ? 3.5 : parseInt(a);
        const valB = b === "BONUS" ? 3.5 : parseInt(b);
        return valA - valB;
    });
    
    const finalBtn = document.getElementById('show-final-scores-btn');
    finalBtn.classList.add('hidden');
    finalBtn.innerText = "CONTINUAR";

    for (const rNum of rounds) {
        const round = history[rNum];
        const card = document.createElement('div');
        card.className = 'recap-card';
        if (rNum === "BONUS") card.style.borderLeftColor = "var(--secondary-color)";
        
        const roundTitle = rNum === "BONUS" ? "RONDA BONUS: MEMORIA" : `RONDA ${rNum}`;
        
        let playersHTML = "";
        appState.players.forEach(p => {
            const pData = round[p.slot];
            if (!pData) return;
            playersHTML += `
                <div class="recap-player-row" style="margin-top: 10px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 8px;">
                    <div class="recap-player-name">${p.name}</div>
                    <div class="recap-player-text">"${pData.text || '...'}"</div>
                    <div class="recap-player-score">${pData.score} pts</div>
                    ${pData.feedback ? `<div class="recap-feedback">${pData.feedback}</div>` : ''}
                </div>
            `;
        });

        card.innerHTML = `
            <div class="recap-round-num">${roundTitle}</div>
            <div class="recap-word">${round.word}</div>
            <div class="recap-bars">${playersHTML}</div>
        `;
        timeline.appendChild(card);
        
        await new Promise(r => setTimeout(r, 50));
        card.classList.add('show');
        timeline.scrollTo({ top: timeline.scrollHeight, behavior: 'auto' });
        await new Promise(r => setTimeout(r, 4000)); 
    }

    finalBtn.classList.remove('hidden');
    finalBtn.disabled = false;
}

document.getElementById('show-final-scores-btn').addEventListener('click', () => {
    if (appState.roomData) {
        showEndScreen(appState.roomData);
    }
});

async function showEndScreen(roomData) {
    showScreen('end');
    particles.start();
    
    // Ensure previous AI summary is removed
    const oldSummary = document.querySelector('.final-ai-summary');
    if (oldSummary) oldSummary.remove();
    
    const scoresList = document.getElementById('final-scores-list');
    scoresList.innerHTML = "";
    
    const sortedPlayers = [...appState.players].sort((a,b) => b.score - a.score);
    
    sortedPlayers.forEach(p => {
        const row = document.createElement('div');
        row.className = 'score-row';
        row.innerHTML = `
            <span>${p.name}${p.id === appState.userId ? ' (Tú)' : ''}</span>
            <span class="score-num">${p.score}</span>
        `;
        scoresList.appendChild(row);
    });

    // We no longer rely on location.reload for the back button
    const backBtn = document.getElementById('back-to-lobby-btn');
    backBtn.onclick = null; // Remove the location.reload
    backBtn.onclick = () => {
        // Reset app state for next match while keeping profile
        appState.roomId = null;
        appState.userId = null;
        appState.isHost = false;
        appState.players = [];
        appState.currentRound = 0;
        appState.lastStatus = "";
        appState.lastRound = 0;
        appState.isTimerActive = false;
        appState.isRecapShown = false;
        appState.hasBonusPlayed = false;
        
        showScreen('menu');
    };

    await updateWeeklyLeaderboard(appState.username, appState.myScore);
    
    const finalVerdictEl = document.getElementById('match-winner');
    const winner = sortedPlayers[0];
    
    // Skill Points and Lifetime stats calculation
    let earnedSp = 0;
    
    // Initialize stats object if missing
    if (!appState.profile.stats) {
        appState.profile.stats = { matchesPlayed: 0, matchesWon: 0, battlesWon: 0, battlesLost: 0 };
    }
    
    if (appState.playersCount === 2) {
        if (appState.userId === winner.id) {
            earnedSp = 300;
            appState.profile.stats.matchesPlayed++;
            appState.profile.stats.matchesWon++;
        } else {
            earnedSp = 5;
            appState.profile.stats.matchesPlayed++;
        }
    } else {
        const myRank = sortedPlayers.findIndex(p => p.id === appState.userId);
        appState.profile.stats.matchesPlayed++;
        if (myRank === 0) {
            earnedSp = 300;
            appState.profile.stats.matchesWon++;
        }
        else if (myRank === 1) earnedSp = 50;
        else earnedSp = 0;
    }

    if (earnedSp > 0 && appState.userId) {
        await awardSkillPoints(appState.username, earnedSp);
        // We mutate the local profile too to sync it
        if(appState.profile) appState.profile.skillPoints += earnedSp;
    }
    
    // Save updated stats for non-battle mode
    await updateUserProfile(appState.username, {
        stats: appState.profile.stats
    });
    
    // Inform how much they won visually
    const spEarnedEl = document.createElement('div');
    spEarnedEl.className = 'sp-earned-badge';
    spEarnedEl.innerHTML = `<svg viewBox="0 0 100 100" width="30" height="30" style="display:inline-block; vertical-align:middle; margin-right:5px;"><g transform="translate(10, 75) rotate(-45)"><rect width="30" height="6" fill="#fbbf24"/><polygon points="30,0 30,6 40,3" fill="#fcd34d"/><polygon points="38,2 38,4 40,3" fill="#000"/></g></svg> +${earnedSp} SP`;
    scoresList.parentElement.insertBefore(spEarnedEl, scoresList);

    if (winner.id === appState.userId) {
        finalVerdictEl.innerText = "¡GANASTE!";
        document.querySelector('.glow-bg.victory').style.background = 'radial-gradient(circle, var(--success) 0%, transparent 70%)';
    } else {
        finalVerdictEl.innerText = "FIN DE PARTIDA";
        document.querySelector('.glow-bg.victory').style.background = 'radial-gradient(circle, var(--error) 0%, transparent 70%)';
    }
    
    const playerNames = appState.players.map(p => p.name).join(", ");
    const finalFeedback = await evaluateFinalMatch(roomData.history, playerNames);
    
    const recapSummary = document.createElement('p');
    recapSummary.className = 'final-ai-summary';
    recapSummary.innerText = finalFeedback;
    scoresList.after(recapSummary);
}

// BATTLE MODE FUNCTIONS
function getHpColor(percent) {
    if (percent > 50) return '#4caf50';
    if (percent > 20) return '#ffeb3b';
    return '#f44336';
}

function enterBattleScreen(roomData) {
    showScreen('battle');
    particles.stop();
    appState.isRecapShown = false; 
    document.getElementById('battle-waiting-overlay').classList.add('hidden');
    document.querySelector('.battle-input-area').style.display = 'flex';
    document.getElementById('battle-dialog-text').innerText = "¿Qué figura literaria utilizarás?";
    
    // Reset temporary buffs each round
    appState.activeBuffs = { atkMulti: 1.0, iaBonus: 0, shield: false, enemyDefMinus: 0, dmgFlatRed: 0 };
    
    // Render Consumables
    const myConsumables = appState.profile.consumables || [];
    for (let i = 1; i <= 3; i++) {
        const btn = document.getElementById(`battle-cons-${i}`);
        if (!btn) continue;
        const consId = myConsumables[i-1];
        if (consId) {
            const consDef = CONSUMABLES_DATA.find(c => c.id === consId);
            if (consDef) {
                btn.innerHTML = consDef.icon || '🧪';
                btn.title = consDef.name;
                btn.disabled = false;
                btn.style.opacity = '1';
                
                // Remove old listeners by cloning
                const newBtn = btn.cloneNode(true);
                btn.parentNode.replaceChild(newBtn, btn);
                newBtn.addEventListener('click', () => useBattleConsumable(i-1, consDef, newBtn));
            }
        } else {
            btn.innerHTML = '';
            btn.title = 'Vacío';
            btn.disabled = true;
            btn.style.opacity = '0.3';
        }
    }
    
    const roundEl = document.getElementById('battle-round');
    if (roundEl) roundEl.innerText = `Ronda ${appState.currentRound}`;
    const wordEl = document.getElementById('battle-current-word');
    if (wordEl) wordEl.innerText = `${appState.currentWord}`;
    
    const myPlayer = appState.players.find(p => p.id === appState.userId);
    const oppPlayer = appState.players.find(p => p.id !== appState.userId);
    
    const myPet = myPlayer.activePet || { id: "pet1", hp: 100 };
    const oppPet = oppPlayer.activePet || { id: "pet1", hp: 100 };
    
    const myPetDef = PETS_DATA.find(p => p.id === myPet.id) || PETS_DATA[0];
    const oppPetDef = PETS_DATA.find(p => p.id === oppPet.id) || PETS_DATA[0];
    
    document.getElementById('my-pet-name').innerText = myPlayer.name;
    document.getElementById('my-pet-visual').innerHTML = myPetDef.svg;
    const myHpPercent = Math.max(0, (roomData[myPlayer.slot].hp / myPetDef.hp) * 100);
    const myHp = Math.ceil(roomData[myPlayer.slot].hp);
    document.getElementById('my-hp-fill').style.width = `${myHpPercent}%`;
    document.getElementById('my-hp-fill').style.backgroundColor = getHpColor(myHpPercent);
    document.getElementById('my-hp-text').innerText = `${myHp}/${myPetDef.hp}`;

    document.getElementById('opp-pet-name').innerText = oppPlayer.name;
    const oppContainer = document.getElementById('opp-pet-visual');
    const myContainer = document.getElementById('my-pet-visual');
    
    oppContainer.innerHTML = oppPetDef.svg;
    oppContainer.classList.add('idle-float');
    myContainer.classList.add('idle-float');
    
    const oppHpPercent = Math.max(0, (roomData[oppPlayer.slot].hp / oppPetDef.hp) * 100);
    const oppHp = Math.ceil(roomData[oppPlayer.slot].hp);
    document.getElementById('opp-hp-fill').style.width = `${oppHpPercent}%`;
    document.getElementById('opp-hp-fill').style.backgroundColor = getHpColor(oppHpPercent);
    document.getElementById('opp-hp-text').innerText = `${oppHp}/${oppPetDef.hp}`;
    
    // Process initial scars
    if (myHpPercent <= 50) {
        let overlay = myContainer.querySelector('.scar-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'scar-overlay';
            overlay.innerHTML = `<svg viewBox="0 0 100 100" style="width:100%; height:100%; opacity:0.8;"><path d="M20,30 L80,70 M80,30 L20,70 M40,20 L60,80 M60,20 L40,80" stroke="rgba(255,0,0,0.6)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
            myContainer.appendChild(overlay);
        }
        overlay.style.opacity = myHpPercent <= 25 ? '1' : '0.6';
        if (myHpPercent <= 25) overlay.style.filter = "brightness(0.7) contrast(1.5)";
    }
    
    if (oppHpPercent <= 50) {
        let overlay = oppContainer.querySelector('.scar-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'scar-overlay';
            overlay.innerHTML = `<svg viewBox="0 0 100 100" style="width:100%; height:100%; opacity:0.8;"><path d="M20,30 L80,70 M80,30 L20,70 M40,20 L60,80 M60,20 L40,80" stroke="rgba(255,0,0,0.6)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
            oppContainer.appendChild(overlay);
        }
        overlay.style.opacity = oppHpPercent <= 25 ? '1' : '0.6';
        if (oppHpPercent <= 25) overlay.style.filter = "brightness(0.7) contrast(1.5)";
    }
    
    const battleInputEl = document.getElementById('battle-input');
    battleInputEl.value = "";
    battleInputEl.disabled = false;
    battleInputEl.focus();
    
    if (!appState.isTimerActive) {
        startTimer(appState.roundTime);
    }
}

async function useBattleConsumable(index, consDef, btnEl) {
    if (!appState.profile.consumables[index]) return; // Already used or empty
    
    // Apply buff
    if (consDef.effect === "heal_15") {
        const myPlayer = appState.players.find(p => p.id === appState.userId);
        const mySlot = myPlayer.slot;
        const myPetDef = PETS_DATA.find(p => p.id === (myPlayer.activePet?.id || "pet1")) || PETS_DATA[0];
        
        healPlayer(appState.roomId, mySlot, 15, myPetDef.hp);
        document.getElementById('battle-dialog-text').innerText = "¡Te has curado 15 HP!";
    } else if (consDef.effect === "ia_plus_2") {
        appState.activeBuffs.iaBonus += 2;
        document.getElementById('battle-dialog-text').innerText = "¡Bonus +2 IA garantizado!";
    } else if (consDef.effect === "shield_50") {
        appState.activeBuffs.shield = true;
        document.getElementById('battle-dialog-text').innerText = "¡Escudo al 50% activado!";
    } else if (consDef.effect === "atk_30") {
        appState.activeBuffs.atkMulti += 0.3;
        document.getElementById('battle-dialog-text').innerText = "¡Ataque +30% esta ronda!";
    } else if (consDef.effect === "time_15") {
        appState.roundTime += 15;
        document.getElementById('battle-timer-text').innerText = parseInt(document.getElementById('battle-timer-text').innerText) + 15;
        document.getElementById('battle-dialog-text').innerText = "¡+15 segundos añadidos!";
    }

    // Mark as used
    appState.profile.consumables.splice(index, 1);
    btnEl.disabled = true;
    btnEl.style.opacity = '0.3';
    btnEl.innerHTML = '';
    btnEl.title = 'Usado';
    
    await updateUserProfile(appState.username, {
        consumables: appState.profile.consumables
    });
}

async function enterBattleGradingScreen(roomData) {
    showScreen('battle');
    document.getElementById('battle-waiting-overlay').classList.remove('hidden');
    document.getElementById('battle-waiting-overlay').querySelector('p').innerText = "La IA está evaluando el ataque...";

    const myPlayer = appState.players.find(p => p.id === appState.userId);
    const oppPlayer = appState.players.find(p => p.id !== appState.userId);
    const mySlot = myPlayer.slot;
    const oppSlot = oppPlayer.slot;
    const word = roomData.word;
    let myText = roomData[mySlot].text;
    
    if (!myText || myText.trim() === "") {
        myText = document.getElementById('battle-input').value.trim();
    }
    
    const aiResult = await evaluateMetaphor(word, myText);
    
    const myPetDef = PETS_DATA.find(p => p.id === (myPlayer.activePet?.id || "pet1")) || PETS_DATA[0];
    const oppPetDef = PETS_DATA.find(p => p.id === (oppPlayer.activePet?.id || "pet1")) || PETS_DATA[0];
    
    // Calculate Multipliers
    let myAtkMulti = 1.0;
    
    if (myPlayer.equipment) {
        ['head', 'chest', 'hands', 'feet', 'weapon'].forEach(slot => {
            const eqId = myPlayer.equipment[slot];
            if (eqId) {
                const item = EQUIPMENT_DATA.find(e => e.id === eqId);
                if (item && item.stats && item.stats.atk) myAtkMulti *= item.stats.atk;
            }
        });
    }
    
    let oppDefMulti = 1.0;
    let oppShield = false; // We can't peek into opponent activeBuffs as they are local, 
                           // but equipment is in standard firebase payload.
    if (oppPlayer.equipment) {
        ['head', 'chest', 'hands', 'feet', 'weapon'].forEach(slot => {
            const eqId = oppPlayer.equipment[slot];
            if (eqId) {
                const item = EQUIPMENT_DATA.find(e => e.id === eqId);
                if (item && item.stats && item.stats.def) oppDefMulti *= item.stats.def;
            }
        });
    }

    // Apply consumable buffs
    const iaScore = Math.min(10, aiResult.score + appState.activeBuffs.iaBonus);
    myAtkMulti += (appState.activeBuffs.atkMulti - 1.0); // additive from buffs like atk_30
    
    // Final Formula
    // Base damage is (IA Score del 1 al 10) * (Mascota Base multiplier? Pet has no base atk implicitly, so just base score) * ATK Multi
    // If we want "Ataque Base Mascota", wait... pet HP goes up to 40, damage is 1-10. So atk base is 1. 
    // Damage = Score * AtkMulti / DefMulti
    let finalDamage = Math.floor((iaScore * myAtkMulti) / oppDefMulti);
    if (isNaN(finalDamage)) finalDamage = 0;
    
    let damageToDeal = finalDamage;

    
    await updateBattleDamage(appState.roomId, mySlot, oppSlot, damageToDeal, aiResult.score, aiResult.feedback, myText, appState.currentRound);
    
    if (appState.isHost) {
        setTimeout(async () => {
            await updateMatchStatus(appState.roomId, "results");
        }, 8000); 
    }
}

async function playBattleResultsAnimation(roomData) {
    showScreen('battle');
    document.getElementById('battle-waiting-overlay').classList.add('hidden');
    document.querySelector('.battle-input-area').style.display = 'none';
    const dialog = document.getElementById('battle-dialog-text');
    
    const p1 = roomData["player1"];
    const p2 = roomData["player2"];
    
    const petDefP1 = PETS_DATA.find(p => p.id === (p1.activePet?.id || "pet1")) || PETS_DATA[0];
    const petDefP2 = PETS_DATA.find(p => p.id === (p2.activePet?.id || "pet1")) || PETS_DATA[0];
    
    const maxHpP1 = petDefP1.hp;
    const maxHpP2 = petDefP2.hp;

    // We have to calculate the intermediate HP steps since roomData has the final resolved HP.
    // HP before P2's attack = final HP + P2's damage dealt
    let p1HpTracker = p1.hp + (p2.evalScore || 0);
    let p2HpTracker = p2.hp + (p1.evalScore || 0);

    const updateHpBar = (slot, currentHp, maxHp) => {
        const percent = Math.max(0, (currentHp / maxHp) * 100);
        const isMe = roomData[slot].id === appState.userId;
        const fillId = isMe ? 'my-hp-fill' : 'opp-hp-fill';
        const textId = isMe ? 'my-hp-text' : 'opp-hp-text';
        const container = document.getElementById(isMe ? 'my-pet-visual' : 'opp-pet-visual');
        
        document.getElementById(fillId).style.width = `${percent}%`;
        document.getElementById(fillId).style.backgroundColor = getHpColor(percent);
        document.getElementById(textId).innerText = `${Math.ceil(currentHp)}/${maxHp}`;
        
        // Dynamic Scars/Damage Overlay
        if (container) {
            let overlay = container.querySelector('.scar-overlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.className = 'scar-overlay';
                // Generics cross scratches SVG
                overlay.innerHTML = `<svg viewBox="0 0 100 100" style="width:100%; height:100%; opacity:0.8;"><path d="M20,30 L80,70 M80,30 L20,70 M40,20 L60,80 M60,20 L40,80" stroke="rgba(255,0,0,0.6)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
                container.appendChild(overlay);
            }
            if (percent <= 25) {
                overlay.style.opacity = '1';
                overlay.style.filter = "brightness(0.7) contrast(1.5)";
            } else if (percent <= 50) {
                overlay.style.opacity = '0.6';
                overlay.style.filter = "none";
            } else {
                overlay.style.opacity = '0';
            }
        }
    };
    
    const animAttack = async (attacker, defender, damage, maxHpDef, hpTrackerDef, attackerName, feedback, defSlot) => {
        const isMeAtt = attacker.id === appState.userId;
        const finalFeedback = isMeAtt ? (feedback ? `\nTu Evaluación: ${feedback}` : '') : '';
        dialog.innerText = `¡${attackerName} ataca! (Puntos: ${damage})${finalFeedback}`;
        
        const attContainer = document.getElementById(isMeAtt ? 'my-pet-visual' : 'opp-pet-visual');
        const defContainer = document.getElementById(!isMeAtt ? 'my-pet-visual' : 'opp-pet-visual');
        
        if (!attContainer || !defContainer) return hpTrackerDef - damage;

        // Ensure idle float is removed during attack
        attContainer.classList.remove('idle-float');

        // Feedback of the attack
        if (feedback) {
            setTimeout(() => {
                dialog.innerText = feedback;
            }, 1000);
        }

        // Apply dynamic dash class based on side
        const attackClass = isMeAtt ? 'anim-attack-right' : 'anim-attack-left';
        
        // Trigger reflow
        attContainer.classList.remove(attackClass);
        void attContainer.offsetWidth;
        attContainer.classList.add(attackClass);
        
        // Wait for strike moment (60% of 500ms = 300ms)
        await new Promise(r => setTimeout(r, 300));
        
        // Spawn Hit Sparks at defender's location
        const defRect = defContainer.getBoundingClientRect();
        const mainRect = document.querySelector('.battle-arena').getBoundingClientRect();
        
        const centerX = defRect.left - mainRect.left + (defRect.width / 2);
        const centerY = defRect.top - mainRect.top + (defRect.height / 2);
        
        for (let i = 0; i < 15; i++) {
            const spark = document.createElement('div');
            spark.className = 'hit-spark';
            spark.style.left = `${centerX}px`;
            spark.style.top = `${centerY}px`;
            
            // Random expanding angle and distance
            const angle = Math.random() * Math.PI * 2;
            const distance = 40 + Math.random() * 60;
            spark.style.setProperty('--dx', `${Math.cos(angle) * distance}px`);
            spark.style.setProperty('--dy', `${Math.sin(angle) * distance}px`);
            
            document.querySelector('.battle-arena').appendChild(spark);
            setTimeout(() => spark.remove(), 600); // Remove after animation
        }
        
        // Shake defender and apply blink
        defContainer.classList.add('take-damage', 'anim-damage');
        setTimeout(() => defContainer.classList.remove('take-damage', 'anim-damage'), 400);
        
        const newHp = Math.max(0, hpTrackerDef - damage);
        updateHpBar(defSlot, newHp, maxHpDef);
        
        // Wait remainder of animation
        await new Promise(r => setTimeout(r, 200));
        attContainer.classList.remove(attackClass);
        attContainer.classList.add('idle-float');
        
        await new Promise(r => setTimeout(r, 2000)); // 2 seconds to read feedback
        return newHp;
    };

    // P1 Attacks P2
    p2HpTracker = await animAttack(p1, p2, (p1.evalScore || 0), maxHpP2, p2HpTracker, p1.name, p1.feedback, "player2");
    
    // P2 Attacks P1
    p1HpTracker = await animAttack(p2, p1, (p2.evalScore || 0), maxHpP1, p1HpTracker, p2.name, p2.feedback, "player1");

    if (appState.isHost) {
        if (p1HpTracker <= 0 || p2HpTracker <= 0) {
            setTimeout(async () => { 
                await updateMatchStatus(appState.roomId, "finished"); 
            }, 1000);
        } else {
            // Wait 2 seconds before starting next round
            setTimeout(async () => {
                startNextRound();
            }, 2000);
        }
    }
}

async function endBattleScreen(roomData) {
    cancelDisconnectHook();
    showScreen('end');
    particles.start();
    
    const oldSummary = document.querySelector('.final-ai-summary');
    if (oldSummary) oldSummary.remove();
    
    // Determine winner based on remaining HP percentage
    const p1 = roomData["player1"];
    const p2 = roomData["player2"];
    const def1 = PETS_DATA.find(p => p.id === (p1.activePet?.id || "pet1")) || PETS_DATA[0];
    const def2 = PETS_DATA.find(p => p.id === (p2.activePet?.id || "pet1")) || PETS_DATA[0];
    
    const hpPct1 = Math.max(0, p1.hp / def1.hp);
    const hpPct2 = Math.max(0, p2.hp / def2.hp);
    
    let winnerId = null;
    if (hpPct1 > hpPct2) winnerId = p1.id;
    else if (hpPct2 > hpPct1) winnerId = p2.id;
    // Tie handles as player1 wins theoretically, or no winner.
    
    const isWinner = winnerId === appState.userId;
    
    // SP Rewards
    const spReward = isWinner ? 300 : 5;
    
    const scoresList = document.getElementById('final-scores-list');
    scoresList.innerHTML = `<div class="score-row"><span style="color:${isWinner ? '#4caf50' : '#f44336'}; font-size:1.5rem; text-align:center; width:100%;">${isWinner ? '¡VICTORIA!' : 'DERROTA'}</span></div>
    <div class="score-row"><span style="text-align:center; width:100%;">Recompensa: +${spReward} SP</span></div>`;

    // Modify pet stats if lost
    if (!isWinner && appState.profile.pet) {
        appState.profile.pet.hunger = Math.max(10, appState.profile.pet.hunger - 50);
        appState.profile.pet.thirst = Math.max(10, appState.profile.pet.thirst - 50);
        appState.profile.pet.health = Math.max(10, appState.profile.pet.health - 50);
        
        scoresList.innerHTML += `<div class="score-row"><span style="color:#f44336; font-size:0.8rem; text-align:center; width:100%;">Tu mascota ha quedado exhausta...</span></div>`;
    }

    appState.profile.skillPoints += spReward;
    
    // Lifetime Stats
    if (!appState.profile.stats) {
        appState.profile.stats = { matchesPlayed: 0, matchesWon: 0, battlesWon: 0, battlesLost: 0 };
    }
    appState.profile.stats.matchesPlayed++;
    if (isWinner) appState.profile.stats.battlesWon = (appState.profile.stats.battlesWon || 0) + 1;
    else appState.profile.stats.battlesLost = (appState.profile.stats.battlesLost || 0) + 1;
    
    await updateUserProfile(appState.username, {
        skillPoints: appState.profile.skillPoints,
        pet: appState.profile.pet,
        stats: appState.profile.stats
    });

    const backBtn = document.getElementById('back-to-lobby-btn');
    backBtn.onclick = () => {
        appState.roomId = null;
        appState.userId = null;
        appState.isHost = false;
        appState.players = [];
        appState.currentRound = 0;
        appState.lastStatus = "";
        appState.lastRound = 0;
        appState.isTimerActive = false;
        showScreen('menu');
    };
}

// --- SOLITARIO (MEMORIA) FUNCTIONS ---
let localPairsFound = 0;
let flippedCards = [];
let actGridDisabled = false;

function enterSolitarioMemPhase(roomData) {
    showScreen('solitario');
    document.getElementById('solitario-grid-panel').classList.remove('hidden');
    document.getElementById('solitario-write-panel').classList.add('hidden');
    document.getElementById('solitario-review-panel').classList.add('hidden');
    document.getElementById('solitario-waiting-overlay').classList.add('hidden');
    
    localPairsFound = 0;
    flippedCards = [];
    actGridDisabled = false;
    document.getElementById('solitario-pairs-count').innerText = "0";
    
    // Generate cards matching array
    const words = roomData.memWords || [];
    let deck = [...words, ...words]; // 2 of each
    deck.sort(() => Math.random() - 0.5); // shuffle
    
    const grid = document.getElementById('solitario-memory-grid');
    grid.innerHTML = "";
    
    deck.forEach((word, index) => {
        const card = document.createElement('div');
        card.className = 'memory-card';
        card.dataset.word = word;
        card.dataset.index = index;
        card.innerHTML = `
            <div class="memory-card-inner">
                <div class="memory-card-front">?</div>
                <div class="memory-card-back">
                    <span class="memory-card-text">${word}</span>
                </div>
            </div>
        `;
        
        card.addEventListener('click', () => handleCardClick(card));
        grid.appendChild(card);
    });
    
    startSolitarioTimer(60, async () => {
        if(appState.isHost) {
            await updateMatchStatus(appState.roomId, "solitario_write");
        }
    });
}

function handleCardClick(card) {
    if(actGridDisabled || card.classList.contains('flipped') || card.classList.contains('matched')) return;
    
    card.classList.add('flipped');
    flippedCards.push(card);
    
    if(flippedCards.length === 2) {
        actGridDisabled = true;
        const [c1, c2] = flippedCards;
        
        if (c1.dataset.word === c2.dataset.word) {
            // Match
            setTimeout(() => {
                c1.classList.add('matched');
                c2.classList.add('matched');
                localPairsFound++;
                document.getElementById('solitario-pairs-count').innerText = localPairsFound;
                flippedCards = [];
                actGridDisabled = false;
            }, 600);
        } else {
            // No match
            setTimeout(() => {
                c1.classList.remove('flipped');
                c2.classList.remove('flipped');
                flippedCards = [];
                actGridDisabled = false;
            }, 1000);
        }
    }
}

function enterSolitarioWritePhase(roomData) {
    appState.isTimerActive = false;
    clearInterval(appState.timerInterval);
    
    document.getElementById('solitario-grid-panel').classList.add('hidden');
    document.getElementById('solitario-write-panel').classList.remove('hidden');
    
    const inputArea = document.getElementById('solitario-input');
    const wordCount = document.getElementById('solitario-word-count');
    inputArea.value = "";
    inputArea.disabled = false;
    wordCount.innerText = "0";
    
    const countWords = (t) => t.trim().split(/\\s+/).filter(w => w.length > 0).length;
    
    // Auto-update word count
    inputArea.oninput = () => {
        const c = countWords(inputArea.value);
        wordCount.innerText = c;
        if (c < 70 || c > 100) wordCount.style.color = "var(--error)";
        else wordCount.style.color = "var(--success)";
    };
    
    const doneBtn = document.getElementById('solitario-done-btn');
    doneBtn.onclick = async () => {
        const text = inputArea.value.trim();
        const c = countWords(text);
        if (c < 70) {
            alert("Tu historia es muy corta. Mínimo 70 palabras.");
            return;
        }
        if (c > 100) {
            alert("Tu historia es muy larga. Máximo 100 palabras.");
            return;
        }
        
        inputArea.disabled = true;
        doneBtn.disabled = true;
        
        document.getElementById('solitario-waiting-overlay').classList.remove('hidden');
        document.getElementById('solitario-waiting-text').innerText = "Guardando poema...";
        
        await submitText(appState.roomId, appState.userId, text);
        
        if (appState.isHost) {
            setTimeout(async () => {
                await updateMatchStatus(appState.roomId, "solitario_grading");
            }, 1500);
        }
    };
    
    startSolitarioTimer(60, () => {
        if (!inputArea.disabled) {
            inputArea.value = inputArea.value || "(Sin tiempo)";
            doneBtn.click();
        }
    });
}

async function enterSolitarioGradingPhase(roomData) {
    clearInterval(appState.timerInterval);
    appState.isTimerActive = false;
    
    document.getElementById('solitario-write-panel').classList.add('hidden');
    document.getElementById('solitario-waiting-overlay').classList.remove('hidden');
    document.getElementById('solitario-waiting-text').innerText = "La IA está evaluando tu composición...";
    
    const myPlayer = appState.players.find(p => p.id === appState.userId);
    let myText = roomData[myPlayer.slot].text;
    if (!myText) myText = "(Vacio)";
    
    try {
        const memWords = roomData.memWords || [];
        // Dynamic import because evaluateSolitarioStory in groq.js
        const { evaluateSolitarioStory } = await import('./groq.js');
        const aiResult = await evaluateSolitarioStory(memWords, myText);
        
        const finalScore = localPairsFound + aiResult.score; // 1 pt per pair + 1-10 for story
        await updateScore(appState.roomId, myPlayer.slot, finalScore, aiResult.feedback, "SOLITARIO");
        
    } catch (e) {
        console.error("Eval Error:", e);
        await updateScore(appState.roomId, myPlayer.slot, localPairsFound, "Error al evaluar.", "SOLITARIO");
    }
    
    if (appState.isHost) {
        setTimeout(async () => {
            await updateMatchStatus(appState.roomId, "solitario_review");
        }, 3000);
    }
}

function enterSolitarioReviewPhase(roomData) {
    document.getElementById('solitario-waiting-overlay').classList.add('hidden');
    document.getElementById('solitario-review-panel').classList.remove('hidden');
    
    const container = document.getElementById('solitario-review-texts');
    container.innerHTML = "";
    
    appState.players.forEach(p => {
        const pData = roomData[p.slot];
        const div = document.createElement('div');
        div.className = 'glass-panel';
        div.style.padding = '1rem';
        div.style.textAlign = 'left';
        div.innerHTML = `
            <h4 style="color: ${p.id === appState.userId ? 'var(--secondary-color)' : 'var(--primary-color)'}">${p.name}</h4>
            <p style="font-size: 0.95rem; margin-top: 0.5rem; line-height: 1.4; color: #ddd;">${pData.text || "(Texto Vacío)"}</p>
            <p style="margin-top: 1rem; font-size: 0.85rem; color: #a855f7;">Feedback: ${pData.feedback || "..."}</p>
            <div style="margin-top: 0.5rem; display: flex; justify-content: space-between; font-weight: bold;">
                <span style="color: khaki;">Puntos Totales: ${pData.score}</span>
            </div>
        `;
        container.appendChild(div);
    });
    
    const continueBtn = document.getElementById('solitario-continue-btn');
    const waitingMsg = document.getElementById('solitario-waiting-peer-msg');
    
    continueBtn.disabled = false;
    continueBtn.style.opacity = '1';
    waitingMsg.classList.add('hidden');
    
    // Using updateMatchStatus to mark readiness
    continueBtn.onclick = async () => {
        continueBtn.disabled = true;
        continueBtn.style.opacity = '0.5';
        waitingMsg.classList.remove('hidden');
        
        const mySlot = appState.players.find(p => p.id === appState.userId).slot;
        await updateMatchStatus(appState.roomId, roomData.status, { [`${mySlot}_ready`]: true });
    };
    
    if (appState.isHost) {
        // If host, check if everyone is ready
        let allReady = true;
        appState.players.forEach(p => {
            if (!roomData[`${p.slot}_ready`]) allReady = false;
        });
        
        if (allReady) {
            updateMatchStatus(appState.roomId, "finished");
        }
    }
}

async function endSolitarioScreen(roomData) {
    showEndScreen(roomData); // We can just reuse showEndScreen for UI and SP assignment.
}

function startSolitarioTimer(seconds, onEnd) {
    clearInterval(appState.timerInterval);
    const textEl = document.getElementById('solitario-timer-text');
    const circle = document.querySelector('.timer-circle-small');
    let timeLeft = seconds;
    textEl.innerText = timeLeft;
    circle.style.borderColor = "var(--primary-color)";
    
    appState.isTimerActive = true;
    appState.timerInterval = setInterval(() => {
        timeLeft--;
        textEl.innerText = timeLeft;
        if(timeLeft <= 10) circle.style.borderColor = "var(--error)";
        
        if (timeLeft <= 0) {
            clearInterval(appState.timerInterval);
            appState.isTimerActive = false;
            onEnd();
        }
    }, 1000);
}
