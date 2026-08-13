(() => {
  'use strict';

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const $ = (id) => document.getElementById(id);
  const ui = {
    startPanel: $('startPanel'), startButton: $('startButton'), newGame: $('newGameButton'), how: $('howButton'), about: $('aboutButton'), pause: $('pauseButton'), mute: $('muteButton'),
    pausePanel: $('pausePanel'), resume: $('resumeButton'), exit: $('exitButton'),
    dialog: $('dialog'), dialogTitle: $('dialogTitle'), dialogBody: $('dialogBody'), dialogClose: $('dialogClose'), dialogOk: $('dialogOk'),
    cycle: $('cycleLabel'), health: $('healthText'), healthBar: $('healthBar'), release: $('releaseText'), releaseBar: $('releaseBar'),
    code: $('codeValue'), money: $('moneyValue'), energy: $('energyValue'), trust: $('trustValue'), uptime: $('uptimeValue'),
    reinvest: $('reinvestButton'), reinvestHint: $('reinvestHint'), extraction: $('extractionRate'), effects: $('effectsList'), status: $('statusMessage'), score: $('scoreMessage'),
    bossMeter: $('bossMeter'), bossBar: $('bossBar'), toasts: $('toastStack'), lamp: $('statusLamp'), desktop: $('desktop'),
    coach: $('coachBanner'), coachVerb: $('coachVerb'), coachText: $('coachText')
  };

  const TYPES = {
    commit: { label: 'COMMIT', color: '#ff4b8b', value: 6, kind: 'good' },
    fix: { label: 'BUG FIX', color: '#36b96d', value: 5, kind: 'good' },
    docs: { label: 'DOCS', color: '#ffd33d', value: 4, kind: 'good' },
    hours: { label: 'HOURS', color: '#5d7dd5', value: 5, kind: 'good' },
    lawyer: { label: 'LAWYER', color: '#596078', value: 10, kind: 'bad' },
    bug: { label: 'BUG', color: '#d84b3f', value: 7, kind: 'bad' },
    invoice: { label: 'INVOICE', color: '#eee7c8', value: 8, kind: 'bad' },
    five: { label: 'FIVE FOR FUTURE', color: '#ff8c32', kind: 'power' },
    fork: { label: 'EMERGENCY FORK', color: '#e850a7', kind: 'power' },
    shield: { label: 'TRADEMARK SHIELD', color: '#4474da', kind: 'power' },
    sabbatical: { label: 'SABBATICAL', color: '#79c85b', kind: 'power' }
  };

  const cycleNames = ['SemVer-ish', 'Patch Tuesday?', 'Enterprise Pivot', 'Monetize Everything', 'Final Release Candidate'];
  const goodTypes = ['commit', 'fix', 'docs', 'hours'];
  const badTypes = ['lawyer', 'bug', 'invoice'];
  const powerTypes = ['five', 'fork', 'shield', 'sabbatical'];
  const state = {
    running: false, paused: false, gameOver: false, muted: false, last: 0, elapsed: 0, cycleTime: 0, cycle: 1,
    cycleLength: 29, boss: false, bossHealth: 100, bossTime: 0, entities: [], particles: [], projectiles: [], floaters: [],
    spawnTimer: 0, eventTimer: 16, health: 72, code: 42, money: 0, energy: 68, trust: 74, uptime: 99.9,
    contributions: 0, score: 0, extraction: 1, multiplierUntil: 0, forkUntil: 0, shieldHits: 0,
    frozenUntil: 0, outageUntil: 0, combo: 0, comboTimer: 0, dodges: 0, tutorialDrop: 0, lastResult: null,
    manualPause: false, autoPaused: false, playerX: 0, targetX: 0, keys: {}, audio: null
  };

  let W = 800, H = 500, dpr = 1;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(320, Math.floor(rect.width));
    H = Math.max(280, Math.floor(rect.height));
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!state.running) state.playerX = state.targetX = W / 2;
  }

  function reset() {
    Object.assign(state, {
      running: true, paused: false, gameOver: false, last: performance.now(), elapsed: 0, cycleTime: 0, cycle: 1, boss: false,
      bossHealth: 100, bossTime: 0, entities: [], particles: [], projectiles: [], floaters: [], spawnTimer: .7, eventTimer: 15,
      health: 72, code: 42, money: 0, energy: 68, trust: 74, uptime: 99.9, contributions: 0, score: 0,
      extraction: 1, multiplierUntil: 0, forkUntil: 0, shieldHits: 0, frozenUntil: 0, outageUntil: 0,
      combo: 0, comboTimer: 0, dodges: 0, tutorialDrop: 0, lastResult: null, manualPause: false, autoPaused: false, playerX: W / 2, targetX: W / 2
    });
    ui.startPanel.hidden = true;
    ui.pausePanel.hidden = true;
    ui.dialog.hidden = true;
    ui.bossMeter.hidden = true;
    ui.coach.hidden = false;
    ui.desktop.classList.remove('panic');
    canvas.focus();
    ensureAudio();
    status('Release 1 booted. Catch useful work; dodge expensive stationery.');
    toast('<b>RELEASE 1:</b> SemVer-ish. Confidence is high; tests are pending.');
    updateUI();
  }

  function ensureAudio() {
    if (!state.audio) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) state.audio = new AudioCtx();
    }
    if (state.audio?.state === 'suspended') state.audio.resume();
  }

  function beep(freq = 440, duration = .07, type = 'square', volume = .035) {
    if (state.muted || !state.audio) return;
    const osc = state.audio.createOscillator();
    const gain = state.audio.createGain();
    osc.type = type; osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, state.audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(.0001, state.audio.currentTime + duration);
    osc.connect(gain).connect(state.audio.destination);
    osc.start(); osc.stop(state.audio.currentTime + duration);
  }

  function spawn(type, x = Math.random() * (W - 70) + 35, y = -35, guided = false) {
    const scale = Math.min(1.35, .88 + state.cycle * .08);
    const sizes = { lawyer: 25, bug: 21, invoice: 24, five: 26, fork: 26, shield: 26, sabbatical: 26 };
    state.entities.push({ type, x, y, size: sizes[type] || 21, vy: guided ? 98 : (55 + Math.random() * 36 + state.cycle * 8) * scale, vx: guided ? 0 : (Math.random() - .5) * 22, spin: Math.random() * 6, caught: false, dodged: false, guided });
  }

  function chooseSpawn() {
    const difficulty = (state.cycle - 1) * .045;
    const roll = Math.random();
    if (roll < .055) return powerTypes[Math.floor(Math.random() * powerTypes.length)];
    if (roll < .25 + difficulty) return badTypes[Math.floor(Math.random() * badTypes.length)];
    return goodTypes[Math.floor(Math.random() * goodTypes.length)];
  }

  function update(dt, now) {
    if (!state.running || state.paused || state.gameOver) return;
    state.elapsed += dt;
    const frozen = now < state.frozenUntil;
    const outage = now < state.outageUntil;
    ui.desktop.classList.toggle('panic', outage);

    if (!frozen) {
      const direction = (state.keys.ArrowRight || state.keys.d ? 1 : 0) - (state.keys.ArrowLeft || state.keys.a ? 1 : 0);
      if (direction) state.targetX += direction * 330 * dt * (outage ? -1 : 1);
      state.targetX = clamp(state.targetX, 48, W - 48);
      state.playerX += (state.targetX - state.playerX) * Math.min(1, dt * 13);

      if (!state.boss) {
        state.cycleTime += dt;
        if (state.cycleTime >= state.cycleLength) nextCycle();
      } else {
        state.bossTime += dt;
        if (state.bossTime >= 48) endGame(state.bossHealth <= 0);
      }

      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) {
        if (state.boss) {
          spawn(Math.random() < .47 ? 'invoice' : goodTypes[Math.floor(Math.random() * goodTypes.length)]);
          if (Math.random() < .24) spawn('lawyer', Math.random() * (W - 70) + 35, -65);
          state.spawnTimer = .38 + Math.random() * .35;
        } else if (state.cycle === 1 && state.elapsed < 9) {
          const tutorialTypes = ['commit', 'fix', 'docs', 'hours', 'lawyer', 'bug'];
          const tutorialPositions = [.5, .5, .72, .3, .2, .8];
          const tutorialIndex = state.tutorialDrop % tutorialTypes.length;
          const type = tutorialTypes[tutorialIndex];
          const safeX = W * tutorialPositions[tutorialIndex];
          spawn(type, safeX, -35, true);
          state.tutorialDrop++;
          state.spawnTimer = 1.65;
        } else {
          spawn(chooseSpawn());
          state.spawnTimer = Math.max(.36, .72 - state.cycle * .055) + Math.random() * .42;
        }
      }

      updateEntities(dt, now);
      updateParticles(dt);
      updateProjectiles(dt);
      updateFloaters(dt);
    }

    economy(dt, now, outage);
    state.comboTimer -= dt;
    if (state.comboTimer <= 0) state.combo = 0;
    updateCoach();
    updateUI(now);
  }

  function economy(dt, now, outage) {
    const pressure = state.boss ? 2.35 : 1 + (state.cycle - 1) * .19;
    state.extraction = pressure * (outage ? 1.65 : 1);
    const hasCode = state.code > 0;
    if (hasCode) {
      state.code = Math.max(0, state.code - .23 * state.extraction * dt);
      state.money += .63 * state.extraction * dt;
    }
    state.energy = clamp(state.energy - (.15 + .055 * state.cycle) * dt, 0, 100);
    state.uptime = clamp(99.96 - Math.max(0, 18 - state.code) * .34 - (outage ? 17 : 0), 42, 99.99);
    const poorConditions = (state.code < 12 ? .48 : 0) + (state.energy < 25 ? .38 : 0) + (state.trust < 25 ? .28 : 0) + (outage ? .72 : 0);
    state.health = clamp(state.health - (.035 * state.extraction + poorConditions) * dt, 0, 100);
    state.trust = clamp(state.trust - (.025 * state.extraction + (state.money > 75 ? .035 : 0)) * dt, 0, 100);
    if (state.health <= 0) endGame(false);
  }

  function updateEntities(dt, now) {
    const basketY = H - 58;
    const basketHalf = now < state.forkUntil ? 78 : 55;
    for (let i = state.entities.length - 1; i >= 0; i--) {
      const e = state.entities[i];
      e.y += e.vy * dt; e.x += e.vx * dt; e.spin += dt * 2;
      if (TYPES[e.type].kind === 'bad') e.x += Math.sin(e.spin * 2.4) * 14 * dt;
      if (e.x < 20 || e.x > W - 20) e.vx *= -1;
      if (e.y + e.size > basketY && e.y - e.size < basketY + 35 && Math.abs(e.x - state.playerX) < basketHalf + e.size * .5) {
        catchEntity(e, now); state.entities.splice(i, 1); continue;
      }
      if (!e.dodged && TYPES[e.type].kind === 'bad' && e.y > basketY + 38) {
        e.dodged = true;
        state.dodges++;
        state.score += 25;
        floatText(clamp(e.x, 70, W - 70), basketY - 8, 'CLEAN DODGE  +25', '#176238');
        beep(250, .04, 'square', .02);
        status(`${TYPES[e.type].label} avoided. Nothing was signed. +25 points.`);
      }
      if (e.y > H + 45) {
        if (TYPES[e.type].kind === 'good') {
          state.health = clamp(state.health - 1.35, 0, 100);
          state.trust = clamp(state.trust - .6, 0, 100);
          status(`${TYPES[e.type].label} missed. The backlog has entered the backlog.`);
        }
        state.entities.splice(i, 1);
      }
    }
  }

  function catchEntity(e, now) {
    const t = TYPES[e.type];
    if (t.kind === 'good') {
      const mult = now < state.multiplierUntil ? 2 : 1;
      const forkMult = now < state.forkUntil ? 1.5 : 1;
      const gain = Math.round(t.value * mult * forkMult);
      state.code = clamp(state.code + (e.type === 'commit' || e.type === 'fix' ? gain : gain * .45), 0, 120);
      state.energy = clamp(state.energy + (e.type === 'hours' ? gain : gain * .38), 0, 100);
      state.trust = clamp(state.trust + (e.type === 'docs' ? gain * .75 : gain * .24), 0, 100);
      state.health = clamp(state.health + gain * .18, 0, 100);
      state.contributions += mult;
      state.combo++; state.comboTimer = 1.6;
      state.score += gain * (1 + Math.min(state.combo, 8) * .1);
      burst(e.x, e.y, t.color, 8);
      const reward = e.type === 'hours' ? `+${gain} ENERGY` : e.type === 'docs' ? `+${Math.round(gain * .75)} TRUST` : `+${gain} CODE`;
      floatText(e.x, e.y - 16, `✓ ${reward}`, '#176238');
      beep(420 + Math.min(state.combo, 7) * 45, .055);
      status(`${t.label} merged${mult > 1 ? ' ×2' : ''}. Nobody read the contribution guide.`);
      if ([3, 6, 10].includes(state.combo)) {
        toast(`<b>${state.combo}× MERGE STREAK</b><br>The Commons is cooking. Keep the useful work flowing!`);
        state.score += state.combo * 10;
      }
      if (state.boss) damageBoss(2.6 * mult * forkMult);
    } else if (t.kind === 'bad') {
      if (e.type === 'lawyer' && state.shieldHits > 0) {
        state.shieldHits--;
        burst(e.x, e.y, '#5d7dd5', 12);
        beep(820, .09, 'sawtooth');
        status('TRADEMARK SHIELD: confusing branding politely redirected.');
        return;
      }
      const damage = t.value * (state.boss ? 1.25 : 1);
      state.health = clamp(state.health - damage, 0, 100);
      state.trust = clamp(state.trust - damage * .55, 0, 100);
      state.energy = clamp(state.energy - damage * .35, 0, 100);
      state.combo = 0;
      burst(e.x, e.y, '#e44045', 13);
      floatText(e.x, e.y - 16, `✕ −${Math.round(damage)} HEALTH`, '#a51f2a');
      shake(); beep(115, .14, 'sawtooth', .05);
      status(`${t.label} landed in the Commons. A meeting has been scheduled.`);
    } else {
      activatePower(e.type, now);
      burst(e.x, e.y, t.color, 16);
      floatText(e.x, e.y - 18, '★ POWER-UP!', '#6b5300');
      beep(660, .08); setTimeout(() => beep(880, .11), 70);
    }
  }

  function activatePower(type, now) {
    if (type === 'five') {
      state.multiplierUntil = now + 12000;
      toast('<b>FIVE FOR THE FUTURE</b><br>Contributions count double for 12 seconds. Calendars cleared!');
      status('Contribution multiplier online. The spreadsheet is inspirational.');
    } else if (type === 'fork') {
      state.forkUntil = now + 11000;
      toast('<b>EMERGENCY FORK</b><br>The tray is wider and useful work is duplicated. Names are being bikeshedded.');
      status('Emergency fork created: same code, spicier README.');
    } else if (type === 'shield') {
      state.shieldHits += 3;
      toast('<b>TRADEMARK SHIELD</b><br>The next 3 tiny lawyers must clarify their nouns.');
      status('Trademark shield armed. Logos are now looking at each other nervously.');
    } else if (type === 'sabbatical') {
      state.energy = clamp(state.energy + 36, 0, 100);
      state.health = clamp(state.health + 14, 0, 100);
      toast('<b>MAINTAINER SABBATICAL</b><br>Morale restored. Notifications remain courageously unread.');
      status('Maintainer took a break and, strangely, the world continued.');
    }
  }

  function reinvest() {
    if (!state.running || state.paused || state.gameOver || performance.now() < state.frozenUntil) return;
    if (state.money < 18 || state.code < 6) {
      status('Reinvestment denied: need $18 and 6 shared code. Synergy cannot be financed by vibes.');
      beep(130, .1, 'square'); return;
    }
    state.money -= 18; state.code -= 6;
    state.health = clamp(state.health + 16, 0, 100);
    state.energy = clamp(state.energy + 13, 0, 100);
    state.trust = clamp(state.trust + 9, 0, 100);
    state.score += 120;
    burst(state.playerX, H - 60, '#ffd33d', 18);
    floatText(state.playerX, H - 90, '+16 HEALTH  +13 ENERGY  +9 TRUST', '#6b5300');
    beep(520, .08); setTimeout(() => beep(720, .12), 70);
    status('Revenue reinvested. A maintainer has seen a dentist.');
    if (state.boss) damageBoss(11);
    updateUI();
  }

  function nextCycle() {
    state.cycleTime = 0;
    if (state.cycle >= 5) { startBoss(); return; }
    state.cycle++;
    state.health = clamp(state.health + 5, 0, 100);
    state.eventTimer = 9 + Math.random() * 7;
    toast(`<b>RELEASE ${state.cycle}:</b> ${cycleNames[state.cycle - 1]}. Extraction pressure increased.`);
    status(`Release ${state.cycle} shipped. Changelog says “miscellaneous improvements.”`);
    beep(370, .1); setTimeout(() => beep(520, .12), 110);
  }

  function triggerEvent(now) {
    const outage = Math.random() < .5;
    if (outage) {
      state.outageUntil = now + 10000;
      toast('<b>PLUGIN DIRECTORY OUTAGE</b><br>Everyone panic for 10 seconds. Controls are reversed. Obviously.');
      status('Directory outage! The status page is also down.');
    } else {
      state.frozenUntil = now + 4200;
      toast('<b>CEASE & DESIST</b><br>Everything is frozen, including you. Billable seconds continue.');
      status('Cease & Desist: all motion paused for mandatory ambiguity.');
    }
    shake(); beep(95, .3, 'sawtooth', .055);
  }

  function startBoss() {
    state.boss = true; state.bossTime = 0; state.bossHealth = 100; state.cycleTime = 0;
    state.entities.length = 0; ui.bossMeter.hidden = false;
    toast('<b>HOSTILE OPTIMIZATION DETECTED</b><br>THE EXTRACTION ENGINE has entered the ecosystem. Merge work and reinvest to fight back!');
    status('FINAL BOSS: Catch contributions to attack. Reinvest for heavy damage.');
    shake(); beep(82, .45, 'sawtooth', .06);
  }

  function damageBoss(amount) {
    state.bossHealth = clamp(state.bossHealth - amount, 0, 100);
    state.projectiles.push({ x: state.playerX, y: H - 70, targetY: 105, life: .42, max: .42 });
    if (state.bossHealth <= 0) endGame(true);
  }

  function endGame(win) {
    if (state.gameOver) return;
    state.gameOver = true; state.running = false;
    ui.bossMeter.hidden = true;
    ui.coach.hidden = true;
    const rank = state.score > 2200 ? 'Benevolent Dictator of Balance' : state.score > 1400 ? 'Senior Forklift Operator' : 'Volunteer Issue Triager';
    const title = win ? 'COMMONS: SUSTAINED!' : 'COMMONS.EXE HAS STOPPED RESPONDING';
    const copy = win
      ? 'You defeated The Extraction Engine with the ancient technology of sharing value. The ecosystem survives until the next pricing page redesign.'
      : 'Community health reached zero. The roadmap is now a sponsored webinar about resilience.';
    state.lastResult = { win, score: Math.round(state.score), contributions: state.contributions, dodges: state.dodges, rank };
    showDialog(title, `<h3>${win ? 'A suspiciously healthy ending.' : 'This is fine. Probably.'}</h3><p>${copy}</p><ul><li><b>Rank:</b> ${rank}</li><li><b>Contributions routed:</b> ${state.contributions}</li><li><b>Hazards cleanly dodged:</b> ${state.dodges}</li><li><b>Reputation-adjusted points:</b> ${Math.round(state.score)}</li><li><b>Revenue left dramatically on table:</b> $${Math.floor(state.money)}</li></ul><div class="share-actions"><button class="share-action" data-share="native">SHARE MY SCORE</button><button class="share-action share-action--copy" data-share="copy">COPY CHALLENGE</button></div><p><small>No real companies, people, or legal claims were simulated. Systems satire only.</small></p>`, 'PLAY AGAIN');
  }

  function updateUI(now = performance.now()) {
    const hp = Math.round(state.health);
    ui.health.textContent = `${hp}%`; ui.healthBar.style.width = `${hp}%`;
    ui.healthBar.parentElement.setAttribute('aria-valuenow', hp);
    ui.healthBar.style.background = hp < 28 ? 'repeating-linear-gradient(90deg,#e44045 0 10px,#a92732 10px 12px)' : hp < 55 ? 'repeating-linear-gradient(90deg,#ffd33d 0 10px,#be9e1e 10px 12px)' : '';
    const releaseProgress = state.boss ? Math.min(100, state.bossTime / 48 * 100) : state.cycleTime / state.cycleLength * 100;
    ui.release.textContent = state.boss ? `${Math.ceil(48 - state.bossTime)}s` : `${Math.floor(releaseProgress)}%`;
    ui.releaseBar.style.width = `${releaseProgress}%`;
    ui.releaseBar.parentElement.setAttribute('aria-valuenow', Math.round(releaseProgress));
    ui.cycle.textContent = state.boss ? 'BOSS' : `${state.cycle} / 5`;
    ui.code.textContent = Math.floor(state.code); ui.money.textContent = Math.floor(state.money);
    ui.energy.textContent = Math.round(state.energy); ui.trust.textContent = Math.round(state.trust); ui.uptime.textContent = state.uptime.toFixed(1);
    ui.extraction.textContent = `extracting ${state.extraction.toFixed(1)}×`;
    ui.pause.disabled = !state.running || state.gameOver || !ui.dialog.hidden;
    ui.pause.textContent = state.manualPause ? 'Resume' : 'Pause';
    const canReinvest = state.money >= 18 && state.code >= 6 && state.running && now >= state.frozenUntil;
    ui.reinvest.disabled = !canReinvest;
    ui.reinvest.classList.toggle('is-ready', canReinvest);
    const moneyNeeded = Math.max(0, 18 - Math.floor(state.money));
    const codeNeeded = Math.max(0, 6 - Math.floor(state.code));
    ui.reinvestHint.textContent = canReinvest
      ? 'READY • Spend $18 + 6 code • Restore health, energy & trust'
      : `Need ${moneyNeeded ? `$${moneyNeeded} more revenue` : '$18 ready'}${codeNeeded ? ` + ${codeNeeded} more code` : ' + code ready'}`;
    ui.reinvest.setAttribute('aria-label', canReinvest ? 'Reinvest now. Spend 18 dollars and 6 code to restore health, energy, and trust.' : ui.reinvestHint.textContent);
    ui.score.textContent = `CAUGHT: ${state.contributions}  •  DODGED: ${state.dodges}  •  PTS: ${Math.round(state.score)}`;
    ui.lamp.textContent = now < state.outageUntil ? 'PANIC' : now < state.frozenUntil ? 'FROZEN' : 'ONLINE';
    ui.lamp.style.color = now < state.outageUntil || now < state.frozenUntil ? '#ffd33d' : '';
    if (state.boss) ui.bossBar.style.width = `${state.bossHealth}%`;
    const effects = [];
    if (now < state.multiplierUntil) effects.push(['FIVE FOR FUTURE', state.multiplierUntil - now, 12000]);
    if (now < state.forkUntil) effects.push(['EMERGENCY FORK', state.forkUntil - now, 11000]);
    if (state.shieldHits > 0) effects.push([`SHIELD ×${state.shieldHits}`, state.shieldHits, 3]);
    if (now < state.outageUntil) effects.push(['DIRECTORY PANIC', state.outageUntil - now, 10000]);
    if (now < state.frozenUntil) effects.push(['CEASE & DESIST', state.frozenUntil - now, 4200]);
    ui.effects.innerHTML = effects.length ? effects.map(([name, left, total]) => `<div class="effect"><span>${name}</span><i style="width:${Math.max(8, left / total * 75)}px"></i></div>`).join('') : '<p>None. Just vibes.</p>';
  }

  function updateCoach() {
    if (!state.running || state.gameOver || state.boss || state.elapsed >= 18) {
      ui.coach.hidden = true;
      return;
    }
    ui.coach.hidden = false;
    ui.coach.className = 'coach-banner';
    if (state.elapsed < 3.5) {
      ui.coachVerb.textContent = '1 • MOVE';
      ui.coachText.textContent = 'Move the blue tray: mouse, touch, ← →, or A D';
    } else if (state.elapsed < 8) {
      ui.coach.classList.add('is-catch');
      ui.coachVerb.textContent = '2 • CATCH';
      ui.coachText.textContent = 'Move under bright items labeled CATCH';
    } else if (state.elapsed < 13) {
      ui.coach.classList.add('is-avoid');
      ui.coachVerb.textContent = '3 • AVOID';
      ui.coachText.textContent = 'Move away from red or gray items labeled AVOID';
    } else {
      ui.coach.classList.add('is-invest');
      ui.coachVerb.textContent = '4 • REINVEST';
      ui.coachText.textContent = 'When the yellow button says READY, press R';
    }
  }

  function draw(now) {
    ctx.clearRect(0, 0, W, H);
    drawBackground();
    if (state.boss) drawBoss(now);
    for (const e of state.entities) drawEntity(e);
    for (const p of state.projectiles) drawProjectile(p);
    drawPlayer(now);
    for (const p of state.particles) drawParticle(p);
    for (const f of state.floaters) drawFloater(f);
    if (now < state.frozenUntil && state.running) drawFrozenOverlay();
    if (now < state.outageUntil && state.running) drawOutageOverlay();
    if (state.combo >= 3) drawCombo();
  }

  function drawBackground() {
    ctx.fillStyle = '#e9dca9'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(62,69,78,.13)'; ctx.lineWidth = 1;
    const grid = 32;
    for (let x = 0; x < W; x += grid) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += grid) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.fillStyle = '#26366e'; ctx.fillRect(0, 0, W, 27);
    ctx.fillStyle = '#f4f0dc'; ctx.font = '800 10px Verdana'; ctx.textAlign = 'left';
    ctx.fillText(state.boss ? 'LIVE: HOSTILE OPTIMIZATION EVENT' : `LIVE: ${cycleNames[state.cycle - 1]}  •  DROP ZONE: COMMONS`, 10, 18);
    ctx.fillStyle = '#c3cbec'; ctx.textAlign = 'right'; ctx.fillText(`QUEUE ${state.entities.length.toString().padStart(2, '0')}`, W - 10, 18);
    ctx.strokeStyle = '#7e734c'; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.moveTo(0, H - 83); ctx.lineTo(W, H - 83); ctx.stroke(); ctx.setLineDash([]);
  }

  function drawEntity(e) {
    ctx.save(); ctx.translate(Math.round(e.x), Math.round(e.y));
    const t = TYPES[e.type];
    if (e.type === 'lawyer') drawLawyer(e);
    else if (e.type === 'bug') drawBug(e);
    else if (e.type === 'invoice') drawInvoice(e);
    else if (t.kind === 'power') drawPower(e);
    else drawGood(e);
    drawCategoryTag(e, t);
    ctx.restore();
  }

  function pixelBox(x, y, w, h, fill, shadow = '#25283a') {
    ctx.fillStyle = shadow; ctx.fillRect(x + 3, y + 3, w, h);
    ctx.fillStyle = fill; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#f8f1d9'; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  }

  function drawGood(e) {
    const t = TYPES[e.type]; pixelBox(-e.size, -e.size, e.size * 2, e.size * 2, t.color);
    ctx.strokeStyle = '#218b50'; ctx.lineWidth = 4; ctx.strokeRect(-e.size - 2, -e.size - 2, e.size * 2 + 4, e.size * 2 + 4);
    ctx.fillStyle = e.type === 'docs' ? '#26304d' : '#fff7dd'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `900 ${e.type === 'hours' ? 19 : 16}px Verdana`;
    const symbols = { commit: '⑂', fix: '+', docs: '≡', hours: '◷' };
    ctx.fillText(symbols[e.type], 0, -2);
  }

  function drawLawyer(e) {
    ctx.strokeStyle = '#596078'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, -e.size - 5, e.size + 4, Math.PI, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-e.size - 4, -e.size - 5); ctx.lineTo(-10, -5); ctx.moveTo(e.size + 4, -e.size - 5); ctx.lineTo(10, -5); ctx.stroke();
    ctx.fillStyle = '#d6b78f'; ctx.fillRect(-7, -8, 14, 12);
    ctx.fillStyle = '#3f4559'; ctx.fillRect(-12, 3, 24, 25);
    ctx.fillStyle = '#f4f0dc'; ctx.fillRect(-3, 4, 6, 19);
    ctx.fillStyle = '#e44045'; ctx.fillRect(-2, 9, 4, 13);
    ctx.fillStyle = '#1d2030'; ctx.fillRect(-8, 28, 6, 8); ctx.fillRect(3, 28, 6, 8);
    ctx.strokeStyle = '#e44045'; ctx.lineWidth = 3; ctx.strokeRect(-15, 0, 30, 39);
  }

  function drawBug(e) {
    ctx.fillStyle = '#842a32'; ctx.fillRect(-15, -10, 30, 24); ctx.fillStyle = '#e44045'; ctx.fillRect(-10, -16, 20, 30);
    ctx.strokeStyle = '#842a32'; ctx.lineWidth = 3;
    for (const s of [-1,1]) for (const yy of [-9,1,11]) { ctx.beginPath(); ctx.moveTo(s*10, yy); ctx.lineTo(s*20, yy-5); ctx.stroke(); }
    ctx.fillStyle = '#ffd33d'; ctx.fillRect(-6, -10, 4, 4); ctx.fillRect(3, -10, 4, 4);
    ctx.strokeStyle = '#e44045'; ctx.lineWidth = 3; ctx.strokeRect(-22, -20, 44, 38);
  }

  function drawInvoice(e) {
    ctx.save(); ctx.rotate(Math.sin(e.spin) * .12); pixelBox(-18, -23, 36, 46, '#f4f0dc');
    ctx.fillStyle = '#e44045'; ctx.fillRect(-13, -16, 26, 5); ctx.fillStyle = '#4c4f5b';
    ctx.fillRect(-12, -6, 22, 2); ctx.fillRect(-12, 0, 19, 2); ctx.fillRect(-12, 6, 25, 2);
    ctx.font = '900 11px Verdana'; ctx.textAlign = 'center'; ctx.fillText('$$$', 0, 17);
    ctx.strokeStyle = '#e44045'; ctx.lineWidth = 3; ctx.strokeRect(-21, -26, 42, 52); ctx.restore();
  }

  function drawPower(e) {
    const t = TYPES[e.type]; const pulse = 1 + Math.sin(e.spin * 3) * .07;
    ctx.save(); ctx.scale(pulse, pulse); ctx.rotate(e.spin * .35); pixelBox(-22, -22, 44, 44, t.color, '#4b3050');
    ctx.strokeStyle = '#ffd33d'; ctx.lineWidth = 4; ctx.strokeRect(-26, -26, 52, 52); ctx.restore();
    ctx.fillStyle = '#fff7dd'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '900 19px Verdana';
    const symbols = { five: '5×', fork: '⑂', shield: '◇', sabbatical: 'Zz' };
    ctx.fillText(symbols[e.type], 0, -1);
  }

  function drawCategoryTag(e, t) {
    const prefix = t.kind === 'good' ? 'CATCH' : t.kind === 'bad' ? 'AVOID' : 'GRAB';
    const text = `${prefix} • ${t.label}`;
    const tagY = e.type === 'lawyer' ? 48 : e.size + 11;
    ctx.font = '900 7px Verdana';
    const width = Math.ceil(ctx.measureText(text).width) + 12;
    const fill = t.kind === 'good' ? '#176238' : t.kind === 'bad' ? '#b22632' : '#ffd33d';
    ctx.fillStyle = '#242736'; ctx.fillRect(-width / 2 + 2, tagY + 2, width, 14);
    ctx.fillStyle = fill; ctx.fillRect(-width / 2, tagY, width, 14);
    ctx.fillStyle = t.kind === 'power' ? '#242736' : '#fff7dd';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 0, tagY + 7);
  }

  function drawPlayer(now) {
    const x = Math.round(state.playerX), y = H - 58;
    const forked = now < state.forkUntil;
    const half = forked ? 78 : 55;
    ctx.fillStyle = '#131a3b'; ctx.fillRect(x - half + 4, y + 7, half * 2, 35);
    ctx.fillStyle = forked ? '#e850a7' : '#3158b5'; ctx.fillRect(x - half, y, half * 2, 35);
    ctx.fillStyle = '#7995df'; ctx.fillRect(x - half + 5, y + 5, half * 2 - 10, 6);
    ctx.fillStyle = '#f4f0dc'; ctx.textAlign = 'center'; ctx.font = '900 11px Verdana'; ctx.fillText(forked ? 'COMMONS // FORK' : 'THE COMMONS', x, y + 26);
    // cheerful block mascot
    ctx.fillStyle = '#ffd33d'; ctx.fillRect(x - 14, y - 23, 28, 24);
    ctx.fillStyle = '#26366e'; ctx.fillRect(x - 8, y - 16, 4, 4); ctx.fillRect(x + 5, y - 16, 4, 4);
    ctx.fillRect(x - 7, y - 8, 15, 3); ctx.fillStyle = '#ff4b8b'; ctx.fillRect(x - 18, y - 12, 4, 7); ctx.fillRect(x + 15, y - 12, 4, 7);
    if (state.shieldHits > 0) {
      const pulse = .78 + Math.sin(now / 180) * .18;
      ctx.save(); ctx.globalAlpha = pulse; ctx.strokeStyle = '#4474da'; ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x - half - 12, y - 25); ctx.lineTo(x + half + 12, y - 25);
      ctx.lineTo(x + half + 18, y + 9); ctx.lineTo(x + half + 8, y + 43);
      ctx.lineTo(x, y + 52); ctx.lineTo(x - half - 8, y + 43); ctx.lineTo(x - half - 18, y + 9);
      ctx.closePath(); ctx.stroke(); ctx.globalAlpha = 1;
      const badge = `SHIELD ×${state.shieldHits}`;
      ctx.font = '900 8px Verdana'; const badgeWidth = ctx.measureText(badge).width + 12;
      ctx.fillStyle = '#4474da'; ctx.fillRect(x - badgeWidth / 2, y - 38, badgeWidth, 15);
      ctx.fillStyle = '#fff7dd'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(badge, x, y - 30);
      ctx.restore();
    }
  }

  function drawBoss(now) {
    const x = W / 2, y = 90 + Math.sin(now / 280) * 4;
    ctx.fillStyle = 'rgba(40,24,54,.16)'; ctx.fillRect(0, 28, W, 120);
    ctx.fillStyle = '#321d42'; ctx.fillRect(x - 76, y - 28, 152, 70);
    ctx.fillStyle = '#5a2b68'; ctx.fillRect(x - 68, y - 20, 136, 54);
    ctx.fillStyle = '#ff4b8b'; ctx.fillRect(x - 52, y - 9, 104, 20);
    ctx.fillStyle = '#27152f'; ctx.fillRect(x - 44, y - 4, 88, 10);
    ctx.fillStyle = '#ffd33d';
    for (let i = -3; i <= 3; i++) ctx.fillRect(x + i * 13 - 3, y - 1, 6, 4 + Math.abs(i) * 2);
    ctx.fillStyle = '#f4f0dc'; ctx.font = '900 9px Verdana'; ctx.textAlign = 'center'; ctx.fillText('EXTRACTION ENGINE', x, y + 28);
    ctx.fillStyle = '#321d42'; ctx.fillRect(x - 93, y - 19, 17, 13); ctx.fillRect(x + 76, y - 19, 17, 13);
  }

  function drawProjectile(p) {
    ctx.fillStyle = '#ffd33d'; ctx.fillRect(p.x - 4, p.y - 8, 8, 16);
    ctx.fillStyle = '#ff4b8b'; ctx.fillRect(p.x - 2, p.y + 8, 4, 8);
  }

  function burst(x, y, color, count) {
    for (let i = 0; i < count; i++) state.particles.push({ x, y, vx: (Math.random() - .5) * 160, vy: (Math.random() - .7) * 150, life: .45 + Math.random() * .35, max: .8, color, size: 3 + Math.random() * 5 });
  }

  function updateParticles(dt) {
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 240 * dt; p.life -= dt;
      if (p.life <= 0) state.particles.splice(i, 1);
    }
  }
  function updateProjectiles(dt) {
    for (let i = state.projectiles.length - 1; i >= 0; i--) {
      const p = state.projectiles[i]; p.life -= dt; p.y += (p.targetY - p.y) * Math.min(1, dt * 13);
      if (p.life <= 0) state.projectiles.splice(i, 1);
    }
  }
  function floatText(x, y, text, color) {
    state.floaters.push({ x, y, text, color, life: 1.05, max: 1.05 });
  }
  function updateFloaters(dt) {
    for (let i = state.floaters.length - 1; i >= 0; i--) {
      const f = state.floaters[i]; f.y -= 28 * dt; f.life -= dt;
      if (f.life <= 0) state.floaters.splice(i, 1);
    }
  }
  function drawFloater(f) {
    const alpha = Math.max(0, f.life / f.max);
    ctx.globalAlpha = alpha;
    ctx.font = '900 10px Verdana'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const width = ctx.measureText(f.text).width + 12;
    ctx.fillStyle = '#fff7dd'; ctx.fillRect(f.x - width / 2, f.y - 9, width, 18);
    ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y);
    ctx.globalAlpha = 1;
  }
  function drawParticle(p) { ctx.globalAlpha = Math.max(0, p.life / p.max); ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.size, p.size); ctx.globalAlpha = 1; }

  function drawFrozenOverlay() {
    ctx.fillStyle = 'rgba(24,35,79,.48)'; ctx.fillRect(0, 27, W, H - 27);
    ctx.fillStyle = '#f4f0dc'; ctx.textAlign = 'center'; ctx.font = '900 22px Georgia'; ctx.fillText('CEASE & DESIST', W / 2, H / 2 - 5);
    ctx.font = '800 9px Verdana'; ctx.fillText('PLEASE REMAIN LEGALLY MOTIONLESS', W / 2, H / 2 + 15);
  }
  function drawOutageOverlay() {
    ctx.fillStyle = '#e44045'; ctx.fillRect(8, 36, 184, 22); ctx.fillStyle = '#fff7dd'; ctx.textAlign = 'left'; ctx.font = '900 9px Verdana'; ctx.fillText('DIRECTORY OFFLINE • PANIC MODE', 16, 51);
  }
  function drawCombo() { ctx.fillStyle = '#26366e'; ctx.textAlign = 'right'; ctx.font = '900 17px Georgia'; ctx.fillText(`${state.combo}× MERGE STREAK`, W - 14, H - 95); }

  function status(text) { ui.status.textContent = text; }
  function toast(html) {
    const el = document.createElement('div'); el.className = 'toast'; el.innerHTML = html; ui.toasts.appendChild(el);
    setTimeout(() => el.remove(), 4200);
  }
  function shake() { document.querySelector('.game-window').classList.remove('screen-shake'); void document.querySelector('.game-window').offsetWidth; document.querySelector('.game-window').classList.add('screen-shake'); }
  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

  function showDialog(title, body, button = 'OK') {
    state.paused = state.running;
    ui.pause.disabled = true;
    ui.dialogTitle.textContent = title; ui.dialogBody.innerHTML = body; ui.dialogOk.textContent = button; ui.dialog.hidden = false; ui.dialogOk.focus();
  }
  function closeDialog() {
    const replay = state.gameOver;
    ui.dialog.hidden = true; state.paused = state.manualPause;
    if (replay) reset();
    else {
      updateUI();
      if (state.manualPause) ui.resume.focus();
      else if (state.running) canvas.focus();
      else ui.startButton.focus();
    }
  }

  function togglePause() {
    if (!state.running || state.gameOver || !ui.dialog.hidden) return;
    state.manualPause = !state.manualPause;
    state.paused = state.manualPause;
    state.autoPaused = false;
    ui.pausePanel.hidden = !state.manualPause;
    ui.pause.textContent = state.manualPause ? 'Resume' : 'Pause';
    status(state.manualPause ? 'Paused. The backlog has agreed to remain exactly where it is.' : 'Resumed. The backlog denies moving while unattended.');
    if (state.manualPause) ui.resume.focus();
    else { state.last = performance.now(); canvas.focus(); }
  }

  function returnToTitle() {
    Object.assign(state, {
      running: false, paused: false, gameOver: false, manualPause: false, autoPaused: false,
      elapsed: 0, cycleTime: 0, cycle: 1, boss: false, bossTime: 0, bossHealth: 100,
      entities: [], particles: [], projectiles: [], floaters: [], spawnTimer: 0, eventTimer: 16,
      health: 72, code: 42, money: 0, energy: 68, trust: 74, uptime: 99.9, contributions: 0, dodges: 0, score: 0,
      extraction: 1, multiplierUntil: 0, forkUntil: 0, shieldHits: 0, frozenUntil: 0, outageUntil: 0,
      combo: 0, comboTimer: 0, tutorialDrop: 0, lastResult: null, playerX: W / 2, targetX: W / 2
    });
    ui.pausePanel.hidden = true; ui.coach.hidden = true; ui.bossMeter.hidden = true; ui.startPanel.hidden = false;
    ui.toasts.replaceChildren();
    status('Ready. The Commons is cautiously optimistic.');
    updateUI(); ui.startButton.focus();
  }
  function showHelp() {
    showDialog('How to sustain a Commons', `<h3>Move the blue tray. Read the falling labels.</h3><ul><li><b>Move:</b> use ← →, A D, mouse, or touch.</li><li><b>CATCH:</b> commits, fixes, docs, and volunteer hours have green frames.</li><li><b>AVOID:</b> lawyers, bugs, and invoices have red frames and wobble.</li><li><b>GRAB:</b> flashing gold power-ups give temporary advantages.</li><li><b>Reinvest:</b> when the yellow button says READY, press R. Spending $18 revenue + 6 code restores health, energy, and trust.</li><li><b>Pause or exit:</b> press P or Esc. The pause screen can resume the run or return to the title.</li><li><b>Final boss:</b> catches attack; reinvestment deals heavy damage.</li></ul><p><b>Tip:</b> Useful work creates shared code. The host converts code into revenue. Put some of that value back before the community burns out.</p>`);
  }

  function showAbout() {
    showDialog('About this tiny executable', `<h3>Systems satire, not a reenactment.</h3><p><i>Fork Around &amp; Find Out</i> is a fictional arcade game about the incentives that pull open-source communities in different directions. It does not represent real companies, people, or legal claims.</p><dl class="about-facts"><dt>Version</dt><dd>1.0 Community Edition</dd><dt>Built with</dt><dd>Vanilla HTML, CSS, Canvas, and JavaScript</dd><dt>Licence</dt><dd>MIT</dd><dt>Tracking</dt><dd>None</dd><dt>Credits</dt><dd>Created collaboratively with OpenAI Codex</dd></dl><p>Study it, fork it, remix it, and keep the Commons weird.</p>`, 'CLOSE');
  }

  function challengeText() {
    const result = state.lastResult;
    if (!result) return 'Can you keep the Commons alive and defeat The Extraction Engine in Fork Around & Find Out?';
    const outcome = result.win ? 'I sustained the Commons' : 'The Commons got extracted';
    return `${outcome} with ${result.score} points, ${result.contributions} contributions caught, and ${result.dodges} hazards dodged. Can you beat my score in Fork Around & Find Out?`;
  }

  async function copyChallenge() {
    const pageUrl = location.protocol === 'file:' ? '' : location.href.split('#')[0];
    const shareText = `${challengeText()}${pageUrl ? ` ${pageUrl}` : ''}`;
    try {
      await navigator.clipboard.writeText(shareText);
    } catch {
      const field = document.createElement('textarea');
      field.value = shareText; field.setAttribute('readonly', ''); field.style.position = 'fixed'; field.style.opacity = '0';
      document.body.appendChild(field); field.select(); document.execCommand('copy'); field.remove();
    }
    toast('<b>CHALLENGE COPIED</b><br>Paste it wherever your community gathers.');
    status('Score challenge copied. The leaderboard is now socially constructed.');
  }

  async function shareResult() {
    const pageUrl = location.protocol === 'file:' ? '' : location.href.split('#')[0];
    if (!navigator.share) { await copyChallenge(); return; }
    try {
      await navigator.share({ title: 'Fork Around & Find Out', text: challengeText(), ...(pageUrl ? { url: pageUrl } : {}) });
      status('Score shared. Healthy competition has entered the Commons.');
    } catch (error) {
      if (error?.name !== 'AbortError') await copyChallenge();
    }
  }

  function frame(now) {
    const dt = Math.min(.035, (now - (state.last || now)) / 1000);
    state.last = now;
    if (state.running && !state.paused && !state.gameOver) {
      state.eventTimer -= dt;
      if (!state.boss && state.cycle >= 2 && state.eventTimer <= 0) { triggerEvent(now); state.eventTimer = 21 + Math.random() * 14; }
    }
    update(dt, now); draw(now); requestAnimationFrame(frame);
  }

  canvas.addEventListener('pointermove', (e) => {
    if (!state.running || state.paused) return;
    const rect = canvas.getBoundingClientRect();
    let x = e.clientX - rect.left;
    if (performance.now() < state.outageUntil) x = W - x;
    state.targetX = clamp(x, 48, W - 48);
  });
  canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture?.(e.pointerId); ensureAudio(); });
  window.addEventListener('keydown', (e) => {
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    state.keys[key] = true;
    if (['ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    if (key === 'r') reinvest();
    if (e.key === 'Escape' && !ui.dialog.hidden) closeDialog();
    else if ((key === 'p' || e.key === 'Escape') && state.running) { e.preventDefault(); togglePause(); }
  });
  window.addEventListener('keyup', (e) => { state.keys[e.key.length === 1 ? e.key.toLowerCase() : e.key] = false; });
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => {
    if (!state.running || state.gameOver || !ui.dialog.hidden || state.manualPause) return;
    if (document.hidden) {
      state.paused = true; state.autoPaused = true;
      status('Paused while you inspect a different tab. Healthy boundaries!');
    } else if (state.autoPaused) {
      state.paused = false; state.autoPaused = false; state.last = performance.now();
      status('Welcome back. The backlog noticed nothing.');
    }
  });

  ui.startButton.addEventListener('click', reset);
  ui.newGame.addEventListener('click', reset);
  ui.how.addEventListener('click', showHelp);
  ui.about.addEventListener('click', showAbout);
  ui.pause.addEventListener('click', togglePause);
  ui.resume.addEventListener('click', togglePause);
  ui.exit.addEventListener('click', returnToTitle);
  ui.reinvest.addEventListener('click', reinvest);
  ui.dialogBody.addEventListener('click', (event) => {
    const button = event.target.closest('[data-share]');
    if (!button) return;
    if (button.dataset.share === 'native') shareResult(); else copyChallenge();
  });
  ui.dialogClose.addEventListener('click', closeDialog); ui.dialogOk.addEventListener('click', closeDialog);
  ui.mute.addEventListener('click', () => { state.muted = !state.muted; ui.mute.textContent = `Sound: ${state.muted ? 'OFF' : 'ON'}`; ui.mute.setAttribute('aria-pressed', String(state.muted)); if (!state.muted) { ensureAudio(); beep(520); } });

  resize(); updateUI(); requestAnimationFrame(frame);
})();
