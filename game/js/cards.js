window.EI = {};

(function (EI) {
  'use strict';

  const catalog = {
    spark:    { name: 'Spark',    cost: 1, value: 3, school: 'ember', effect: 'damage', copies: 4, text: 'Deal 3 damage.' },
    cinder:   { name: 'Cinder',   cost: 2, value: 5, school: 'ember', effect: 'damage', copies: 4, text: 'Deal 5 damage.' },
    wildfire: { name: 'Wildfire', cost: 3, value: 8, school: 'ember', effect: 'damage', copies: 3, text: 'Deal 8 damage.' },
    sap:      { name: 'Sap',      cost: 1, value: 4, school: 'ivy',   effect: 'heal',   copies: 3, text: 'Restore 4 life.' },
    bloom:    { name: 'Bloom',    cost: 2, value: 7, school: 'ivy',   effect: 'heal',   copies: 2, text: 'Restore 7 life.' },
    aegis:    { name: 'Aegis',    cost: 2, value: 1, school: 'ivy',   effect: 'shield', copies: 2, text: 'Absorb the next hit.' },
    gust:     { name: 'Gust',     cost: 1, value: 2, school: 'gust',  effect: 'draw',   copies: 2, text: 'Draw 2 cards.' },
    venom:    { name: 'Venom',    cost: 2, value: 2, school: 'venom', effect: 'poison', copies: 4, text: '2 damage per turn for 3 turns.' },
    mirror:   { name: 'Mirror',   cost: 2, value: 1, school: 'mirror',effect: 'mirror', copies: 2, text: 'Reflect the next hit.' },
  };

  // A 32-bit seeded generator keeps deck and reshuffle order reproducible.
  function rng(seed) {
    let state = (seed >>> 0) || 1;
    return function next() {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      return (state >>> 0) / 4294967296;
    };
  }

  function shuffle(pile, random) {
    for (let index = pile.length - 1; index > 0; index--) {
      const swap = Math.floor(random() * (index + 1));
      [pile[index], pile[swap]] = [pile[swap], pile[index]];
    }
    return pile;
  }

  function deck(random) {
    const cards = Object.keys(catalog).flatMap(id => Array(catalog[id].copies).fill(id));
    return shuffle(cards, random);
  }

  EI.cards = { catalog, rng, shuffle, deck };
})(window.EI);
