import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, onValue, update, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyConuxhGCtGvJaa6TZ1bkUvlOhhTdyTgZE",
    authDomain: "flip7share.firebaseapp.com",
    databaseURL: "https://flip7share-default-rtdb.firebaseio.com",
    projectId: "flip7share",
    storageBucket: "flip7share.firebasestorage.app",
    messagingSenderId: "467127126520",
    appId: "1:467127126520:web:0646f4fc19352eaa11ee0d"
};

const fApp = initializeApp(firebaseConfig);
const db = getDatabase(fApp);

// --- Data & Config ---
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

let games = JSON.parse(localStorage.getItem('panda_games')) || [];
let settings = JSON.parse(localStorage.getItem('panda_settings')) || { theme: 'dark' };
let activeGame = null;
let keypadValue = '';
let activeInputField = null;
let myName = localStorage.getItem('panda_name') || "";

// --- Multiplayer State ---
let multiplayerConfig = {
    active: false,
    code: null,
    isHost: false,
    hasSubmitted: false,
    playerOrder: [] 
};

const app = document.getElementById('app');

// --- Expose Functions ---
Object.assign(window, {
    checkOnboarding, showOnboarding, finishOnboarding, showHome,
    openGameActions, resumeGame, confirmDelete, openNewGameModal, initGame,
    showResults, renderGame, changeRound, adjustWildCount, toggleSparkle,
    setWildTarget, setActiveInput, setActiveWildInput, kpInput, kpClear,
    kpToggleNeg, kpEnter, removeVal, toggleMenu, setTheme, clearHistory,
    // MP Functions
    openHostModeSelect, finalizeHostGame, joinExistingGame, leaveLobby,
    editMyScore, hostPushNextRound, adjustLobbyCount, openHostSettings,
    movePlayerOrder, savePlayerOrder, closeHostSettings, exitHostGame,
    submitMultiplayerRound, toggleScoreVisibility, updatePlayerName
});

function applySettings() {
    document.body.classList.toggle('light-theme', settings.theme === 'light');
    localStorage.setItem('panda_settings', JSON.stringify(settings));
}

// --- Navigation & Onboarding ---
function showSplash() {
    app.innerHTML = `<div class="h-full flex flex-col items-center justify-center bg-[#0f172a]" onclick="checkOnboarding()">
        <h1 class="text-5xl font-black text-green-400 text-center px-6 uppercase tracking-tighter">Panda Royale</h1>
        <h2 class="text-xl font-bold text-slate-500 tracking-[0.3em] uppercase mt-2">Calculator</h2>
        <p class="mt-12 text-slate-600 animate-pulse font-bold text-xs uppercase">Tap to Enter</p>
    </div>`;
}

function checkOnboarding() {
    const complete = localStorage.getItem('panda_onboarding_complete');
    if (!complete) { showOnboarding(1); } else { showHome(); }
}

function showOnboarding(step) {
    const menu = document.getElementById('menu-overlay');
    if (menu) menu.remove(); 
    let container = document.getElementById('onboarding-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'onboarding-container';
        document.body.appendChild(container);
    }
    const currentCard = container.querySelector('.onboarding-card');
    if (currentCard && step === 2) {
        currentCard.classList.add('slide-out-left');
        setTimeout(() => renderOnboardingCard(step, container), 300);
    } else {
        renderOnboardingCard(step, container);
    }
}

function renderOnboardingCard(step, container) {
    container.innerHTML = '';
    const card = document.createElement('div');
    card.className = 'onboarding-card slide-in-right text-white';
    if (step === 1) {
        card.innerHTML = `
            <div class="flex justify-between items-center mb-10">
                <span class="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">Step 1 of 2</span>
                <button onclick="showOnboarding(2)" class="bg-blue-600 px-4 py-1.5 rounded-full font-black uppercase text-xs shadow-lg">Next</button>
            </div>
            <div class="flex-1 flex flex-col justify-center">
                <h2 class="text-4xl font-black mb-8 tracking-tighter">Master the Menu</h2>
                <div class="space-y-6 text-slate-300 font-medium leading-snug">
                    <p><strong class="text-white">Multiplayer:</strong> Host or Join games to play with friends in real-time!</p>
                    <p><strong class="text-white">Game Modes:</strong> Choose <span class="text-green-400">Normal</span> or <span class="text-purple-400">Expansion</span>.</p>
                </div>
            </div>
            <button onclick="finishOnboarding()" class="mt-10 py-4 opacity-40 font-black uppercase text-[10px] tracking-widest">Skip Instructions</button>`;
    } else {
        card.innerHTML = `
            <div class="flex justify-between items-center mb-10">
                <span class="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">Step 2 of 2</span>
                <button onclick="finishOnboarding()" class="bg-green-600 px-4 py-1.5 rounded-full font-black uppercase text-xs shadow-lg">Let's Play</button>
            </div>
            <div class="flex-1 flex flex-col justify-center">
                <h2 class="text-4xl font-black mb-8 tracking-tighter">Playing Together</h2>
                <div class="space-y-6 text-slate-300 font-medium leading-snug text-sm">
                    <p><strong class="text-white">Syncing:</strong> Calculate your score, then tap <strong class="text-white">SUBMIT</strong> to join the summary page.</p>
                </div>
            </div>
            <button onclick="finishOnboarding()" class="mt-10 py-4 opacity-40 font-black uppercase text-[10px] tracking-widest text-white">Start Playing</button>`;
    }
    container.appendChild(card);
}

function finishOnboarding() {
    localStorage.setItem('panda_onboarding_complete', 'true');
    const container = document.getElementById('onboarding-container');
    if (container) container.remove();
    showHome();
}

function updatePlayerName(val) {
    myName = val;
    localStorage.setItem('panda_name', val);
}

function showHome() {
    activeInputField = null; 
    document.getElementById('lobby-screen').classList.add('hidden');
    document.getElementById('waiting-screen').classList.add('hidden');
    
    if (!myName) {
        myName = "Panda";
        localStorage.setItem('panda_name', myName);
    }

    const gameCards = games.map((g, i) => {
        const isFinished = (g.currentRound === 9);
        const mpBadge = g.mpCode ? `<span class="ml-2 px-2 py-0.5 bg-purple-500/20 text-purple-400 text-[8px] font-black rounded-full border border-purple-500/30 uppercase tracking-widest">ONLINE</span>` : '';
        const statusBadge = isFinished 
            ? `<span class="ml-2 px-2 py-0.5 bg-green-500/20 text-green-500 text-[8px] font-black rounded-full border border-green-500/30 uppercase tracking-widest">Finished</span>` 
            : `<span class="ml-2 px-2 py-0.5 bg-blue-500/20 text-blue-500 text-[8px] font-black rounded-full border border-blue-500/30 uppercase tracking-widest">Round ${g.currentRound + 1}</span>`;
        return `
        <div class="bg-[var(--bg-card)] p-6 rounded-2xl mb-4 flex justify-between items-center border border-[var(--border-ui)] active:scale-[0.98] transition-all cursor-pointer" onclick="openGameActions(${i})">
            <div class="flex-1 pointer-events-none">
                <div class="flex items-center text-[10px] font-black opacity-40 uppercase tracking-widest">
                    ${g.mode || 'normal'} #${games.length - i} ${statusBadge} ${mpBadge}
                </div>
                <div class="text-xl font-bold mt-1">${g.date}</div>
            </div>
            <div class="text-3xl font-black pointer-events-none" style="color: var(--color-score)">${calculateGrandTotal(g)}</div>
        </div>`;
    }).join('');

    app.innerHTML = `<div class="p-6 h-full flex flex-col animate-fadeIn">
        <div class="flex justify-between items-center mb-6">
            <h1 class="text-4xl font-black tracking-tighter">History</h1>
            <button onclick="toggleMenu()" class="p-2 bg-black/5 rounded-xl"><svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2.5" stroke-linecap="round" d="M4 6h16M4 12h16m-7 6h7"></path></svg></button>
        </div>

        <div class="bg-black/5 p-2 rounded-2xl border border-[var(--border-ui)] mb-6 flex items-center">
            <div class="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-2xl shadow-sm">🐼</div>
            <div class="flex-1 ml-3">
                <label class="block text-[8px] font-black uppercase opacity-40 tracking-widest">Player Name</label>
                <input type="text" value="${myName}" oninput="updatePlayerName(this.value)" class="w-full bg-transparent border-none outline-none font-black text-lg text-[var(--text-primary)] p-0 m-0 focus:ring-0 placeholder:opacity-30" placeholder="ENTER NAME">
            </div>
            <div class="opacity-30 pr-3">✎</div>
        </div>

        <div class="flex gap-3 mb-6">
            <button onclick="openHostModeSelect()" class="flex-1 py-4 bg-white text-slate-900 rounded-2xl font-black text-sm uppercase tracking-wider shadow-lg">Host</button>
            <button onclick="joinExistingGame()" class="flex-1 py-4 bg-slate-800 text-white rounded-2xl font-black text-sm uppercase tracking-wider shadow-lg">Join</button>
        </div>
        <div class="flex-1 overflow-y-auto mb-4 border-t border-[var(--border-ui)] pt-4">${games.length > 0 ? gameCards : '<p class="opacity-30 italic text-center py-20">No games found.</p>'}</div>
        <button onclick="openNewGameModal()" class="w-full bg-green-600 py-5 rounded-3xl font-black text-xl text-white shadow-xl active:scale-95 transition-all">LOCAL GAME</button>
    </div>`;
}

