// ─────────────────────────────────────────
// SETTINGS
// ─────────────────────────────────────────
const SETTINGS_KEY = 'crimson_desert_settings';

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? Object.assign({ precision: 'normal', showCheats: false }, JSON.parse(raw)) : { precision: 'normal', showCheats: false };
  } catch(e) { return { precision: 'normal', showCheats: false }; }
}

const settings = loadSettings();

let MC_SAMPLES = settings.precision === 'high' ? 10000 : settings.precision === 'low' ? 1500 : 6000;

function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch(e) {}
}

function openSettings() {
  document.getElementById('settings-overlay').classList.add('open');
  document.getElementById('settings-panel').classList.add('open');
  updateSettingsUI();
}

function closeSettings() {
  document.getElementById('settings-overlay').classList.remove('open');
  document.getElementById('settings-panel').classList.remove('open');
}

function setPrecision(level) {
  settings.precision = level;
  MC_SAMPLES = level === 'high' ? 10000 : level === 'low' ? 1500 : 6000;
  saveSettings();
  updateSettingsUI();

  logAnalyticsEvent('change_precision', {
    precision_level: level,
    sample_count: MC_SAMPLES
  });
}

function updateSettingsUI() {
  document.getElementById('prec-high')?.classList.toggle('active', settings.precision === 'high');
  document.getElementById('prec-normal')?.classList.toggle('active', settings.precision === 'normal');
  document.getElementById('prec-low')?.classList.toggle('active', settings.precision === 'low');
  document.getElementById('toggle-cheats')?.classList.toggle('on', settings.showCheats);
}

function toggleSetting(key) {
  settings[key] = !settings[key];
  saveSettings();
  updateSettingsUI();
  if (key === 'showCheats') applyCheatVisibility();

  logAnalyticsEvent('change_setting', {
    setting_key: key,
    new_value: settings[key]
  });
}

function applyCheatVisibility() {
  const show = settings.showCheats;
  const activeScreen = document.querySelector('.screen.active');
  const screenId = activeScreen ? activeScreen.id : '';
  const notOnGuide = !['screen-guide', 'screen-guide-fc'].includes(screenId);
  document.getElementById('cheats-tab')?.classList.toggle('visible', show && notOnGuide);
  if (!show) closeCheats();
}

// ─────────────────────────────────────────
// HAPTIC
// ─────────────────────────────────────────
function triggerHaptic(type) {
  if (!navigator.vibrate) return;
  if (type === 'light')   navigator.vibrate(10);
  if (type === 'medium')  navigator.vibrate(30);
  if (type === 'success') navigator.vibrate([20, 30, 20]);
}

// ─────────────────────────────────────────
// HISTORY ENGINE
// ─────────────────────────────────────────
const HISTORY_KEY = 'crimson_desert_history';
const HISTORY_MAX = 5;

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch(e) { return []; }
}

function saveHistory(entries) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(entries)); } catch(e) {}
}

function clearHistory() {
  saveHistory([]);
  renderHistorySection();
}

function addToHistory() {
  const summary = state.lastSummary;
  if (!summary) return;
  const hand = state.game === 'duo' ? state.duoHandRank?.label : state.fcHandRank?.label;
  if (!hand) return;
  const entry = {
    game:     state.game === 'duo' ? 'DUO' : '5-CARD',
    hand,
    oppCount: state.oppCount,
    winPct:   summary.winPct,
    losePct:  summary.losePct,
    ts:       Date.now()
  };
  const entries = loadHistory();
  entries.unshift(entry);
  saveHistory(entries.slice(0, HISTORY_MAX));
}

// ─────────────────────────────────────────
// ANALYTICS BRIDGE
// ─────────────────────────────────────────
function logAnalyticsEvent(name, params) {
  // If user includes Firebase JS SDK later, this will work. 
  // For now, it maps out the choices to the console for debugging
  console.log(`[Analytics Event] ${name}:`, params);
  
  if (window.gtag) {
    window.gtag('event', name, params);
  }
}

function adviceFromPcts(winPct, losePct) {
  const wr = winPct / 100, lr = losePct / 100;
  if      (wr >= 0.7)  return { text: 'BET BIG',        color: '#4ade80' };
  else if (wr >= 0.5)  return { text: 'BET MODERATE',   color: '#a8d44a' };
  else if (wr >= 0.35) return { text: 'BET CAUTIOUS',   color: '#d4c470' };
  else if (lr >= 0.7)  return { text: 'FOLD / MIN BET', color: '#f87171' };
  else                 return { text: 'PLAY SAFE',       color: '#d4a04a' };
}

function renderHistorySection() {
  const list = document.getElementById('history-list');
  if (!list) return;
  const entries = loadHistory();
  if (!entries.length) {
    list.innerHTML = '<div class="history-empty">No calculations yet.</div>';
  } else {
    let html = '';
    entries.forEach(e => {
      const adv = adviceFromPcts(parseFloat(e.winPct), parseFloat(e.losePct));
      html += `<div class="history-item">
        <span class="history-game-tag">${e.game}</span>
        <span class="history-hand">${e.hand}</span>
        <span class="history-opp">${e.oppCount} ${e.oppCount === 1 ? 'OPP' : 'OPPS'}</span>
        <span class="history-win" style="color:${adv.color}">${e.winPct}%</span>
        <span class="history-advice-dot" style="background:${adv.color}" title="${adv.text}"></span>
      </div>`;
    });
    html += `<button class="history-clear-btn" onclick="clearHistory()">CLEAR HISTORY</button>`;
    list.innerHTML = html;
  }
}

function toggleHistory() {
  const list = document.getElementById('history-list');
  const tog  = document.getElementById('history-toggle');
  const open = list.classList.toggle('open');
  tog.textContent = open ? '▲ HIDE' : '▼ SHOW';
}

// ─────────────────────────────────────────
// APP STATE
// ─────────────────────────────────────────
const state = {
  game: null,           // 'duo' | 'fc'
  oppCount: null,       // 1 | 2 | 3
  oppCards: [],         // Duo: {number, color} | FC: {number}
  duoHandRank: null,    // Duo: {type, rank, label, fallback} — selected hand
  fcHandRank: null,     // FC: {rank, label} — selected hand
  lastSummary: null,    // {winPct, losePct} — for history
};

// ─────────────────────────────────────────
// SCREEN NAVIGATION & SESSION
// ─────────────────────────────────────────
const navHistory = [];
const SESSION_KEY = 'crimson_desert_session';

function saveSession() {
  const currentScreen = document.querySelector('.screen.active')?.id;
  if (!currentScreen || currentScreen === 'screen-game' || currentScreen.includes('guide')) return;
  const sessionData = { screen: currentScreen, navHistory, state, checkerState };
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData)); } catch(e) {}
}

function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch(e) {}
}

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return false;
    const sessionData = JSON.parse(raw);
    if (!sessionData.screen || sessionData.screen === 'screen-game') return false;

    Object.assign(state, sessionData.state);
    Object.assign(checkerState, sessionData.checkerState);
    navHistory.length = 0;
    navHistory.push(...(sessionData.navHistory || []));
    
    if (state.game) {
      document.getElementById('btn-duo')?.classList.toggle('btn-selected', state.game === 'duo');
      document.getElementById('btn-fc')?.classList.toggle('btn-selected', state.game === 'fc');
      const oppsContainer = document.getElementById('opp-btns');
      if (oppsContainer) oppsContainer.innerHTML = [1,2,3].map(n => `<button class="choice-btn opp-btn" onclick="selectOpps(${n})">${n}</button>`).join('');
      document.getElementById('opp-section')?.classList.add('visible');
    }
    
    showScreen(sessionData.screen, false);
    
    if (sessionData.screen === 'screen-opphand') {
      const bc = document.getElementById('bc-opphand');
      if (bc) bc.innerHTML = breadcrumbHtml(state.game==='duo'?'DUO':'FIVE-CARD', state.oppCount, 4);
      renderOppCardsUI();
    } else if (sessionData.screen === 'screen-results') {
      const bc = document.getElementById('bc-results');
      if (bc) bc.innerHTML = breadcrumbHtml(state.game==='duo'?'DUO':'FIVE-CARD', state.oppCount, 5);
      renderResults();
    }
    return true;
  } catch(e) { return false; }
}

