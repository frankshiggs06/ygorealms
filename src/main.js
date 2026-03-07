import { setupFirebase, createOrJoinLobby, listenToMatch, updateMatchStatus, submitText, updateScore, updateWeeklyLeaderboard, getWeeklyLeaderboard, loginWithEmail, signUpWithEmail, onAuthChange, logout } from './firebase.js';
import { getRandomWord } from './words.js';
import { evaluateMetaphor, evaluateFinalMatch, evaluateMemoryRound } from './groq.js';
import { ParticleSystem } from './particles.js';

const screens = {
  login: document.getElementById('login-screen'),
  menu: document.getElementById('menu-screen'),
  leaderboard: document.getElementById('leaderboard-screen'),
  lobby: document.getElementById('lobby-screen'),
  game: document.getElementById('game-screen'),
  results: document.getElementById('results-screen'),
  bonus: document.getElementById('bonus-screen'),
  recap: document.getElementById('recap-screen'),
  end: document.getElementById('end-screen')
};

const particles = new ParticleSystem('particles-canvas');

// State
let appState = {
  username: "",
  roomId: null,
  userId: null,
  isHost: false,
  opponentName: "???",
  currentRound: 0,
  myScore: 0,
  oppScore: 0,
  currentWord: "",
  timerInterval: null,
  roundTime: 30, 
  lastStatus: "",
  lastRound: 0,
  isTimerActive: false,
  isRecapShown: false,
  bonusWords: [],
  hasBonusPlayed: false,
  isLoginMode: true
};

// Elements
const emailInput = document.getElementById('email-input');
const usernameInput = document.getElementById('username-input');
const passwordInput = document.getElementById('password-input');
const waitTimeSelect = document.getElementById('wait-time-select');
const loginBtn = document.getElementById('login-btn');
const toggleAuthBtn = document.getElementById('toggle-auth-btn');
const loginError = document.getElementById('login-error');
const authSubtitle = document.getElementById('auth-subtitle');

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
const player1Name = document.getElementById('player1-name');
const player2Name = document.getElementById('player2-name');
const logoutBtn = document.getElementById('logout-btn');
logoutBtn.addEventListener('click', async () => {
    await logout();
    location.reload();
});

const timerText = document.getElementById('timer-text');
const timerCircle = document.querySelector('.timer-circle');
const currentWordEl = document.getElementById('current-word');
const gameInputEl = document.getElementById('game-input');
const wordCountEl = document.getElementById('word-count');
const roundNumberEl = document.getElementById('round-number');
const waitingOverlay = document.getElementById('waiting-overlay');

function showScreen(screenKey) {
  Object.values(screens).forEach(s => s.classList.remove('active', 'hidden'));
  Object.keys(screens).forEach(k => {
    if (k !== screenKey) {
        screens[k].classList.add('hidden');
    } else {
        screens[k].classList.add('active');
    }
  });
}

// 1. INIT / AUTH
setupFirebase();

onAuthChange((user) => {
    if (user) {
        appState.username = user.displayName || "MC Anónimo";
        menuWelcomeText.innerText = `Bienvenido, ${appState.username}`;
        showScreen('menu');
        particles.start();
    } else {
        showScreen('login');
    }
});

toggleAuthBtn.addEventListener('click', () => {
    appState.isLoginMode = !appState.isLoginMode;
    if (appState.isLoginMode) {
        authSubtitle.innerText = "Inicia sesión para jugar";
        usernameInput.classList.add('hidden');
        loginBtn.innerText = "Entrar";
        toggleAuthBtn.innerText = "¿No tienes cuenta? Regístrate";
    } else {
        authSubtitle.innerText = "Crea tu cuenta de MC";
        usernameInput.classList.remove('hidden');
        loginBtn.innerText = "Registrarse";
        toggleAuthBtn.innerText = "¿Ya tienes cuenta? Inicia sesión";
    }
    loginError.innerText = "";
});

loginBtn.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();
    const username = usernameInput.value.trim();

    if (!email || !password) {
        loginError.innerText = "Completa todos los campos";
        return;
    }

    if (!appState.isLoginMode && username.length < 3) {
        loginError.innerText = "Nombre de MC demasiado corto";
        return;
    }

    loginBtn.disabled = true;
    loginBtn.innerText = "Cargando...";

    try {
        if (appState.isLoginMode) {
            await loginWithEmail(email, password);
        } else {
            await signUpWithEmail(email, password, username);
        }
    } catch (e) {
        console.error(e);
        loginError.innerText = e.code === 'auth/user-not-found' ? "Usuario no encontrado" : 
                           e.code === 'auth/wrong-password' ? "Contraseña incorrecta" :
                           e.code === 'auth/email-already-in-use' ? "El email ya está registrado" :
                           "Error de autenticación";
        loginBtn.disabled = false;
        loginBtn.innerText = appState.isLoginMode ? "Entrar" : "Registrarse";
    }
});