// --- Multiplayer Logic ---

function openHostModeSelect() {
    const overlay = document.createElement('div');
    overlay.id = 'host-mode-modal';
    overlay.className = 'modal-overlay animate-fadeIn';
    overlay.onclick = (e) => { if(e.target === overlay) overlay.remove(); };
    overlay.innerHTML = `<div class="action-popup">
        <h2 class="text-2xl font-black mb-8">Host Game</h2>
        <div class="flex flex-col gap-4">
            <button onclick="finalizeHostGame('normal')" class="w-full py-5 bg-slate-200 text-slate-900 rounded-2xl font-black text-xl shadow-md active:scale-95 transition-all">NORMAL MODE</button>
            <button onclick="finalizeHostGame('expansion')" class="w-full py-5 bg-gradient-to-r from-purple-600 to-red-500 text-white rounded-2xl font-black text-xl shadow-lg active:scale-95 transition-all">EXPANSION MODE</button>
        </div>
    </div>`;
    document.body.appendChild(overlay);
}

async function finalizeHostGame(mode) {
    if(document.getElementById('host-mode-modal')) document.getElementById('host-mode-modal').remove();
    
    multiplayerConfig.active = true;
    multiplayerConfig.isHost = true;
    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
    multiplayerConfig.code = newCode;
    
    initGame(mode, true); 
    
    activeGame.mpCode = newCode;
    activeGame.isHost = true;
    saveGame();
    
    await set(ref(db, `games/${newCode}`), { 
        host: myName, 
        mode: mode,
        status: "waiting", 
        roundNum: 0,
        targetCount: 4,
        playerOrder: [myName],
        showGrandTotal: true 
    });

    await set(ref(db, `games/${newCode}/players/${myName}`), { 
        name: myName, 
        submitted: false, 
        grandTotal: 0,
        roundScore: 0,
        yellowScore: 0,
        clearUsed: false
    });
    
    onValue(ref(db, `games/${newCode}`), syncLobby);
}

async function joinExistingGame() {
    let code = prompt("Enter Game Code:");
    if (!code) return;
    
    const gSnap = await get(ref(db, `games/${code}`));
    if(!gSnap.exists()) return alert("Game not found!");
    
    multiplayerConfig.active = true;
    multiplayerConfig.isHost = false;
    multiplayerConfig.code = code;
    
    const gameMode = gSnap.val().mode || 'normal';
    initGame(gameMode, true); 

    activeGame.mpCode = code;
    activeGame.isHost = false;
    saveGame();

    const pRef = ref(db, `games/${code}/players/${myName}`);
    const snap = await get(pRef);
    if (!snap.exists()) {
        await set(pRef, { 
            name: myName, 
            submitted: false, 
            grandTotal: 0,
            roundScore: 0,
            yellowScore: 0,
            clearUsed: false
        });
        
        const gameData = gSnap.val();
        let currentOrder = gameData.playerOrder || [];
        if (!currentOrder.includes(myName)) {
            currentOrder.push(myName);
            await update(ref(db, `games/${code}`), { playerOrder: currentOrder });
        }
    }
    onValue(ref(db, `games/${code}`), syncLobby);
}

function getPityDiceCount(playerCount) {
    if (playerCount <= 3) return 1;
    if (playerCount <= 6) return 2;
    if (playerCount <= 9) return 3;
    return 4;
}

function adjustLobbyCount(delta) {
    if(!multiplayerConfig.isHost) return;
    get(ref(db, `games/${multiplayerConfig.code}/targetCount`)).then((snap) => {
        let current = snap.val() || 4;
        let next = Math.max(1, Math.min(20, current + delta));
        update(ref(db, `games/${multiplayerConfig.code}`), { targetCount: next });
    });
}

function toggleScoreVisibility() {
    if(!multiplayerConfig.isHost) return;
    get(ref(db, `games/${multiplayerConfig.code}/showGrandTotal`)).then((snap) => {
        const current = snap.val();
        update(ref(db, `games/${multiplayerConfig.code}`), { showGrandTotal: !current });
    });
}

function getPlayerIndex(name, orderList) { return orderList.indexOf(name); }
function getDistanceLeft(pandaIndex, playerIndex, totalPlayers) { if (totalPlayers === 0) return 0; return (playerIndex - pandaIndex + totalPlayers) % totalPlayers; }
function getDistanceRight(pandaIndex, playerIndex, totalPlayers) { if (totalPlayers === 0) return 0; return (pandaIndex - playerIndex + totalPlayers) % totalPlayers; }

