import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, get, onValue, update, remove, onDisconnect } from "firebase/database";

let app;
let db;

export function setupFirebase() {
    if (app) return; // already initialized
    const firebaseConfig = {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
      databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL
    };
    app = initializeApp(firebaseConfig);
    db = getDatabase(app);
}

export async function createOrJoinLobby(username, waitTime, playersCount, gameMode, activePet, onMatchFound) {
  const userId = `user_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const lobbyKey = `lobby_${gameMode}_${playersCount}`;
  const myLobbyRef = ref(db, `${lobbyKey}/${userId}`);
  
  try {
    // 1. Initial cleanup of potentially stale data (optional but good)
    // 2. Add myself to the lobby queue
    await set(myLobbyRef, { 
        username, 
        activePet, 
        roomId: null, 
        joinedAt: Date.now() 
    });
    onDisconnect(myLobbyRef).remove();

    // 3. Continuous check for match
    return new Promise((resolve, reject) => {
        const lobbyRef = ref(db, lobbyKey);
        
        // Timeout if no match found in 60s
        const matchTimeout = setTimeout(() => {
            unsubscribeLobby();
            remove(myLobbyRef);
            reject(new Error("Timeout: No se encontró oponente en 60 segundos."));
        }, 60000);

        const unsubscribeLobby = onValue(lobbyRef, async (snapshot) => {
            if (!snapshot.exists()) return;
            
            const players = snapshot.val();
            const myEntry = players[userId];
            
            // If someone (host) already assigned a roomId to me, I'm a joiner
            if (myEntry && myEntry.roomId) {
                clearTimeout(matchTimeout);
                unsubscribeLobby();
                const roomId = myEntry.roomId;
                onMatchFound();
                resolve({ roomId, userId, isHost: false });
                return;
            }

            // Host is the oldest player in the required count batch
            // Filter only valid entries with joinedAt
            const allPlayerIds = Object.keys(players)
                .filter(id => players[id] && players[id].joinedAt)
                .sort((a, b) => players[a].joinedAt - players[b].joinedAt);
            
            if (allPlayerIds.length >= playersCount) {
                const myBatch = allPlayerIds.slice(0, playersCount);
                if (myBatch.includes(userId) && myBatch[0] === userId) {
                    // I am the host!
                    clearTimeout(matchTimeout);
                    unsubscribeLobby();
                    
                    const roomId = `room_${Date.now()}`;
                    const playersData = {};
                    const signals = {};

                    myBatch.forEach((id, index) => {
                        const p = players[id];
                        playersData[`player${index + 1}`] = {
                            id: id,
                            name: p.username,
                            activePet: p.activePet,
                            score: 0, text: "", evalScore: 0, feedback: "", 
                            hp: p.activePet ? (p.activePet.hp || 40) : 40
                        };
                        signals[`${id}/roomId`] = roomId;
                    });

                    try {
                        // Create room
                        await set(ref(db, `matches/${roomId}`), {
                            ...playersData,
                            playersCount,
                            gameMode,
                            currentRound: 0,
                            status: "starting",
                            word: "",
                            waitTime: waitTime,
                            history: {}
                        });

                        // Signal to others
                        await update(lobbyRef, signals);
                        
                        // Cleanup lobby entry after signaling
                        setTimeout(() => {
                            myBatch.forEach(id => remove(ref(db, `${lobbyKey}/${id}`)));
                        }, 2000);

                        onMatchFound();
                        resolve({ roomId, userId, isHost: true });
                    } catch (err) {
                        console.error("Host setup failed:", err);
                        reject(new Error("Error al configurar la sala del host."));
                    }
                }
            }
        }, (error) => {
            clearTimeout(matchTimeout);
            console.error("Lobby listener error:", error);
            reject(new Error("Error de conexión con Firebase Realtime Database."));
        });
    });
  } catch (err) {
    console.error("Join lobby failed:", err);
    throw new Error("No se pudo conectar a la cola de emparejamiento.");
  }
}

export function listenToMatch(roomId, callback) {
   const roomRef = ref(db, `matches/${roomId}`);
   onValue(roomRef, (snapshot) => callback(snapshot.val()));
}

export async function updateMatchStatus(roomId, status, extraData = {}) {
  const roomRef = ref(db, `matches/${roomId}`);
  await update(roomRef, { status, ...extraData });
}

let currentDisconnectRef = null;

export function setupDisconnectHook(roomId) {
    if (currentDisconnectRef) {
        currentDisconnectRef.cancel();
    }
    const statusRef = ref(db, `matches/${roomId}/status`);
    currentDisconnectRef = onDisconnect(statusRef);
    currentDisconnectRef.set("abandoned");
}

export function cancelDisconnectHook() {
    if (currentDisconnectRef) {
        currentDisconnectRef.cancel();
        currentDisconnectRef = null;
    }
}

export async function submitText(roomId, userId, text) {
    const roomRef = ref(db, `matches/${roomId}`);
    const snap = await get(roomRef);
    const data = snap.val();
    if (!data) return;

    const players = Object.keys(data).filter(k => /^player\d+$/.test(k));
    const mySlot = players.find(p => data[p].id === userId);
    
    if (!mySlot) return;

    const updates = {};
    updates[`${mySlot}/text`] = text;
    await update(roomRef, updates);
}

export async function updateScore(roomId, playerSlot, newTotalScore, feedback, roundNum) {
   const playerRef = ref(db, `matches/${roomId}/${playerSlot}`);
   const snap = await get(playerRef);
   const data = snap.val();
   if (!data) return;

   const currentScore = data.score || 0;
   const delta = newTotalScore - currentScore;

   const roomSnap = await get(ref(db, `matches/${roomId}`));
   const roomWord = roundNum === "BONUS" ? "MEMORIA" : roomSnap.val().word;

   const updates = {};
   updates[`${playerSlot}/score`] = newTotalScore;
   updates[`${playerSlot}/evalScore`] = delta;
   updates[`${playerSlot}/feedback`] = feedback;
   
   updates[`history/${roundNum}/${playerSlot}`] = {
       text: snap.val().text || "(Vacio)",
       score: delta,
       feedback: feedback
   };
   updates[`history/${roundNum}/word`] = roomWord;

   await update(ref(db, `matches/${roomId}`), updates);
}

export async function updateWeeklyLeaderboard(username, score) {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const weekNum = Math.ceil((((now - startOfYear) / 86400000) + startOfYear.getDay() + 1) / 7);
    const weekKey = `${now.getFullYear()}_W${weekNum}`;
    
    const userRef = ref(db, `leaderboard/${weekKey}/${username}`);
    const snap = await get(userRef);
    const currentHigh = snap.val() || 0;
    
    if (score > currentHigh) {
        await set(userRef, score);
    }
}

export async function getWeeklyLeaderboard() {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const weekNum = Math.ceil((((now - startOfYear) / 86400000) + startOfYear.getDay() + 1) / 7);
    const weekKey = `${now.getFullYear()}_W${weekNum}`;
    
    const boardRef = ref(db, `leaderboard/${weekKey}`);
    const snap = await get(boardRef);
    if (!snap.exists()) return [];
    
    const data = snap.val();
    const arr = Object.keys(data).map(key => ({ username: key, score: data[key] }));
    arr.sort((a,b) => b.score - a.score);
    return arr;
}

export async function getUserProfile(username) {
    const safeName = username.replace(/[\.\#\$\[\]]/g, "_");
    const userRef = ref(db, `users/${safeName}`);
    const snap = await get(userRef);
    if (snap.exists()) {
        return snap.val();
    }
    return null;
}

export async function updateUserProfile(username, dataUpdates) {
    const safeName = username.replace(/[\.\#\$\[\]]/g, "_");
    const userRef = ref(db, `users/${safeName}`);
    await update(userRef, dataUpdates);
}

export async function awardSkillPoints(username, points) {
    if (points <= 0) return;
    const safeName = username.replace(/[\.\#\$\[\]]/g, "_");
    const userRef = ref(db, `users/${safeName}/skillPoints`);
    const snap = await get(userRef);
    const currentSp = snap.val() || 0;
    await set(userRef, currentSp + points);
}

export async function updateBattleDamage(roomId, playerSlot, targetSlot, damageToDeal, aiScore, feedback, text, roundNum) {
    const roomRef = ref(db, `matches/${roomId}`);
    const snap = await get(roomRef);
    if (!snap.exists()) return;
    const room = snap.val();
    
    const currentHp = room[targetSlot].hp || 0;
    const newHp = Math.max(0, currentHp - damageToDeal);
    
    const updates = {};
    updates[`${targetSlot}/hp`] = newHp;
    updates[`${playerSlot}/evalScore`] = damageToDeal; 
    updates[`${playerSlot}/text`] = text;
    updates[`${playerSlot}/feedback`] = feedback;
    
    updates[`history/${roundNum}/${playerSlot}`] = {
       text: text,
       score: damageToDeal, 
       feedback: feedback
    };
    
    await update(roomRef, updates);
}
