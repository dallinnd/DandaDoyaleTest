// --- 1. FIREBASE CONFIG ---
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

// --- 2. GLOBAL STATE ---
let myId = localStorage.getItem('p_id') || ('p_' + Math.random().toString(36).substr(2, 9));
localStorage.setItem('p_id', myId);
let playerName = localStorage.getItem('p_name') || "";
let multiHistory = JSON.parse(localStorage.getItem('p_history')) || [];
let currentGameCode = null;
let isHost = false;
let activeGame = null;
let keypadValue = '';
let activeInputField = null;
window.currentRoundVals = {}; 

const diceConfig = [
    { id: 'yellow', label: 'Yellow', color: '#fbbf24', text: '#000' },
    { id: 'purple', label: 'Purple (×2)', color: '#a855f7', text: '#fff' },
    { id: 'blue', label: 'Blue (Sparkle ×2)', color: '#3b82f6', text: '#fff' },
    { id: 'red', label: 'Red (Sum × # of Red)', color: '#ef4444', text: '#fff' },
    { id: 'green', label: 'Green', color: '#22c55e', text: '#fff' },
    { id: 'clear', label: 'Clear', color: '#cbd5e1', text: '#000' },
    { id: 'pink', label: 'Pink', color: '#ec4899', text: '#fff' }
];

const app = document.getElementById('app');
showHome();

// --- 3. CORE NAVIGATION ---
function showHome() {
    const list = multiHistory.map(g => `
        <div class="bg-white/5 p-4 rounded-2xl mb-2 flex justify-between border border-white/10" onclick="joinGame('${g.code}')">
            <span class="font-bold text-white">${g.mode} #${g.code}</span>
            <span class="text-green-500 font-black text-[10px] uppercase">Resume</span>
        </div>`).join('');

    app.innerHTML = `
    <div class="p-6 h-full flex flex-col text-white">
        <h1 class="text-4xl font-black mb-8 tracking-tighter">Panda Royale</h1>
        <div class="bg-white/5 p-6 rounded-3xl border border-white/10 mb-8">
            <span class="text-[10px] uppercase opacity-40 block mb-2">Your Name</span>
            <input type="text" id="name-input" oninput="saveName(this.value)" value="${playerName}" class="w-full bg-transparent text-2xl font-black outline-none border-b-2 border-green-600 pb-2">
        </div>
        <div class="grid grid-cols-2 gap-4 mb-8">
            <button onclick="openHostModal()" class="bg-green-600 p-5 rounded-3xl font-black uppercase">Host Game</button>
            <button onclick="joinPrompt()" class="bg-slate-700 p-5 rounded-3xl font-black uppercase">Join Game</button>
        </div>
        <div class="flex-1 overflow-y-auto"><h3 class="text-[10px] opacity-40 uppercase mb-4">History</h3>${list}</div>
    </div>`;
}

function saveName(v) { playerName = v; localStorage.setItem('p_name', v); }

function openHostModal() {
    const modal = document.createElement('div');
    modal.className = "modal-overlay fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50";
    modal.innerHTML = `
        <div class="bg-[#0f172a] p-8 rounded-[40px] w-11/12 max-w-sm border border-white/10 text-center">
            <h2 class="text-2xl font-black text-white mb-8">Select Mode</h2>
            <button onclick="hostGame('normal')" class="w-full py-5 bg-slate-200 text-slate-900 rounded-2xl font-black mb-4">NORMAL</button>
            <button onclick="hostGame('expansion')" class="w-full py-5 bg-gradient-to-r from-purple-600 to-red-500 text-white rounded-2xl font-black">EXPANSION</button>
        </div>`;
    document.body.appendChild(modal);
}

// --- 4. MULTIPLAYER SYNC (The "Flip 7" Strategy) ---
async function hostGame(mode) {
    if (!playerName) return alert("Enter name!");
    document.querySelector('.modal-overlay').remove();
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    await db.ref('games/' + code).set({
        hostId: myId, mode: mode, status: "lobby", roundNum: 1,
        players: { [myId]: { name: playerName, submitted: false } }
    });
    joinGame(code);
}

function joinPrompt() {
    const c = prompt("6-Digit Code:");
    if (c) joinGame(c);
}