function showScreen(id, addToHistory = true) {
  const current = document.querySelector('.screen.active');
  if (addToHistory && current) navHistory.push(current.id);
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0, 0);
  document.getElementById('drawer-tab')?.classList.toggle('visible', id !== 'screen-guide' && id !== 'screen-guide-fc');
  document.getElementById('checker-tab')?.classList.toggle('visible', id !== 'screen-guide' && id !== 'screen-guide-fc');
  const notOnGuide = id !== 'screen-guide' && id !== 'screen-guide-fc';
  document.getElementById('cheats-tab')?.classList.toggle('visible', settings.showCheats && notOnGuide);
  const supRow = document.getElementById('fc-superior-row');
  if (id === 'screen-fc-hand' && supRow) supRow.style.display = 'none';
  closeDrawer();
  updateBackBtns();
  saveSession();

  logAnalyticsEvent('screen_view', {
    screen_id: id,
    previous_screen: current ? current.id : 'none'
  });
}

function goBack() {
  if (!navHistory.length) return;
  const prev = navHistory.pop();
  showScreen(prev, false);
}

function updateBackBtns() {
  const hasHistory = navHistory.length > 0;
  document.querySelectorAll('.back-btn').forEach(btn => {
    btn.classList.toggle('visible', hasHistory);
  });
}

// ─────────────────────────────────────────
// HANDS DRAWER
// ─────────────────────────────────────────
function openDrawer() {
  closeChecker();
  document.getElementById('drawer-overlay').classList.add('open');
  document.getElementById('drawer-panel').classList.add('open');
  const title = state.game === 'fc' ? 'FIVE-CARD HANDS' : 'DUO HANDS';
  document.getElementById('drawer-title').textContent = title;
  document.getElementById('drawer-body').innerHTML =
    state.game === 'fc' ? drawerFcHtml() : drawerDuoHtml();

  logAnalyticsEvent('open_drawer', {
    type: 'hand_rankings',
    game_mode: state.game || 'none'
  });
}

function closeDrawer() {
  document.getElementById('drawer-overlay').classList.remove('open');
  document.getElementById('drawer-panel').classList.remove('open');
}

// ─────────────────────────────────────────
// HAND CHECKER DRAWER
// ─────────────────────────────────────────
const checkerState = {
  game: 'duo',
  cards: [{number:null,color:null},{number:null,color:null}]
};

function openChecker() {
  closeDrawer();
  closeCheats();
  // Sync to current game if one is active
  if (state.game && checkerState.game !== state.game) {
    checkerState.game = state.game;
    checkerState.cards = [];
  }
  initCheckerCards();
  renderCheckerUI();
  document.getElementById('checker-overlay').classList.add('open');
  document.getElementById('checker-panel').classList.add('open');

  logAnalyticsEvent('open_drawer', {
    type: 'hand_checker'
  });
}

function closeChecker() {
  document.getElementById('checker-overlay').classList.remove('open');
  document.getElementById('checker-panel').classList.remove('open');
}

// ─────────────────────────────────────────
// CHEATS DRAWER
// ─────────────────────────────────────────
const cheatSectionCollapsed = {}; // persists across drawer open/close

function openCheats() {
  closeDrawer();
  closeChecker();
  document.getElementById('cheats-body').innerHTML = drawerCheatsHtml();
  document.getElementById('cheats-overlay').classList.add('open');
  document.getElementById('cheats-panel').classList.add('open');

  logAnalyticsEvent('open_drawer', {
    type: 'cheating_guide'
  });
}

function closeCheats() {
  const overlay = document.getElementById('cheats-overlay');
  const panel = document.getElementById('cheats-panel');
  if (overlay) overlay.classList.remove('open');
  if (panel) panel.classList.remove('open');
}

function toggleCheatSection(id) {
  const body    = document.getElementById('csb-' + id);
  const chevron = document.getElementById('csc-' + id);
  const isNowCollapsed = body.classList.toggle('collapsed');
  chevron.classList.toggle('collapsed', isNowCollapsed);
  cheatSectionCollapsed[id] = isNowCollapsed;
}

function cheatSection(id, label, contentHtml) {
  const collapsed = !!cheatSectionCollapsed[id];
  return `
    <div class="cheat-section-header" onclick="toggleCheatSection('${id}')">
      <span class="cheat-section-label">${label}</span>
      <span class="cheat-section-chevron${collapsed ? ' collapsed' : ''}" id="csc-${id}">▼</span>
    </div>
    <div class="cheat-section-body${collapsed ? ' collapsed' : ''}" id="csb-${id}">${contentHtml}</div>
    <div class="drawer-divider" style="margin:4px 18px 4px"></div>`;
}

function cheatStep(num, text) {
  return `<div class="cheat-step">
    <div class="cheat-step-num">${num}</div>
    <div class="cheat-step-text">${text}</div>
  </div>`;
}