function syncLobby(snap) {
    const data = snap.val();
    if (!data) return;

    // --- LIVE SETTINGS REFRESH ---
    if (document.getElementById('host-settings-overlay')) {
        const container = document.getElementById('host-settings-content');
        const isSetup = container && container.innerHTML.includes('SEATING CHART');
        renderHostSettingsContent(isSetup);
    }
    
    const lobbyEl = document.getElementById('lobby-screen');
    const waitingEl = document.getElementById('waiting-screen');
    const players = Object.values(data.players || {});
    const playerCount = data.targetCount || 4;
    const pityDiceCount = getPityDiceCount(playerCount);
    
    multiplayerConfig.playerOrder = data.playerOrder || [];

    if (multiplayerConfig.isHost && data.status === "active" && data.roundNum === 0) {
        const existing = document.getElementById('host-settings-overlay');
        if (!existing && !sessionStorage.getItem('setup_shown')) {
            openHostSettings(true); 
            sessionStorage.setItem('setup_shown', 'true');
        }
    }

    if (data.status === "waiting") {
        app.classList.add('hidden');
        waitingEl.classList.add('hidden');
        lobbyEl.classList.remove('hidden');
        
        document.getElementById('lobby-code-display').innerText = `CODE: ${multiplayerConfig.code}`;
        
        let controlsHtml = '';
        if (multiplayerConfig.isHost) {
            controlsHtml = `
            <div class="flex justify-center items-center gap-4 mb-4 bg-white/5 p-4 rounded-xl border border-white/10">
                <button onclick="adjustLobbyCount(-1)" class="w-10 h-10 bg-white text-black font-black rounded-lg text-xl">-</button>
                <div class="text-center">
                    <div class="text-4xl font-black text-white">${playerCount}</div>
                    <div class="text-[8px] font-black uppercase text-slate-400 tracking-widest">Players (${pityDiceCount} Pity Dice)</div>
                </div>
                <button onclick="adjustLobbyCount(1)" class="w-10 h-10 bg-white text-black font-black rounded-lg text-xl">+</button>
            </div>`;
        } else {
             controlsHtml = `
             <div class="text-center mb-4 opacity-50">
                 <div class="text-2xl font-black text-white">${playerCount} Players Expected</div>
                 <div class="text-[10px] uppercase">${pityDiceCount} Pity Dice Rules</div>
             </div>`;
        }

        document.getElementById('lobby-player-list').innerHTML = controlsHtml + players.map(p => 
            `<div class="mp-row text-white"><span class="font-bold">${p.name}</span>${p.name === data.host ? '<span class="text-[10px] bg-yellow-500 text-black px-2 rounded-full">HOST</span>' : ''}</div>`
        ).join("");

        if (multiplayerConfig.isHost) {
             let startBtn = document.getElementById('mp-start-btn');
             if(!startBtn) {
                 startBtn = document.createElement('button');
                 startBtn.id = 'mp-start-btn';
                 startBtn.className = "w-full bg-green-600 py-4 rounded-2xl font-black text-white mt-4 shadow-lg";
                 startBtn.innerText = "START GAME";
                 startBtn.onclick = () => update(ref(db, `games/${multiplayerConfig.code}`), { status: "active", roundNum: 0 });
                 lobbyEl.appendChild(startBtn);
             }
        }
    } else if (data.status === "active") {
        lobbyEl.classList.add('hidden');
        
        if (!document.getElementById('game-scroll')) {
            renderGame();
        }

        if (activeGame.currentRound !== data.roundNum) {
            activeGame.currentRound = data.roundNum;
            multiplayerConfig.hasSubmitted = false;
            saveGame();
            renderGame(); 
        }

        if (multiplayerConfig.hasSubmitted) {
            waitingEl.classList.remove('hidden');
            app.classList.add('hidden');

            const listContainer = document.getElementById('waiting-list');
            const orderList = multiplayerConfig.playerOrder;
            
            const calcPlayers = players.map(p => ({
                ...p,
                yellowScore: p.submitted ? (p.yellowScore || 0) : 0,
                roundScore: p.submitted ? (p.roundScore || 0) : 0,
                grandTotal: p.grandTotal || 0,
                orderIndex: getPlayerIndex(p.name, orderList)
            }));

            // 1. Find Panda
            const sortedByYellowRaw = [...calcPlayers].sort((a,b) => {
                if (b.yellowScore !== a.yellowScore) return b.yellowScore - a.yellowScore;
                return a.orderIndex - b.orderIndex; 
            });
            const pandaPlayer = sortedByYellowRaw[0];
            const pandaIndex = pandaPlayer ? pandaPlayer.orderIndex : 0;
            const totalP = orderList.length;

            // 2. Picking Order
            const pickingOrder = [...calcPlayers].sort((a,b) => {
                if (b.yellowScore !== a.yellowScore) return b.yellowScore - a.yellowScore;
                const distA = getDistanceLeft(pandaIndex, a.orderIndex, totalP);
                const distB = getDistanceLeft(pandaIndex, b.orderIndex, totalP);
                return distA - distB;
            });

            // 3. Pity Dice - Modified Logic (Panda Last)
            const pityOrder = [...calcPlayers].sort((a,b) => {
                if (a.roundScore !== b.roundScore) return a.roundScore - b.roundScore;
                let distA = getDistanceLeft(pandaIndex, a.orderIndex, totalP);
                let distB = getDistanceLeft(pandaIndex, b.orderIndex, totalP);
                if (distA === 0) distA = totalP + 99;
                if (distB === 0) distB = totalP + 99;
                return distA - distB;
            });
            const pityList = pityOrder.slice(0, pityDiceCount);

            // 4. Trade List
            let tradeList = calcPlayers.filter(p => p.clearUsed && p.submitted);
            tradeList.sort((a, b) => {
                let distA = getDistanceLeft(pandaIndex, a.orderIndex, totalP);
                let distB = getDistanceLeft(pandaIndex, b.orderIndex, totalP);
                if (distA === 0) distA = 9999;
                if (distB === 0) distB = 9999;
                return distA - distB;
            });

            // 5. Grand Order
            const grandOrder = [...calcPlayers].sort((a,b) => b.grandTotal - a.grandTotal);
            
            let html = '';

            const myRoundData = activeGame.rounds[activeGame.currentRound];
            const myYel = (myRoundData.yellow || []).reduce((a,b)=>a+b,0);
            const myRnd = calculateRoundTotal(myRoundData);

            html += `
            <div class="mb-6 animate-fadeIn">
                <div class="text-[10px] font-black uppercase opacity-50 tracking-widest mb-2 text-center">YOUR PERFORMANCE</div>
                <div class="prev-round-box bg-[#fbbf24] text-black border-none mb-2">
                    <span>Yellow Total</span>
                    <span class="text-xl font-black">${myYel}</span>
                </div>
                <div class="prev-total-box bg-[#1e293b] text-[#f1f5f9] border-[#1e293b]">
                    <span>Round Score</span>
                    <span class="text-xl font-black">${myRnd}</span>
                </div>
            </div>`;

            // SECTION 1: THE PANDA
            html += `<div class="mb-4"><div class="text-[10px] font-black uppercase text-yellow-500 tracking-widest mb-1 pl-2">THE PANDA</div>`;
            if (pandaPlayer && pandaPlayer.submitted) {
                html += `<div class="bg-yellow-500/10 border border-yellow-500/50 p-4 rounded-xl flex justify-between items-center">
                    <span class="text-xl font-black text-yellow-400">${pandaPlayer.name}</span>
                    <span class="text-2xl font-black text-white">${pandaPlayer.yellowScore}</span>
                </div>`;
            } else { html += `<div class="opacity-30 italic pl-2 text-xs">Determining...</div>`; }
            html += `</div>`;

            // SECTION 2: PITY DICE
            html += `<div class="mb-4"><div class="text-[10px] font-black uppercase text-pink-500 tracking-widest mb-1 pl-2">PITY DICE (${pityDiceCount})</div>`;
            if (pityList.length > 0) {
                 html += `<div class="grid grid-cols-1 gap-2">`;
                 pityList.forEach(p => {
                    const val = p.submitted ? p.roundScore : '-';
                    html += `<div class="bg-pink-500/10 border border-pink-500/50 p-3 rounded-xl flex justify-between items-center">
                        <span class="font-bold text-pink-400">${p.name}</span>
                        <span class="font-mono text-white text-xs">Round: ${val}</span>
                    </div>`;
                 });
                 html += `</div>`;
            } else { html += `<div class="opacity-30 italic pl-2 text-xs">Waiting...</div>`; }
            html += `</div>`;

            // SECTION 3: TRADES
            html += `<div class="mb-4"><div class="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1 pl-2">TRADES</div>`;
            if (tradeList.length > 0) {
                 html += `<div class="flex flex-wrap gap-2">`;
                 tradeList.forEach(p => {
                    html += `<span class="bg-slate-700/50 border border-slate-600 px-3 py-1 rounded-lg text-xs font-bold text-slate-300">${p.name}</span>`;
                 });
                 html += `</div>`;
            } else { html += `<div class="opacity-30 italic pl-2 text-xs text-slate-600">No trades.</div>`; }
            html += `</div>`;

            // SECTION 4: PICKING ORDER
            html += `<div class="mb-4"><div class="text-[10px] font-black uppercase text-blue-400 tracking-widest mb-1 pl-2">PICKING ORDER</div>`;
            html += `<div class="bg-white/5 rounded-xl border border-white/10 divide-y divide-white/5">`;
            pickingOrder.forEach((p, i) => {
                const val = p.submitted ? p.yellowScore : '-';
                html += `<div class="p-3 flex justify-between items-center">
                    <div class="flex items-center gap-3">
                        <span class="text-[10px] font-black w-4 text-slate-500">${i+1}</span>
                        <span class="font-bold text-sm ${p.name===myName?'text-blue-400':'text-slate-300'}">${p.name}</span>
                    </div>
                    <div class="bg-[#fbbf24] text-black px-2 py-0.5 rounded-lg text-xs font-black">${val}</div>
                </div>`;
            });
            html += `</div></div>`;

            // SECTION 5: GRAND TOTAL
            if (data.showGrandTotal !== false) { 
                html += `<div class="mb-8"><div class="text-[10px] font-black uppercase text-green-500 tracking-widest mb-1 pl-2">LEADERBOARD</div>`;
                html += `<div class="bg-gradient-to-b from-green-900/20 to-transparent rounded-xl border border-green-500/20 divide-y divide-green-500/10">`;
                grandOrder.forEach((p, i) => {
                    html += `<div class="p-3 flex justify-between items-center">
                        <div class="flex items-center gap-3">
                            <span class="text-[10px] font-black w-4 text-green-700">${i+1}</span>
                            <span class="font-bold text-sm ${p.name===myName?'text-green-400':'text-white'}">${p.name} ${p.submitted?'':'...'}</span>
                        </div>
                        <span class="font-black text-green-500">${p.grandTotal||0}</span>
                    </div>`;
                });
                html += `</div></div>`;
            } else {
                html += `<div class="mb-8 text-center text-xs text-slate-500 font-bold italic opacity-50">Family Mode Active (Leaderboard Hidden)</div>`;
            }

            // SECTION 6: WAITING FOR
            const waitingFor = players.filter(p => !p.submitted);
            if(waitingFor.length > 0) {
                 html += `<div class="mt-8 text-center animate-pulse"><div class="text-[10px] font-black uppercase text-red-500 tracking-widest mb-2">WAITING FOR</div><div class="text-slate-400 text-xs font-bold">${waitingFor.map(p => p.name).join(', ')}</div></div>`;
            }

            listContainer.innerHTML = html;

            const hostBtn = document.getElementById('host-next-btn');
            const msg = document.getElementById('waiting-msg');
            
            if (multiplayerConfig.isHost) {
                hostBtn.classList.remove('hidden');
                msg.classList.add('hidden');
            } else {
                hostBtn.classList.add('hidden');
                msg.classList.remove('hidden');
            }

        } else {
            waitingEl.classList.add('hidden');
            app.classList.remove('hidden');
        }
    }
}