// Initially hide username input in login mode
usernameInput.classList.add('hidden');

// -- MENU INTERACTIONS --
menuPlayBtn.addEventListener('click', async () => {
    appState.roundTime = parseInt(waitTimeSelect.value);
    
    lobbyUsername.innerText = appState.username;
    showScreen('lobby');
    
    try {
        // Find Match
        const { roomId, userId, isHost } = await createOrJoinLobby(appState.username, appState.roundTime, onGameStartRequested);

        appState.roomId = roomId;
        appState.userId = userId;
        appState.isHost = isHost;

        listenToMatch(roomId, handleMatchStateChange);
    } catch (e) {
        console.error(e);
        alert("Error de conexión");
        showScreen('login');
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
        if (index === 0) rankColor = "#FFD700"; // Gold
        if (index === 1) rankColor = "#C0C0C0"; // Silver
        if (index === 2) rankColor = "#CD7F32"; // Bronze
        
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

function onGameStartRequested() {
    // When 2 players found
    matchStatus.innerText = "¡Partida lista!";
    matchStatus.parentElement.querySelector('.spinner').classList.add('hidden');
    
    // Add EPIC classes
    playersFoundPanel.classList.remove('hidden');
    playersFoundPanel.classList.add('epic-vs-reveal');
    player1Name.classList.add('epic-player-1');
    player2Name.classList.add('epic-player-2');
    document.querySelector('.vs-text').classList.add('epic-vs-text');

    player1Name.innerText = appState.username; // Highlight
    // We get opponent from match state shortly
    setTimeout(() => {
        if(appState.isHost) {
            startNextRound();
        }
    }, 4000); // 4 sec visual delay for epicness
}

function handleMatchStateChange(roomData) {
    if (!roomData) return;
    
    const mySlot = roomData.player1.id === appState.userId ? 'player1' : 'player2';
    const oppSlot = mySlot === 'player1' ? 'player2' : 'player1';
    
    appState.opponentName = roomData[oppSlot].name;
    player2Name.innerText = appState.opponentName;
    
    appState.myScore = roomData[mySlot].score;
    appState.oppScore = roomData[oppSlot].score;
    
    // Check if status or round actually changed
    const statusChanged = roomData.status !== appState.lastStatus;
    const roundChanged = roomData.currentRound !== appState.lastRound;

    appState.currentRound = roomData.currentRound;
    
    if (roomData.waitTime) {
        appState.roundTime = roomData.waitTime;
    }

    if (statusChanged || roundChanged) {
        console.log(`Transitioning: ${appState.lastStatus} -> ${roomData.status}, Round: ${appState.lastRound} -> ${roomData.currentRound}`);
        appState.lastStatus = roomData.status;
        appState.lastRound = roomData.currentRound;

        if (roomData.status === "playing") {
            appState.currentWord = roomData.word;
            enterGameScreen(roomData);
        } else if (roomData.status === "grading") {
            enterGradingScreen(roomData, mySlot, oppSlot);
        } else if (roomData.status === "bonus") {
            enterBonusScreen(roomData, mySlot, oppSlot);
        } else if (roomData.status === "results") {
            updateResultsUI(roomData, mySlot, oppSlot);
            if (statusChanged) {
                startResultsCountdown(); 
            }
        } else if (roomData.status === "recap") {
            if (!appState.isRecapShown) {
                appState.isRecapShown = true;
                startRecapShow(roomData, mySlot, oppSlot);
            }
        } else if (roomData.status === "finished") {
            showEndScreen(roomData);
        } else if (roomData.status === "abandoned") {
            alert("El oponente se desconectó");
            location.reload();
        }
    } else if (roomData.status === "results") {
        // Even if status didn't change, update the UI (in case scores arrive late)
        updateResultsUI(roomData, mySlot, oppSlot);
    }
}

async function startNextRound() {
    if (appState.currentRound === 3 && !appState.hasBonusPlayed) {
        appState.hasBonusPlayed = true;
        const bonusWords = [getRandomWord(), getRandomWord(), getRandomWord(), getRandomWord(), getRandomWord()];
        await updateMatchStatus(appState.roomId, "bonus", { bonusWords });
        return;
    }

    if (appState.currentRound >= 5) {
        await updateMatchStatus(appState.roomId, "finished");
        return;
    }
    
    const nextWord = getRandomWord();
    // Reset round-specific data in one go
    const roundUpdates = {
        word: nextWord,
        currentRound: appState.currentRound + 1,
        "player1/text": "",
        "player1/evalScore": 0,
        "player1/feedback": "",
        "player2/text": "",
        "player2/evalScore": 0,
        "player2/feedback": ""
    };
    await updateMatchStatus(appState.roomId, "playing", roundUpdates);
}

// 2. GAME LOOP
function enterGameScreen(roomData) {
    showScreen('game');
    particles.stop(); // Clean canvas for concentration
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
    timerCircle.classList.remove('danger');
    
    appState.isTimerActive = true;
    appState.timerInterval = setInterval(() => {
        timeLeft--;
        timerText.innerText = timeLeft;
        if (timeLeft <= 5) {
            timerCircle.classList.add('danger');
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
    waitingOverlay.classList.remove('hidden');
    const myText = gameInputEl.value.trim();
    
    // Upload text to Firebase
    const mySlot = appState.isHost ? 'player1' : 'player2'; // Not reliable, better determine slot before
    // Need to cleanly determine slot, rely on myId.
    // For simplicity, Firebase abstraction should handle this
    await submitText(appState.roomId, appState.userId, myText);
    
    // Only HOST changes status to grading when both texts are essentially "locked in".
    // Since we don't have perfect sync, if host finishes, wait 1 sec and declare grading.
    if(appState.isHost) {
        setTimeout(async () => {
             await updateMatchStatus(appState.roomId, "grading");
        }, 1500); 
    }
}

// 3. GRADING
async function enterGradingScreen(roomData, mySlot, oppSlot) {
    showScreen('game'); // Keep on game screen while grading
    waitingOverlay.classList.remove('hidden');
    waitingOverlay.querySelector('p').innerText = "La IA está evaluando tu texto...";

    const word = roomData.word;
    let myText = roomData[mySlot].text;
    
    // Fallback: if Firebase hasn't synced yet, use the local value from input
    if (!myText || myText.trim() === "") {
        myText = gameInputEl.value.trim();
    }
    
    // Execute Groq API Call
    const aiResult = await evaluateMetaphor(word, myText);
    
    // Save to Firebase (PASS CURRENT ROUND NUM EXPLICITLY)
    await updateScore(appState.roomId, mySlot, appState.myScore + aiResult.score, aiResult.feedback, appState.currentRound);
    
    // Host waits for both to be graded
    if(appState.isHost) {
        const waitTime = roomData.status === "bonus" ? 4000 : 8000;
        setTimeout(async () => {
            await updateMatchStatus(appState.roomId, "results");
        }, waitTime); 
    }
}

// 3.5 BONUS ROUND
async function enterBonusScreen(roomData, mySlot, oppSlot) {
    showScreen('bonus');
    const display = document.getElementById('bonus-word-display');
    const inputs = document.getElementById('bonus-input-panel');
    const wordEl = document.getElementById('bonus-current-word');
    const waiting = document.getElementById('bonus-waiting');
    
    // Clear previous inputs
    for(let i=1; i<=5; i++) {
        document.getElementById(`bonus-in-${i}`).value = "";
    }
    
    display.classList.remove('hidden');
    inputs.classList.add('hidden');
    waiting.classList.add('hidden');

    const words = roomData.bonusWords || [];
    appState.bonusWords = words;

    // Show words context
    for (let i = 0; i < words.length; i++) {
        wordEl.innerText = words[i];
        await new Promise(r => setTimeout(r, 2000));
    }

    // Now Input Phase
    display.classList.add('hidden');
    inputs.classList.remove('hidden');
    
    let bonusTime = 10;
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
            ];
            
            const aiResult = await evaluateMemoryRound(appState.bonusWords, answers);
            // Save as text to show in results
            const ansText = `MEMORIA: ${answers.join(", ")}`;
            await submitText(appState.roomId, appState.userId, ansText);
            await updateScore(appState.roomId, mySlot, appState.myScore + aiResult.score, aiResult.feedback, "BONUS");
            
            if (appState.isHost) {
                setTimeout(async () => {
                    await updateMatchStatus(appState.roomId, "results");
                }, 8000); // Wait longer for API to evaluate both
            }
        }
    }, 1000);
}

// 4. RESULTS
function updateResultsUI(roomData, mySlot, oppSlot) {
    showScreen('results');
    
    const myData = roomData[mySlot];
    const oppData = roomData[oppSlot];

    document.getElementById('res-my-text').innerText = myData.text || "(No escribió nada)";
    document.getElementById('res-my-score').innerText = (myData.evalScore || 0) + " pts";
    
    document.getElementById('res-opp-text').innerText = oppData.text || "(No escribió nada)";
    document.getElementById('res-opp-score').innerText = (oppData.evalScore || 0) + " pts";

    // Dynamic feedback if you want to show it
    if (myData.feedback) {
        document.getElementById('res-my-name').innerText = appState.username + ": " + myData.feedback;
    } else {
        document.getElementById('res-my-name').innerText = appState.username;
    }
    
    if (oppData.feedback) {
        document.getElementById('res-opp-name').innerText = appState.opponentName + ": " + oppData.feedback;
    } else {
        document.getElementById('res-opp-name').innerText = appState.opponentName;
    }
}

function startResultsCountdown() {
    const countdownPanel = document.getElementById('next-round-countdown');
    const timerSpan = document.getElementById('next-timer');
    const finishBtn = document.getElementById('finish-btn');
    
    if (appState.currentRound < 5) {
        countdownPanel.classList.remove('hidden');
        finishBtn.classList.add('hidden');
        let cd = 5; // Faster to read feedback
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

async function startRecapShow(roomData, mySlot, oppSlot) {
    showScreen('recap');
    const timeline = document.getElementById('recap-timeline');
    timeline.innerHTML = "";
    
    // Convert to array and sort numerically by round number, putting BONUS between 3 and 4
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
        if (!round[mySlot] || !round[oppSlot]) continue;

        const card = document.createElement('div');
        card.className = 'recap-card';
        if (rNum === "BONUS") card.style.borderLeftColor = "var(--secondary-color)";
        
        const roundTitle = rNum === "BONUS" ? "RONDA BONUS: MEMORIA" : `RONDA ${rNum}`;

        card.innerHTML = `
            <div class="recap-round-num">${roundTitle}</div>
            <div class="recap-word">${round.word}</div>
            <div class="recap-bars">
                <div class="recap-player-row">
                    <div class="recap-player-name">${appState.username}</div>
                    <div class="recap-player-text">"${round[mySlot].text || '...'}"</div>
                    <div class="recap-player-score">${round[mySlot].score} pts</div>
                    ${round[mySlot].feedback ? `<div class="recap-feedback">${round[mySlot].feedback}</div>` : ''}
                </div>
                <div class="recap-player-row" style="margin-top: 15px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 10px;">
                    <div class="recap-player-name">${appState.opponentName}</div>
                    <div class="recap-player-text">"${round[oppSlot].text || '...'}"</div>
                    <div class="recap-player-score">${round[oppSlot].score} pts</div>
                    ${round[oppSlot].feedback ? `<div class="recap-feedback">${round[oppSlot].feedback}</div>` : ''}
                </div>
            </div>
        `;
        timeline.appendChild(card);
        
        await new Promise(r => setTimeout(r, 50));
        card.classList.add('show');
        timeline.scrollTo({ top: timeline.scrollHeight, behavior: 'auto' });
        
        // 2 seconds to read as per user request
        await new Promise(r => setTimeout(r, 2000)); 
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

// 5. END MATCH
async function showEndScreen(roomData) {
    showScreen('end');
    particles.start(); // Bring particles back
    
    document.getElementById('final-my-name').innerText = appState.username;
    document.getElementById('final-my-score').innerText = appState.myScore;
    
    document.getElementById('final-opp-name').innerText = appState.opponentName;
    document.getElementById('final-opp-score').innerText = appState.oppScore;
    
    // Update Leaderboard
    await updateWeeklyLeaderboard(appState.username, appState.myScore);
    
    // Final AI Summary
    const finalVerdictEl = document.getElementById('match-winner');
    
    // Determine winner name immediately
    let winnerName = "";
    if (appState.myScore > appState.oppScore) {
        winnerName = appState.username;
        finalVerdictEl.innerText = `¡Felicidades ${winnerName}!`;
    } else if (appState.myScore < appState.oppScore) {
        winnerName = appState.opponentName;
        finalVerdictEl.innerText = `¡Felicidades ${winnerName}!`;
    } else {
        finalVerdictEl.innerText = "¡Un empate épico!";
    }
    
    const finalFeedback = await evaluateFinalMatch(roomData.history, roomData.player1.name, roomData.player2.name);
    
    const recapSummary = document.createElement('p');
    recapSummary.className = 'final-ai-summary';
    recapSummary.innerText = finalFeedback;
    document.querySelector('.final-scores-card').after(recapSummary);
    
    const resultTitle = document.getElementById('match-winner');
    if (appState.myScore > appState.oppScore) {
        resultTitle.innerText = "¡GANASTE!";
        document.querySelector('.glow-bg.victory').style.background = 'radial-gradient(circle, var(--success) 0%, transparent 70%)';
    } else if (appState.myScore < appState.oppScore) {
        resultTitle.innerText = "PERDISTE...";
        document.querySelector('.glow-bg.victory').style.background = 'radial-gradient(circle, var(--error) 0%, transparent 70%)';
    } else {
        resultTitle.innerText = "¡EMPATE!";
        document.querySelector('.glow-bg.victory').style.background = 'radial-gradient(circle, var(--secondary-color) 0%, transparent 70%)';
    }
}

document.getElementById('back-to-lobby-btn').addEventListener('click', () => {
    location.reload(); // Quick reset for now
});
