(function (EI) {
  'use strict';

  const ui = id => document.getElementById(id);
  const { catalog } = EI.cards;
  const schoolArt = { ember: 'flame', ivy: 'leaf', gust: 'swirl', venom: 'vial', mirror: 'mirror' };
  const icon = (art, extra = '') =>
    `<svg ${extra} aria-hidden="true"><use href="#art-${art}"></use></svg>`;
  const backArt = `<svg class="back-art" viewBox="0 0 74 104" aria-hidden="true">
    <path fill="none" d="M37 9 65 52 37 95 9 52Zm0 8 22 35-22 35-22-35Zm0 9 16 26-16 26-16-26Z"/>
    <path fill="currentColor" d="M37 37 46 52l-9 15-9-15Zm0-31 3 4-3 4-3-4Zm0 84 3 4-3 4-3-4ZM11 15l4 5-4 5-4-5Zm52 64 4 5-4 5-4-5ZM63 15l4 5-4 5-4-5ZM11 79l4 5-4 5-4-5Z"/>
    <path fill="#681f29" d="M37 47 40 52l-3 5-3-5Z"/>
  </svg>`;

  function makeCard(id, key, playable) {
    const card = catalog[id];
    const node = document.createElement(key ? 'button' : 'div');
    node.className = 'card card-' + card.school;
    node.innerHTML = `<span class="card-band">${card.name}</span><span class="cost">${card.cost}</span>
      <span class="card-art"><span class="card-value">${card.value}</span>${icon(schoolArt[card.school])}</span>
      <span class="card-description">${card.text}</span>${key ? `<span class="card-key">${key}</span>` : ''}`;
    if (key) {
      node.type = 'button';
      node.dataset.slot = key - 1;
      node.setAttribute('aria-keyshortcuts', String(key));
      node.setAttribute('aria-disabled', String(!playable));
      node.setAttribute('aria-label', `${card.name}, ${card.cost} energy. ${card.text} Key ${key}.`);
      node.title = card.name + ' · ' + card.cost + ' energy · ' + card.text;
    }
    return node;
  }

  function makeBack() {
    const node = document.createElement('div');
    node.className = 'card-back';
    node.innerHTML = backArt;
    node.setAttribute('aria-hidden', 'true');
    return node;
  }

  function status(art, label, turns, modifier) {
    return `<span class="status status-${modifier}" title="${label}" aria-label="${label}">${icon(art)}${turns}</span>`;
  }

  function paintDuelist(side, duelist) {
    const name = side === 'player' ? 'Ember Mage' : 'Ivy Warden';
    const art = side === 'player' ? 'ember-mage' : 'ivy-warden';
    const statuses = [
      duelist.poison ? status('vial', `Poisoned, ${duelist.poison} ticks left`, duelist.poison, 'poison') : '',
      duelist.shield ? status('shield', 'Shield absorbs the next hit', '', 'shield') : '',
      duelist.mirror ? status('mirror', 'Mirror reflects the next hit', '', 'mirror') : '',
    ].join('');
    ui(side + '-portrait').innerHTML = `<div class="portrait">${icon(art)}<div class="statuses">${statuses}</div></div>
      <p class="duelist-name">${name}</p><p class="life-count">${duelist.life} <span>/ 30</span></p>
      <div class="life-track" role="meter" aria-label="${name} life" aria-valuemin="0" aria-valuemax="30" aria-valuenow="${duelist.life}">
        <span class="life-fill" style="width:${duelist.life / 30 * 100}%"></span>
      </div>`;
  }

  function paintPiles(side, duelist) {
    const discard = catalog[duelist.revealed];
    const cover = discard
      ? icon(schoolArt[discard.school]) + '<span class="discard-name">' + discard.name + '</span>'
      : '—';
    const discardLabel = discard ? 'Top discard: ' + discard.name : 'Empty discard';
    ui(side + '-piles').innerHTML = `<div class="pile deck-pile" title="${duelist.deck.length} cards in deck">
      <div class="pile-card">${backArt}</div><span class="pile-count">${duelist.deck.length}</span><span class="pile-label">Deck</span>
    </div><div class="pile pile-discard" title="${discardLabel}">
      <div class="pile-card ${discard ? 'has-card card-' + discard.school : ''}">${cover}</div>
      <span class="pile-count">${duelist.discard.length}</span><span class="pile-label">Discard</span>
    </div>`;
  }

  function paintHands(state, onPlay, arrivals) {
    const { player, ai, phase } = state;
    const ours = player.hand.map((id, index) => {
      const node = makeCard(id, index + 1, phase === 'player' && catalog[id].cost <= player.energy);
      node.addEventListener('click', () => onPlay(index));
      return node;
    });
    const theirs = ai.hand.map(makeBack);
    ui('player-hand').replaceChildren(...ours);
    ui('ai-hand').replaceChildren(...theirs);
    ui('player-hand-caption').textContent = `Your hand · ${ours.length} / 7`;
    ui('ai-hand-caption').textContent = `Ivy’s hand · ${theirs.length} ${theirs.length === 1 ? 'card' : 'cards'}`;
    if (arrivals.player) fanIn(ours.slice(-arrivals.player));
    if (arrivals.ai) fanIn(theirs.slice(-arrivals.ai));
  }

  function fanIn(cards) {
    cards.forEach(card => card.classList.add('arriving'));
    nextPaint(() => cards.forEach(card => card.classList.remove('arriving')));
  }

  function nextPaint(callback) {
    window.requestAnimationFrame(() => window.requestAnimationFrame(callback));
  }

  function playerCard(index) {
    const hand = ui('player-hand').children;
    return hand[Math.min(index, hand.length - 1)];
  }

  function paint(state, onPlay, arrivals = {}) {
    const playing = state.phase !== 'title' && state.phase !== 'result';
    ui('title-screen').hidden = state.phase !== 'title';
    ui('help-button').hidden = state.phase === 'title';
    ui('table').hidden = !playing;
    ui('turn-controls').hidden = !playing;
    ui('result-screen').hidden = state.phase !== 'result';
    if (!playing) {
      if (state.phase === 'result') paintResult(state);
      return;
    }

    paintDuelist('player', state.player);
    paintDuelist('ai', state.ai);
    paintPiles('player', state.player);
    paintPiles('ai', state.ai);
    paintHands(state, onPlay, arrivals);
    ui('end-turn').disabled = state.phase !== 'player';
    const energy = state.player.energy;
    const crystals = Array.from({ length: 3 }, (_, i) =>
      `<span class="crystal${i < energy ? ' full' : ''}"></span>`).join('');
    ui('energy').innerHTML = `<span class="energy-label">Your energy</span><div class="crystals" aria-hidden="true">${crystals}</div>
      <span class="energy-count">${energy} / 3</span>`;

    const banner = state.phase === 'dealing' ? 'DEALING' : state.active === 'player' ? 'YOUR TURN' : 'IVY’S TURN';
    setText('round-label', state.turns ? 'Duel turn ' + state.turns : 'Opening hand');
    setText('turn-banner', banner);
    setText('battle-note', state.note);
  }

  function setText(id, value) {
    const node = ui(id);
    if (node.textContent !== value) node.textContent = value;
  }

  function paintResult(state) {
    const won = state.winner === 'player';
    ui('result-screen').dataset.winner = state.winner;
    ui('result-icon').setAttribute('href', won ? '#art-flame' : '#art-leaf');
    ui('result-order').textContent = won ? 'Ember holds the court' : 'Ivy holds the court';
    ui('result-heading').textContent = won ? 'VICTORY' : 'DEFEAT';
    ui('result-subtitle').textContent = won ? 'the laurels are yours' : 'the court keeps its laurels';
    const stats = [['Turns taken', state.turns], ['Damage dealt', state.damage], ['Life remaining', state.player.life]];
    ui('result-stats').innerHTML = stats.map(([label, value]) =>
      `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('');
  }

  function fly(id, side, index) {
    const source = ui(side + '-hand').children[index];
    const node = makeCard(id);
    node.classList.add('flying-card');
    if (source) {
      const origin = source.getBoundingClientRect();
      const stage = ui('stage').getBoundingClientRect();
      const scale = stage.width / 1280;
      const x = (origin.left + origin.width / 2 - stage.left) / scale - 640;
      const y = (origin.top + origin.height / 2 - stage.top) / scale - 353;
      node.style.setProperty('--origin-x', x + 'px');
      node.style.setProperty('--origin-y', y + 'px');
      node.style.setProperty('--origin-scale', String(origin.width / scale / 118));
      node.style.setProperty('--origin-tilt', side === 'player' ? '-7deg' : '8deg');
    }
    ui('flight-layer').append(node);
    nextPaint(() => node.classList.add('landed'));
    return node;
  }

  function float(side, number, style = '', frozen = false) {
    const node = document.createElement('div');
    node.className = 'float-number at-' + side + ' ' + style;
    node.textContent = String(number);
    ui('floating').append(node);
    if (!frozen) {
      nextPaint(() => node.classList.add('rising'));
      window.setTimeout(() => node.remove(), 700);
    }
  }

  function clearMotion() {
    ui('flight-layer').replaceChildren();
    ui('floating').replaceChildren();
  }

  function fillHelp() {
    ui('help-cards').innerHTML = Object.values(catalog).map(card => `<article class="help-card">
      ${icon(schoolArt[card.school])}<strong>${card.name}</strong><span class="help-cost">${card.cost} energy</span>
      <span class="help-effect">${card.text}</span></article>`).join('');
  }

  function resize() {
    const scale = Math.min(window.innerWidth / 1280, window.innerHeight / 720, 1);
    ui('stage').style.setProperty('--stage-scale', String(scale));
  }

  EI.render = { ui, playerCard, paint, fly, float, clearMotion, fillHelp, resize };
})(window.EI);