// --- HOST SETTINGS UI (REFACTORED) ---

function openHostSettings(isSetupMode = false) {
    if(!multiplayerConfig.isHost) return;

    let overlay = document.getElementById('host-settings-overlay');
    if(!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'host-settings-overlay';
        overlay.className = 'modal-overlay animate-fadeIn';
        overlay.innerHTML = `<div id="host-settings-content" class="action-popup w-[90%] max-w-[350px]"></div>`;
        document.body.appendChild(overlay);
    }
    renderHostSettingsContent(isSetupMode);
}

function renderHostSettingsContent(isSetupMode) {
    const container = document.getElementById('host-settings-content');
    if(!container) return;

    get(ref(db, `games/${multiplayerConfig.code}`)).then((snap) => {
        const data = snap.val();
        if(!data) return;
        const order = data.playerOrder || [];
        const pCount = data.targetCount || 4; 
        const gameCode = multiplayerConfig.code; 
        const showGT = data.showGrandTotal !== false; 

        container.innerHTML = `
        <h2 class="text-2xl font-black mb-2">${isSetupMode ? 'SEATING CHART' : 'HOST SETTINGS'}</h2>
        
        <div class="mb-6 bg-white/5 p-3 rounded-xl border border-white/10 text-center">
            <div class="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1">JOIN CODE</div>
            <div class="text-4xl font-black text-white tracking-widest select-all">${gameCode}</div>
        </div>

        ${isSetupMode ? '<p class="text-xs text-slate-400 mb-6">Arrange players starting from your Left (Clockwise)</p>' : ''}
        
        <div class="mb-4">
            <div class="flex justify-between items-center mb-2">
                 <span class="text-[10px] font-black uppercase opacity-60">Player Count</span>
            </div>
            <div class="flex items-center justify-between bg-black/20 p-2 rounded-xl border border-white/10">
                <button onclick="adjustLobbyCount(-1)" class="w-10 h-10 bg-white text-black font-black rounded-lg">-</button>
                <span class="font-black text-xl">${pCount} <span class="text-[10px] opacity-50">PLAYERS</span></span>
                <button onclick="adjustLobbyCount(1)" class="w-10 h-10 bg-white text-black font-black rounded-lg">+</button>
            </div>
        </div>

        <div class="mb-6">
            <button onclick="toggleScoreVisibility()" class="w-full flex items-center justify-between bg-black/20 p-3 rounded-xl border border-white/10">
                <div class="text-left">
                    <div class="text-xs font-black text-white uppercase">Grand Totals</div>
                    <div class="text-[10px] text-slate-400">${showGT ? 'Visible (Competitive)' : 'Hidden (Family Mode)'}</div>
                </div>
                <div class="w-10 h-6 rounded-full relative transition-colors ${showGT ? 'bg-green-500' : 'bg-slate-600'}">
                    <div class="absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${showGT ? 'translate-x-4' : ''}"></div>
                </div>
            </button>
        </div>

        <div class="mb-6">
             <div class="text-[10px] font-black uppercase opacity-60 mb-2 text-left">Player Order (Drag/Move)</div>
             <div id="host-order-list" class="flex flex-col gap-2 max-h-[150px] overflow-y-auto">
                 ${order.map((p, i) => `
                 <div class="flex items-center gap-2 bg-white/5 p-2 rounded-lg border border-white/10">
                    <span class="text-[10px] font-bold w-4 text-slate-500">${i+1}</span>
                    <span class="flex-1 text-left font-bold text-sm truncate">${p}</span>
                    <div class="flex gap-1">
                        <button onclick="movePlayerOrder(${i}, -1)" class="w-8 h-8 bg-black/20 hover:bg-white/20 rounded text-[10px]">▲</button>
                        <button onclick="movePlayerOrder(${i}, 1)" class="w-8 h-8 bg-black/20 hover:bg-white/20 rounded text-[10px]">▼</button>
                    </div>
                 </div>`).join('')}
             </div>
        </div>
        
        <div class="flex flex-col gap-3">
            <button onclick="closeHostSettings()" class="w-full bg-green-600 py-3 rounded-xl font-black text-white uppercase text-sm shadow-lg">Save & Close</button>
            ${!isSetupMode ? '<button onclick="exitHostGame()" class="w-full bg-red-900/50 text-red-400 py-3 rounded-xl font-black uppercase text-xs border border-red-500/30">Exit to Main Menu</button>' : ''}
        </div>`;
    });
}

function movePlayerOrder(index, direction) {
    const list = [...multiplayerConfig.playerOrder];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= list.length) return;
    [list[index], list[targetIndex]] = [list[targetIndex], list[index]];
    multiplayerConfig.playerOrder = list;
    savePlayerOrder();
    
    const container = document.getElementById('host-settings-content'); 
    const isSetup = container && container.innerHTML.includes('SEATING CHART');
    renderHostSettingsContent(isSetup);
}

