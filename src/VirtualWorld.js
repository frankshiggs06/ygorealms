import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { joinVirtualWorld, updateWorldPosition, listenToWorldPlayers, leaveVirtualWorld, getNpcChatHistory, saveNpcChatHistory } from './firebase.js';
import { chatWithNPC } from './groq.js';

let scene, camera, renderer, animationId;
let playerMesh;
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let myUserId = null;
let myUsername = "";
let otherPlayers = {}; // { id: meshGroup }
let worldUnsubscribe = null;
let lastSyncTime = 0;

// NPC Data
const npcsInfo = [
    { id: "npc_sabio", name: "El Sabio", role: "Maestro de Métrica", personality: "Habla con acertijos y usa rimas complejas. Evalúa el conocimiento de los demás.", x: 10, z: -10, color: 0x9333ea },
    { id: "npc_novato", name: "MC Novato", role: "Aprendiz", personality: "Es muy entusiasta pero sus rimas son básicas. Siempre pide consejos.", x: -15, z: 5, color: 0xef4444 },
    { id: "npc_guardian", name: "Guardián del Ritmo", role: "Protector", personality: "Vigila que todos mantengan el flow. Habla como un policía del hip hop.", x: 5, z: 20, color: 0xeab308 }
];
let npcs = []; // { mesh, info }
let currentInteractableNPC = null;
let isChatOpen = false;
let currentChatHistory = [];

const speed = 0.2;

