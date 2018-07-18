'use strict';

var _renderer = require('./renderer');

var _Chip = require('../shared/bodies/Chip');

var _Chip2 = _interopRequireDefault(_Chip);

var _engine = require('./engine');

var _engine2 = _interopRequireDefault(_engine);

var _gameLoop = require('./gameLoop');

var _gameLoop2 = _interopRequireDefault(_gameLoop);

var _setup = require('../shared/setup');

var _setup2 = _interopRequireDefault(_setup);

var _matterJs = require('matter-js');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// On click, add a chip at the mouse's x and y relative to canvas
document.querySelector('canvas').addEventListener('click', function (e) {
  e.preventDefault();

  var chip = new _Chip2.default({ x: e.offsetX, y: e.offsetY });

  chip.addToEngine(_engine2.default.world);
  chip.addToRenderer(_renderer.stage);
  chip.registerUpdateListener(_engine2.default);
  _renderer.renderer.render(_renderer.stage);
});

// Collision Events
_matterJs.Events.on(_engine2.default, 'collisionStart', function (event) {
  var pairs = event.pairs;

  for (var i = 0; i < pairs.length; i++) {
    var pair = pairs[i];
    console.log(pair.bodyA.sprite.tint);
    console.log(pair.bodyB.sprite.tint);

    if (pair.bodyA.label === 'peg') {
      pair.bodyA.sprite.tint = 0xff0000;
    } else if (pair.bodyB.label === 'peg') {
      pair.bodyB.sprite.tint = 0xff0000;
    }

    console.log(pair.bodyA.sprite.tint);
    console.log(pair.bodyB.sprite.tint);
  }
});

(0, _setup2.default)(_renderer.stage);

_renderer.renderer.render(_renderer.stage);

var gameLoop = new _gameLoop2.default({ engine: _engine2.default, stage: _renderer.stage, renderer: _renderer.renderer });
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
//# sourceMappingURL=client.js.map