function savePlayerOrder() {
    update(ref(db, `games/${multiplayerConfig.code}`), { playerOrder: multiplayerConfig.playerOrder });
}

function closeHostSettings() {
    const el = document.getElementById('host-settings-overlay');
    if(el) el.remove();
}

function exitHostGame() {
    if(confirm("End game for everyone?")) {
        window.location.reload();
    }
}

async function hostPushNextRound() {
    const snap = await get(ref(db, `games/${multiplayerConfig.code}`));
    const currentR = snap.val().roundNum;
    
    const updates = {};
    updates[`games/${multiplayerConfig.code}/roundNum`] = currentR + 1;
    for (let p in snap.val().players) {
        updates[`games/${multiplayerConfig.code}/players/${p}/submitted`] = false;
    }
    await update(ref(db), updates);
}

function editMyScore() {
    multiplayerConfig.hasSubmitted = false;
    update(ref(db, `games/${multiplayerConfig.code}/players/${myName}`), { submitted: false });
}

function leaveLobby() {
    if(confirm("Leave game?")) window.location.reload();
}

// --- Standard Game Logic ---
function openGameActions(index) {
    const overlay = document.createElement('div');
    overlay.id = 'action-modal';
    overlay.className = 'modal-overlay animate-fadeIn';
    overlay.onclick = (e) => { if(e.target === overlay) overlay.remove(); };
    overlay.innerHTML = `<div class="action-popup">
        <h2 class="text-2xl font-black mb-2">${games[index].mode.toUpperCase()} MODE</h2>
        <p class="text-[10px] font-black uppercase opacity-40 tracking-[0.2em] mb-8">Game #${games.length - index}</p>
        <div class="flex justify-center gap-10">
            <button onclick="resumeGame(${index})" class="w-20 h-20 bg-green-600 rounded-3xl flex flex-col items-center justify-center text-white shadow-lg active:scale-90 transition-all">
                <svg class="w-8 h-8 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"></path></svg>
                <span class="text-[8px] font-black uppercase mt-1">Play</span>
            </button>
            <button onclick="confirmDelete(${index})" class="w-20 h-20 rounded-3xl flex flex-col items-center justify-center text-white shadow-lg active:scale-90 transition-all" style="background-color: var(--color-danger)">
                <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                <span class="text-[8px] font-black uppercase mt-1">Delete</span>
            </button>
        </div>
    </div>`;
    document.body.appendChild(overlay);
}

function resumeGame(i) {
    activeGame = games[i];
    
    if (activeGame.mpCode) {
        multiplayerConfig.active = true;
        multiplayerConfig.code = activeGame.mpCode;
        multiplayerConfig.isHost = activeGame.isHost || false;
        
        onValue(ref(db, `games/${activeGame.mpCode}`), syncLobby);
        
        const m = document.getElementById('action-modal');
        if (m) m.remove();
    } else {
        multiplayerConfig.active = false; 
        const m = document.getElementById('action-modal');
        if (m) m.remove();
        renderGame();
        setActiveInput('yellow'); 
    }
}

function confirmDelete(index) {
    if (confirm("Permanently delete this game?")) {
        games.splice(index, 1);
        saveGame();
        const modal = document.getElementById('action-modal');
        if (modal) modal.remove();
        showHome();
    }
}

function openNewGameModal() {
    const overlay = document.createElement('div');
    overlay.id = 'mode-modal';
    overlay.className = 'modal-overlay animate-fadeIn';
    overlay.onclick = (e) => { if(e.target === overlay) overlay.remove(); };
    overlay.innerHTML = `<div class="action-popup">
        <h2 class="text-2xl font-black mb-8">Select Mode</h2>
        <div class="flex flex-col gap-4">
            <button onclick="initGame('normal')" class="w-full py-5 bg-slate-200 text-slate-900 rounded-2xl font-black text-xl shadow-md active:scale-95 transition-all">NORMAL</button>
            <button onclick="initGame('expansion')" class="w-full py-5 bg-gradient-to-r from-purple-600 to-red-500 text-white rounded-2xl font-black text-xl shadow-lg active:scale-95 transition-all">EXPANSION</button>
        </div>
    </div>`;
    document.body.appendChild(overlay);
}

function initGame(mode, suppressRender = false) {
    if(document.getElementById('mode-modal')) document.getElementById('mode-modal').remove();
    activeGame = { 
        id: Date.now(), mode: mode,
        date: new Date().toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }), 
        currentRound: 0, 
        rounds: Array(10).fill(null).map(() => ({ 
            yellow: [], purple: [], blue: [], red: [], green: [], clear: [], pink: [], sage: [], 
            wild: [], blueHasSparkle: false 
        })) 
    }; 
    games.unshift(activeGame); 
    saveGame(); 
    if(!suppressRender) {
        renderGame();
        setActiveInput('yellow');
    }
}

function calculateSageProgress(round) {
    const usedColors = new Set();
    diceConfig.forEach(d => { if (round[d.id] && round[d.id].length > 0) usedColors.add(d.id); });
    if (round.wild) { round.wild.forEach(w => { if (w.value !== 0) usedColors.add(w.target); }); }
    return { count: usedColors.size, percentage: Math.min(100, (usedColors.size / 6) * 100) };
}

function isSageAlreadyCompleteBy(roundIdx) {
    if (!activeGame || activeGame.mode !== 'expansion') return false;
    return activeGame.rounds.slice(0, roundIdx + 1).some(r => calculateSageProgress(r).count >= 6);
}

function showResults() {
    const grandTotal = calculateGrandTotal(activeGame);
    const roundList = activeGame.rounds.map((r, i) => `
        <div class="flex justify-between items-center p-4 bg-black/5 rounded-2xl border border-[var(--border-ui)]">
            <span class="text-xs font-black uppercase opacity-40">Round ${i + 1}</span>
            <span class="text-xl font-black">${calculateRoundTotal(r)}</span>
        </div>`).join('');

    app.innerHTML = `<div class="p-6 h-full flex flex-col animate-fadeIn overflow-y-auto">
        <div class="flex justify-between items-center mb-8">
            <button onclick="renderGame()" class="p-2 bg-black/5 rounded-xl"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="3" d="M15 19l-7-7 7-7"></path></svg></button>
            <h1 class="text-xl font-black uppercase tracking-widest">Final Results</h1><div class="w-10"></div>
        </div>
        <div class="text-center mb-10 py-8 bg-green-600 rounded-[40px] shadow-xl text-white">
            <span class="text-[10px] font-black uppercase opacity-70 tracking-[0.3em]">Grand Total Score</span>
            <div class="text-7xl font-black mt-2">${grandTotal}</div>
        </div>
        <div class="flex-1 space-y-3 mb-8">${roundList}</div>
        <button onclick="showHome()" class="w-full bg-slate-800 py-5 rounded-3xl font-black text-xl text-white mb-6 shadow-lg">BACK TO HISTORY</button>
    </div>`;
}

