// --- CONFIGURACIÓN DE FIREBASE ---
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { 
    getFirestore, collection, doc, onSnapshot, addDoc, setDoc, updateDoc, 
    getDocs, query, orderBy, limit, writeBatch, deleteDoc, where
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

// Configuración de Firebase
const firebaseConfig = {
    apiKey: "AIzaSyABsmkXrhStMBi6517stczD0KcgVAPNm_A",
    authDomain: "torneo-duelistas-f535a.firebaseapp.com",
    projectId: "torneo-duelistas-f535a",
    storageBucket: "torneo-duelistas-f535a.firebasestorage.app",
    messagingSenderId: "701455896792",
    appId: "1:701455896792:web:667ec25f0defd7c98c87ad"
};

// Inicializar Firebase evitando múltiples inicializaciones
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Referencias a colecciones
const basePath = `torneo/torneo-data`;
const dbPlayersRef = collection(db, `${basePath}/players`);
const dbHistoryRef = collection(db, `${basePath}/history`);
const dbMarketplaceRef = collection(db, `${basePath}/marketplace`);

// Exportar todo lo necesario
export {
    app,
    auth,
    db,
    dbPlayersRef,
    dbHistoryRef,
    dbMarketplaceRef,
    collection,
    doc,
    onSnapshot,
    addDoc,
    setDoc,
    updateDoc,
    getDocs,
    query,
    orderBy,
    limit,
    writeBatch,
    deleteDoc,
    where,
    signInAnonymously,
    onAuthStateChanged
};
