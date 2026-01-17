// --- FIREBASE CONFIGURATION ---
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
    projectId: "YOUR_PROJECT",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "...",
    appId: "..."
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// --- STATE MANAGEMENT ---
let myId = localStorage.getItem('panda_player_id') || ('p_' + Math.random().toString(36).substr(2, 9));
localStorage.setItem('panda_player_id', myId);

let playerName = localStorage.getItem('panda_player_name') || '';
let currentGameCode = null;
let isHost = false;
let activeGame = null;
let keypadValue = '';
let activeInputField = null;
let settings = JSON.parse(localStorage.getItem('panda_settings')) || { theme: 'dark' };

const diceConfig = [
    { id: 'yellow', label: 'Yellow', color: '#fbbf24', text: '#000' },
    { id: 'purple', label: 'Purple (×2)', color: '#a855f7', text: '#fff' },
    { id: 'blue', label: 'Blue (Sparkle ×2)', color: '#3b82f6', text: '#fff' },
    { id: 'red', label: 'Red (Sum × # of Red)', color: '#ef4444', text: '#fff' },
    { id: 'green', label: 'Green', color: '#22c55e', text: '#fff' },
    { id: 'clear', label: 'Clear', color: '#cbd5e1', text: '#000' },
    { id: 'pink', label: 'Pink', color: '#ec4899', text: '#fff' }
];

// --- INITIALIZATION ---
const app = document.getElementById('app');
applySettings();
showHome();

function applySettings() {
    document.body.classList.toggle('light-theme', settings.theme === 'light');
}

// --- HOME & PROFILE ---
function showHome() {
    app.innerHTML = `
    <div class="p-6 h-full flex flex-col animate-fadeIn">
        <h1 class="text-4xl font-black tracking-tighter mb-8">Panda Royale</h1>
        
        <div class="bg-white/5 p-6 rounded-3xl border border-[var(--border-ui)] mb-6">
            <span class="text-[10px] font-black uppercase opacity-40 tracking-widest block mb-2">Player Profile</span>
            <input type="text" id="name-input" onchange="updateName(this.value)" value="${playerName}" 
                class="w-full bg-transparent text-2xl font-black outline-none border-b-2 border-green-500 pb-2" 
                placeholder="Enter Your Name...">
        </div>

        <div class="flex-1 overflow-y-auto">
            <h3 class="text-[10px] font-black uppercase opacity-40 mb-4 tracking-widest">Multiplayer</h3>
            <div class="grid grid-cols-2 gap-4">
                <button onclick="openModeSelect()" class="bg-blue-600 p-6 rounded-3xl font-black text-white text-center shadow-lg">HOST GAME</button>
                <button onclick="promptJoinCode()" class="bg-slate-700 p-6 rounded-3xl font-black text-white text-center shadow-lg">JOIN GAME</button>
            </div>
        </div>
    </div>`;
}

function updateName(val) {
    playerName = val;
    localStorage.setItem('panda_player_name', val);
}

// --- FIREBASE CORE LOGIC ---
async function hostGame(mode) {
    if (!playerName) return alert("Please enter a name first!");
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    const gameData = {
        settings: { mode: mode, hostId: myId, showLeaderboard: true },
        status: 'lobby',
        players: { [myId]: { name: playerName, role: 'host' } },
        currentRound: 0
    };
    await db.ref('active_games/' + code).set(gameData);
    joinListener(code);
}

async function promptJoinCode() {
    const code = prompt("Enter 4-Digit Game Code:");
    if (!code) return;
    const snap = await db.ref('active_games/' + code).once('value');
    if (!snap.exists()) return alert("Game not found!");
    await db.ref(`active_games/${code}/players/${myId}`).set({ name: playerName, role: 'player' });
    joinListener(code);
}

function joinListener(code) {
    currentGameCode = code;
    db.ref('active_games/' + code).on('value', (snap) => {
        const data = snap.val();
        if (!data) return;
        activeGame = data;
        isHost = data.settings.hostId === myId;
        
        if (data.status === 'lobby') renderLobby(code, data.players);
        else if (data.status === 'seating') renderSeating(data.players);
        else if (data.status === 'playing') renderGame();
        else if (data.status === 'summary') renderSummary();
    });
}

