(function (EI) {
  'use strict';

  const { catalog } = EI.cards;

  function forecastAttacks(attacks) {
    const forecast = { direct: 0, guarded: 0 };
    function visit(hand, energy, total, firstHit) {
      forecast.direct = Math.max(forecast.direct, total);
      forecast.guarded = Math.max(forecast.guarded, total - firstHit);
      hand.forEach(({ cost, value }, index) => {
        if (cost <= energy) {
          const rest = hand.filter((_, i) => i !== index);
          visit(rest, energy - cost, total + value, firstHit || value);
        }
      });
    }
    visit(attacks, 3, 0, 0);
    return forecast;
  }

  function danger(actor, forecast) {
    const protectedHit = actor.shield || actor.mirror;
    const incoming = protectedHit ? forecast.guarded : forecast.direct;
    const poison = actor.poison && !protectedHit ? 2 : 0;
    const margin = actor.life - incoming - poison;
    return Math.max(0, 3 - margin) * 1.4 + (margin <= 0 ? 12 : 0);
  }

  // Forecast only the cards already in hand. Gust's draw is valued by hand size.
  function choose(state, strike) {
    const { ai, player, turns } = state;
    const attacks = player.hand.map(id => catalog[id]).filter(card => card.effect === 'damage');
    const forecast = forecastAttacks(attacks);
    const threat = Math.max(player.hand.length ? 2 : 0, ...attacks.map(card => card.value));
    const currentDanger = danger(ai, forecast);
    const hasDraw = ai.deck.length + ai.discard.length > 0;
    const caution = ai.life - (ai.poison ? 2 : 0) < 12;
    const attackWeight = ai.life >= player.life ? 1.12 : 1;
    const lifeWeight = caution ? 1.27 : .71;
    let best = 0;
    let choice = -1;

    function evaluate(from, to, drawValue, spells) {
      if (!from.life) return -1000;
      if (!to.life) return 1000 - spells;
      if (to.poison) {
        const caster = { ...from };
        const afflicted = { ...to };
        strike(afflicted, caster, 2);
        if (!caster.life) return -500;
        if (!afflicted.life) return 200 - spells;
      }
      const pressure = (player.life - to.life) * attackWeight;
      const recovery = (from.life - ai.life) * lifeWeight;
      const guard = (Number(from.shield) - Number(ai.shield)) * threat * .32 +
        (Number(from.mirror) - Number(ai.mirror)) * threat * .48;
      const openings = (Number(player.shield) - Number(to.shield)) * 1.65 +
        (Number(player.mirror) - Number(to.mirror)) * 2.6;
      const poison = (to.poison - player.poison) * (turns < 5 ? 2.1 : 1.53);
      const safer = currentDanger - danger(from, forecast);
      return pressure + recovery + guard * lifeWeight + openings + poison + drawValue + safer - spells * .17;
    }

    function search(hand, energy, from, to, drawValue, spells, first) {
      const score = evaluate(from, to, drawValue, spells);
      if (score > best) {
        best = score;
        choice = first;
      }
      if (!energy || !from.life || !to.life) return;

      for (const { id, index } of hand) {
        const { cost, effect, value } = catalog[id];
        if (cost > energy) continue;
        const nextFrom = { ...from };
        const nextTo = { ...to };
        let draw = drawValue;
        switch (effect) {
          case 'damage': strike(nextTo, nextFrom, value); break;
          case 'heal': nextFrom.life = Math.min(30, from.life + value); break;
          case 'shield': nextFrom.shield = true; break;
          case 'mirror': nextFrom.mirror = true; break;
          case 'poison': nextTo.poison = 3; break;
          case 'draw':
            if (hasDraw && hand.length <= 6) draw += hand.length <= 3 && energy > 1 ? 2.4 : .55;
            break;
        }
        const remaining = hand.filter(card => card.index !== index);
        search(remaining, energy - cost, nextFrom, nextTo, draw, spells + 1, first === -1 ? index : first);
      }
    }

    search(ai.hand.map((id, index) => ({ id, index })), ai.energy, ai, player, 0, 0, -1);
    return choice;
  }

  EI.ai = { choose };
})(window.EI);