function joinGame(code) {
    currentGameCode = code;
    const gRef = db.ref('games/' + code);
    gRef.child('players/' + myId).update({ name: playerName, submitted: false });
    
    // SAVE TO LOCAL HISTORY
    if (!multiHistory.find(h => h.code === code)) {
        multiHistory.unshift({code, mode: "Game"});
        localStorage.setItem('p_history', JSON.stringify(multiHistory.slice(0,10)));
    }

    gRef.on('value', syncApp);
}

function syncApp(snap) {
    const data = snap.val(); if (!data) return;
    activeGame = data;
    isHost = data.hostId === myId;
    
    const players = data.players;
    const me = players[myId];
    const playerCount = Object.keys(players).length;
    const submissions = data.roundSubmissions?.[`round_${data.roundNum}`] || {};
    const subCount = Object.keys(submissions).length;

    // AUTO-ADVANCE LOGIC
    if (subCount === playerCount && data.status === "playing" && isHost) {
        db.ref(`games/${currentGameCode}`).update({ status: "summary" });
        return;
    }

    // SCREEN SWITCHER
    if (data.status === "lobby") renderLobby(players);
    else if (data.status === "seating") renderSeating(players);
    else if (data.status === "playing") {
        if (me.submitted) renderWaiting(submissions);
        else renderCalculator();
    }
    else if (data.status === "summary") renderSummary(submissions);
}

// --- 5. LOBBY & SEATING ---
function renderLobby(players) {
    const list = Object.values(players).map(p => `<div class="p-4 bg-white/5 rounded-2xl mb-2 font-bold text-white">${p.name}</div>`).join('');
    app.innerHTML = `<div class="p-8 h-full flex flex-col text-white">
        <div class="text-center mt-10 mb-10"><span class="opacity-40 uppercase text-xs">Game Code</span><div class="text-7xl font-black text-green-500">${currentGameCode}</div></div>
        <div class="flex-1 overflow-y-auto">${list}</div>
        ${isHost ? `<button onclick="db.ref('games/'+currentGameCode).update({status:'seating'})" class="w-full bg-green-600 py-6 rounded-3xl font-black">START SEATING</button>` : `<p class="text-center opacity-40 animate-pulse">Waiting for host...</p>`}
    </div>`;
}

function renderSeating(players) {
    if (!isHost) {
        app.innerHTML = `<div class="h-full flex flex-col items-center justify-center p-10 text-center text-white"><div class="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin mb-4"></div><p class="font-black opacity-40 uppercase">Host is picking the order...</p></div>`;
        return;
    }
    if (!window.pickedOrder) window.pickedOrder = [myId];

    const list = Object.entries(players).map(([id, p]) => {
        const idx = window.pickedOrder.indexOf(id);
        const active = idx !== -1;
        return `<button onclick="toggleSeat('${id}')" class="w-full p-5 rounded-2xl mb-2 border transition-all ${active ? 'bg-green-600 border-green-400 text-white' : 'bg-white/5 border-white/10 text-white/40'}">
            <span class="font-bold">${p.name}</span> ${active ? `<span class="float-right bg-black/20 w-6 h-6 rounded-full text-[10px] flex items-center justify-center">${idx+1}</span>` : ''}
        </button>`;
    }).join('');

    app.innerHTML = `<div class="p-8 h-full flex flex-col text-white">
        <h2 class="text-2xl font-black mb-2 uppercase">Who is on your left?</h2>
        <p class="text-xs opacity-40 mb-8">Tap players in order going around the table to the left.</p>
        <div class="flex-1 overflow-y-auto">${list}</div>
        <button onclick="confirmSeating()" class="w-full bg-blue-600 py-5 rounded-3xl font-black">CONFIRM ORDER</button>
    </div>`;
}

window.toggleSeat = (id) => {
    const idx = window.pickedOrder.indexOf(id);
    if (idx === -1) window.pickedOrder.push(id);
    else if (id !== myId) window.pickedOrder.splice(idx, 1);
    syncApp({ val: () => activeGame });
};

async function confirmSeating() {
    await db.ref(`games/${currentGameCode}`).update({ playerOrder: window.pickedOrder, status: "playing" });
}