// --- Render Engine ---
function renderGame() {
    const roundNum = activeGame.currentRound + 1;
    const roundData = activeGame.rounds[activeGame.currentRound];
    const isExpansion = activeGame.mode === 'expansion';
    const sageGlobalStatus = isExpansion ? isSageAlreadyCompleteBy(activeGame.currentRound) : false;
    const sageUnlocked = isExpansion && activeGame.currentRound > 0 && isSageAlreadyCompleteBy(activeGame.currentRound - 1);
    const isLastRound = roundNum === 10;
     
    let leftAction, rightAction;

    if (multiplayerConfig.active) {
        if (multiplayerConfig.isHost) {
            leftAction = `<button onclick="openHostSettings()" class="text-[10px] font-black uppercase px-3 py-2 rounded-lg bg-black/5 text-slate-500 flex items-center gap-1">⚙️ HOST</button>`;
        } else {
            leftAction = `<button onclick="leaveLobby()" class="text-[10px] font-black uppercase opacity-50 px-3 py-2 rounded-lg bg-black/5">EXIT</button>`;
        }
        rightAction = `<button onclick="submitMultiplayerRound()" class="bg-green-500 text-white font-black text-xs px-5 py-2 rounded-lg shadow-lg hover:bg-green-400 transition-colors uppercase tracking-wider">SUBMIT</button>`;
    
    } else {
        const leftChevron = `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M15 19l-7-7 7-7"></path></svg>`;
        const rightChevron = `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M9 5l7 7-7 7"></path></svg>`;
        const nextBtn = isLastRound 
            ? `<button onclick="showResults()" class="px-4 py-2 bg-green-600 text-white text-[10px] font-black uppercase rounded-lg shadow-lg">Results</button>`
            : `<button onclick="changeRound(1)" class="nav-btn">${rightChevron}</button>`;
        leftAction = `<button onclick="showHome()" class="text-[10px] font-black uppercase opacity-50 px-3 py-2 rounded-lg bg-black/5">Exit</button>`;
    }

    let reviewSectionHtml = '';
    if (activeGame.currentRound > 0) {
        const pr = activeGame.rounds[activeGame.currentRound - 1];
        reviewSectionHtml += `
            <div class="animate-fadeIn">
                <div class="prev-round-box"><span>Prev Round Yellow Total</span><span class="text-xl">${(pr.yellow || []).reduce((a,b)=>a+b,0)}</span></div>
                <div class="prev-total-box"><span>Last Round Total Score</span><span class="text-xl">${calculateRoundTotal(pr)}</span></div>
            </div>`;
    }

    if (isExpansion && roundNum >= 2 && sageGlobalStatus) {
        reviewSectionHtml += `
            <div class="prev-round-box bg-yellow-500 text-black border-none mb-3 py-3 animate-fadeIn flex justify-between items-center shadow-md">
                <span class="text-[10px] font-black uppercase tracking-widest">Sage Quest</span>
                <span class="text-xs font-black tracking-tighter italic decoration-black underline"> COMPLETE ✓ </span>
            </div>`;
    }

    let progressSectionHtml = '';
    if (isExpansion && roundNum >= 2 && !sageGlobalStatus) {
        progressSectionHtml = `
            <div id="sage-container" class="mt-8 mb-4 p-4 bg-black/5 rounded-3xl border border-[var(--border-ui)] animate-fadeIn">
                <div class="flex justify-between items-end mb-2">
                    <span class="text-[10px] font-black uppercase tracking-widest opacity-60">Sage Progress</span>
                    <span id="sage-status-text" class="text-xs font-black uppercase">0/6 Used</span>
                </div>
                <div class="h-4 w-full bg-black/10 rounded-full overflow-hidden">
                    <div id="sage-progress-fill" class="h-full transition-all duration-500" style="width: 0%"></div>
                </div>
            </div>`;
    }

    let diceRowsHtml = (roundNum === 1) 
        ? `<div class="animate-fadeIn">${renderDiceRow(diceConfig[0], roundData)}</div><div class="mt-12 text-center animate-fadeIn px-4"><div class="${isExpansion ? 'expansion-gradient' : 'text-slate-400'} text-5xl font-black uppercase tracking-tight">${isExpansion ? 'Expansion Pack<br>Edition' : 'Normal Game'}</div></div>`
        : diceConfig.map((dice, idx) => `<div class="animate-fadeIn">${renderDiceRow(dice, roundData)}</div>`).join('');
     
    if (sageUnlocked && roundNum > 1) {
        diceRowsHtml += `<div class="mt-6 pt-6 border-t-4 border-yellow-500/20 animate-fadeIn">${renderDiceRow(sageDiceConfig, roundData)}</div>`;
    }

    let topBarContent;
    if (multiplayerConfig.active) {
        topBarContent = `
            ${leftAction}
            <div class="text-center">
                <div class="text-xl font-black uppercase">Round ${roundNum}</div>
                <div id="round-total-display" class="text-5xl font-black">0</div>
            </div>
            ${rightAction}
        `;
    } else {
        const leftChevron = `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M15 19l-7-7 7-7"></path></svg>`;
        const rightChevron = `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M9 5l7 7-7 7"></path></svg>`;
        const nextBtn = isLastRound 
            ? `<button onclick="showResults()" class="px-4 py-2 bg-green-600 text-white text-[10px] font-black uppercase rounded-lg shadow-lg">Results</button>`
            : `<button onclick="changeRound(1)" class="nav-btn">${rightChevron}</button>`;
        
        topBarContent = `
            <button onclick="showHome()" class="text-[10px] font-black uppercase opacity-50 px-3 py-2 rounded-lg bg-black/5">Exit</button>
            <div class="flex items-center gap-6">
                <button onclick="changeRound(-1)" class="nav-btn ${roundNum === 1 ? 'disabled' : ''}">${leftChevron}</button>
                <div class="text-center">
                    <div class="text-xl font-black uppercase">Round ${roundNum}</div>
                    <div id="round-total-display" class="text-5xl font-black">0</div>
                </div>
                ${nextBtn}
            </div>
            <div class="w-10"></div>
        `;
    }

    app.innerHTML = `<div class="scroll-area" id="game-scroll">
        <div class="sticky top-0 bg-inherit backdrop-blur-md z-50 p-5 border-b border-[var(--border-ui)] flex justify-between items-center">
            ${topBarContent}
        </div>
        <div class="p-4 pb-8">
            ${reviewSectionHtml}
            <div class="section-title animate-fadeIn"><h3>Dice Calculators</h3></div>
            <div class="space-y-3">
                ${diceRowsHtml}
                ${progressSectionHtml}
                <div id="wild-section" class="wild-section-container animate-fadeIn ${(!isExpansion || roundNum < 2) ? 'hidden' : ''}">
                    <div class="wild-counter-inline shadow-sm"><span class="text-[10px] font-black uppercase opacity-60">Wild Dice Qty</span><div class="flex items-center gap-5"><button onclick="adjustWildCount(-1)" class="wild-btn-minus">-</button><span id="wild-count-num" class="font-black text-2xl">${(roundData.wild || []).length}</span><button onclick="adjustWildCount(1)" class="wild-btn-plus">+</button></div></div>
                    <div class="wild-stack" id="wild-list-container">${(roundData.wild || []).map((w, idx) => renderWildCardHtml(w, idx)).join('')}</div>
                </div>
            </div><div class="grand-total-footer animate-fadeIn"><span class="text-[10px] font-black uppercase opacity-50 block mb-1">Grand Total</span><span id="grand-total-box" class="text-5xl font-black">0</span></div>
        </div>
    </div>
    <div id="keypad-container" class="keypad-area p-4 flex flex-col"><div id="active-input-display" class="text-center text-lg font-black mb-3 h-6 tracking-widest uppercase opacity-60">-</div><div class="grid grid-cols-4 gap-2 flex-1">${[1,2,3].map(n => `<button onclick="kpInput('${n}')" class="kp-btn bg-black/5 text-inherit text-3xl">${n}</button>`).join('')}<button id="add-btn" onclick="kpEnter()" class="kp-btn bg-green-600 text-white row-span-4 h-full">ADD</button>${[4,5,6].map(n => `<button onclick="kpInput('${n}')" class="kp-btn bg-black/5 text-inherit text-3xl">${n}</button>`).join('')}${[7,8,9].map(n => `<button onclick="kpInput('${n}')" class="kp-btn bg-black/5 text-inherit text-3xl">${n}</button>`).join('')}<button onclick="kpClear()" class="kp-btn bg-black/5 text-lg font-bold text-slate-400">CLR</button><button onclick="kpInput('0')" class="kp-btn bg-black/5 text-inherit text-3xl">0</button><button onclick="kpToggleNeg()" class="kp-btn bg-black/5 text-inherit text-2xl">+/-</button></div></div>`;
     
    if (!activeInputField) { setActiveInput('yellow'); }
    updateAllDisplays();
}

