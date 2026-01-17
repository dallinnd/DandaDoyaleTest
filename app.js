// --- FIREBASE CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyCyv0xLx6joG106Qi9wNATUbwA6Y7dzfzU",
    authDomain: "pandaroyalsync.firebaseapp.com",
    projectId: "pandaroyalsync",
    storageBucket: "pandaroyalsync.firebasestorage.app",
    messagingSenderId: "315230601498",
    appId: "1:315230601498:web:35b1b86272cc1713112ca3",
    measurementId: "G-RXWQJ3ECP5"
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
    const fullOrder = calculateOrder(); // [Host, LeftOfHost, LeftOfLeft...]

    // 1. FIND THE ROUND PANDA (Highest Yellow)
    const sortedByYellow = Object.entries(submissions).sort((a,b) => b[1].yellow - a[1].yellow);
    const pandaId = sortedByYellow[0][0];

    // 2. CREATE THE RELATIVE ORDER (Start from Panda, go Left)
    // We shift the array so the Panda is index 0.
    const pandaIndex = fullOrder.indexOf(pandaId);
    const relativeOrder = [...fullOrder.slice(pandaIndex), ...fullOrder.slice(0, pandaIndex)];

    // 3. PICK ORDER CALCULATION (Descending Yellow + Tie Breaker)
    const pickOrder = [...fullOrder].sort((a, b) => {
        if (submissions[b].yellow !== submissions[a].yellow) {
            return submissions[b].yellow - submissions[a].yellow; // Sort by Value
        }
        // Tie-breaker: Who is closer to Panda's Left? (Lower index in relativeOrder)
        return relativeOrder.indexOf(a) - relativeOrder.indexOf(b);
    });

    // 4. PITY DICE CALCULATION (Lowest Round Total + Tie Breaker)
    // Rule: Tie-breaker priority given to player closest to Panda's RIGHT.
    const playerCount = fullOrder.length;
    let pityWinnerCount = 1;
    if (playerCount >= 4 && playerCount <= 6) pityWinnerCount = 2;
    else if (playerCount >= 7 && playerCount <= 9) pityWinnerCount = 3;
    else if (playerCount === 10) pityWinnerCount = 4;

    const sortedByRoundTotal = [...fullOrder].sort((a, b) => {
        if (submissions[a].roundTotal !== submissions[b].roundTotal) {
            return submissions[a].roundTotal - submissions[b].roundTotal; // Sort by Value
        }
        // Tie-breaker: Closest to Panda's Right (Highest index in relativeOrder)
        return relativeOrder.indexOf(b) - relativeOrder.indexOf(a);
    });
    const pityWinners = sortedByRoundTotal.slice(0, pityWinnerCount);

    // 5. RENDER THE SECTIONS
    app.innerHTML = `
    <div class="p-6 h-full overflow-y-auto animate-fadeIn bg-[var(--bg-main)]">
        <h2 class="text-center text-[10px] font-black uppercase tracking-[0.4em] opacity-40 mb-8">Round ${roundIdx + 1} Summary</h2>
        
        <div class="summary-card panda-highlight">
            <span class="text-[10px] font-black uppercase opacity-60 tracking-widest">Round Panda</span>
            <div class="text-4xl font-black text-yellow-500 mt-1">${activeGame.players[pandaId].name}</div>
        </div>

        <div class="summary-card">
            <span class="text-[10px] font-black uppercase opacity-60 tracking-widest">Pity Dice Winners</span>
            <div class="mt-2 space-y-1">
                ${pityWinners.map(id => `<div class="font-bold text-lg">• ${activeGame.players[id].name}</div>`).join('')}
            </div>
        </div>

        <div class="summary-card">
            <span class="text-[10px] font-black uppercase opacity-60 tracking-widest">Trades (Clear Dice)</span>
            <div class="mt-2 flex flex-wrap gap-2">
                ${relativeOrder.filter(id => submissions[id].hasClear).map(id => 
                    `<span class="bg-slate-700 px-3 py-1 rounded-full text-xs font-bold">${activeGame.players[id].name}</span>`
                ).join('') || '<span class="opacity-30 italic text-xs">No trades this round</span>'}
            </div>
        </div>

        <div class="summary-card">
            <span class="text-[10px] font-black uppercase opacity-60 tracking-widest">Dice Pick Order</span>
            <div class="mt-3 space-y-2">
                ${pickOrder.map((id, i) => `
                    <div class="flex items-center gap-3">
                        <span class="w-6 h-6 flex items-center justify-center bg-white/10 rounded-full text-[10px] font-black">${i+1}</span>
                        <span class="font-bold ${id === pandaId ? 'text-yellow-500' : ''}">${activeGame.players[id].name}</span>
                    </div>
                `).join('')}
            </div>
        </div>

        ${activeGame.settings.showLeaderboard ? `
        <div class="summary-card border-green-500/30 bg-green-500/5">
            <span class="text-[10px] font-black uppercase text-green-500 tracking-widest">Current Standings</span>
            <div class="mt-3 space-y-2">
                ${Object.entries(submissions).sort((a,b) => b[1].grandTotal - a[1].grandTotal).map(([id, data]) => `
                    <div class="flex justify-between items-center text-sm">
                        <span class="font-medium">${activeGame.players[id].name}</span>
                        <span class="font-black text-green-500">${data.grandTotal}</span>
                    </div>
                `).join('')}
            </div>
        </div>` : ''}

        ${isHost ? `
            <button onclick="nextRound()" class="w-full bg-blue-600 py-5 rounded-[24px] font-black text-white mt-8 shadow-xl active:scale-95 transition-all">NEXT ROUND</button>
        ` : `
            <div class="text-center py-10 opacity-30 text-[10px] font-black uppercase animate-pulse">Waiting for host to advance...</div>
        `}
        
        <button onclick="renderGame()" class="w-full py-4 text-[10px] font-black uppercase opacity-30 tracking-widest">Back to Calculator</button>
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
