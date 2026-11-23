(function (EI) {
  'use strict';

  let context;
  let master;
  let muted = false;

  function unlock() {
    if (muted) return;
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    if (!context) {
      context = new Audio();
      master = context.createGain();
      master.connect(context.destination);
    }
    if (context.state === 'suspended') context.resume().catch(() => {});
  }

  function toggle() {
    muted = !muted;
    if (!muted) unlock();
    if (master) master.gain.setValueAtTime(muted ? 0 : 1, context.currentTime);
    return muted;
  }

  // Each cue is built from short oscillator envelopes.
  function tone(at, duration, frequency, tail, gain, shape = 'sine') {
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = shape;
    oscillator.frequency.setValueAtTime(frequency, at);
    oscillator.frequency.exponentialRampToValueAtTime(tail, at + duration);
    envelope.gain.setValueAtTime(.001, at);
    envelope.gain.exponentialRampToValueAtTime(gain, at + .012);
    envelope.gain.exponentialRampToValueAtTime(.001, at + duration);
    oscillator.connect(envelope);
    envelope.connect(master);
    oscillator.start(at);
    oscillator.stop(at + duration + .02);
  }

  function cue(name) {
    if (muted || !context || context.state !== 'running') return;
    const time = context.currentTime + .01;
    switch (name) {
      case 'deal':
        tone(time, .045, 520, 210, .055, 'triangle');
        break;
      case 'play':
        tone(time, .16, 760, 155, .06, 'triangle');
        tone(time + .04, .12, 210, 80, .035);
        break;
      case 'hit':
        tone(time, .19, 142, 42, .18, 'triangle');
        break;
      case 'heal':
        [523.25, 659.25, 783.99].forEach((note, i) =>
          tone(time + i * .06, .25, note, note, .05, 'triangle'));
        break;
      case 'poison':
        tone(time, .13, 125, 300, .09);
        tone(time + .10, .16, 210, 108, .07);
        break;
      case 'guard':
        tone(time, .22, 610, 400, .055, 'triangle');
        break;
      case 'win':
        [392, 523.25, 659.25, 783.99, 1046.5].forEach((note, i) =>
          tone(time + i * .105, .37, note, note, .065, 'triangle'));
        break;
      case 'loss':
        [392, 349.23, 261.63, 196].forEach((note, i) =>
          tone(time + i * .14, .48, note, note, .07, 'triangle'));
        break;
    }
  }

  EI.audio = { unlock, toggle, cue };
})(window.EI);
