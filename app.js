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

// --- 2. GLOBAL STATE ---
let myId = localStorage.getItem('panda_player_id') || ('p_' + Math.random().toString(36).substr(2, 9));
localStorage.setItem('panda_player_id', myId);

let playerName = localStorage.getItem('panda_player_name') || '';
let multiplayerHistory = JSON.parse(localStorage.getItem('panda_multiplayer_history')) || [];
let settings = JSON.parse(localStorage.getItem('panda_settings')) || { theme: 'dark' };

let currentGameCode = null;
let isHost = false;
let activeGame = null; // Syncs with Firebase
let keypadValue = '';
let activeInputField = null;

const diceConfig = [
    { id: 'yellow', label: 'Yellow', color: '#fbbf24', text: '#000' },
    { id: 'purple', label: 'Purple (×2)', color: '#a855f7', text: '#fff' },
    { id: 'blue', label: 'Blue (Sparkle ×2)', color: '#3b82f6', text: '#fff' },
    { id: 'red', label: 'Red (Sum × # of Red)', color: '#ef4444', text: '#fff' },
    { id: 'green', label: 'Green', color: '#22c55e', text: '#fff' },
    { id: 'clear', label: 'Clear', color: '#cbd5e1', text: '#000' },
    { id: 'pink', label: 'Pink', color: '#ec4899', text: '#fff' }
];
const sageDiceConfig = { id: 'sage', label: '★ SAGE ★', color: '#fbbf24', text: '#000' };

// --- 3. INITIALIZATION ---
const app = document.getElementById('app');
document.body.classList.toggle('light-theme', settings.theme === 'light');
showHome();

// --- 4. HOME & NAVIGATION ---
function showHome() {
    activeInputField = null;
    const historyHtml = multiplayerHistory.map(g => `
        <div class="bg-[var(--bg-card)] p-5 rounded-2xl mb-3 flex justify-between items-center border border-[var(--border-ui)] active:scale-[0.98] transition-all cursor-pointer" onclick="joinListener('${g.code}')">
            <div>
                <div class="text-[10px] font-black opacity-40 uppercase tracking-widest">${g.mode} Mode #${g.code}</div>
                <div class="text-lg font-bold mt-1">${g.date}</div>
            </div>
            <div class="text-green-500 font-black text-xs uppercase">Resume</div>
        </div>
    `).join('');

    app.innerHTML = `
    <div class="p-6 h-full flex flex-col animate-fadeIn overflow-hidden">
        <h1 class="text-4xl font-black tracking-tighter mb-8">Panda Royale</h1>
        
        <div class="bg-white/5 p-6 rounded-3xl border border-[var(--border-ui)] mb-8">
            <span class="text-[10px] font-black uppercase opacity-40 tracking-widest block mb-2">Player Name</span>
            <input type="text" id="name-input" onchange="updateName(this.value)" value="${playerName}" 
                class="w-full bg-transparent text-2xl font-black outline-none border-b-2 border-green-600 pb-2" 
                placeholder="Enter Name...">
        </div>

        <div class="grid grid-cols-2 gap-4 mb-8">
            <button onclick="openModeSelect()" class="bg-green-600 p-6 rounded-3xl font-black text-white text-center shadow-lg active:scale-95 transition-all uppercase text-sm">Host Game</button>
            <button onclick="promptJoinCode()" class="bg-slate-700 p-6 rounded-3xl font-black text-white text-center shadow-lg active:scale-95 transition-all uppercase text-sm">Join Game</button>
        </div>

        <div class="flex-1 overflow-y-auto pr-1">
            <h3 class="text-[10px] font-black uppercase opacity-40 mb-4 tracking-widest">Recent Multiplayer</h3>
            ${multiplayerHistory.length > 0 ? historyHtml : '<p class="opacity-20 italic text-center py-10">No recent games</p>'}
        </div>
    </div>`;
}

function updateName(val) {
    playerName = val;
    localStorage.setItem('panda_player_name', val);
}