// --- 6. CALCULATOR & WAITING ---
function renderCalculator() {
    const header = `<div class="p-5 border-b border-white/10 flex justify-between items-center text-white">
        <button onclick="location.reload()" class="text-[10px] opacity-40">EXIT</button>
        <div class="text-center"><span class="text-[10px] opacity-40 uppercase">Round ${activeGame.roundNum}</span><div id="round-total-display" class="text-3xl font-black">0</div></div>
        <button onclick="submitScore()" class="bg-blue-600 px-6 py-2 rounded-full font-black text-xs">SUBMIT</button>
    </div>`;

    let rows = diceConfig.map(d => `<div onclick="setActiveInput('${d.id}')" id="row-${d.id}" class="p-4 rounded-2xl mb-2 bg-white/5 text-white flex justify-between border-l-8 border-transparent transition-all">
        <span class="font-black uppercase text-xs">${d.label}</span><span id="${d.id}-sum" class="text-2xl font-black">0</span>
    </div>`).join('');

    app.innerHTML = `<div class="h-2/3 overflow-y-auto">${header}<div class="p-4">${rows}</div></div>
    <div class="h-1/3 p-4 grid grid-cols-4 gap-2 bg-[#0f172a]">${[1,2,3,4,5,6,7,8,9,0].map(n => `<button onclick="kpPush('${n}')" class="bg-white/5 text-2xl text-white rounded-xl font-bold">${n}</button>`).join('')}
    <button onclick="kpClear()" class="bg-white/5 text-white/40 text-xs font-bold rounded-xl">CLR</button>
    <button onclick="kpEnter()" class="bg-green-600 text-white row-span-2 text-2xl font-black rounded-xl">ADD</button></div>`;
    
    setActiveInput('yellow');
    updateCalcUI();
}

function renderWaiting(submissions) {
    const myData = submissions[myId];
    const waitList = Object.entries(activeGame.players).filter(([id]) => !submissions[id]).map(([id, p]) => p.name);

    app.innerHTML = `<div class="p-8 h-full flex flex-col text-white text-center">
        <h2 class="text-[10px] opacity-40 uppercase mb-10 tracking-widest">Submitted</h2>
        <div class="bg-blue-600/10 p-6 rounded-3xl border border-blue-500/30 mb-8 grid grid-cols-2 gap-4">
            <div><span class="text-[8px] opacity-40 block uppercase">Yellow</span><span class="text-2xl font-black">${myData.yellow}</span></div>
            <div><span class="text-[8px] opacity-40 block uppercase">Round</span><span class="text-2xl font-black">${myData.roundTotal}</span></div>
        </div>
        <div class="flex-1 flex flex-col items-center justify-center">
            <div class="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p class="text-[10px] opacity-40 uppercase">Waiting for:</p>
            <div class="font-bold text-lg">${waitList.join(', ')}</div>
        </div>
        <button onclick="undo()" class="w-full py-5 border border-white/10 rounded-3xl text-xs font-black opacity-40">EDIT VALUES</button>
    </div>`;
}