function drawerCheatsHtml() {
  let h = '<div style="height:6px"></div>';

  h += cheatSection('unlock', 'UNLOCKING CHEATING', `
    <div class="cheat-block">
      <div class="cheat-block-body">You must <strong>observe an NPC cheat three separate times</strong> before you can cheat yourself. During the deal, a cheating opponent glows with a <strong>blue outline</strong>. Early on, time slows and an Accuse prompt appears — use it to register the observation. After three successful detections, the ability is <strong>permanently unlocked</strong>.</div>
    </div>
    <div class="cheat-warning">⚠ Once unlocked, the blue highlight and time-slow disappear. You must spot cheaters by their animations alone from that point on.</div>
  `);

  h += cheatSection('tells', 'SPOTTING CHEATERS — VISUAL TELLS', `
    <div class="cheat-tell-grid">
      <div class="cheat-tell-header normal">✓ NORMAL</div>
      <div class="cheat-tell-header cheat">✗ CHEATING</div>
      <div class="cheat-tell-label" style="grid-column:1/-1;padding:8px 10px 2px;font-size:9px;letter-spacing:1px;color:var(--text-dim);background:rgba(255,255,255,0.02)">GRIP</div>
      <div class="cheat-tell-cell normal">Thumb down, palm toward table</div>
      <div class="cheat-tell-cell cheat">Thumb up, back of hand toward table</div>
      <div class="cheat-tell-label" style="grid-column:1/-1;padding:8px 10px 2px;font-size:9px;letter-spacing:1px;color:var(--text-dim);background:rgba(255,255,255,0.02)">MOTION</div>
      <div class="cheat-tell-cell normal">Smooth pull from top of bundle</div>
      <div class="cheat-tell-cell cheat">Side-grab or pull from bottom</div>
      <div class="cheat-tell-label" style="grid-column:1/-1;padding:8px 10px 2px;font-size:9px;letter-spacing:1px;color:var(--text-dim);background:rgba(255,255,255,0.02)">CARD SOURCE</div>
      <div class="cheat-tell-cell normal">Cards from shaker or tin</div>
      <div class="cheat-tell-cell cheat">Cards from sleeves or coat</div>
      <div class="cheat-tell-label" style="grid-column:1/-1;padding:8px 10px 2px;font-size:9px;letter-spacing:1px;color:var(--text-dim);background:rgba(255,255,255,0.02)">PLACEMENT</div>
      <div class="cheat-tell-cell normal">Quick confident toss onto table</div>
      <div class="cheat-tell-cell cheat">Deliberate, slow, two-handed placement</div>
      <div class="cheat-tell-label" style="grid-column:1/-1;padding:8px 10px 2px;font-size:9px;letter-spacing:1px;color:var(--text-dim);background:rgba(255,255,255,0.02)">EYE CONTACT</div>
      <div class="cheat-tell-cell normal">Dealer watches table or pot</div>
      <div class="cheat-tell-cell cheat">Dealer brings cards up to face first</div>
    </div>
    <div style="margin:0 18px 12px;font-family:sans-serif;font-size:11px;color:var(--text-dim);line-height:1.5;letter-spacing:0">
      <strong style="color:var(--text)">Behavioral pattern:</strong> Consecutive wins with top-tier hands are a red flag even if you missed the animation tell.
    </div>
  `);

  h += cheatSection('howto', 'HOW TO CHEAT (PLAYER)', `
    <div class="cheat-block">
      <div class="cheat-block-title">PHASE 1 — HIDE HAND</div>
      <div class="cheat-block-body">Only available <strong>when it is your turn to deal</strong>. A brief prompt (under 0.5 seconds) appears — hold it to pause the deal. Select one card by number and color to stash in your sleeve. That card is removed from the active deck and held in reserve.</div>
    </div>
    <div class="cheat-block" style="margin-top:-4px">
      <div class="cheat-block-title">PHASE 2 — CHANGE HAND</div>
      <div class="cheat-block-body">While waiting for opponents to bet, use the Change Hand prompt to swap your stashed card into your hand. <strong>You can only swap your second card</strong> — the first is visible to all players. Swapping it triggers immediate detection.</div>
    </div>
  `);

  h += cheatSection('cards', 'BEST CARDS TO HIDE', `
    <div class="cheat-block">
      <div style="display:flex;flex-direction:column;gap:10px">
        <div>
          <div style="font-family:'Cinzel',serif;font-size:10px;letter-spacing:2px;color:var(--gold);margin-bottom:6px">DUO</div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span class="cheat-card-pill red">Red 1</span>
            <span style="font-family:sans-serif;font-size:12px;color:var(--text-dim);letter-spacing:0">Opens Superior Pair, One-two, One-four, and other strong named hands. Highest EV hide in Duo.</span>
          </div>
        </div>
        <div>
          <div style="font-family:'Cinzel',serif;font-size:10px;letter-spacing:2px;color:var(--gold);margin-bottom:6px">FIVE-CARD</div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span class="cheat-card-pill yellow">10 (any color)</span>
            <span style="font-family:sans-serif;font-size:12px;color:var(--text-dim);letter-spacing:0">Best shot at Ten Pair — the only hand that wins unconditionally in Five-Card.</span>
          </div>
        </div>
      </div>
    </div>
  `);

  h += cheatSection('accuse', 'THE ACCUSE ACTION', `
    <div style="padding:0 18px 10px">
      ${cheatStep('1', 'Watch the dealer\'s hand during the deal. Look for the <strong>thumb-up grip</strong> or <strong>side-grab motion</strong>.')}
      ${cheatStep('2', 'If you spot the tell, use the <strong>Accuse</strong> action before the round resolves.')}
      ${cheatStep('3', '<strong>If correct:</strong> The Hammer Man intervenes. The cheater is removed and their silver is split among remaining players.')}
      ${cheatStep('4', '<strong>If wrong:</strong> You are thrown out. In Duo you lose your silver. In Five-Card you are banned from the den for several in-game days.')}
    </div>
  `);

  h += cheatSection('risk', 'RISK & STRATEGY', `
    <div class="cheat-block" style="background:rgba(166,38,38,0.07);border-color:rgba(166,38,38,0.18)">
      <div class="cheat-block-body">
        Swapping cards too frequently — or hiding and changing in the same round — <strong>significantly raises detection risk</strong>. The safest approach: stash a high-value card and wait for an organic draw that sets up the other half of a top-tier hand.<br><br>
        <strong>Save before every session</strong> outside the gambling den. If you lose an all-in or make a false accusation, reload to reset your silver and any ban timer. Gambling does not affect church reputation — but theft and violence do. If guards turn hostile, a <strong>Writ of Absolution</strong> at any church restores your standing.
      </div>
    </div>
    <div class="cheat-block" style="margin-top:-4px;background:rgba(166,38,38,0.07);border-color:rgba(166,38,38,0.18)">
      <div class="cheat-block-title" style="color:#c06060">BAIT & BLEED STRATEGY</div>
      <div class="cheat-block-body">Allow a confirmed cheater to keep winning for several rounds — letting the pot grow. Accuse them only when their silver balance is at its peak for maximum payout.</div>
    </div>
    <div class="cheat-danger">⚠ A known bug occasionally causes the dispersal to calculate as if the table were full even when players have been eliminated, reducing your actual payout.</div>
  `);

  h += cheatSection('fedora', "DECEIVER'S FEDORA", `
    <div class="cheat-block">
      <div class="cheat-block-title">GAMBLER'S SIGHT</div>
      <div class="cheat-block-body">An endgame headgear item. When activated (LT+RT on controller, <strong>Skill 5</strong> on PC), the fedora's golden monocle reveals every opponent's hidden cards in real time.</div>
    </div>
    <div style="margin:0 18px 10px;padding:10px 12px;border-radius:8px;background:rgba(201,164,74,0.07);border:1px solid rgba(201,164,74,0.18)">
      <div style="font-family:'Cinzel',serif;font-size:10px;letter-spacing:2px;color:var(--gold);margin-bottom:8px">HOW TO OBTAIN</div>
      ${cheatStep('1', 'Defeat <strong>Muskan</strong>, the arena champion. High-level fight — requires stagger loops and focus-parry mastery.')}
      ${cheatStep('2', 'Defeating Muskan opens a <strong>Mineral Shop</strong> near Tomasso in the Bone Pit area.')}
      ${cheatStep('3', 'Reach <strong>100 Trust</strong> with the vendor. Gift a <strong>Giant Gold Bar</strong> for instant +100 trust.')}
      ${cheatStep('4', "Purchase the Fedora from the vendor's stock.")}
      <div style="height:8px"></div>
      <div class="cheat-fedora-stat"><span class="cheat-fedora-stat-label">Cost</span><span class="cheat-fedora-stat-val">3,882 Silver</span></div>
      <div class="cheat-fedora-stat"><span class="cheat-fedora-stat-label">Slot</span><span class="cheat-fedora-stat-val">Headgear</span></div>
      <div class="cheat-fedora-stat"><span class="cheat-fedora-stat-label">Vendor</span><span class="cheat-fedora-stat-val">Mineral Shop, Bone Pit</span></div>
    </div>
    <div style="height:8px"></div>
  `);

  return h;
}

function checkerSetGame(game) {
  checkerState.game = game;
  checkerState.cards = [];
  initCheckerCards();
  document.getElementById('ctog-duo').classList.toggle('active', game === 'duo');
  document.getElementById('ctog-fc').classList.toggle('active', game === 'fc');
  renderCheckerUI();
}

function initCheckerCards() {
  const count = checkerState.game === 'duo' ? 2 : 5;
  while (checkerState.cards.length < count) {
    checkerState.cards.push(checkerState.game === 'duo' ? {number:null,color:null} : {number:null,color:'red'});
  }
  checkerState.cards = checkerState.cards.slice(0, count);
}

function checkerCardUpdate(idx, type, val) {
  if (type === 'num')   checkerState.cards[idx].number = val;
  if (type === 'color') checkerState.cards[idx].color  = val;
  renderCheckerUI();
}

