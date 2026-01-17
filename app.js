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
let activeGame = null; 
let keypadValue = '';
let activeInputField = null;
window.currentRoundVals = {}; // Local ephemeral storage for current round dice

const diceConfig = [
    { id: 'yellow', label: 'Yellow', color: '#fbbf24', text: '#000' },
    { id: 'purple', label: 'Purple (×2)', color: '#a855f7', text: '#fff' },
    { id: 'blue', label: 'Blue (Sparkle ×2)', color: '#3b82f6', text: '#fff' },
    { id: 'red', label: 'Red (Sum × # of Red)', color: '#ef4444', text: '#fff' },
    { id: 'green', label: 'Green', color: '#22c55e', text: '#fff' },
    { id: 'clear', label: 'Clear', color: '#cbd5e1', text: '#000' },
    { id: 'pink', label: 'Pink', color: '#ec4899', text: '#fff' }
];

// --- 3. INITIALIZATION ---
const app = document.getElementById('app');
document.body.classList.toggle('light-theme', settings.theme === 'light');
showHome();

// --- 4. NAVIGATION & LOBBY ---
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
                class="w-full bg-transparent text-2xl font-black outline-none border-b-2 border-green-600 pb-2" placeholder="Enter Name...">
        </div>
        <div class="grid grid-cols-2 gap-4 mb-8">
            <button onclick="openModeSelect()" class="bg-green-600 p-6 rounded-3xl font-black text-white text-center shadow-lg active:scale-95 transition-all uppercase text-sm">Host Game</button>
            <button onclick="promptJoinCode()" class="bg-slate-700 p-6 rounded-3xl font-black text-white text-center shadow-lg active:scale-95 transition-all uppercase text-sm">Join Game</button>
        </div>
        <div class="flex-1 overflow-y-auto">
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
    overlay.className = 'modal-overlay animate-fadeIn';
    overlay.innerHTML = `
        <div class="action-popup">
            <h2 class="text-2xl font-black mb-8">Select Mode</h2>
            <div class="flex flex-col gap-4">
                <button onclick="hostGame('normal')" class="w-full py-5 bg-slate-200 text-slate-900 rounded-2xl font-black text-xl shadow-md active:scale-95 transition-all">NORMAL</button>
                <button onclick="hostGame('expansion')" class="w-full py-5 bg-gradient-to-r from-purple-600 to-red-500 text-white rounded-2xl font-black text-xl shadow-lg active:scale-95 transition-all">EXPANSION</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);
    overlay.onclick = (e) => { if(e.target === overlay) overlay.remove(); };
}

// --- 5. FIREBASE ENGINE ---
async function hostGame(mode) {
    if (!playerName) return alert("Please enter a name first!");
    document.querySelector('.modal-overlay')?.remove();
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    const gameData = {
        settings: { mode, hostId: myId, showLeaderboard: true },
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
    localStorage.setItem('panda_multiplayer_history', JSON.stringify(multiplayerHistory.slice(0,10)));
}

function joinListener(code) {
    currentGameCode = code;
    db.ref('active_games/' + code).on('value', (snap) => {
        const data = snap.val();
        if (!data) { showHome(); return; }
        activeGame = data;
        isHost = data.settings.hostId === myId;
        
        const roundIdx = data.currentRound;
        const submissions = data.roundSubmissions?.[`round_${roundIdx}`] || {};
        const playerCount = Object.keys(data.players).length;
        const submissionCount = Object.keys(submissions).length;

        // Auto-advance to summary if everyone submitted
        if (submissionCount === playerCount && data.status === 'playing' && isHost) {
            updateStatus('summary');
            return;
        }

        if (data.status === 'lobby') renderLobby(code, data.players);
        else if (data.status === 'seating') renderSeating(data.players);
        else if (data.status === 'playing') {
            if (submissions[myId]) renderWaitingScreen(submissions);
            else renderGame();
        }
        else if (data.status === 'summary') renderSummary();
    });
}

// --- 6. GAME SCREENS ---
function renderLobby(code, players) {
    const list = Object.values(players).map(p => `
        <div class="bg-white/5 p-4 rounded-2xl border border-white/5 flex justify-between items-center mb-2">
            <span class="font-bold">${p.name}</span>
            <span class="text-[8px] font-black uppercase opacity-40 px-2 py-1 bg-white/10 rounded">${p.role}</span>
        </div>`).join('');
    app.innerHTML = `<div class="p-8 h-full flex flex-col bg-[#0f172a] text-white animate-fadeIn">
        <div class="text-center mt-10 mb-12">
            <span class="text-[10px] font-black opacity-40 uppercase tracking-[0.4em]">Join Code</span>
            <div class="text-7xl font-black tracking-tighter text-green-400">${code}</div>
        </div>
        <div class="flex-1 overflow-y-auto">${list}</div>
        ${isHost ? `<button onclick="updateStatus('seating')" class="w-full bg-green-600 py-6 rounded-3xl font-black text-xl shadow-xl">START GAME</button>` 
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
    if (isHost) setTimeout(() => updateStatus('playing'), 3000);
}