// --- 7. THE FINAL SUMMARY ---
function renderSummary(submissions) {
    const fullOrder = activeGame.playerOrder;
    const sortedYellow = Object.entries(submissions).sort((a,b) => b[1].yellow - a[1].yellow);
    const pandaId = sortedYellow[0][0];
    const pIdx = fullOrder.indexOf(pandaId);
    const relOrder = [...fullOrder.slice(pIdx), ...fullOrder.slice(0, pIdx)];

    const pickOrder = [...fullOrder].sort((a,b) => {
        if(submissions[b].yellow !== submissions[a].yellow) return submissions[b].yellow - submissions[a].yellow;
        return relOrder.indexOf(a) - relOrder.indexOf(b);
    });

    let limit = fullOrder.length < 4 ? 1 : (fullOrder.length < 7 ? 2 : (fullOrder.length < 10 ? 3 : 4));
    const pity = [...fullOrder].sort((a,b) => {
        if(submissions[a].roundTotal !== submissions[b].roundTotal) return submissions[a].roundTotal - submissions[b].roundTotal;
        return relOrder.indexOf(b) - relOrder.indexOf(a);
    }).slice(0, limit);

    app.innerHTML = `<div class="p-6 h-full overflow-y-auto text-white">
        <h2 class="text-center text-[10px] opacity-40 uppercase mb-10">Round ${activeGame.roundNum} Summary</h2>
        <div class="p-6 bg-yellow-500/10 border-2 border-yellow-500/50 rounded-3xl mb-4">
            <span class="text-[10px] opacity-60 uppercase">Round Panda</span>
            <div class="text-4xl font-black text-yellow-500">${activeGame.players[pandaId].name}</div>
        </div>
        <div class="bg-white/5 p-6 rounded-3xl mb-4"><span class="text-[10px] opacity-40">Pity Dice</span><div class="text-xl font-bold mt-1">${pity.map(id => activeGame.players[id].name).join(', ')}</div></div>
        <div class="bg-white/5 p-6 rounded-3xl mb-4"><span class="text-[10px] opacity-40">Pick Order</span><div class="mt-4 space-y-2">${pickOrder.map((id, i) => `<div class="flex items-center gap-3"><span class="w-5 h-5 bg-white/10 rounded-full text-[8px] flex items-center justify-center font-black">${i+1}</span><span class="font-bold">${activeGame.players[id].name}</span></div>`).join('')}</div></div>
        <div class="mt-10 space-y-4">
            ${isHost ? `<button onclick="nextRound()" class="w-full bg-blue-600 py-5 rounded-3xl font-black uppercase">Next Round</button>` : `<p class="text-center opacity-40 animate-pulse text-[10px] uppercase">Waiting for Host...</p>`}
            <button onclick="undo()" class="w-full py-4 border border-white/10 rounded-3xl text-[10px] font-black opacity-40">EDIT VALUES</button>
        </div>
    </div>`;
}

// --- 8. CALCULATOR LOGIC ---
window.kpPush = (v) => { keypadValue += v; };
window.kpClear = () => { keypadValue = ''; };
window.kpEnter = () => {
    if (!activeInputField || !keypadValue) return;
    if (!window.currentRoundVals[activeInputField]) window.currentRoundVals[activeInputField] = [];
    window.currentRoundVals[activeInputField].push(parseFloat(keypadValue));
    keypadValue = ''; updateCalcUI();
};

function setActiveInput(id) {
    activeInputField = id;
    const config = diceConfig.find(d => d.id === id);
    document.querySelectorAll('[id^="row-"]').forEach(r => r.style.backgroundColor = "");
    const row = document.getElementById(`row-${id}`);
    row.style.backgroundColor = config.color; row.style.color = config.text;
}

function updateCalcUI() {
    let total = 0;
    diceConfig.forEach(d => {
        const v = window.currentRoundVals[d.id] || [];
        const base = v.reduce((a,b)=>a+b,0);
        const score = (d.id==='purple') ? base*2 : (d.id==='red' ? base*v.length : base);
        total += score;
        const sEl = document.getElementById(`${d.id}-sum`);
        if(sEl) sEl.textContent = score;
    });
    const tEl = document.getElementById('round-total-display');
    if(tEl) tEl.textContent = total;
}

async function submitScore() {
    const roundIdx = activeGame.roundNum;
    const yellow = (window.currentRoundVals['yellow'] || []).reduce((a,b)=>a+b, 0);
    const roundTotal = parseInt(document.getElementById('round-total-display').textContent);
    const hasClear = (window.currentRoundVals['clear'] || []).length > 0;
    
    // Calculate Grand Total from history (looking at the previous submission in Firebase)
    const prevData = activeGame.roundSubmissions?.[`round_${roundIdx-1}`]?.[myId];
    const prevGrand = prevData ? prevData.grandTotal : 0;

    await db.ref(`games/${currentGameCode}/roundSubmissions/round_${roundIdx}/${myId}`).set({ 
        yellow, roundTotal, hasClear, grandTotal: prevGrand + roundTotal 
    });
    await db.ref(`games/${currentGameCode}/players/${myId}`).update({ submitted: true });
}

async function undo() {
    await db.ref(`games/${currentGameCode}/players/${myId}`).update({ submitted: false });
    await db.ref(`games/${currentGameCode}`).update({ status: "playing" });
}

async function nextRound() {
    window.currentRoundVals = {};
    const updates = { roundNum: activeGame.roundNum + 1, status: "playing" };
    for(let id in activeGame.players) {
        updates[`players/${id}/submitted`] = false;
    }
    await db.ref(`games/${currentGameCode}`).update(updates);
}