// --- UI COMPONENTS ---
function renderLobby(code, players) {
    const list = Object.values(players).map(p => `<div class="player-pill mb-2"><span>${p.name}</span><span class="text-[8px] uppercase opacity-40">${p.role}</span></div>`).join('');
    app.innerHTML = `
    <div class="p-8 h-full flex flex-col bg-[#0f172a] text-white">
        <div class="text-center mb-10">
            <span class="text-[10px] font-black opacity-40 uppercase tracking-[0.4em]">Join Code</span>
            <div class="text-7xl font-black tracking-tighter text-green-400">${code}</div>
        </div>
        <div class="flex-1">${list}</div>
        ${isHost ? `<button onclick="updateStatus('seating')" class="w-full bg-green-600 py-6 rounded-3xl font-black text-xl shadow-xl">START GAME</button>` : `<p class="text-center opacity-40 animate-pulse font-black text-xs uppercase">Waiting for host...</p>`}
    </div>`;
}

function renderSeating(players) {
    const others = Object.entries(players).filter(([id]) => id !== myId);
    const list = others.map(([id, p]) => `<button onclick="setNeighbor('${id}')" class="w-full p-5 bg-white/5 border border-white/10 rounded-2xl mb-3 text-xl font-bold">${p.name}</button>`).join('');
    app.innerHTML = `<div class="p-8 h-full flex flex-col">
        <h2 class="text-3xl font-black mb-2">Who is on your left?</h2>
        <p class="opacity-40 text-sm mb-8">This establishes the circular seating order.</p>
        <div class="flex-1">${list}</div>
    </div>`;
}

async function setNeighbor(neighborId) {
    await db.ref(`active_games/${currentGameCode}/neighbors/${myId}`).set(neighborId);
    if (isHost) {
        // Simple delay to let others finish, in a real app, check if all neighbors are set
        setTimeout(() => updateStatus('playing'), 2000);
    }
}

function updateStatus(status) {
    db.ref(`active_games/${currentGameCode}`).update({ status: status });
}

// --- GAME LOGIC ---
function renderGame() {
    const roundIdx = activeGame.currentRound;
    const rd = activeGame.rounds?.[roundIdx]?.[myId] || { yellow: [], purple: [], blue: [], red: [], green: [], clear: [], pink: [], wild: [] };
    
    // Header with Submit Button
    const header = `
    <div class="sticky top-0 bg-inherit backdrop-blur-md z-50 p-5 border-b border-[var(--border-ui)] flex justify-between items-center">
        <button onclick="showHome()" class="text-[10px] font-black uppercase opacity-50 px-3 py-2 rounded-lg bg-black/5">Exit</button>
        <div class="text-center">
            <div class="text-xs font-black opacity-40 uppercase">Round ${roundIdx + 1}</div>
            <div id="round-total-display" class="text-2xl font-black">0</div>
        </div>
        <button onclick="submitRound()" class="bg-blue-600 px-5 py-2 rounded-full text-[10px] font-black uppercase text-white shadow-lg">Submit Round</button>
    </div>`;

    // Reusing your dice row logic from original file
    let diceRows = diceConfig.map(d => `
        <div onclick="setActiveInput('${d.id}')" id="row-${d.id}" class="dice-row p-4 rounded-2xl border-l-8 border-transparent mb-2">
            <div class="flex justify-between items-center"><span class="font-black uppercase text-sm">${d.label}</span><span id="${d.id}-sum" class="text-2xl font-black">0</span></div>
            <div id="${d.id}-values" class="flex flex-wrap gap-2 mt-2"></div>
        </div>`).join('');

    app.innerHTML = `
        <div class="scroll-area">${header}<div class="p-4">${diceRows}</div></div>
        <div class="keypad-area p-4 grid grid-cols-4 gap-2">
            ${[1,2,3,4,5,6,7,8,9,0].map(n => `<button onclick="kpInput('${n}')" class="kp-btn bg-black/5 text-2xl">${n}</button>`).join('')}
            <button onclick="kpClear()" class="kp-btn bg-black/5 text-xs font-bold">CLR</button>
            <button onclick="kpEnter()" class="kp-btn bg-green-600 text-white row-span-2">ADD</button>
        </div>`;
    
    updateDisplays(rd);
}