function updateStatus(status) {
    db.ref(`active_games/${currentGameCode}`).update({ status });
}

// --- 7. CALCULATOR & WAITING ---
function renderGame() {
    const roundIdx = activeGame.currentRound;
    const header = `
    <div class="sticky top-0 bg-[#0f172a] z-50 p-5 border-b border-[var(--border-ui)] flex justify-between items-center">
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
        <div class="scroll-area" id="game-scroll">${header}<div class="p-4 pb-20">${diceRows}</div></div>
        <div class="keypad-area p-4 grid grid-cols-4 gap-2">
            ${[1,2,3,4,5,6,7,8,9,0].map(n => `<button onclick="kpInput('${n}')" class="kp-btn bg-white/5 text-2xl">${n}</button>`).join('')}
            <button onclick="kpClear()" class="kp-btn bg-white/5 text-xs font-bold opacity-50">CLR</button>
            <button id="add-btn" onclick="kpEnter()" class="kp-btn bg-green-600 text-white row-span-2 text-2xl font-black">ADD</button>
        </div>`;
    
    setActiveInput('yellow');
    updateRoundUI();
}

function renderWaitingScreen(submissions) {
    const myData = submissions[myId];
    const waitingFor = Object.entries(activeGame.players).filter(([id]) => !submissions[id]).map(([id, p]) => p.name);

    app.innerHTML = `
    <div class="p-8 h-full flex flex-col animate-fadeIn bg-[#0f172a]">
        <h2 class="text-xs font-black uppercase tracking-[0.4em] opacity-40 text-center mb-10">Waiting for Others</h2>
        <div class="summary-card bg-blue-600/10 border-blue-500/30 mb-8 p-6 rounded-3xl">
            <span class="text-[10px] font-black uppercase text-blue-400 tracking-widest">Your Round Stats</span>
            <div class="grid grid-cols-2 gap-y-4 mt-4">
                <div><span class="text-[8px] uppercase opacity-40 block">Yellow</span><span class="text-2xl font-black">${myData.yellow}</span></div>
                <div><span class="text-[8px] uppercase opacity-40 block">Round Total</span><span class="text-2xl font-black">${myData.roundTotal}</span></div>
                <div><span class="text-[8px] uppercase opacity-40 block">Grand Total</span><span class="text-2xl font-black">${myData.grandTotal}</span></div>
                <div><span class="text-[8px] uppercase opacity-40 block">Trade?</span><span class="text-2xl font-black">${myData.hasClear ? 'YES' : 'NO'}</span></div>
            </div>
        </div>
        <div class="flex-1 flex flex-col items-center justify-center text-center">
            <div class="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p class="text-[10px] font-black uppercase opacity-40">Still waiting for:</p>
            <div class="text-lg font-bold">${waitingFor.join(', ')}</div>
        </div>
        <button onclick="undoSubmission()" class="w-full py-5 border border-white/10 rounded-3xl text-[10px] font-black uppercase tracking-widest opacity-60">← Back to Edit</button>
    </div>`;
}

