(function (EI) {
  'use strict';

  const { catalog, deck, rng, shuffle } = EI.cards;
  const view = EI.render;
  const { ui } = view;
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  const shotSeed = 419726;
  const healthCap = 30;
  const energyCap = 3;
  const handCap = 7;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sessionSeed = shot ? shotSeed : Number(params.get('seed')) || (Date.now() ^ Math.floor(Math.random() * 2 ** 32));
  const names = { player: 'Ember', ai: 'Ivy' };
  let roundsStarted = 0;
  let state = newDuel(sessionSeed);
  let focusReturn;
  let pausedAction;

  function newDuel(seed) {
    const random = rng(seed);
    return {
      phase: 'title', active: 'player', turns: 0, winner: null, damage: 0, note: '',
      random, player: newDuelist(random), ai: newDuelist(random),
    };
  }

  function newDuelist(random) {
    return {
      life: healthCap, energy: 0, hand: [], deck: deck(random), discard: [],
      revealed: null, shield: false, mirror: false, poison: 0,
    };
  }

  const other = side => side === 'player' ? 'ai' : 'player';
  const helpOpen = () => !ui('help-overlay').hidden;
  const paint = arrivals => view.paint(state, play, arrivals);
  const say = message => { state.note = message; };

  function later(action, delay) {
    window.setTimeout(() => {
      if (helpOpen()) pausedAction = action;
      else action();
    }, reducedMotion ? Math.min(delay, 80) : delay);
  }

  function start() {
    if (state.phase !== 'title' && state.phase !== 'result') return;
    EI.audio.unlock();
    view.clearMotion();
    state = newDuel(sessionSeed + roundsStarted++ * 7919);
    state.phase = 'dealing';
    say('Five opening cards for each duelist.');
    draw(state.player, 5);
    draw(state.ai, 5);
    paint({ player: 5, ai: 5 });
    EI.audio.cue('deal');
    later(() => beginTurn('player'), 460);
  }

  function draw(duelist, count) {
    const result = { kept: 0, burned: [] };
    for (let drawIndex = 0; drawIndex < count; drawIndex++) {
      if (!duelist.deck.length) {
        duelist.deck = shuffle(duelist.discard, state.random);
        duelist.discard = [];
        duelist.revealed = null;
      }
      if (!duelist.deck.length) break;
      const id = duelist.deck.pop();
      if (duelist.hand.length >= handCap) result.burned.push(id);
      else {
        duelist.hand.push(id);
        result.kept++;
      }
    }
    return result;
  }

  function discard(duelist, ids) {
    if (!ids.length) return;
    duelist.discard.push(...ids);
    duelist.revealed = ids[ids.length - 1];
  }

  // Reused for live spells and the AI's strike forecasts. Each guard is spent before a reflection can recurse.
  function strike(target, attacker, amount) {
    if (target.shield) {
      target.shield = false;
      return [{ kind: 'shield', target }];
    }
    if (target.mirror) {
      target.mirror = false;
      return [{ kind: 'mirror', target }, ...strike(attacker, target, amount)];
    }
    const damage = Math.min(target.life, amount);
    target.life -= damage;
    return [{ kind: 'damage', target, damage }];
  }

  function hit(side, amount, poisoned = false) {
    const events = strike(state[side], state[other(side)], amount);
    return events.map(event => {
      const recipient = event.target === state.player ? 'player' : 'ai';
      if (event.kind === 'damage') {
        if (recipient === 'ai') state.damage += event.damage;
        view.float(recipient, event.damage, poisoned ? 'is-poison' : '');
        EI.audio.cue(poisoned ? 'poison' : 'hit');
        return names[recipient] + ' takes ' + event.damage;
      }
      EI.audio.cue('guard');
      return names[recipient] + (event.kind === 'shield' ? ' blocks the hit' : ' reflects it');
    }).join(' · ');
  }

  function burnNote(burned) {
    return burned.length ? ' Full hand burns ' + burned.map(id => catalog[id].name).join(' and ') + '.' : '';
  }

  function beginTurn(side) {
    state.active = side;
    state.phase = 'resolving';
    const duelist = state[side];
    duelist.energy = energyCap;
    if (side === 'player') state.turns++;
    if (duelist.poison) {
      const effect = hit(side, 2, true);
      duelist.poison--;
      say('Venom · ' + effect + '.');
      paint();
      later(() => {
        if (!finishIfFallen()) prepareHand(side);
      }, 430);
    } else {
      say(side === 'player' ? 'Choose a spell or pass to Ivy.' : 'The Warden considers their hand.');
      prepareHand(side);
    }
  }

  function prepareHand(side) {
    const duelist = state[side];
    const { kept, burned } = draw(duelist, 2);
    discard(duelist, burned);
    if (burned.length) say(state.note + burnNote(burned));
    if (kept || burned.length) EI.audio.cue('deal');
    state.phase = side;
    paint({ [side]: kept });
    if (side === 'ai') later(aiStep, 420);
  }

  function play(index) {
    if (state.phase !== 'player' || helpOpen()) return false;
    const card = catalog[state.player.hand[index]];
    if (!card) return false;
    if (card.cost > state.player.energy) {
      say(card.name + ' needs ' + card.cost + ' energy.');
      ui('battle-note').textContent = state.note;
      return false;
    }
    const restoreCardFocus = document.activeElement === view.playerCard(index);
    EI.audio.unlock();
    cast('player', index, restoreCardFocus);
    return true;
  }

  function cast(side, index, restoreCardFocus = false) {
    const duelist = state[side];
    const id = duelist.hand[index];
    const card = catalog[id];
    view.clearMotion();
    const flight = view.fly(id, side, index);
    state.phase = 'resolving';
    duelist.energy -= card.cost;
    duelist.hand.splice(index, 1);
    say(names[side] + ' casts ' + card.name + '.');
    paint();
    EI.audio.cue('play');

    later(() => {
      flight.classList.add('spent');
      const result = resolveSpell(side, card);
      discard(duelist, [id, ...result.burned]);
      paint({ [side]: result.kept });
      later(() => {
        flight.remove();
        if (finishIfFallen()) return;
        state.phase = side;
        paint();
        if (side === 'ai') later(aiStep, 280);
        else if (restoreCardFocus) (view.playerCard(index) || ui('end-turn')).focus();
      }, 335);
    }, 420);
  }

  function resolveSpell(side, card) {
    const actor = state[side];
    const opponent = state[other(side)];
    let detail;
    let drawn = { kept: 0, burned: [] };
    switch (card.effect) {
      case 'damage':
        detail = hit(other(side), card.value);
        break;
      case 'heal': {
        const healed = Math.min(healthCap - actor.life, card.value);
        actor.life += healed;
        if (healed) view.float(side, '+' + healed, 'is-heal');
        EI.audio.cue('heal');
        detail = healed ? names[side] + ' restores ' + healed + ' life' : names[side] + ' is already at full life';
        break;
      }
      case 'shield':
        actor.shield = true;
        EI.audio.cue('guard');
        detail = names[side] + ' is shielded';
        break;
      case 'mirror':
        actor.mirror = true;
        EI.audio.cue('guard');
        detail = names[side] + ' readies a reflection';
        break;
      case 'draw':
        drawn = draw(actor, card.value);
        EI.audio.cue('deal');
        detail = names[side] + ' draws ' + (drawn.kept + drawn.burned.length);
        break;
      case 'poison':
        opponent.poison = 3;
        EI.audio.cue('poison');
        detail = names[other(side)] + ' is poisoned for 3 turns';
        break;
    }
    say(card.name + ' · ' + detail + '.' + burnNote(drawn.burned));
    return drawn;
  }

  function aiStep() {
    const choice = EI.ai.choose(state, strike);
    if (choice === -1) beginTurn('player');
    else cast('ai', choice);
  }

  function endTurn() {
    if (state.phase !== 'player' || helpOpen()) return false;
    EI.audio.unlock();
    view.clearMotion();
    beginTurn('ai');
    return true;
  }

  function finishIfFallen() {
    if (state.player.life && state.ai.life) return false;
    state.winner = state.player.life ? 'player' : 'ai';
    state.phase = 'result';
    view.clearMotion();
    paint();
    EI.audio.cue(state.winner === 'player' ? 'win' : 'loss');
    ui('again-button').focus();
    return true;
  }

  function stageHand(duelist, hand, spent) {
    duelist.hand = hand;
    discard(duelist, spent);
    for (const id of [...hand, ...spent]) duelist.deck.splice(duelist.deck.indexOf(id), 1);
  }

  function stageShot() {
    if (shot === 'play') {
      Object.assign(state, { phase: 'player', active: 'player', turns: 4, damage: 13 });
      Object.assign(state.player, { life: 22, energy: 2 });
      Object.assign(state.ai, { life: 17, poison: 2 });
      stageHand(state.player, ['spark', 'wildfire', 'bloom', 'venom', 'gust'], ['aegis', 'venom', 'sap', 'spark', 'cinder']);
      stageHand(state.ai, ['spark', 'sap', 'aegis', 'wildfire'], ['mirror', 'cinder', 'gust', 'bloom']);
      say('Cinder · Ivy takes 5.');
      view.float('ai', 5, '', true);
    } else if (shot === 'win' || shot === 'loss') {
      const won = shot === 'win';
      Object.assign(state, { phase: 'result', winner: won ? 'player' : 'ai', turns: won ? 9 : 8, damage: won ? 42 : 28 });
      state.player.life = won ? 11 : 0;
      state.ai.life = won ? 0 : 9;
    }
    paint();
  }

  function openHelp() {
    if (helpOpen()) return;
    focusReturn = document.activeElement;
    ui('help-overlay').hidden = false;
    ui('close-help').focus();
  }

  function closeHelp() {
    if (!helpOpen()) return;
    ui('help-overlay').hidden = true;
    focusReturn?.focus();
    if (pausedAction) {
      const action = pausedAction;
      pausedAction = null;
      later(action, 60);
    }
  }

  function toggleSound() {
    const muted = EI.audio.toggle();
    ui('sound-button').textContent = muted ? 'Sound off' : 'Sound on';
    ui('sound-button').setAttribute('aria-pressed', String(muted));
  }

  function onKey(event) {
    if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
    if (event.key.toLowerCase() === 'm') {
      event.preventDefault();
      toggleSound();
    } else if (helpOpen()) {
      if (event.key === 'Escape') closeHelp();
      if (event.key === 'Tab') event.preventDefault();
    } else if (state.phase === 'player') {
      if (event.code === 'Space' || event.key === ' ') {
        event.preventDefault();
        endTurn();
      } else if (/^[1-7]$/.test(event.key)) {
        play(Number(event.key) - 1);
      }
    }
  }

  ui('start-button').addEventListener('click', start);
  ui('again-button').addEventListener('click', start);
  ui('end-turn').addEventListener('click', endTurn);
  ui('help-button').addEventListener('click', openHelp);
  ui('title-help').addEventListener('click', openHelp);
  ui('close-help').addEventListener('click', closeHelp);
  ui('help-overlay').addEventListener('click', event => {
    if (event.target === ui('help-overlay')) closeHelp();
  });
  ui('sound-button').addEventListener('click', toggleSound);
  document.addEventListener('keydown', onKey);
  window.addEventListener('resize', view.resize);

  view.resize();
  view.fillHelp();
  stageShot();
  EI.game = { start, play, endTurn, get state() { return state; } };
})(window.EI);