function getCheckerResult() {
  const isDuo = checkerState.game === 'duo';
  const cards = checkerState.cards;
  let res;
  if (isDuo) {
    if (!cards[0]?.number || !cards[0]?.color || !cards[1]?.number || !cards[1]?.color) return null;
    res = duoEval(cards[0], cards[1]);
  } else {
    if (cards.some(c => !c.number)) return null;
    const withColor = cards.map(c => ({number:c.number, color: c.color || 'red'}));
    res = findBestHand(withColor);
  }

  if (res) {
    logAnalyticsEvent('identify_hand', {
      game_mode: checkerState.game,
      identified_as: res.label
    });
  }
  return res;
}

function renderCheckerUI() {
  const isDuo = checkerState.game === 'duo';
  const count = isDuo ? 2 : 5;
  let html = '';

  for (let i = 0; i < count; i++) {
    const card = checkerState.cards[i] || {};
    html += `<div class="checker-card-block">`;
    html += `<div class="drawer-tier">CARD ${i + 1}</div>`;
    html += `<div class="checker-num-row">`;
    for (let n = 1; n <= 10; n++) {
      const a = card.number === n ? ' active' : '';
      html += `<button class="num-btn${a}" onclick="checkerCardUpdate(${i},'num',${n})">${n}</button>`;
    }
    html += `</div>`;
    if (isDuo) {
      const rA = card.color === 'red'    ? ' red-active'    : '';
      const yA = card.color === 'yellow' ? ' yellow-active' : '';
      html += `<div class="checker-color-row">`;
      html += `<button class="color-btn${rA}" onclick="checkerCardUpdate(${i},'color','red')">Red</button>`;
      html += `<button class="color-btn${yA}" onclick="checkerCardUpdate(${i},'color','yellow')">Yellow</button>`;
      html += `</div>`;
    }
    html += `</div>`;
  }

  const result = getCheckerResult();
  if (result) {
    html += `<div class="checker-result">`;
    html += `<div class="checker-result-label">HAND RESULT</div>`;
    if (result.rank === -1 && result.label === 'Bust') {
      html += `<div class="bust-badge">${result.label}</div>`;
      html += `<div style="font-size:11px;color:var(--text-dim);font-family:sans-serif;margin-top:6px;letter-spacing:0">No three cards sum to 10, 20, or 30.</div>`;
    } else {
      html += `<div class="hand-badge">${result.label}</div>`;
      if (result.groupings && result.groupings.length > 0) {
        const g = result.groupings[0];
        html += `<div class="grouping-info">Trio: ${g.trio.map(c=>chipHtml(c)).join('')} &nbsp;+&nbsp; Pair: ${g.remaining.map(c=>chipHtml(c)).join('')}</div>`;
      }
    }
    html += `</div>`;
  }

  document.getElementById('checker-body').innerHTML = html;
}

function drawerRow(name, dotClass) {
  return `<div class="drawer-item">
    <span class="dot ${dotClass}"></span>
    <span class="drawer-name">${name}</span>
  </div>`;
}

function drawerInfoRow(id, name, dotClass, info) {
  return `<div class="drawer-item">
    <span class="dot ${dotClass}"></span>
    <span class="drawer-name">${name}</span>
    <button class="drawer-info-btn" onclick="toggleInfo('${id}', this)">i</button>
  </div>
  <div class="drawer-explanation" id="info-${id}">${info}</div>`;
}

function toggleInfo(id, btn) {
  const el = document.getElementById('info-' + id);
  const open = el.classList.toggle('visible');
  btn.classList.toggle('active', open);
}

function drawerDuoHtml() {
  let h = '';
  h += '<div class="drawer-tier">TOP TIER</div>';
  h += drawerInfoRow('prime_pair',    'Prime Pair',    's', 'Red 3 + Red 8. The strongest hand in the game. Beats everything except Executor.');
  h += drawerInfoRow('superior_pair', 'Superior Pair', 's', 'Red 1 + Red 3, or Red 1 + Red 8. Loses only to Prime Pair. Beats Executor.');
  h += drawerInfoRow('ten_pair',      'Ten Pair',      's', 'Two 10s of any color. Loses to Prime Pair and Superior Pair. Beats Executor.');
  h += '<div class="drawer-divider"></div>';
  h += '<div class="drawer-tier">PAIRS</div>';
  for (let n = 9; n >= 2; n--) h += drawerRow('Pair of ' + n + 's', 'a');
  h += drawerRow('One Pair', 'a');
  h += '<div class="drawer-divider"></div>';
  h += '<div class="drawer-tier">NAMED HANDS</div>';
  h += drawerInfoRow('one_two',      'One-two',      'a', '1 + 2. Beats Perfect Nine and all point hands. Loses to all pairs and top tier hands.');
  h += drawerInfoRow('one_four',     'One-four',     'a', '1 + 4. Same as One-two — beats Perfect Nine and point hands, loses to pairs and above. Loses to One-two in a direct matchup.');
  h += drawerInfoRow('one_nine',     'One-nine',     'a', '1 + 9. Same as One-four. Loses directly to One-two and One-four.');
  h += drawerInfoRow('one_ten',      'One-ten',      'a', '1 + 10. Same as One-nine. Loses directly to One-two, One-four, and One-nine.');
  h += drawerInfoRow('four_ten',     'Four-ten',     'a', '4 + 10. Same as One-ten. Loses directly to all One-x hands.');
  h += drawerInfoRow('four_six',     'Four-six',     'a', '4 + 6. The lowest named hand. Beats Perfect Nine and point hands, but loses to all other named hands.');
  h += drawerInfoRow('perfect_nine', 'Perfect Nine', 'a', 'Any two cards that add up to 9, or to 19 (e.g. 1+8, 2+7, 4+5, 9+10). Beats all point hands. Loses to pairs and named hands.');
  h += '<div class="drawer-divider"></div>';
  h += '<div class="drawer-tier">POINTS</div>';
  for (let n = 8; n >= 1; n--) h += drawerRow(n + ' Points', 'c');
  h += drawerRow('Zero', 'c');
  h += '<div class="drawer-divider"></div>';
  h += '<div class="drawer-tier">SPECIAL — SITUATIONAL</div>';
  h += '<div class="drawer-special-note">These beat, lose to, or rematch depending on what they face.</div>';
  h += drawerInfoRow('high_warden', 'High Warden', 'b', 'Red 4 + Red 9. Loses to Prime Pair, Superior Pair, and Ten Pair. Triggers a rematch against all other hands.');
  h += drawerInfoRow('warden',      'Warden',      'b', '4 + 9 (any color, not both red). Loses to Prime Pair, Superior Pair, and Ten Pair. Beats named hands and high point hands by comparing its point value. Rematches otherwise.');
  h += drawerInfoRow('executor',    'Executor',    'b', 'Red 4 + Red 7. Beats Superior Pair but loses to Prime Pair. Ties another Executor. Rematches Warden and High Warden. Against everything else, compares by its own point value (1).');
  h += drawerInfoRow('judge',       'Judge',       'b', '3 + 7. Beats regular pairs but loses to Prime Pair, Superior Pair, and Ten Pair. Rematches Warden and High Warden. Counts as 0 points when compared against point hands.');
  return h;
}

function drawerFcHtml() {
  let h = '';
  h += '<div class="drawer-tier">TOP TIER</div>';
  h += drawerInfoRow('fc_ten_pair', 'Ten Pair', 's', 'After grouping three cards that sum to 10, 20, or 30, the two remaining cards are both 10s. Beats everything.');
  h += '<div class="drawer-divider"></div>';
  h += '<div class="drawer-tier">PAIRS</div>';
  for (let n = 9; n >= 2; n--) h += drawerRow('Pair of ' + n + 's', 'a');
  h += drawerRow('One Pair', 'a');
  h += '<div class="drawer-divider"></div>';
  h += '<div class="drawer-tier">NAMED HANDS</div>';
  h += drawerInfoRow('fc_perfect_nine', 'Perfect Nine', 'a', 'After the trio is set aside, the two remaining cards add up to 9 or 19. For example: 1+8, 2+7, 4+5, 9+10.');
  h += '<div class="drawer-divider"></div>';
  h += '<div class="drawer-tier">POINTS</div>';
  for (let n = 8; n >= 1; n--) h += drawerRow(n + ' Points', 'c');
  h += drawerRow('Zero', 'c');
  h += '<div class="drawer-divider"></div>';
  h += '<div class="drawer-tier">WORST</div>';
  h += drawerInfoRow('fc_bust', 'Bust', 'c', 'No group of three cards in your hand sums to 10, 20, or 30. The hand cannot be scored and loses to everything.');
  return h;
}