// --- 8. SUMMARY ENGINE ---
function renderSummary() {
    const roundIdx = activeGame.currentRound;
    const submissions = activeGame.roundSubmissions[`round_${roundIdx}`];
    const fullOrder = calculateOrder();

    const sortedYellow = Object.entries(submissions).sort((a,b) => b[1].yellow - a[1].yellow);
    const pandaId = sortedYellow[0][0];
    const pandaIndex = fullOrder.indexOf(pandaId);
    const relativeOrder = [...fullOrder.slice(pandaIndex), ...fullOrder.slice(0, pandaIndex)];

    const pickOrder = [...fullOrder].sort((a, b) => {
        if (submissions[b].yellow !== submissions[a].yellow) return submissions[b].yellow - submissions[a].yellow;
        return relativeOrder.indexOf(a) - relativeOrder.indexOf(b);
    });

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
        <h2 class="text-center text-[10px] font-black uppercase tracking-[0.4em] opacity-40 mb-8">Round ${roundIdx + 1} Summary</h2>
        <div class="summary-card panda-highlight p-6 rounded-3xl mb-4 border-2 border-yellow-500/50 bg-yellow-500/10">
            <span class="text-[10px] font-black uppercase opacity-60 tracking-widest">Round Panda</span>
            <div class="text-4xl font-black text-yellow-500">${activeGame.players[pandaId].name}</div>
        </div>
        <div class="summary-card p-6 bg-white/5 rounded-3xl mb-4">
            <span class="text-[10px] font-black uppercase opacity-60">Pity Dice</span>
            <div class="mt-2 text-xl font-bold">${pityWinners.map(id => activeGame.players[id].name).join(', ')}</div>
        </div>
        <div class="summary-card p-6 bg-white/5 rounded-3xl mb-4">
            <span class="text-[10px] font-black uppercase opacity-60">Trades</span>
            <div class="mt-2 flex flex-wrap gap-2">${relativeOrder.filter(id => submissions[id].hasClear).map(id => `<span class="bg-blue-600 px-3 py-1 rounded-full text-[10px] font-bold">${activeGame.players[id].name}</span>`).join('') || 'None'}</div>
        </div>
        <div class="summary-card p-6 bg-white/5 rounded-3xl mb-4">
            <span class="text-[10px] font-black uppercase opacity-60">Pick Order</span>
            <div class="mt-4 space-y-2">${pickOrder.map((id, i) => `<div class="flex items-center gap-3"><span class="w-5 h-5 flex items-center justify-center bg-white/10 rounded-full text-[8px] font-black">${i+1}</span><span class="font-bold">${activeGame.players[id].name}</span></div>`).join('')}</div>
        </div>
        ${activeGame.settings.showLeaderboard ? `<div class="p-6 bg-green-500/10 rounded-3xl mb-4 border border-green-500/20"><span class="text-[10px] font-black uppercase text-green-500">Standings</span><div class="mt-4 space-y-2">${Object.entries(submissions).sort((a,b) => b[1].grandTotal - a[1].grandTotal).map(([id, d]) => `<div class="flex justify-between text-sm font-black"><span>${activeGame.players[id].name}</span><span>${d.grandTotal}</span></div>`).join('')}</div></div>` : ''}
        <div class="mt-10 space-y-4">
            ${isHost ? `<button onclick="nextRound()" class="w-full bg-blue-600 py-5 rounded-3xl font-black text-white shadow-xl">NEXT ROUND</button>` : `<p class="text-center opacity-40 animate-pulse text-[10px] font-black uppercase">Waiting for Host...</p>`}
            <button onclick="undoSubmission()" class="w-full py-4 border border-white/10 rounded-3xl text-[10px] font-black uppercase tracking-widest opacity-60">Review / Edit Values</button>
        </div>
    </div>`;
}

// --- 9. HELPERS ---
function calculateOrder() {
    const order = [];
    let current = activeGame.settings.hostId;
    const count = Object.keys(activeGame.players).length;
    for(let i=0; i<count; i++) {
        order.push(current);
        current = activeGame.neighbors?.[current];
    }
    return order;
}

function kpInput(v) { keypadValue += v; updateRoundUI(); }
function kpClear() { keypadValue = ''; updateRoundUI(); }
function kpToggleNeg() { keypadValue = keypadValue.startsWith('-') ? keypadValue.substring(1) : (keypadValue ? '-' + keypadValue : '-'); updateRoundUI(); }

function setActiveInput(id) {
    activeInputField = id;
    const config = diceConfig.find(d => d.id === id);
    document.querySelectorAll('.dice-row').forEach(r => r.style.backgroundColor = "");
    document.getElementById(`row-${id}`).style.backgroundColor = config.color;
    document.getElementById(`row-${id}`).style.color = config.text;
    document.querySelectorAll('.kp-btn:not(#add-btn)').forEach(k => { k.style.backgroundColor = config.color; k.style.color = config.text; });
}

function kpEnter() {
    if (!activeInputField || !keypadValue || keypadValue === '-') return;
    if (!window.currentRoundVals[activeInputField]) window.currentRoundVals[activeInputField] = [];
    window.currentRoundVals[activeInputField].push(parseFloat(keypadValue));
    keypadValue = '';
    updateRoundUI();
}

function updateRoundUI() {
    let total = 0;
    diceConfig.forEach(d => {
        const vals = window.currentRoundVals[d.id] || [];
        let base = vals.reduce((a, b) => a + b, 0);
        let score = (d.id==='purple') ? base*2 : (d.id==='red' ? base*vals.length : base);
        total += score;
        document.getElementById(`${d.id}-sum`).textContent = score;
        document.getElementById(`${d.id}-values`).innerHTML = vals.map(v => `<span class="bg-black/20 px-3 py-1 rounded-lg text-xs font-bold">${v}</span>`).join('');
    });
    document.getElementById('round-total-display').textContent = total;
}

async function submitRound() {
    const roundIdx = activeGame.currentRound;
    const yellow = (window.currentRoundVals['yellow'] || []).reduce((a,b)=>a+b, 0);
    const roundTotal = parseInt(document.getElementById('round-total-display').textContent);
    const hasClear = (window.currentRoundVals['clear'] || []).length > 0;
    const prevGrand = activeGame.roundSubmissions?.[`round_${roundIdx-1}`]?.[myId]?.grandTotal || 0;

    await db.ref(`active_games/${currentGameCode}/roundSubmissions/round_${roundIdx}/${myId}`).set({
        yellow, roundTotal, grandTotal: prevGrand + roundTotal, hasClear
    });
}

async function undoSubmission() {
    await db.ref(`active_games/${currentGameCode}/roundSubmissions/round_${activeGame.currentRound}/${myId}`).remove();
    if (isHost && activeGame.status === 'summary') updateStatus('playing');
}

async function nextRound() {
    window.currentRoundVals = {};
    await db.ref(`active_games/${currentGameCode}`).update({ currentRound: activeGame.currentRound + 1, status: 'playing' });
}
