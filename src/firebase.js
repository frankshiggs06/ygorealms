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

export async function createOrJoinLobby(username, waitTime, playersCount, onMatchFound) {
  const userId = `user_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const lobbyKey = `lobby_${playersCount}`;
  const lobbyRef = ref(db, lobbyKey);
  
  const lobbySnap = await get(lobbyRef);
  let waitingPlayers = lobbySnap.exists() ? lobbySnap.val() : {};
  
  // Add myself to waiting list
  waitingPlayers[userId] = { username };
  await set(lobbyRef, waitingPlayers);
  onDisconnect(ref(db, `${lobbyKey}/${userId}`)).remove();

  // Check if we reached the required count
  if (Object.keys(waitingPlayers).length >= playersCount) {
    const playerIds = Object.keys(waitingPlayers).slice(0, playersCount);
    const playersData = {};
    playerIds.forEach((id, index) => {
      playersData[`player${index + 1}`] = { 
        id: id, 
        name: waitingPlayers[id].username, 
        score: 0, text: "", evalScore: 0, feedback: "" 
      };
    });

    // Remove these players from lobby
    for (const id of playerIds) {
      await remove(ref(db, `${lobbyKey}/${id}`));
    }

    const roomId = `room_${Date.now()}`;
    const roomRef = ref(db, `matches/${roomId}`);
    
    await set(roomRef, {
      ...playersData,
      playersCount,
      currentRound: 0,
      status: "starting",
      word: "",
      waitTime: waitTime,
      history: {}
    });

    onDisconnect(ref(db, `matches/${roomId}/status`)).set("abandoned");
    setTimeout(onMatchFound, 500);
    
    const mySlotIndex = playerIds.indexOf(userId);
    return { roomId, userId, isHost: mySlotIndex === 0 };
  } else {
    // Wait for match
    return new Promise((resolve) => {
      const matchesRef = ref(db, 'matches');
      const unsubscribe = onValue(matchesRef, (snapshot) => {
        if (!snapshot.exists()) return;
        const matches = snapshot.val();
        for (const [roomId, room] of Object.entries(matches)) {
          // Check if I am in this room
          const players = Object.keys(room).filter(k => k.startsWith('player'));
          const mySlot = players.find(p => room[p].id === userId);
          
          if (mySlot) {
             unsubscribe();
             onDisconnect(ref(db, `matches/${roomId}/status`)).set("abandoned");
             onMatchFound();
             resolve({ roomId, userId, isHost: mySlot === 'player1' });
          }
        }
      });
    });
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
    } else {
        // Create default profile
        const defaultProfile = {
            username: username,
            skillPoints: 100, // Starts with 100 for trying the shop
            inventory: {
                "food1": 0, "food2": 0, "water1": 0, "water2": 0, "health1":0, "acc1": 0, "acc2": 0
            },
            pet: null // No pet initially
        };
        await set(userRef, defaultProfile);
        return defaultProfile;
    }
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