function breadcrumbHtml(gameLabel, oppCount, currentStep) {
  let html = '';
  if (gameLabel) html += '<span class="bc-tag">' + gameLabel + '</span><span class="bc-sep">›</span>';
  if (oppCount)  html += '<span class="bc-tag">' + oppCount + (oppCount === 1 ? ' OPP' : ' OPPS') + '</span>';
  return html;
}

// ─────────────────────────────────────────
// SCREEN 1: GAME SELECT
// ─────────────────────────────────────────
function selectGame(game) {
  triggerHaptic('light');
  state.game = game;
  const label = game === 'duo' ? 'DUO' : 'FIVE-CARD';

  document.getElementById('btn-duo').classList.toggle('btn-selected', game === 'duo');
  document.getElementById('btn-fc').classList.toggle('btn-selected', game === 'fc');

  document.getElementById('opp-btns').innerHTML = [1,2,3].map(n =>
    `<button class="choice-btn opp-btn" onclick="selectOpps(${n})">${n}</button>`
  ).join('');

  const sec = document.getElementById('opp-section');
  sec.classList.remove('visible');
  void sec.offsetWidth; // force reflow so removing+re-adding 'visible' restarts the CSS animation
  sec.classList.add('visible');
}

// ─────────────────────────────────────────
// OPP COUNT → next screen
// ─────────────────────────────────────────
function selectOpps(n) {
  triggerHaptic('light');
  state.oppCount = n;

  if (state.game === 'duo') {
    state.oppCards = Array.from({length: n}, () => ({number: null, color: null}));
    state.duoHandRank = null;
    document.getElementById('bc-duo-hand').innerHTML = breadcrumbHtml('DUO', n, 3);
    showScreen('screen-duo-hand');
  } else {
    state.oppCards = Array.from({length: n}, () => ({number: null}));
    state.fcHandRank = null;
    document.getElementById('bc-fc-hand').innerHTML = breadcrumbHtml('FIVE-CARD', n, 3);
    showScreen('screen-fc-hand');
  }
}

// ─────────────────────────────────────────
// DUO HAND PICKER
// ─────────────────────────────────────────
function pickDuoHand(hand) {
  state.duoHandRank = hand;
  document.getElementById('bc-opphand').innerHTML = breadcrumbHtml('DUO', state.oppCount, 4);
  document.getElementById('opphand-title').textContent = 'OPPONENTS — VISIBLE CARDS';
  renderOppCardsUI();
  showScreen('screen-opphand');
  saveSession();
}

function showDuoHandValue(type) {
  document.getElementById('bc-handvalue').innerHTML = breadcrumbHtml('DUO', state.oppCount, 3);
  const qEl = document.getElementById('handvalue-question');
  const btnsEl = document.getElementById('handvalue-btns');

  if (type === 'pair') {
    qEl.innerHTML = '<span>WHICH PAIR?</span>';
    let html = '';
    for (let n = 9; n >= 1; n--) {
      const hand = JSON.stringify({type:'pair', rank:70+n, label: n===1 ? 'One Pair' : 'Pair of '+n+'s', fallback:(2*n)%10});
      const lbl = n === 1 ? 'ONE PAIR' : n + 'S';
      html += `<button class="choice-btn opp-btn" style="font-size:16px" onclick='pickDuoHand(${hand})'>${lbl}</button>`;
    }
    btnsEl.innerHTML = html;
  } else {
    qEl.innerHTML = '<span>HOW MANY POINTS?</span>';
    let html = '';
    for (let n = 8; n >= 1; n--) {
      const hand = JSON.stringify({type:'points', rank:n, label:n+' Points', fallback:n});
      html += `<button class="choice-btn opp-btn" style="font-size:20px" onclick='pickDuoHand(${hand})'>${n}</button>`;
    }
    btnsEl.innerHTML = html;
  }

  showScreen('screen-handvalue');
}

// ─────────────────────────────────────────
// FC HAND PICKER
// ─────────────────────────────────────────
function showFcHandValue(type) {
  document.getElementById('bc-handvalue').innerHTML = breadcrumbHtml('FIVE-CARD', state.oppCount, 3);
  const qEl = document.getElementById('handvalue-question');
  const btnsEl = document.getElementById('handvalue-btns');

  if (type === 'pair') {
    qEl.innerHTML = '<span>WHICH PAIR?</span>';
    let html = '';
    for (let n = 9; n >= 1; n--) {
      const rank  = 70 + n;
      const label = n === 1 ? 'ONE PAIR' : n + 'S';
      html += `<button class="choice-btn opp-btn" style="font-size:16px" onclick="pickFcHand(${rank}, '${n === 1 ? 'One Pair' : 'Pair of ' + n + 's'}')">${label}</button>`;
    }
    btnsEl.innerHTML = html;
  } else {
    qEl.innerHTML = '<span>HOW MANY POINTS?</span>';
    let html = '';
    for (let n = 8; n >= 1; n--) {
      html += `<button class="choice-btn opp-btn" style="font-size:20px" onclick="pickFcHand(${n}, '${n} Points')">${n}</button>`;
    }
    btnsEl.innerHTML = html;
  }

  showScreen('screen-handvalue');
}

function pickFcHand(rank, label) {
  state.fcHandRank = {rank, label};
  document.getElementById('bc-opphand').innerHTML = breadcrumbHtml('FIVE-CARD', state.oppCount, 4);
  document.getElementById('opphand-title').textContent = 'OPPONENTS — VISIBLE CARD';
  renderOppCardsUI();
  showScreen('screen-opphand');
}

// ─────────────────────────────────────────
// OPP CARDS UI
// ─────────────────────────────────────────
function renderOppCardsUI() {
  const container = document.getElementById('opp-cards-ui');
  let html = '';
  state.oppCards.forEach((card, i) => {
    if (i > 0) html += '<div class="card-rule"></div>';
    html += oppCardEntryHtml(card, i, 'Opponent ' + (i + 1));
  });
  container.innerHTML = html;
  checkOppHandSubmit();
}

function oppCardEntryHtml(card, idx, label) {
  let html = '<div class="card-entry">';
  html += '<div class="card-label">' + label + ' — VISIBLE CARD</div>';
  // 5×2 number grid
  html += '<div class="num-grid">';
  for (let n = 1; n <= 10; n++) {
    const a = card.number === n ? ' active' : '';
    html += `<button class="num-big${a}" onclick="oppCardUpdate(${idx},'num',${n})">${n}</button>`;
  }
  html += '</div>';
  // Color buttons — only for Duo
  if (state.game === 'duo') {
    const rA = card.color === 'red'    ? ' red-active' : '';
    const yA = card.color === 'yellow' ? ' yel-active' : '';
    html += '<div class="color-big">';
    html += `<button class="col-big${rA}" onclick="oppCardUpdate(${idx},'color','red')"><span class="col-dot r"></span>Red</button>`;
    html += `<button class="col-big${yA}" onclick="oppCardUpdate(${idx},'color','yellow')"><span class="col-dot y"></span>Yellow</button>`;
    html += '</div>';
  }
  html += '</div>';
  return html;
}

function oppCardUpdate(idx, type, val) {
  if (type === 'num')   state.oppCards[idx].number = val;
  if (type === 'color') state.oppCards[idx].color  = val;
  renderOppCardsUI();
  saveSession(); // Fix #4: persist opp card selections immediately
}

