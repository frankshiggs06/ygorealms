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

export async function createOrJoinLobby(username, waitTime, onMatchFound) {
  const lobbyRef = ref(db, 'lobby');
  const lobbySnap = await get(lobbyRef);
  
  const userId = `user_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  
  if (lobbySnap.exists() && Object.keys(lobbySnap.val()).length > 0) {
    // Join
    const waitingPlayers = lobbySnap.val();
    const opponentId = Object.keys(waitingPlayers)[0];
    const opponentName = waitingPlayers[opponentId].username;
    
    await remove(ref(db, `lobby/${opponentId}`));
    
    const roomId = `room_${Date.now()}`;
    const roomRef = ref(db, `matches/${roomId}`);
    
    await set(roomRef, {
      player1: { id: opponentId, name: opponentName, score: 0, text: "", evalScore: 0, feedback: "" },
      player2: { id: userId, name: username, score: 0, text: "", evalScore: 0, feedback: "" },
      currentRound: 0,
      status: "starting",
      word: "",
      waitTime: waitTime,
      history: {} // Store { roundNum: { word, p1: {text, score, feedback}, p2: {...} } }
    });

    onDisconnect(ref(db, `matches/${roomId}/status`)).set("abandoned");
    setTimeout(onMatchFound, 500); // Trigger locally
    
    return { roomId, userId, isHost: false };
  } else {
    // Wait
    await set(ref(db, `lobby/${userId}`), { username });
    onDisconnect(ref(db, `lobby/${userId}`)).remove();

    return new Promise((resolve) => {
      const matchesRef = ref(db, 'matches');
      const unsubscribe = onValue(matchesRef, (snapshot) => {
        if (!snapshot.exists()) return;
        const matches = snapshot.val();
        for (const [roomId, room] of Object.entries(matches)) {
          if (room.player1 && room.player1.id === userId) {
             unsubscribe();
             onDisconnect(ref(db, `matches/${roomId}/status`)).set("abandoned");
             onMatchFound();
             resolve({ roomId, userId, isHost: true });
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

    const mySlot = data.player1.id === userId ? 'player1' : 'player2';
    // Atomic update to avoid race conditions with other player
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

   // Get current word from room for history
   const roomSnap = await get(ref(db, `matches/${roomId}`));
   const roomWord = roundNum === "BONUS" ? "MEMORIA" : roomSnap.val().word;

   const updates = {};
   // Update current round stats
   updates[`${playerSlot}/score`] = newTotalScore;
   updates[`${playerSlot}/evalScore`] = delta;
   updates[`${playerSlot}/feedback`] = feedback;
   
   // Update history for recap
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
    // Simple way to get a "weekly" key: Year-WeekNumber
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
    arr.sort((a,b) => b.score - a.score); // sort by score descending
    return arr;
}