function updateAllDisplays() {
    const round = activeGame.rounds[activeGame.currentRound];
    if (!round) return;
    const isExpansion = activeGame.mode === 'expansion';
    if (isExpansion) {
        const sage = calculateSageProgress(round);
        const sText = document.getElementById('sage-status-text');
        const sFill = document.getElementById('sage-progress-fill');
        if (sText) {
            sText.textContent = `${sage.count}/6 Used${sage.count >= 6 ? ' - SAGE! ✨' : ''}`;
            sText.className = `text-xs font-black uppercase ${sage.count >= 6 ? 'text-yellow-500' : 'text-green-500'}`;
        }
        if (sFill) {
            sFill.style.width = `${sage.percentage}%`;
            sFill.className = `h-full transition-all duration-500 ${sage.count >= 6 ? 'bg-gradient-to-r from-amber-300 via-yellow-500 to-amber-600' : 'bg-gradient-to-r from-green-500 to-emerald-400'}`;
        }
    }
    const wildBonuses = {};
    (round.wild || []).forEach((w, i) => {
        wildBonuses[w.target] = (wildBonuses[w.target] || 0) + (w.value || 0);
        const displays = document.querySelectorAll('.wild-val-display');
        if (displays[i]) displays[i].textContent = w.value || 0;
    });
    [...diceConfig, sageDiceConfig].forEach(d => {
        const sumEl = document.getElementById(`${d.id}-sum`);
        if (!sumEl) return;
        const vals = round[d.id] || [];
        let base = (vals.reduce((a, b) => a + b, 0)) + (wildBonuses[d.id] || 0);
        let score = (d.id==='purple'||(d.id==='blue'&&round.blueHasSparkle)) ? base*2 : (d.id==='red' ? base*vals.length : base);
        sumEl.textContent = score;
        const valBox = document.getElementById(`${d.id}-values`);
        if (valBox) valBox.innerHTML = vals.map((v, i) => `<span class="inline-flex items-center bg-black/10 px-5 py-3 rounded-2xl text-xl font-black border border-black/5">${v} <button onclick="event.stopPropagation(); removeVal('${d.id}', ${i})" class="ml-4 w-8 h-8 flex items-center justify-center bg-black/20 rounded-full text-lg opacity-60 active:bg-red-500 active:text-white">×</button></span>`).join('');
    });
    document.getElementById('round-total-display').textContent = calculateRoundTotal(round);
    document.getElementById('grand-total-box').textContent = calculateGrandTotal(activeGame);
}

// --- Interaction Helpers ---
function updateKeypadTheme(bgColor, textColor) {
    const keys = document.querySelectorAll('.kp-btn:not(#add-btn)');
    keys.forEach(k => {
        k.style.backgroundColor = bgColor;
        k.style.color = textColor;
        k.style.border = (bgColor === '#ffffff' || bgColor === 'white') ? "1px solid rgba(0,0,0,0.1)" : "none";
    });
}

// --- SUBMISSION LOGIC ---

async function submitMultiplayerRound() {
    if(!multiplayerConfig.active) return;
    if(!confirm("Submit score for this round?")) return;

    const currentRData = activeGame.rounds[activeGame.currentRound];
    const rTotal = calculateRoundTotal(currentRData);
    const gTotal = calculateGrandTotal(activeGame);
    const yTotal = (currentRData.yellow || []).reduce((a, b) => a + b, 0);
    const hasNaturalClear = (currentRData.clear || []).length > 0;
    const hasWildClear = (currentRData.wild || []).some(w => w.target === 'clear');
    const clrUsed = hasNaturalClear || hasWildClear;
    
    multiplayerConfig.hasSubmitted = true;
    
    await update(ref(db, `games/${multiplayerConfig.code}/players/${myName}`), {
        submitted: true,
        roundScore: rTotal,
        grandTotal: gTotal,
        yellowScore: yTotal,
        clearUsed: clrUsed
    });
}

async function changeRound(s) { 
    if (!multiplayerConfig.active) {
        const n = activeGame.currentRound + s; 
        if (n < 0 || n >= 10) return;
        setActiveInput('yellow'); 
        if (activeGame.mode === 'expansion' && s === 1) {
            const sageNow = calculateSageProgress(activeGame.rounds[activeGame.currentRound]).count >= 6;
            const completedPreviously = activeGame.rounds.slice(0, activeGame.currentRound).some(r => calculateSageProgress(r).count >= 6);
            if (sageNow && !completedPreviously) showSagePopup();
        }
        activeGame.currentRound = n; saveGame(); renderGame(); 
    }
}

function adjustWildCount(delta) {
    const rd = activeGame.rounds[activeGame.currentRound];
    if (!rd.wild) rd.wild = [];
    if (rd.wild.length + delta < 0 || rd.wild.length + delta > 9) return;
    if (delta > 0) { rd.wild.push({ value: 0, target: 'purple' }); setActiveWildInput(0); }
    else { rd.wild.pop(); if (activeInputField && activeInputField.startsWith('wild-')) setActiveInput('yellow'); }
    saveGame();
    const container = document.getElementById('wild-list-container');
    if (container) container.innerHTML = rd.wild.map((w, idx) => renderWildCardHtml(w, idx)).join('');
    document.getElementById('wild-count-num').textContent = rd.wild.length;
    updateAllDisplays();
}

function toggleSparkle() {
    const rd = activeGame.rounds[activeGame.currentRound];
    rd.blueHasSparkle = !rd.blueHasSparkle;
    setActiveInput('blue');
    const btn = document.getElementById('sparkle-btn');
    if (btn) {
        btn.innerHTML = rd.blueHasSparkle ? 'Sparkle Activated ✨' : 'Add Sparkle?';
        btn.className = `sparkle-btn-full ${rd.blueHasSparkle ? 'sparkle-on' : 'sparkle-off'}`;
    }
    updateAllDisplays(); saveGame();
}

function setWildTarget(idx, targetId) {
    activeGame.rounds[activeGame.currentRound].wild[idx].target = targetId;
    setActiveWildInput(idx);
    const card = document.getElementById(`wild-card-${idx}`);
    if (card) {
        const color = diceConfig.find(d => d.id === targetId).color;
        card.style.borderLeftColor = color;
        const configFiltered = diceConfig.filter(d => d.id !== 'yellow');
        card.querySelectorAll('.wheel-item').forEach((dot, i) => dot.classList.toggle('selected', configFiltered[i].id === targetId));
    }
    updateAllDisplays(); saveGame();
}

function setActiveWildInput(idx) {
    activeInputField = `wild-${idx}`;
    document.querySelectorAll('.wild-card').forEach((c, i) => c.classList.toggle('active-input', i === idx));
    document.querySelectorAll('.dice-row').forEach(r => { r.style.backgroundColor = ""; r.style.color = ""; });
    updateKeypadTheme("#ffffff", "#000000"); updateKpDisplay();
}