function checkOppHandSubmit() {
  let allDone;
  if (state.game === 'fc') {
    allDone = state.oppCards.every(c => c.number);
  } else {
    allDone = state.oppCards.every(c => c.number && c.color);
  }
  document.getElementById('opphand-submit').disabled = !allDone;
}

function submitOppHand() {
  triggerHaptic('medium');
  const label = state.game === 'duo' ? 'DUO' : 'FIVE-CARD';
  document.getElementById('bc-results').innerHTML = breadcrumbHtml(label, state.oppCount, 5);
  renderResults();
  triggerHaptic('success');
  addToHistory();
  renderHistorySection();
  
  // Log the "Mapping" event
  logAnalyticsEvent('calculate_odds', {
    game_type: state.game,
    opponent_count: state.oppCount,
    user_hand: state.game === 'duo' ? state.duoHandRank?.label : state.fcHandRank?.label,
    opponent_cards: state.oppCards.map(c => c.number + (c.color ? c.color[0] : '')).join(',')
  });

  showScreen('screen-results');
}

// ─────────────────────────────────────────
// RESULTS RENDER
// ─────────────────────────────────────────
function renderResults() {
  const container = document.getElementById('results-ui');
  container.innerHTML = state.game === 'duo' ? renderDuoResults() : renderFcResults();
}

// ─────────────────────────────────────────
// PLAY AGAIN
// ─────────────────────────────────────────
function playAgain() {
  if (state.game === 'fc') {
    state.fcHandRank = null;
    state.oppCards = Array.from({length: state.oppCount}, () => ({number: null}));
    document.getElementById('bc-fc-hand').innerHTML = breadcrumbHtml('FIVE-CARD', state.oppCount, 3);
    showScreen('screen-fc-hand');
  } else {
    state.duoHandRank = null;
    state.oppCards = Array.from({length: state.oppCount}, () => ({number: null, color: null}));
    document.getElementById('bc-duo-hand').innerHTML = breadcrumbHtml('DUO', state.oppCount, 3);
    showScreen('screen-duo-hand');
  }
}

function newGame(game) {
  clearSession();
  navHistory.length = 0;
  state.oppCount = null;
  state.oppCards = [];
  state.duoHandRank = null;
  state.fcHandRank = null;
  document.getElementById('opp-section').classList.remove('visible');
  document.getElementById('btn-duo').classList.remove('btn-selected');
  document.getElementById('btn-fc').classList.remove('btn-selected');
  showScreen('screen-game');
  if (game) selectGame(game);
}

// ─────────────────────────────────────────
// DUO LOGIC  (untouched)
// ─────────────────────────────────────────
const DUO_DECK = [];
for (let n = 1; n <= 10; n++) {
  DUO_DECK.push({number: n, color: 'red'});
  DUO_DECK.push({number: n, color: 'yellow'});
}

function duoEval(c1, c2) {
  const nums = [c1.number, c2.number].sort((a,b) => a-b);
  const bothRed = c1.color === 'red' && c2.color === 'red';
  const sum = (c1.number + c2.number) % 10;
  if (nums[0]===3  && nums[1]===8  && bothRed) return {type:'prime_pair',   rank:100, label:'Prime Pair',   fallback:sum};
  if (bothRed && nums[0]===1 && (nums[1]===3||nums[1]===8)) return {type:'superior_pair',rank:90,label:'Superior Pair',fallback:sum};
  if (nums[0]===10 && nums[1]===10) return {type:'ten_pair',    rank:80,  label:'Ten Pair',    fallback:sum};
  if (nums[0]===4  && nums[1]===9  && bothRed) return {type:'high_warden', rank:-1,  label:'High Warden', fallback:3};
  if (nums[0]===4  && nums[1]===7  && bothRed) return {type:'executor',    rank:-1,  label:'Executor',    fallback:1};
  if (nums[0]===4  && nums[1]===9)             return {type:'warden',      rank:-1,  label:'Warden',      fallback:3};
  if (nums[0]===3  && nums[1]===7)             return {type:'judge',       rank:-2,  label:'Judge',       fallback:0};
  if (nums[0]===nums[1]) return {type:'pair', rank:70+nums[0], label: nums[0]===1 ? 'One Pair' : 'Pair of '+nums[0]+'s', fallback:sum}; // Fix #6: normalized label
  if (nums[0]===1  && nums[1]===2)  return {type:'one_two',    rank:60, label:'One-two',    fallback:sum};
  if (nums[0]===1  && nums[1]===4)  return {type:'one_four',   rank:59, label:'One-four',   fallback:sum};
  if (nums[0]===1  && nums[1]===9)  return {type:'one_nine',   rank:58, label:'One-nine',   fallback:sum};
  if (nums[0]===1  && nums[1]===10) return {type:'one_ten',    rank:57, label:'One-ten',    fallback:sum};
  if (nums[0]===4  && nums[1]===10) return {type:'four_ten',   rank:56, label:'Four-ten',   fallback:sum};
  if (nums[0]===4  && nums[1]===6)  return {type:'four_six',   rank:55, label:'Four-six',   fallback:sum};
  if (sum===9) return {type:'perfect_nine', rank:50, label:'Perfect Nine', fallback:9};
  if (sum===0) return {type:'zero',         rank:0,  label:'Zero',         fallback:0};
  return {type:'points', rank:sum, label:sum+' Points', fallback:sum};
}

function duoCompare(my, opp) {
  if (my.type === 'executor') {
    if (opp.type === 'superior_pair') return 'win';
    if (opp.type === 'prime_pair')    return 'lose';
    if (opp.type === 'executor')      return 'tie';
    if (opp.type === 'high_warden' || opp.type === 'warden') return 'rematch';
    const oppEff = opp.type === 'judge' ? 0 : opp.rank;
    return my.fallback > oppEff ? 'win' : my.fallback < oppEff ? 'lose' : 'tie';
  }
  if (opp.type === 'executor') {
    if (my.type === 'superior_pair') return 'lose';
    if (my.type === 'prime_pair')    return 'win';
    if (my.type === 'warden' || my.type === 'high_warden') return 'rematch';
    const myEff = my.type === 'judge' ? 0 : my.rank;
    return myEff > opp.fallback ? 'win' : myEff < opp.fallback ? 'lose' : 'tie';
  }
  if (my.type === 'judge') {
    if (opp.type === 'pair') return 'win';
    if (opp.type === 'ten_pair' || opp.type === 'superior_pair' || opp.type === 'prime_pair') return 'lose';
    if (opp.type === 'judge') return 'tie';
    if (opp.type === 'warden' || opp.type === 'high_warden') return 'rematch';
    return 0 > opp.rank ? 'win' : 0 < opp.rank ? 'lose' : 'tie';
  }
  if (opp.type === 'judge') {
    if (my.type === 'pair') return 'lose';
    if (my.type === 'ten_pair' || my.type === 'superior_pair' || my.type === 'prime_pair') return 'win';
    if (my.type === 'warden' || my.type === 'high_warden') return 'rematch';
    return my.rank > 0 ? 'win' : my.rank < 0 ? 'lose' : 'tie';
  }
  if (my.type === 'high_warden') {
    if (opp.type === 'prime_pair' || opp.type === 'superior_pair' || opp.type === 'ten_pair') return 'lose';
    return 'rematch';
  }
  if (opp.type === 'high_warden') {
    if (my.type === 'prime_pair' || my.type === 'superior_pair' || my.type === 'ten_pair') return 'win';
    return 'rematch';
  }
  if (my.type === 'warden') {
    if (opp.type === 'prime_pair' || opp.type === 'superior_pair' || opp.type === 'ten_pair') return 'lose';
    if (opp.type === 'pair') return my.fallback > opp.fallback ? 'win' : my.fallback < opp.fallback ? 'lose' : 'tie';
    if (opp.rank >= 60) return my.fallback > opp.rank ? 'win' : my.fallback < opp.rank ? 'lose' : 'tie';
    return 'rematch';
  }
  if (opp.type === 'warden') {
    if (my.type === 'prime_pair' || my.type === 'superior_pair' || my.type === 'ten_pair') return 'win';
    if (my.type === 'pair') return my.fallback > opp.fallback ? 'win' : my.fallback < opp.fallback ? 'lose' : 'tie';
    if (my.rank >= 60) return my.rank > opp.fallback ? 'win' : my.rank < opp.fallback ? 'lose' : 'tie';
    return 'rematch';
  }
  return my.rank > opp.rank ? 'win' : my.rank < opp.rank ? 'lose' : 'tie';
}