// --- SUMMARY CALCULATIONS ---
function renderSummary() {
    const roundIdx = activeGame.currentRound;
    const submissions = activeGame.roundSubmissions[`round_${roundIdx}`];
    const order = calculateOrder(); // Use neighbors to find circular list
    
    // TIE BREAKER ENGINE
    const sortedYellow = Object.entries(submissions).sort((a,b) => b[1].yellow - a[1].yellow);
    const pandaId = sortedYellow[0][0]; // Highest Yellow
    
    // PITY DICE CALC
    const playerCount = order.length;
    let pityCount = 1;
    if (playerCount >= 4 && playerCount <= 6) pityCount = 2;
    else if (playerCount >= 7 && playerCount <= 9) pityCount = 3;
    else if (playerCount === 10) pityCount = 4;

    const sortedTotal = Object.entries(submissions).sort((a,b) => a[1].roundTotal - b[1].roundTotal);
    const pityWinners = sortedTotal.slice(0, pityCount).map(s => activeGame.players[s[0]].name);

    app.innerHTML = `
    <div class="p-6 h-full overflow-y-auto animate-fadeIn">
        <h2 class="text-center text-xs font-black uppercase tracking-[0.4em] opacity-40 mb-10">Round ${roundIdx + 1} Summary</h2>
        
        <div class="summary-card panda-highlight">
            <span class="text-[10px] font-black uppercase opacity-60">Round Panda</span>
            <div class="text-3xl font-black text-yellow-500">${activeGame.players[pandaId].name}</div>
        </div>

        <div class="summary-card">
            <span class="text-[10px] font-black uppercase opacity-60">Pity Dice Winners</span>
            <div class="font-bold text-xl">${pityWinners.join(', ')}</div>
        </div>

        <div class="summary-card">
            <span class="text-[10px] font-black uppercase opacity-60">Trades (Clear Dice)</span>
            <div class="space-y-1 mt-2">
                ${order.filter(id => submissions[id].hasClear).map(id => `<div class="text-sm font-bold">• ${activeGame.players[id].name}</div>`).join('')}
            </div>
        </div>

        ${activeGame.settings.showLeaderboard ? `
        <div class="summary-card bg-green-600/10 border-green-500/30">
            <span class="text-[10px] font-black uppercase text-green-500">Leaderboard</span>
            <div class="mt-2 space-y-2">
                ${Object.entries(submissions).sort((a,b) => b[1].grandTotal - a[1].grandTotal).map(s => `
                    <div class="flex justify-between text-sm font-black">
                        <span>${activeGame.players[s[0]].name}</span>
                        <span>${s[1].grandTotal}</span>
                    </div>
                `).join('')}
            </div>
        </div>` : ''}

        ${isHost ? `<button onclick="nextRound()" class="w-full bg-blue-600 py-5 rounded-3xl font-black text-white mt-8 shadow-xl">NEXT ROUND</button>` : ''}
    </div>`;
}

// --- HELPERS ---
function calculateOrder() {
    // Starting with Host, follow the neighbor chain
    const order = [];
    let current = activeGame.settings.hostId;
    const playerIds = Object.keys(activeGame.players);
    for(let i=0; i<playerIds.length; i++) {
        order.push(current);
        current = activeGame.neighbors[current];
    }
    return order;
}

async function submitRound() {
    const roundIdx = activeGame.currentRound;
    // Calculate values based on your current dice inputs
    const yellowTotal = 15; // Placeholder for actual calc logic
    const roundTotal = 45;  // Placeholder
    const grandTotal = 100; // Placeholder
    const hasClear = true;  // Placeholder
    
    await db.ref(`active_games/${currentGameCode}/roundSubmissions/round_${roundIdx}/${myId}`).set({
        yellow: yellowTotal,
        roundTotal: roundTotal,
        grandTotal: grandTotal,
        hasClear: hasClear
    });
    // Host manually triggers summary view once they see everyone submitted
    if (isHost) updateStatus('summary');
}

async function nextRound() {
    const nextIdx = activeGame.currentRound + 1;
    await db.ref(`active_games/${currentGameCode}`).update({
        currentRound: nextIdx,
        status: 'playing'
    });
}

function openModeSelect() {
    const mode = confirm("Press OK for Expansion, Cancel for Normal");
    hostGame(mode ? 'expansion' : 'normal');
}
