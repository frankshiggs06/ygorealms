import { setupFirebase, createOrJoinLobby, listenToMatch, updateMatchStatus, submitText, updateScore, updateBattleDamage, updateWeeklyLeaderboard, getWeeklyLeaderboard, getUserProfile, updateUserProfile, awardSkillPoints } from './firebase.js';
import { getRandomWord } from './words.js';
import { evaluateMetaphor, evaluateFinalMatch, evaluateMemoryRound } from './groq.js';
import { ParticleSystem } from './particles.js';
import { PETS_DATA, SHOP_ITEMS, calculatePetStats } from './pets.js';

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
  battle: document.getElementById('battle-screen')
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
  profile: null // Will hold the whole node from getUserProfile
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
const menuPetBtn = document.getElementById('menu-pet-btn');
const menuShopBtn = document.getElementById('menu-shop-btn');
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
const modeSelectionPanel = document.getElementById('mode-selection-panel');
const modeRetoBtn = document.getElementById('mode-reto-btn');
const modeBatallaBtn = document.getElementById('mode-batalla-btn');

menuPlayBtn.addEventListener('click', () => {
    // Toggle the mode selection panel
    modeSelectionPanel.classList.toggle('hidden');
});

modeRetoBtn.addEventListener('click', async () => {
    modeSelectionPanel.classList.add('hidden');
    appState.roundTime = parseInt(waitTimeSelect.value);
    appState.playersCount = parseInt(playerCountSelect.value);
    
    lobbyUsername.innerText = appState.username;
    showScreen('lobby');
    
    try {
        const { roomId, userId, isHost } = await createOrJoinLobby(appState.username, appState.roundTime, appState.playersCount, "reto", null, onGameStartRequested);

        appState.roomId = roomId;
        appState.userId = userId;
        appState.isHost = isHost;

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

    modeSelectionPanel.classList.add('hidden');
    appState.roundTime = parseInt(waitTimeSelect.value);
    appState.playersCount = 2; // Forced to 2 players for battles
    
    const myPetDef = PETS_DATA.find(p => p.id === appState.profile.pet.id) || { name: "Desconocido" };
    lobbyUsername.innerText = appState.username + " & " + myPetDef.name;
    showScreen('lobby');
    
    try {
        const { roomId, userId, isHost } = await createOrJoinLobby(appState.username, appState.roundTime, 2, "batalla", appState.profile.pet, onGameStartRequested);

        appState.roomId = roomId;
        appState.userId = userId;
        appState.isHost = isHost;

        listenToMatch(roomId, handleMatchStateChange);
    } catch (e) {
        console.error("Matchmaking Error (Batalla):", e);
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

// -- PET & SHOP INTERACTIONS --

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

petBackBtn.addEventListener('click', () => showScreen('menu'));
shopBackBtn.addEventListener('click', () => showScreen('menu'));

function renderShop() {
    const grid = document.getElementById('shop-items-grid');
    grid.innerHTML = "";
    SHOP_ITEMS.forEach(item => {
        const canAfford = appState.profile.skillPoints >= item.cost;
        const div = document.createElement('div');
        div.className = 'shop-item-card';
        div.innerHTML = `
            <div class="shop-icon">${item.icon}</div>
            <div class="shop-name">${item.name}</div>
            <div class="shop-desc">${item.desc}</div>
            <button class="shop-btn" ${canAfford ? '' : 'disabled'}>${item.cost} SP</button>
        `;
        div.querySelector('.shop-btn').addEventListener('click', () => buyItem(item));
        grid.appendChild(div);
    });
}

async function buyItem(item) {
    if (appState.profile.skillPoints < item.cost) return;
    
    appState.profile.skillPoints -= item.cost;
    
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
        appState.profile.inventory[item.id] = (appState.profile.inventory[item.id] || 0) + 1;
        updates.inventory = appState.profile.inventory;
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
            div.className = 'shop-item-card';
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
        
        document.getElementById('stat-hunger-bar').style.width = `${stats.hunger}%`;
        document.getElementById('stat-thirst-bar').style.width = `${stats.thirst}%`;
        document.getElementById('stat-health-bar').style.width = `${stats.health}%`;
        
        // Render Inventory inside pet screen
        const invGrid = document.getElementById('inventory-grid');
        invGrid.innerHTML = "";
        SHOP_ITEMS.forEach(item => {
            const amount = appState.profile.inventory[item.id] || 0;
            if (amount > 0) {
                const div = document.createElement('div');
                div.className = 'shop-item-card';
                div.innerHTML = `
                    <div style="font-size:1.5rem">${item.icon}</div>
                    <div style="font-size:0.8rem; font-weight:bold;">x${amount}</div>
                    ${item.type !== 'accessory' ? '<button class="shop-btn" style="padding:0.2rem 0.5rem; font-size:0.8rem; margin-top:5px;">Usar</button>' : '<div style="font-size:0.7rem; color:var(--text-muted); margin-top:5px;">Accesorio</div>'}
                `;
                if(item.type !== 'accessory') {
                    div.querySelector('button').addEventListener('click', () => useItem(item));
                }
                invGrid.appendChild(div);
            }
        });
        
        if (invGrid.innerHTML === "") {
            invGrid.innerHTML = `<p style="grid-column: 1 / -1; text-align:center; color: var(--text-muted);">Tu inventario está vacío. Ve a la Tienda.</p>`;
        }
    }
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
            else showEndScreen(roomData);
        } else if (roomData.status === "abandoned") {
            alert("Un jugador se desconectó");
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
        const int = setInterval(() => {
            cd--;
            timerSpan.innerText = cd;
            if (cd <= 0) {
                clearInterval(int);
                if(appState.isHost) startNextRound();
            }
            if (appState.lastStatus !== "results") clearInterval(int);
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
    finalBtn.innerText = appState.isHost ? "VER RESULTADOS FINALES" : "ESPERANDO AL HOST...";

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
    if (!appState.isHost) {
        finalBtn.disabled = true;
    }
}

document.getElementById('show-final-scores-btn').addEventListener('click', () => {
    if(appState.isHost) {
        updateMatchStatus(appState.roomId, "finished");
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
    
    // Skill Points calculation
    let earnedSp = 0;
    if (appState.playersCount === 2) {
        earnedSp = (appState.userId === winner.id) ? 30 : 5;
    } else {
        const myRank = sortedPlayers.findIndex(p => p.id === appState.userId);
        if (myRank === 0) earnedSp = 50;
        else if (myRank === 1) earnedSp = 10;
        else earnedSp = 0;
    }

    if (earnedSp > 0 && appState.userId) {
        await awardSkillPoints(appState.username, earnedSp);
        // We mutate the local profile too to sync it
        if(appState.profile) appState.profile.skillPoints += earnedSp;
    }
    
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
    
    const roundEl = document.getElementById('battle-round');
    if (roundEl) roundEl.innerText = `Ronda ${appState.currentRound}`;
    const wordEl = document.getElementById('battle-current-word');
    if (wordEl) wordEl.innerText = `Palabra: ${appState.currentWord}`;
    
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
    document.getElementById('opp-pet-visual').innerHTML = oppPetDef.svg;
    const oppHpPercent = Math.max(0, (roomData[oppPlayer.slot].hp / oppPetDef.hp) * 100);
    const oppHp = Math.ceil(roomData[oppPlayer.slot].hp);
    document.getElementById('opp-hp-fill').style.width = `${oppHpPercent}%`;
    document.getElementById('opp-hp-fill').style.backgroundColor = getHpColor(oppHpPercent);
    document.getElementById('opp-hp-text').innerText = `${oppHp}/${oppPetDef.hp}`;
    
    const battleInputEl = document.getElementById('battle-input');
    battleInputEl.value = "";
    battleInputEl.disabled = false;
    battleInputEl.focus();
    
    if (!appState.isTimerActive) {
        startTimer(appState.roundTime);
    }
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
    
    // Damage is now directly the score (1-10) as requested
    let damageToDeal = Math.floor(aiResult.score);
    if (isNaN(damageToDeal)) damageToDeal = 0;

    
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
        
        document.getElementById(fillId).style.width = `${percent}%`;
        document.getElementById(fillId).style.backgroundColor = getHpColor(percent);
        document.getElementById(textId).innerText = `${Math.ceil(currentHp)}/${maxHp}`;
    };
    
    const animAttack = async (attacker, defender, damage, maxHpDef, hpTrackerDef, attackerName, feedback, defSlot) => {
        dialog.innerText = `¡${attackerName} ataca! (Puntos: ${damage})\n${feedback ? feedback : ''}`;
        
        const isMeAtt = attacker.id === appState.userId;
        const attContainer = document.getElementById(isMeAtt ? 'my-pet-visual' : 'opp-pet-visual');
        const defContainer = document.getElementById(!isMeAtt ? 'my-pet-visual' : 'opp-pet-visual');
        
        if (!attContainer || !defContainer) return hpTrackerDef - damage;

        // Feedback of the attack
        if (feedback) {
            setTimeout(() => {
                dialog.innerText = feedback;
            }, 1000);
        }

        // Attack bump
        attContainer.style.transform = isMeAtt ? "translate(30px, -30px)" : "translate(-30px, 30px)";
        
        await new Promise(r => setTimeout(r, 400));
        attContainer.style.transform = "translate(0, 0)";
        
        // Shake defender
        defContainer.classList.add('take-damage');
        setTimeout(() => defContainer.classList.remove('take-damage'), 300);
        
        const newHp = Math.max(0, hpTrackerDef - damage);
        updateHpBar(defSlot, newHp, maxHpDef);
        
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
    const spReward = isWinner ? 30 : 5;
    
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
    
    await updateUserProfile(appState.username, {
        skillPoints: appState.profile.skillPoints,
        pet: appState.profile.pet
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