function renderDuoResults() {
  const myHand = state.duoHandRank;
  let html = '';

  html += renderSelectionRecap();
  
  html += `<div class="hand-label">YOUR HAND</div>`;
  html += `<div class="hand-badge">${myHand.label}</div>`;

  const oppResults = state.oppCards.map(opp => {
    let wins=0, losses=0, ties=0, rematches=0;
    // Fix #2: exclude opponent's visible card from the unknown pool
    const pool = DUO_DECK.filter(c => !(c.number === opp.number && c.color === opp.color));
    pool.forEach(unk => {
      const r = duoCompare(myHand, duoEval(opp, unk));
      if (r==='win') wins++; else if (r==='lose') losses++;
      else if (r==='tie') ties++; else rematches++;
    });
    return {wins, losses, ties, rematches, total: pool.length};
  });

  html += '<div class="results-opps">';
  oppResults.forEach((r,i) => {
    html += '<div class="result-block">';
    html += '<div class="vs-label">VS OPPONENT ' + (i+1) + '</div>';
    html += oddsBarHtml(r.wins, r.losses, r.ties, r.total, r.rematches);
    html += '</div>';
  });
  html += '</div>';

  if (state.oppCount >= 2) {
    let cW=0, cL=0, cT=0, cM=0;
    // Fix #1 + #2: per-opp pools (visible card excluded) + full 2- or 3-opp enumeration
    const pools = state.oppCards.map(opp =>
      DUO_DECK.filter(c => !(c.number === opp.number && c.color === opp.color))
    );
    if (state.oppCount === 2) {
      pools[0].forEach(u1 => pools[1].forEach(u2 => {
        const r1 = duoCompare(myHand, duoEval(state.oppCards[0], u1));
        const r2 = duoCompare(myHand, duoEval(state.oppCards[1], u2));
        if (r1==='win' && r2==='win') cW++;
        else if (r1==='lose' || r2==='lose') cL++;
        else if (r1==='tie' && r2==='tie') cT++;
        else cM++;
      }));
    } else {
      pools[0].forEach(u1 => pools[1].forEach(u2 => pools[2].forEach(u3 => {
        const r1 = duoCompare(myHand, duoEval(state.oppCards[0], u1));
        const r2 = duoCompare(myHand, duoEval(state.oppCards[1], u2));
        const r3 = duoCompare(myHand, duoEval(state.oppCards[2], u3));
        if (r1==='win' && r2==='win' && r3==='win') cW++;
        else if (r1==='lose' || r2==='lose' || r3==='lose') cL++;
        else if (r1==='tie' && r2==='tie' && r3==='tie') cT++;
        else cM++;
      })));
    }
    const cTotal = pools.reduce((acc, p) => acc * p.length, 1);
    state.lastSummary = { winPct: (cW/cTotal*100).toFixed(1), losePct: (cL/cTotal*100).toFixed(1) };
    html += '<div class="combined-rule"></div>';
    html += '<div class="combined-label">COMBINED — BEAT ALL</div>';
    html += oddsBarHtml(cW, cL, cT, cTotal, cM);
    html += adviceHtml(cW, cL, cTotal);
  } else {
    state.lastSummary = { winPct: (oppResults[0].wins/oppResults[0].total*100).toFixed(1), losePct: (oppResults[0].losses/oppResults[0].total*100).toFixed(1) };
    html += adviceHtml(oppResults[0].wins, oppResults[0].losses, DUO_DECK.length);
  }

  return html;
}

// ─────────────────────────────────────────
// FIVE-CARD LOGIC
// ─────────────────────────────────────────
const FC_FULL_DECK = [];
for (let n = 1; n <= 10; n++) {
  for (const c of ['red','yellow']) {
    FC_FULL_DECK.push({number:n,color:c});
    FC_FULL_DECK.push({number:n,color:c});
  }
}


function fcEval(c1, c2) {
  const nums = [c1.number, c2.number].sort((a,b)=>a-b);
  const sum  = (c1.number + c2.number) % 10;
  if (nums[0]===10 && nums[1]===10) return {rank:80, label:'Ten Pair'};
  if (nums[0]===nums[1]) return {rank:70+nums[0], label: nums[0]===1 ? 'One Pair' : 'Pair of '+nums[0]+'s'};
  if (sum===9) return {rank:50, label:'Perfect Nine'};
  if (sum===0) return {rank:0,  label:'Zero'};
  return {rank:sum, label:sum+' Points'};
}

function findBestHand(cards) {
  let bestRank = -2;
  let bestLabel = 'Bust';
  let bestGrouping = null;

  for (let i=0; i<5; i++) {
    for (let j=i+1; j<5; j++) {
      for (let k=j+1; k<5; k++) {
        const c1 = cards[i], c2 = cards[j], c3 = cards[k];
        const s = c1.number + c2.number + c3.number;
        if (s===10 || s===20 || s===30) {
          let r1, r2;
          for (let x=0; x<5; x++) {
            if (x !== i && x !== j && x !== k) {
              if (!r1) r1 = cards[x];
              else r2 = cards[x];
            }
          }
          const hand = fcEval(r1, r2);
          if (hand.rank > bestRank) {
            bestRank = hand.rank;
            bestLabel = hand.label;
            bestGrouping = {trio: [c1, c2, c3], remaining: [r1, r2], hand, sum: s};
          }
        }
      }
    }
  }

  if (bestRank === -2) return {rank: -1, label: 'Bust', groupings: []};
  return {rank: bestRank, label: bestLabel, groupings: [bestGrouping]};
}

function fcCompare(my, opp) {
  return my.rank > opp.rank ? 'win' : my.rank < opp.rank ? 'lose' : 'tie';
}

// Updated: handles colorless cards (FC opp visible cards have no color)
function getRemainingDeck(knownCards) {
  const deck = FC_FULL_DECK.slice();
  for (const card of knownCards) {
    if (!card || !card.number) continue;
    if (card.color) {
      // Exact match (Duo or cards with known color)
      const idx = deck.findIndex(c => c.number===card.number && c.color===card.color);
      if (idx !== -1) deck.splice(idx, 1);
    } else {
      // FC visible card — color unknown, remove one instance of this number
      const idx = deck.findIndex(c => c.number===card.number);
      if (idx !== -1) deck.splice(idx, 1);
    }
  }
  return deck;
}

function draw4(deck) {
  const len = deck.length;
  let r1 = Math.floor(Math.random() * len);
  let r2, r3, r4;
  do { r2 = Math.floor(Math.random() * len); } while (r2 === r1);
  do { r3 = Math.floor(Math.random() * len); } while (r3 === r1 || r3 === r2);
  do { r4 = Math.floor(Math.random() * len); } while (r4 === r1 || r4 === r2 || r4 === r3);
  return [deck[r1], deck[r2], deck[r3], deck[r4]];
}