export function initVirtualWorld(username, petDef) {
    const container = document.getElementById('world-3d-container');
    if (!container) return;
    
    // Generate unique ID for session
    myUserId = `vw_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    myUsername = username;

    // SCENE
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb); // Sky blue
    scene.fog = new THREE.Fog(0x87ceeb, 20, 100);

    // CAMERA
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 10, 15);
    camera.lookAt(0, 0, 0);

    // RENDERER
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    // LIGHTS
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(20, 40, 20);
    dirLight.castShadow = true;
    dirLight.shadow.camera.left = -50;
    dirLight.shadow.camera.right = 50;
    dirLight.shadow.camera.top = 50;
    dirLight.shadow.camera.bottom = -50;
    scene.add(dirLight);

    // VOXEL MAP
    createVoxelEnvironment();

    // NPCS
    spawnNPCs();

    // PLAYER AVATAR (Extrude SVG)
    createPlayerAvatar(petDef);

    // CONTROLS
    setupControls();
    setupChatUI();

    // START MULTIPLAYER SYNC
    joinVirtualWorld(myUserId, username, petDef);
    worldUnsubscribe = listenToWorldPlayers(handleWorldPlayersUpdate);

    // RESIZE
    window.addEventListener('resize', onWindowResize);

    // ANIMATE
    animate();
}

function createVoxelEnvironment() {
    // Simple 100x100 grass floor using instanced mesh or just a big plane for performance
    const floorGeo = new THREE.BoxGeometry(100, 1, 100);
    const floorMat = new THREE.MeshLambertMaterial({ color: 0x4ade80 }); // Grass green
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.y = -0.5;
    floor.receiveShadow = true;
    scene.add(floor);

    // Add some random "tree" voxels
    const trunkGeo = new THREE.BoxGeometry(1, 4, 1);
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x78350f }); // Brown
    const leavesGeo = new THREE.BoxGeometry(3, 3, 3);
    const leavesMat = new THREE.MeshLambertMaterial({ color: 0x166534 }); // Dark green

    for (let i = 0; i < 30; i++) {
        const x = (Math.random() - 0.5) * 80;
        const z = (Math.random() - 0.5) * 80;

        // Skip middle area
        if (Math.abs(x) < 10 && Math.abs(z) < 10) continue;

        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.set(x, 2, z);
        trunk.castShadow = true;
        scene.add(trunk);

        const leaves = new THREE.Mesh(leavesGeo, leavesMat);
        leaves.position.set(x, 5.5, z);
        leaves.castShadow = true;
        scene.add(leaves);
    }
}

function spawnNPCs() {
    npcsInfo.forEach(info => {
        // Simple distinct cube for now
        const geo = new THREE.BoxGeometry(2.5, 3, 2.5);
        const mat = new THREE.MeshLambertMaterial({ color: info.color });
        const mesh = new THREE.Mesh(geo, mat);
        
        mesh.position.set(info.x, 1.5, info.z);
        mesh.castShadow = true;
        
        scene.add(mesh);
        npcs.push({ mesh, info });
    });
}

function createPlayerAvatar(petData) {
    playerMesh = createAvatarMesh(petData);
    scene.add(playerMesh);
}

function createAvatarMesh(petData) {
    const holder = new THREE.Group();

    if (!petData || !petData.svg) {
        // Fallback cube
        const geo = new THREE.BoxGeometry(2, 2, 2);
        const mat = new THREE.MeshLambertMaterial({ color: 0x3b82f6 });
        const fallbackMesh = new THREE.Mesh(geo, mat);
        fallbackMesh.position.y = 1;
        fallbackMesh.castShadow = true;
        holder.add(fallbackMesh);
        return holder;
    }

    // Parse SVG and Extrude
    const loader = new SVGLoader();
    
    // We create a temporary standard box if SVG parsing fails or takes time
    const svgHTML = petData.svg;


    // Parse logic
    try {
        const parsed = loader.parse(petData.svg);
        const paths = parsed.paths;
        
        const group = new THREE.Group();
        const material = new THREE.MeshLambertMaterial({ color: 0xFFFF00, side: THREE.DoubleSide });

        for ( let i = 0; i < paths.length; i ++ ) {
            const path = paths[ i ];
            const fillColor = path.userData.style.fill;
            if ( fillColor !== undefined && fillColor !== 'none' ) {
                material.color.setStyle( fillColor );
            }

            const shapes = SVGLoader.createShapes( path );
            for ( let j = 0; j < shapes.length; j ++ ) {
                const shape = shapes[ j ];
                const extGeo = new THREE.ExtrudeGeometry( shape, { depth: 5, bevelEnabled: false } );
                const mesh = new THREE.Mesh( extGeo, material );
                group.add( mesh );
            }
        }
        
        // Center and scale SVG group
        const box = new THREE.Box3().setFromObject(group);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        
        group.position.set(-center.x, -center.y, -center.z);
        group.rotation.x = Math.PI; // SVG often renders upside down in 3d

        // Scale to fit approx 2 units
        const maxDim = Math.max(size.x, size.y);
        const scale = 2.5 / maxDim;
        group.scale.set(scale, scale, scale);
        
        holder.add(group);
        holder.position.y = 1.5;

    } catch(e) {
        console.warn("Could not parse SVG to 3D, using fallback.", e);
        const geo = new THREE.BoxGeometry(2, 2, 2);
        const mat = new THREE.MeshLambertMaterial({ color: 0x3b82f6 });
        const mesh = new THREE.Mesh(geo, mat);
        holder.add(mesh);
        holder.position.y = 1;
    }
}

function setupControls() {
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
}

function releaseControls() {
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('keyup', onKeyUp);
}

function onKeyDown(event) {
    // Return early if chat input is focused
    if (document.activeElement && document.activeElement.tagName === 'TEXTAREA') return;

    // Interaction key E
    if (event.code === 'KeyE') {
        if (!isChatOpen && currentInteractableNPC) {
            openNPCChat(currentInteractableNPC.info);
        }
    }

    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
            moveForward = true;
            break;
        case 'ArrowLeft':
        case 'KeyA':
            moveLeft = true;
            break;
        case 'ArrowDown':
        case 'KeyS':
            moveBackward = true;
            break;
        case 'ArrowRight':
        case 'KeyD':
            moveRight = true;
            break;
    }
}

function onKeyUp(event) {
    if (document.activeElement && document.activeElement.tagName === 'TEXTAREA') return;
    
    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
            moveForward = false;
            break;
        case 'ArrowLeft':
        case 'KeyA':
            moveLeft = false;
            break;
        case 'ArrowDown':
        case 'KeyS':
            moveBackward = false;
            break;
        case 'ArrowRight':
        case 'KeyD':
            moveRight = false;
            break;
    }
}

function onWindowResize() {
    if(!camera || !renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    animationId = requestAnimationFrame(animate);

    if (playerMesh) {
        let moved = false;
        let oldX = playerMesh.position.x;
        let oldZ = playerMesh.position.z;

        // Movement relative to camera perspective to keep it simple for now
        if (moveForward) { playerMesh.position.z -= speed; moved = true; }
        if (moveBackward) { playerMesh.position.z += speed; moved = true; }
        if (moveLeft) { playerMesh.position.x -= speed; moved = true; }
        if (moveRight) { playerMesh.position.x += speed; moved = true; }

        if (moved) {
            // Very simple rotation pointing to movement direction
            const dx = playerMesh.position.x - oldX;
            const dz = playerMesh.position.z - oldZ;
            playerMesh.rotation.y = Math.atan2(dx, dz);
            
            // Sync to Firebase (throttle to avoid spam)
            const now = Date.now();
            if (now - lastSyncTime > 100) { // 10 fps sync rate
                updateWorldPosition(myUserId, playerMesh.position.x, playerMesh.position.y, playerMesh.position.z, playerMesh.rotation.y);
                lastSyncTime = now;
            }
        }

        // Make camera follow player
        camera.position.x = playerMesh.position.x;
        camera.position.z = playerMesh.position.z + 15;
        camera.lookAt(playerMesh.position);

        // Check distance to NPCs
        if (!isChatOpen) {
            let foundClosest = null;
            let minDist = 5; // Interaction radius
            
            npcs.forEach(npc => {
                const dist = playerMesh.position.distanceTo(npc.mesh.position);
                if (dist < minDist) {
                    minDist = dist;
                    foundClosest = npc;
                }
            });

            if (foundClosest) {
                if (currentInteractableNPC !== foundClosest) {
                    currentInteractableNPC = foundClosest;
                    document.getElementById('world-interaction-prompt').classList.remove('hidden');
                    document.getElementById('world-interaction-prompt').innerHTML = `Presiona <strong>[E]</strong> para hablar con <strong>${foundClosest.info.name}</strong>`;
                }
            } else {
                if (currentInteractableNPC) {
                    currentInteractableNPC = null;
                    document.getElementById('world-interaction-prompt').classList.add('hidden');
                }
            }
        }
    }

    renderer.render(scene, camera);
}

// -- MULTIPLAYER LOGIC --
function handleWorldPlayersUpdate(playersData) {
    if (!scene) return;
    
    const currentIds = Object.keys(playersData || {});
    
    // Remove disconnected players
    Object.keys(otherPlayers).forEach(id => {
        if (!currentIds.includes(id)) {
            scene.remove(otherPlayers[id]);
            delete otherPlayers[id];
        }
    });

    // Add or update players
    currentIds.forEach(id => {
        if (id === myUserId) return; // Skip ourselves
        
        const data = playersData[id];
        const pos = data.position || {x:0, y:1, z:0};
        
        if (!otherPlayers[id]) {
            // New player
            const mesh = createAvatarMesh(data.pet);
            mesh.position.set(pos.x, pos.y, pos.z);
            if (data.rotation !== undefined) mesh.rotation.y = data.rotation;
            scene.add(mesh);
            otherPlayers[id] = mesh;
        } else {
            // Update existing player
            const mesh = otherPlayers[id];
            mesh.position.set(pos.x, pos.y, pos.z);
            if (data.rotation !== undefined) mesh.rotation.y = data.rotation;
        }
    });
}

// -- CHAT LOGIC --
function setupChatUI() {
    const chatCloseBtn = document.getElementById('world-chat-close-btn');
    const chatSendBtn = document.getElementById('world-chat-send-btn');
    const chatInput = document.getElementById('world-chat-input');
    
    chatCloseBtn.onclick = closeNPCChat;
    
    chatSendBtn.onclick = () => {
        sendNPCChatMessage(chatInput.value.trim());
    };
    
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendNPCChatMessage(chatInput.value.trim());
        }
    });
}

async function openNPCChat(npcInfo) {
    isChatOpen = true;
    moveForward = moveBackward = moveLeft = moveRight = false; // Stop movement
    document.getElementById('world-interaction-prompt').classList.add('hidden');
    
    const panel = document.getElementById('world-chat-panel');
    panel.classList.remove('hidden');
    document.getElementById('world-chat-title').innerText = `Hablando con ${npcInfo.name}`;
    
    const msgsContainer = document.getElementById('world-chat-messages');
    msgsContainer.innerHTML = '<div style="text-align:center; color:gray;">Cargando recuerdos...</div>';
    
    // Load history
    currentChatHistory = await getNpcChatHistory(myUsername, npcInfo.id);
    
    if (currentChatHistory.length === 0) {
        // Initial greeting
        currentChatHistory.push({ sender: 'assistant', content: `Oh, hola. Soy ${npcInfo.name}. ¿Qué te trae por aquí?`, timestamp: Date.now() });
        await saveNpcChatHistory(myUsername, npcInfo.id, currentChatHistory);
    }

    renderWorldChatMessages();
    document.getElementById('world-chat-input').focus();
}

function closeNPCChat() {
    isChatOpen = false;
    document.getElementById('world-chat-panel').classList.add('hidden');
}

function renderWorldChatMessages() {
    const msgsContainer = document.getElementById('world-chat-messages');
    msgsContainer.innerHTML = "";
    currentChatHistory.forEach(msg => {
        const div = document.createElement('div');
        const isUser = msg.sender === 'user';
        div.className = `chat-message ${isUser ? 'user' : 'pet'}`;
        div.style.marginBottom = "5px";
        div.innerHTML = `
            <div><strong>${isUser ? myUsername : currentInteractableNPC.info.name}:</strong> ${msg.content}</div>
        `;
        msgsContainer.appendChild(div);
    });
    msgsContainer.scrollTop = msgsContainer.scrollHeight;
}

async function sendNPCChatMessage(text) {
    if (!text || !currentInteractableNPC) return;
    
    const input = document.getElementById('world-chat-input');
    const sendBtn = document.getElementById('world-chat-send-btn');
    const msgsContainer = document.getElementById('world-chat-messages');
    
    input.value = "";
    input.disabled = true;
    sendBtn.disabled = true;
    
    // User message
    currentChatHistory.push({ sender: 'user', content: text, timestamp: Date.now() });
    renderWorldChatMessages();
    
    // Typing indicator
    const typingInd = document.createElement('div');
    typingInd.innerHTML = '<div class="spinner small"></div>';
    msgsContainer.appendChild(typingInd);
    msgsContainer.scrollTop = msgsContainer.scrollHeight;
    
    // AI Call
    const aiResponse = await chatWithNPC(currentInteractableNPC.info, currentChatHistory, text);
    
    typingInd.remove();
    
    // AI Message
    currentChatHistory.push({ sender: 'assistant', content: aiResponse, timestamp: Date.now() });
    renderWorldChatMessages();
    
    // Save
    await saveNpcChatHistory(myUsername, currentInteractableNPC.info.id, currentChatHistory);
    
    input.disabled = false;
    sendBtn.disabled = false;
    input.focus();
}

export function exitVirtualWorld() {
    if (animationId) cancelAnimationFrame(animationId);
    if (worldUnsubscribe) { worldUnsubscribe(); worldUnsubscribe = null; }
    if (myUserId) { leaveVirtualWorld(myUserId); }
    
    releaseControls();
    window.removeEventListener('resize', onWindowResize);
    
    const container = document.getElementById('world-3d-container');
    if (container) container.innerHTML = "";
    
    // Cleanup ThreeJS mem
    if(renderer) {
        renderer.dispose();
        renderer = null;
    }
}

window.initVirtualWorld = initVirtualWorld;
window.exitVirtualWorld = exitVirtualWorld;