function openModeSelect() {
    const overlay = document.createElement('div');
    overlay.id = 'mode-modal';
    overlay.className = 'modal-overlay animate-fadeIn';
    overlay.onclick = (e) => { if(e.target === overlay) overlay.remove(); };
    overlay.innerHTML = `
        <div class="action-popup">
            <h2 class="text-2xl font-black mb-8">Select Mode</h2>
            <div class="flex flex-col gap-4">
                <button onclick="hostGame('normal')" class="w-full py-5 bg-slate-200 text-slate-900 rounded-2xl font-black text-xl shadow-md active:scale-95 transition-all">NORMAL</button>
                <button onclick="hostGame('expansion')" class="w-full py-5 bg-gradient-to-r from-purple-600 to-red-500 text-white rounded-2xl font-black text-xl shadow-lg active:scale-95 transition-all">EXPANSION</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);
}

// --- 5. FIREBASE ENGINE ---
async function hostGame(mode) {
    if (!playerName) return alert("Please enter a name first!");
    document.getElementById('mode-modal')?.remove();
    
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    const gameData = {
        settings: { mode: mode, hostId: myId, showLeaderboard: true },
        status: 'lobby',
        players: { [myId]: { name: playerName, role: 'host' } },
        currentRound: 0
    };
    await db.ref('active_games/' + code).set(gameData);
    saveToHistory(code, mode);
    joinListener(code);
}

async function promptJoinCode() {
    const code = prompt("Enter 4-Digit Game Code:");
    if (!code) return;
    const snap = await db.ref('active_games/' + code).once('value');
    if (!snap.exists()) return alert("Game not found!");
    
    await db.ref(`active_games/${code}/players/${myId}`).set({ name: playerName, role: 'player' });
    saveToHistory(code, snap.val().settings.mode);
    joinListener(code);
}

function saveToHistory(code, mode) {
    multiplayerHistory = multiplayerHistory.filter(g => g.code !== code);
    multiplayerHistory.unshift({ code, mode, date: new Date().toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) });
    if (multiplayerHistory.length > 10) multiplayerHistory.pop();
    localStorage.setItem('panda_multiplayer_history', JSON.stringify(multiplayerHistory));
}

function joinListener(code) {
    currentGameCode = code;
    db.ref('active_games/' + code).on('value', (snap) => {
        const data = snap.val();
        if (!data) { showHome(); return; }
        activeGame = data;
        isHost = data.settings.hostId === myId;
        
        if (data.status === 'lobby') renderLobby(code, data.players);
        else if (data.status === 'seating') renderSeating(data.players);
        else if (data.status === 'playing') renderGame();
        else if (data.status === 'summary') renderSummary();
    });
}

// --- 6. MULTIPLAYER SCREENS ---
function renderLobby(code, players) {
    const list = Object.values(players).map(p => `
        <div class="bg-white/5 p-4 rounded-2xl border border-white/5 flex justify-between items-center mb-2">
            <span class="font-bold">${p.name}</span>
            <span class="text-[8px] font-black uppercase opacity-40 px-2 py-1 bg-white/10 rounded">${p.role}</span>
        </div>`).join('');

    app.innerHTML = `
    <div class="p-8 h-full flex flex-col bg-[#0f172a] text-white animate-fadeIn">
        <div class="text-center mt-10 mb-12">
            <span class="text-[10px] font-black opacity-40 uppercase tracking-[0.4em]">Join Code</span>
            <div class="text-7xl font-black tracking-tighter text-green-400">${code}</div>
        </div>
        <div class="flex-1 overflow-y-auto">${list}</div>
        ${isHost ? `<button onclick="updateStatus('seating')" class="w-full bg-green-600 py-6 rounded-3xl font-black text-xl shadow-xl active:scale-95 transition-all">START GAME</button>` 
                 : `<div class="text-center py-6 opacity-40 animate-pulse text-xs font-black uppercase tracking-widest">Waiting for host...</div>`}
    </div>`;
}

function renderSeating(players) {
    const others = Object.entries(players).filter(([id]) => id !== myId);
    const list = others.map(([id, p]) => `
        <button onclick="setNeighbor('${id}')" class="w-full p-5 bg-white/5 border border-white/10 rounded-2xl mb-3 text-xl font-bold active:bg-green-600/20 active:border-green-600 transition-all">
            ${p.name}
        </button>`).join('');

    app.innerHTML = `<div class="p-8 h-full flex flex-col animate-fadeIn">
        <h2 class="text-3xl font-black mb-2 uppercase tracking-tight">Who is on your left?</h2>
        <p class="opacity-40 text-sm mb-10">Select the player sitting to your immediate left.</p>
        <div class="flex-1 overflow-y-auto">${list}</div>
    </div>`;
}

async function setNeighbor(neighborId) {
    await db.ref(`active_games/${currentGameCode}/neighbors/${myId}`).set(neighborId);
    if (isHost) {
        setTimeout(() => updateStatus('playing'), 3000); // Buffer for others to finish
    }
}

function updateStatus(status) {
    db.ref(`active_games/${currentGameCode}`).update({ status: status });
}

// --- 7. CALCULATOR ENGINE ---
function renderGame() {
    const roundIdx = activeGame.currentRound;
    const isExpansion = activeGame.settings.mode === 'expansion';
    
    // Header
    const header = `
    <div class="sticky top-0 bg-[#0f172a] backdrop-blur-md z-50 p-5 border-b border-[var(--border-ui)] flex justify-between items-center">
        <button onclick="db.ref('active_games/'+currentGameCode).off(); showHome()" class="text-[8px] font-black uppercase opacity-40 tracking-widest bg-white/5 px-3 py-2 rounded">Exit</button>
        <div class="text-center">
            <div class="text-[10px] font-black opacity-40 uppercase tracking-widest">Round ${roundIdx + 1}</div>
            <div id="round-total-display" class="text-3xl font-black">0</div>
        </div>
        <button onclick="submitRound()" class="bg-blue-600 px-5 py-2 rounded-full text-[10px] font-black uppercase text-white shadow-lg active:scale-90 transition-all">Submit</button>
    </div>`;

    let diceRows = diceConfig.map(d => `
        <div onclick="setActiveInput('${d.id}')" id="row-${d.id}" class="dice-row p-4 rounded-2xl border-l-8 border-transparent mb-2 cursor-pointer transition-all">
            <div class="flex justify-between items-center"><span class="font-black uppercase text-xs tracking-widest">${d.label}</span><span id="${d.id}-sum" class="text-2xl font-black">0</span></div>
            <div id="${d.id}-values" class="flex flex-wrap gap-2 mt-2 min-h-[5px]"></div>
        </div>`).join('');

    app.innerHTML = `
        <div class="scroll-area" id="game-scroll">
            ${header}
            <div class="p-4 pb-20">${diceRows}</div>
        </div>
        <div id="keypad-container" class="keypad-area p-4 grid grid-cols-4 gap-2">
            ${[1,2,3].map(n => `<button onclick="kpInput('${n}')" class="kp-btn bg-white/5 text-2xl">${n}</button>`).join('')}
            <button id="add-btn" onclick="kpEnter()" class="kp-btn bg-green-600 text-white row-span-4 h-full text-2xl font-black">ADD</button>
            ${[4,5,6].map(n => `<button onclick="kpInput('${n}')" class="kp-btn bg-white/5 text-2xl">${n}</button>`).join('')}
            ${[7,8,9].map(n => `<button onclick="kpInput('${n}')" class="kp-btn bg-white/5 text-2xl">${n}</button>`).join('')}
            <button onclick="kpClear()" class="kp-btn bg-white/5 text-xs font-bold opacity-50">CLR</button>
            <button onclick="kpInput('0')" class="kp-btn bg-white/5 text-2xl">0</button>
            <button onclick="kpToggleNeg()" class="kp-btn bg-white/5 text-xl">+/-</button>
        </div>`;
    
    // Start by selecting yellow
    setActiveInput('yellow');
}

// --- 8. SUMMARY & TIE-BREAKING ENGINE ---
function renderSummary() {
    const roundIdx = activeGame.currentRound;
    const submissions = activeGame.roundSubmissions?.[`round_${roundIdx}`];
    
    if (!submissions || !submissions[myId]) {
        app.innerHTML = `<div class="h-full flex items-center justify-center p-10 text-center"><p class="animate-pulse opacity-40 font-black uppercase tracking-widest">Waiting for submissions...</p></div>`;
        return;
    }

    const fullOrder = calculateOrder(); // Circular seating
    const sortedYellow = Object.entries(submissions).sort((a,b) => b[1].yellow - a[1].yellow);
    const pandaId = sortedYellow[0][0];

    // Build relative seating (Panda is 0)
    const pandaIndex = fullOrder.indexOf(pandaId);
    const relativeOrder = [...fullOrder.slice(pandaIndex), ...fullOrder.slice(0, pandaIndex)];

    // Pick Order (Descending Yellow + Left of Panda Tie-breaker)
    const pickOrder = [...fullOrder].sort((a, b) => {
        if (submissions[b].yellow !== submissions[a].yellow) return submissions[b].yellow - submissions[a].yellow;
        return relativeOrder.indexOf(a) - relativeOrder.indexOf(b);
    });

    // Pity Dice (Lowest Total + Right of Panda Tie-breaker)
    const playerCount = fullOrder.length;
    let pityLimit = 1;
    if (playerCount >= 4 && playerCount <= 6) pityLimit = 2;
    else if (playerCount >= 7 && playerCount <= 9) pityLimit = 3;
    else if (playerCount === 10) pityLimit = 4;

    const pityWinners = [...fullOrder].sort((a, b) => {
        if (submissions[a].roundTotal !== submissions[b].roundTotal) return submissions[a].roundTotal - submissions[b].roundTotal;
        return relativeOrder.indexOf(b) - relativeOrder.indexOf(a);
    }).slice(0, pityLimit);

    app.innerHTML = `
    <div class="p-6 h-full overflow-y-auto animate-fadeIn bg-[#0f172a]">
        <h2 class="text-center text-[10px] font-black uppercase tracking-[0.4em] opacity-40 mb-10">Round ${roundIdx + 1} Done</h2>
        
        <div class="summary-card panda-highlight">
            <span class="text-[10px] font-black uppercase opacity-60">Round Panda</span>
            <div class="text-3xl font-black text-yellow-500 mt-1">${activeGame.players[pandaId].name}</div>
        </div>

        <div class="summary-card">
            <span class="text-[10px] font-black uppercase opacity-60">Pity Dice</span>
            <div class="mt-2 space-y-1">
                ${pityWinners.map(id => `<div class="font-bold text-lg">• ${activeGame.players[id].name}</div>`).join('')}
            </div>
        </div>

        <div class="summary-card">
            <span class="text-[10px] font-black uppercase opacity-60">Trades</span>
            <div class="mt-2 flex flex-wrap gap-2">
                ${relativeOrder.filter(id => submissions[id].hasClear).map(id => `<span class="bg-white/10 px-3 py-1 rounded-full text-[10px] font-bold">${activeGame.players[id].name}</span>`).join('') || '<span class="opacity-20 text-xs">No trades</span>'}
            </div>
        </div>

        <div class="summary-card">
            <span class="text-[10px] font-black uppercase opacity-60">Pick Order</span>
            <div class="mt-4 space-y-2">
                ${pickOrder.map((id, i) => `
                    <div class="flex items-center gap-3">
                        <span class="w-5 h-5 flex items-center justify-center bg-white/10 rounded-full text-[8px] font-black">${i+1}</span>
                        <span class="font-bold ${id === pandaId ? 'text-yellow-500' : ''}">${activeGame.players[id].name}</span>
                    </div>`).join('')}
            </div>
        </div>

        ${activeGame.settings.showLeaderboard ? `
        <div class="summary-card border-green-500/30 bg-green-500/5">
            <span class="text-[10px] font-black uppercase text-green-500 tracking-widest">Grand Standings</span>
            <div class="mt-4 space-y-2">
                ${Object.entries(submissions).sort((a,b) => b[1].grandTotal - a[1].grandTotal).map(([id, data]) => `
                    <div class="flex justify-between items-center text-sm font-black">
                        <span class="opacity-70">${activeGame.players[id].name}</span>
                        <span class="text-green-500">${data.grandTotal}</span>
                    </div>`).join('')}
            </div>
        </div>` : ''}

        ${isHost ? `<button onclick="nextRound()" class="w-full bg-blue-600 py-5 rounded-3xl font-black text-white mt-10 shadow-xl active:scale-95 transition-all">NEXT ROUND</button>` : ''}
    </div>`;
}

// --- 9. HELPERS & KEYPAD ---
function calculateOrder() {
    const order = [];
    let current = activeGame.settings.hostId;
    const count = Object.keys(activeGame.players).length;
    for(let i=0; i<count; i++) {
        order.push(current);
        current = activeGame.neighbors?.[current];
        if (!current) break; // Safety
    }
    return order;
}

function kpInput(v) { keypadValue += v; updateKpDisplay(); }
function kpClear() { keypadValue = ''; updateKpDisplay(); }
function kpToggleNeg() { keypadValue = keypadValue.startsWith('-') ? keypadValue.substring(1) : (keypadValue ? '-' + keypadValue : '-'); updateKpDisplay(); }
function updateKpDisplay() { document.getElementById('active-input-display') ? document.getElementById('active-input-display').textContent = keypadValue : null; }

function setActiveInput(id) {
    activeInputField = id;
    const config = diceConfig.find(d => d.id === id);
    document.querySelectorAll('.dice-row').forEach(r => { r.style.backgroundColor = ""; r.style.color = ""; });
    const row = document.getElementById(`row-${id}`);
    if (row) { row.style.backgroundColor = config.color; row.style.color = config.text; }
    // Update keypads colors
    document.querySelectorAll('.kp-btn:not(#add-btn)').forEach(k => { k.style.backgroundColor = config.color; k.style.color = config.text; });
}

function kpEnter() {
    if (!activeInputField || !keypadValue || keypadValue === '-') return;
    const val = parseFloat(keypadValue);
    // Local ephemeral storage for the round (not synced until submit)
    if (!window.currentRoundVals) window.currentRoundVals = {};
    if (!window.currentRoundVals[activeInputField]) window.currentRoundVals[activeInputField] = [];
    window.currentRoundVals[activeInputField].push(val);
    
    kpClear();
    updateRoundUI();
}

function updateRoundUI() {
    let total = 0;
    diceConfig.forEach(d => {
        const vals = window.currentRoundVals?.[d.id] || [];
        const sumEl = document.getElementById(`${d.id}-sum`);
        const boxEl = document.getElementById(`${d.id}-values`);
        
        let base = vals.reduce((a, b) => a + b, 0);
        let score = (d.id==='purple') ? base*2 : (d.id==='red' ? base*vals.length : base);
        total += score;
        
        if (sumEl) sumEl.textContent = score;
        if (boxEl) boxEl.innerHTML = vals.map(v => `<span class="bg-black/20 px-3 py-1 rounded-lg text-xs font-bold">${v}</span>`).join('');
    });
    document.getElementById('round-total-display').textContent = total;
}

async function submitRound() {
    const roundIdx = activeGame.currentRound;
    const yellow = (window.currentRoundVals?.['yellow'] || []).reduce((a,b)=>a+b, 0);
    const roundTotal = parseInt(document.getElementById('round-total-display').textContent);
    const hasClear = (window.currentRoundVals?.['clear'] || []).length > 0;
    
    // We get the previous grand total from history or activeGame
    const prevGrand = activeGame.roundSubmissions?.[`round_${roundIdx-1}`]?.[myId]?.grandTotal || 0;
    const grandTotal = prevGrand + roundTotal;

    await db.ref(`active_games/${currentGameCode}/roundSubmissions/round_${roundIdx}/${myId}`).set({
        yellow, roundTotal, grandTotal, hasClear
    });
    
    // Reset local inputs for next round
    window.currentRoundVals = {};
    if (isHost) updateStatus('summary');
}

async function nextRound() {
    await db.ref(`active_games/${currentGameCode}`).update({
        currentRound: activeGame.currentRound + 1,
        status: 'playing'
    });
}