function simulateOneOpp(myHand, visibleCard, deck) {
  const rem = deck.slice(), remLen = rem.length;
  let wins=0, losses=0, ties=0, total=0;
  for (let a=0;a<remLen;a++) for (let b=a+1;b<remLen;b++) for (let c=b+1;c<remLen;c++) for (let d=c+1;d<remLen;d++) {
    const oppHand = findBestHand([visibleCard, rem[a], rem[b], rem[c], rem[d]]);
    const r = fcCompare(myHand, oppHand);
    if (r==='win') wins++; else if (r==='lose') losses++; else ties++;
    total++;
  }
  return {wins, losses, ties, total};
}

function simulateCombined(myHand, validOpps) {
  let wins=0, losses=0, ties=0;
  
  // FC: opp cards have no color; don't subtract my unknown cards from deck
  const oppDecks = validOpps.map(opp => getRemainingDeck([opp]));
  const loopsCount = validOpps.length;

  for (let s=0; s<MC_SAMPLES; s++) {
    let beatAll = true, lostAny = false;
    for (let i=0; i<loopsCount; i++) {
      const opp = validOpps[i];
      const deck = oppDecks[i];
      const hidden = draw4(deck);
      const combinedCards = [opp, hidden[0], hidden[1], hidden[2], hidden[3]];
      
      const r = fcCompare(myHand, findBestHand(combinedCards));
      if (r !== 'win') beatAll = false;
      if (r === 'lose') lostAny = true;
    }
    if (beatAll) wins++; else if (lostAny) losses++; else ties++;
  }
  return {wins, losses, ties, total:MC_SAMPLES};
}

function renderFcResults() {
  const myHand = state.fcHandRank; // {rank, label} from hand picker
  let html = '';

  html += renderSelectionRecap();

  html += `<div class="hand-label">YOUR HAND</div>`;
  html += `<div class="hand-badge">${myHand.label}</div>`;

  html += '<div class="results-opps">';
  state.oppCards.forEach((opp, i) => {
    // Only remove opp's visible card from deck (our 5 cards are unknown)
    const deck = getRemainingDeck([opp]);
    const r = simulateOneOpp(myHand, opp, deck);
    html += '<div class="result-block">';
    html += '<div class="vs-label">VS OPPONENT ' + (i+1) + '</div>';
    html += oddsBarHtml(r.wins, r.losses, r.ties, r.total);
    html += '</div>';
  });
  html += '</div>';

  if (state.oppCount >= 2) {
    const c = simulateCombined(myHand, state.oppCards);
    state.lastSummary = { winPct: (c.wins/c.total*100).toFixed(1), losePct: (c.losses/c.total*100).toFixed(1) };
    html += '<div class="combined-rule"></div>';
    html += '<div class="combined-label">COMBINED — BEAT ALL ' + state.oppCount + '</div>';
    html += '<div class="mc-note">ESTIMATED · ' + MC_SAMPLES + ' SAMPLES</div>';
    html += oddsBarHtml(c.wins, c.losses, c.ties, c.total);
    html += adviceHtml(c.wins, c.losses, c.total);
  } else {
    const deck = getRemainingDeck([state.oppCards[0]]);
    const r = simulateOneOpp(myHand, state.oppCards[0], deck);
    state.lastSummary = { winPct: (r.wins/r.total*100).toFixed(1), losePct: (r.losses/r.total*100).toFixed(1) };
    html += adviceHtml(r.wins, r.losses, r.total);
  }

  return html;
}

// ─────────────────────────────────────────
// SHARED UI HELPERS
// ─────────────────────────────────────────
function oddsBarHtml(wins, losses, ties, total, rematches = 0) {
  const wP = (wins/total*100).toFixed(1);
  const lP = (losses/total*100).toFixed(1);
  const tP = (ties/total*100).toFixed(1);
  const rP = (rematches/total*100).toFixed(1);
  let html = '<div class="odds-bar">';
  if (wins)     html += `<div class="odds-seg win"     style="width:${wP}%">${parseFloat(wP)>8?wP+'%':''}</div>`;
  if (ties)     html += `<div class="odds-seg tie"     style="width:${tP}%">${parseFloat(tP)>8?tP+'%':''}</div>`;
  if (rematches)html += `<div class="odds-seg rematch" style="width:${rP}%">${parseFloat(rP)>8?rP+'%':''}</div>`;
  if (losses)   html += `<div class="odds-seg lose"    style="width:${lP}%">${parseFloat(lP)>8?lP+'%':''}</div>`;
  html += '</div>';
  html += '<div class="odds-legend">';
  html += `<span class="legend-win">Win ${wP}%</span>`;
  html += `<span class="legend-tie">Tie ${tP}%</span>`;
  if (rematches) html += `<span class="legend-rematch">Rematch ${rP}%</span>`;
  html += `<span class="legend-lose">Lose ${lP}%</span>`;
  html += '</div>';
  return html;
}

// Fix #3: delegates to adviceFromPcts — single source of truth for thresholds
function adviceHtml(wins, losses, total) {
  const { text, color } = adviceFromPcts((wins / total * 100), (losses / total * 100));
  return `<div class="advice" style="border:1px solid ${color}33;background:${color}11;color:${color}">${text}</div>`;
}

function chipHtml(c) {
  const cls = c.color === 'red' ? 'red' : 'yellow';
  const lbl = (c.color === 'red' ? 'R' : 'Y') + c.number;
  return `<span class="chip ${cls}">${lbl}</span>`;
}

function renderSelectionRecap() {
  const isDuo = state.game === 'duo';
  const hand = isDuo ? state.duoHandRank?.label : state.fcHandRank?.label;
  
  let html = `<div class="selection-recap">
    <div class="recap-title">Selection Summary</div>
    <div class="recap-grid">
      <div class="recap-item">
        <div class="recap-label">Game</div>
        <div class="recap-value">${isDuo ? 'Duo' : 'Five-Card'}</div>
      </div>
      <div class="recap-item">
        <div class="recap-label">Opponents</div>
        <div class="recap-value">${state.oppCount}</div>
      </div>
    </div>
    <div style="height:12px"></div>
    <div class="recap-item">
      <div class="recap-label">Opponent Visible Cards</div>
      <div class="recap-cards">
        ${state.oppCards.map(c => chipHtml({number: c.number, color: c.color || 'yellow'})).join('')}
      </div>
    </div>
  </div>`;
  return html;
}

// ─────────────────────────────────────────
// KEYBOARD ACCESSIBILITY
// ─────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const settings = document.getElementById('settings-overlay');
    const drawer = document.getElementById('drawer-overlay');
    const checker = document.getElementById('checker-overlay');
    
    let handled = false;
    if (settings && settings.classList.contains('open')) { closeSettings(); handled = true; }
    else if (checker && checker.classList.contains('open')) { closeChecker(); handled = true; }
    else if (document.getElementById('cheats-overlay')?.classList.contains('open')) { closeCheats(); handled = true; }
    else if (drawer && drawer.classList.contains('open')) { closeDrawer(); handled = true; }
    
    if (!handled && navHistory.length > 0) goBack();
  }
  
  if (e.key === 'Enter') {
    const hasModalOpen = document.querySelector('.modal-overlay.open, .drawer-overlay.open');
    if (hasModalOpen) return;
    
    const submitBtn = document.getElementById('opphand-submit');
    if (submitBtn && !submitBtn.disabled && submitBtn.offsetParent !== null) {
      submitOppHand();
    }
  }
});

window.addEventListener('load', () => {
  renderHistorySection();
  updateSettingsUI();
  loadSession();
  applyCheatVisibility();
  
  // Register Service Worker for PWA / Offline support
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('Service Worker Registered!', reg))
      .catch(err => console.error('Service Worker Registration Failed!', err));
  }
});

// ── Mobile touch fix: fire onclick immediately on touchend ──
// Prevents the 300ms delay and unresponsive-tap issue on Android/iOS
document.addEventListener('touchend', function(e) {
  const btn = e.target.closest('button');
  if (!btn) return;
  e.preventDefault();
  btn.click();
}, { passive: false });