function setActiveInput(id) {
    activeInputField = id;
    document.querySelectorAll('.wild-card').forEach(c => c.classList.remove('active-input'));
    const all = [...diceConfig, sageDiceConfig];
    const config = all.find(d => d.id === id);
    document.querySelectorAll('.dice-row').forEach(r => { r.style.backgroundColor = ""; r.style.color = ""; });
    const row = document.getElementById(`row-${id}`);
    if (row) { row.style.backgroundColor = config.color; row.style.color = config.text; }
    updateKeypadTheme(config.color, config.text); updateKpDisplay();
}

function renderDiceRow(dice, roundData) {
    const isBlue = dice.id === 'blue';
    const sparkleBtn = isBlue ? `<button id="sparkle-btn" onclick="event.stopPropagation(); toggleSparkle()" class="sparkle-btn-full ${roundData.blueHasSparkle ? 'sparkle-on' : 'sparkle-off'}">${roundData.blueHasSparkle ? 'Sparkle Activated ✨' : 'Add Sparkle?'}</button>` : '';
    return `<div onclick="setActiveInput('${dice.id}')" id="row-${dice.id}" class="dice-row p-5 rounded-2xl border-l-8 border-transparent cursor-pointer"><div class="flex justify-between items-center"><span class="font-black uppercase tracking-tight">${dice.label}</span><span id="${dice.id}-sum" class="text-3xl font-black">0</span></div><div id="${dice.id}-values" class="flex flex-wrap gap-3 mt-3 min-h-[10px]"></div>${sparkleBtn}</div>`;
}

function renderWildCardHtml(w, idx) {
    const color = diceConfig.find(d => d.id === w.target).color;
    return `<div onclick="setActiveWildInput(${idx})" id="wild-card-${idx}" class="wild-card ${activeInputField === 'wild-'+idx ? 'active-input' : ''}" style="border-left: 8px solid ${color}"><div class="flex justify-between items-start"><span class="text-[10px] font-black uppercase opacity-40">Wild #${idx+1}</span><span class="text-3xl font-black wild-val-display">${w.value || 0}</span></div><div class="color-picker-wheel">${diceConfig.filter(d => d.id !== 'yellow').map(d => `<div onclick="event.stopPropagation(); setWildTarget(${idx}, '${d.id}')" class="wheel-item ${w.target === d.id ? 'selected' : ''}" style="background-color: ${d.color}"></div>`).join('')}</div></div>`;
}

// --- Utils & Settings ---
function calculateRoundTotal(round) {
    let total = 0;
    const wildBonuses = {};
    (round.wild || []).forEach(w => { wildBonuses[w.target] = (wildBonuses[w.target] || 0) + (w.value || 0); });
    [...diceConfig.map(d => d.id), 'sage'].forEach(id => {
        const vals = round[id] || [];
        let base = (vals.reduce((a, b) => a + b, 0)) + (wildBonuses[id] || 0);
        if (id === 'purple') total += (base * 2);
        else if (id === 'blue' && round.blueHasSparkle) total += (base * 2);
        else if (id === 'red') total += (base * vals.length);
        else total += base;
    });
    return total;
}
function calculateGrandTotal(g) { return (g.rounds || []).reduce((t, r) => t + calculateRoundTotal(r), 0); }
function kpInput(v) { keypadValue += v; updateKpDisplay(); }
function kpClear() { keypadValue = ''; updateKpDisplay(); }
function kpToggleNeg() { keypadValue = keypadValue.startsWith('-') ? keypadValue.substring(1) : (keypadValue ? '-' + keypadValue : '-'); updateKpDisplay(); }
function updateKpDisplay() { const d = document.getElementById('active-input-display'); if (d) d.textContent = keypadValue || (activeInputField ? `Adding to ${activeInputField.toUpperCase()}` : '-'); }
function kpEnter() {
    if (!activeInputField || !keypadValue || keypadValue === '-') return;
    const rd = activeGame.rounds[activeGame.currentRound];
    if (activeInputField.startsWith('wild-')) rd.wild[parseInt(activeInputField.split('-')[1])].value = parseFloat(keypadValue);
    else rd[activeInputField].push(parseFloat(keypadValue));
    kpClear(); updateAllDisplays(); saveGame();
}
function removeVal(id, idx) { activeGame.rounds[activeGame.currentRound][id].splice(idx, 1); setActiveInput(id); updateAllDisplays(); saveGame(); }
function saveGame() { localStorage.setItem('panda_games', JSON.stringify(games)); }
function setTheme(t) { settings.theme = t; applySettings(); toggleMenu(); showHome(); }
function toggleMenu() {
    const existing = document.getElementById('menu-overlay');
    if (existing) { existing.remove(); return; }
     
    const menu = document.createElement('div');
    menu.id = 'menu-overlay';
    menu.className = 'fixed inset-0 z-[4000] bg-black/40 backdrop-blur-md flex justify-end animate-fadeIn';
    menu.onclick = (e) => { if (e.target === menu) menu.remove(); };

    menu.innerHTML = `
        <div class="menu-panel w-72 h-full bg-[var(--bg-main)] border-l border-[var(--border-ui)] p-8 flex flex-col shadow-2xl" onclick="event.stopPropagation()">
            <h2 class="text-xl font-black uppercase mb-8 tracking-tight">Settings</h2>
            <div class="space-y-4">
                <button onclick="setTheme('dark')" class="w-full text-left p-4 rounded-2xl border-2 transition-all ${settings.theme === 'dark' ? 'border-green-600 bg-green-600/10' : 'border-black/5'}">
                    <span class="font-bold text-sm">Dark Navy</span>
                </button>
                <button onclick="setTheme('light')" class="w-full text-left p-4 rounded-2xl border-2 transition-all ${settings.theme === 'light' ? 'border-blue-600 bg-blue-600/10' : 'border-black/5'}">
                    <span class="font-bold text-sm">Off-White</span>
                </button>
            </div>
            <div class="mt-auto space-y-3">
                <button onclick="showOnboarding(1)" class="w-full p-4 bg-blue-600/10 text-blue-500 rounded-2xl font-black text-xs uppercase tracking-widest">
                    Replay Instructions
                </button>
                <a href="https://dallinnd.github.io/DandaDoyale/privacy.html" target="_blank" onclick="document.getElementById('menu-overlay').remove()" class="w-full p-4 bg-black/5 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-widest block text-center no-underline">
                    Privacy Policy
                </a>
                <button onclick="clearHistory()" class="w-full p-4 text-red-500 font-bold text-xs italic opacity-60 hover:opacity-100 transition-opacity">
                    Clear All History
                </button>
            </div>
        </div>`;
    document.body.appendChild(menu);
}
function clearHistory() {
    if (confirm("Delete ALL history?")) {
        const m = document.getElementById('menu-overlay');
        if (m) m.remove();
        games = []; saveGame(); showHome();
    }
}
function showSagePopup() {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black/40 backdrop-blur-2xl z-[2000] flex items-center justify-center animate-fadeIn cursor-pointer';
    overlay.onclick = () => overlay.remove();
    overlay.innerHTML = `<div class="w-[85%] max-w-[320px] bg-white border-4 border-yellow-500 rounded-[40px] p-8 text-center shadow-2xl"><div class="flex flex-col items-center gap-6"><div class="w-24 h-24 bg-gradient-to-tr from-amber-400 to-yellow-600 rounded-full flex items-center justify-center text-white shadow-xl ring-4 ring-yellow-200"><svg class="w-14 h-14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="4" d="M5 13l4 4L19 7"></path></svg></div><div><h2 class="text-3xl font-black text-yellow-600 tracking-tighter mb-1">SAGE QUEST</h2><h3 class="text-xl font-black uppercase text-slate-400">COMPLETE</h3></div><p class="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">Tap anywhere to continue</p></div></div>`;
    document.body.appendChild(overlay);
}

applySettings();
showSplash();
