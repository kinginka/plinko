import { renderer, stage } from './renderer';
import Chip from '../shared/bodies/Chip';
import engine from './engine';
import GameLoop from './gameLoop';
import createEnvironment from '../shared/setup';
import { Events } from 'matter-js';

// On click, add a chip at the mouse's x and y relative to canvas
document.querySelector('canvas').addEventListener('click', (e) => {
  e.preventDefault();

  const chip = new Chip({ x: e.offsetX, y: e.offsetY });

  chip.addToEngine(engine.world);
  chip.addToRenderer(stage);
  chip.registerUpdateListener(engine);
  renderer.render(stage);
});

// Collision Events
Events.on(engine, 'collisionStart', function(event) {
  const pairs = event.pairs;

  for (var i = 0; i < pairs.length; i++) {
    var pair = pairs[i];

    if (pair.bodyA.label === 'peg') {
      pair.bodyA.sprite.tint = 0xFFAAAA;
    } else if (pair.bodyB.label === 'peg') {
      pair.bodyB.sprite.tint = 0xFFAAAA;
    }


  }
});

createEnvironment(stage);

renderer.render(stage);

const gameLoop = new GameLoop({ engine, stage, renderer });
gameLoop.start();

// // When the client moves the mouse, display a chip overlay
// document.querySelector('canvas').addEventListener('mousemove', (e) => {
//   const x = e.offsetX;
//   const y = e.offsetY;
//
//   const chip = new Chip({ x, y });
//   chip.addToRenderer(stage);
//   renderer.render(stage)
// })
