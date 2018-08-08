import EventEmitter from 'eventemitter3';

import Serializer from '../shared/serializer';
import Synchronizer from './synchronizer';
import Renderer from './renderer';
import Chip from './bodies/Chip';
import Peg from './bodies/Peg';
import Triangle from './bodies/Triangle';
import HoverChip from './bodies/HoverChip';
import { VerticalWall, HorizontalWall, BucketWall } from './bodies/Wall';
import { DROP_BOUNDARY, TIMESTEP } from '../shared/constants/game'
import { PLAYER_COLORS } from '../shared/constants/colors';
import { Snapshot, SnapshotBuffer } from './snapshot.js';

import {
  NEW_CHIP,
  SNAPSHOT,
  // INITIATE_SYNC,
  // HANDSHAKE_COMPLETE,
  SERVER_FRAME,
  // REQUEST_SERVER_FRAME
} from '../shared/constants/events'

import {
  CANVAS,
  ROWS,
  COLS,
  ROW_SPACING,
  COL_SPACING,
  VERTICAL_MARGIN,
  HORIZONTAL_OFFSET
} from '../shared/constants/canvas'

/**

  ClientEngine holds all of the logic for running the game loop, rendering
  the objects to the canvas, connecting to the server through websockets. Also
  generates the world and binds events.

**/

export default class ClientEngine {
  constructor({ playerId, socket }) {
    this.playerId = playerId;
    this.socket = socket;
    this.renderer = new Renderer();
    this.eventEmitter = new EventEmitter();
    this.synchronizer = new Synchronizer(this.socket, this.eventEmitter).init();
    this.snapshotBuffer = new SnapshotBuffer();
  }

  init() {
    this.logged = false
    this.chips = {};
    this.pegs = {};
    this.isRunning = false;
    this.lastChipId = 0;
    this.stage = this.renderer.stage;

    this.createEnvironment();
    this.registerCanvasEvents();
    this.registerSocketEvents();

    // Wait 250ms so that the socket.io connection can complete
    // setTimeout(this.establishSynchronization.bind(this), 250)

    return this;
  }

  // establishSynchronization() {
  //   this.synchronizer.handshake();
  //
  //   this.eventEmitter.once(HANDSHAKE_COMPLETE, () => {
  //     console.log("Handshake complete, your latency is: ", this.synchronizer.latency)
  //   })
  // }

  registerSocketEvents() {
    this.socket.on('start game', () => {
      this.frame = 0;
    });

    this.socket.on(SNAPSHOT, (encodedSnapshot) => {
      let { chips, pegs, score, winner, targetScore } = Serializer.decode(encodedSnapshot);

      if (this.isRunning) {
        this.snapshotBuffer.push(new Snapshot({ pegs, chips, score, winner, targetScore, timestamp: performance.now() }));
      }
    });
  }

  registerCanvasEvents() {
    // On click, add a chip at the mouse's x and y relative to canvas
    document.querySelector('canvas').addEventListener('click', this.onClick, false);
    // We prevent the default mousedown event so that when you spam chips,
    // random parts of the DOM might get highlighted due to double click
    document.body.addEventListener('mousedown', (e) => { e.preventDefault() });
    // When the client moves the mouse, display a chip overlay
    document.querySelector('canvas').addEventListener('mouseenter', this.onMouseEnter);
  }

  frameSync() {
    // If we have too many snapshots shorten it
    while (this.snapshotBuffer.length > 5) {
      this.snapshotBuffer.shift();
    }

    let currentSnapshot = this.snapshotBuffer.shift();

    if (!currentSnapshot) { return }

    let chipsInCurrentSnapshot = {}

    currentSnapshot.chips.forEach(chipInfo => {
      const { id, ownerId, x, y, angle } = chipInfo;

      let combinedId = String(ownerId) + String(id)

      chipsInCurrentSnapshot[combinedId] = true

      if (typeof this.chips[combinedId] === 'undefined') {
        const chip = new Chip({ id, ownerId, x, y });

        chip.addToRenderer(this.stage);
        this.chips[combinedId] = chip;
      }

      this.chips[combinedId].recentlyDropped = undefined;

      const chip = this.chips[combinedId];

      chip.sprite.position.x = x;
      chip.sprite.position.y = y;
      chip.sprite.rotation = angle;

      if (y >= CANVAS.HEIGHT - 10 - chip.sprite.width / 2) {
        chip.shrink();
      }
    });

    for (let id of Object.keys(this.chips)) {

      // this removes chips that the server has created (and returned to the client)
      // and have reached the bottom
      if (!chipsInCurrentSnapshot[id] && !this.chips[id].recentlyDropped) {
        this.stage.removeChild(this.chips[id].sprite)
        delete this.chips[id]
      }
    }

    currentSnapshot.pegs.forEach(pegInfo => {
      const peg = this.pegs[pegInfo.id];

      peg.ownerId = pegInfo.ownerId;

      if (peg.ownerId !== null) {
        peg.sprite.tint = PLAYER_COLORS[peg.ownerId];
      }
    });
  }

  updateTargetScore(targetScore) {
    document.body.querySelector('.peg-target').innerText = targetScore;
  }

  highlightWinner(scores) {
    let winnerId;
    let playerElement;
    let highScore = 0;

    let infoContainer = document.querySelector('.game-info');
    let winnerBanner = document.createElement('div');

    Object.values(scores)
      .map(score => parseInt(score, 10))
      .forEach((score, id) => {
        if (score > highScore) {
          highScore = score;
          winnerId = id;
        }
    });

    winnerBanner.setAttribute('id', 'winner-element');
    winnerBanner.textContent = `Winner is player ${winnerId + 1}`;
    infoContainer.appendChild(winnerBanner);

    playerElement = '.player-' + winnerId;
    document.body.querySelector(playerElement).style.color = 'yellow';
  }

  updateScoreboard(score) {
    for (let i = 0; i <= 3; i++) {
      let scoreElement = '.player-' + i;
      document.body.querySelector(scoreElement).children[0].innerHTML = score[i];
    }
  }

  update() {
    this.frame++;
    this.frameSync()
  }

  animate(timestamp) {
    if (timestamp < this.lastFrameTime + TIMESTEP) {
      this.frameID = requestAnimationFrame(this.animate.bind(this));
      return;
    }

    // This code is used for repeated synchronization handshakes

    // let timeSinceLastSync = timestamp - this.lastSyncTime
    //
    // if (timeSinceLastSync > 6000) {
    //   this.lastSyncTime = timestamp;
    // } else if (timeSinceLastSync > 5000) {
    //   this.eventEmitter.emit(INITIATE_SYNC);
    //   this.lastSyncTime = timestamp;
    // }

    // Wait for next rAF if not enough time passed for engine update

    this.delta += timestamp - this.lastFrameTime;
    this.lastFrameTime = timestamp;

    while (this.delta >= TIMESTEP) {
      this.frameSync();
      this.delta -= TIMESTEP;
    }

    this.renderer.render(this.stage);

    this.frameID = requestAnimationFrame(this.animate.bind(this));
  }

  startGame() {
    // Entry point for updates and rendering
    // Only gets called once
    this.isRunning = true;

    requestAnimationFrame((timestamp) => {
      this.lastSyncTime = timestamp;
      this.renderer.render(this.stage);
      this.lastFrameTime = timestamp;
      this.delta = 0;

      requestAnimationFrame(this.animate.bind(this));
    })
  }

  stopGame() {
    clearInterval(this.loop);
  }

  onClick = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!this.isRunning) { return }

    // Short circuit handler if outside of drop boundary
    if (e.offsetY > DROP_BOUNDARY) { return }

    const x = e.offsetX;
    const y = e.offsetY;
    const ownerId = this.playerId;
    const id = this.lastChipId++ % 255;

    let frame = this.frame;

    let chip = new Chip({ id, ownerId, x, y });
    chip.recentlyDropped = true;
    chip.addToRenderer(this.stage);
    this.chips[String(ownerId) + String(id)] = chip;
    this.socket.emit(NEW_CHIP, { frame, id, x, y, ownerId });
  }

  onMouseEnter = (e) => {
    const x = e.offsetX;
    const y = e.offsetY;
    const hoverChip = new HoverChip({ x, y, ownerId: this.playerId });
    hoverChip.addToRenderer(this.stage);

    e.target.addEventListener('mouseleave', () => {
      hoverChip.removeChip(this.stage);
    });
  }

  _createWalls(stage, engine) {
    const leftWall = new VerticalWall({x: 0, y: CANVAS.HEIGHT / 2});
    const rightWall = new VerticalWall({x: CANVAS.WIDTH, y: CANVAS.HEIGHT / 2});
    const ground = new HorizontalWall();
    const walls = [leftWall, rightWall, ground];

    walls.forEach(w => w.addToRenderer(this.stage));
  }

  _createBucketWalls() {
    for (let i = 1; i < COLS; i++) {
      let bucket = new BucketWall({ x: i * COL_SPACING });

      bucket.addToRenderer(this.stage)
    }
  }

  _createTriangles() {
    // Positional calculations and vertices for the wall triangles.
    const triangles = [
                { x: 772, y: 290, side: 'right' },
                { x: 772, y: 158, side: 'right' },
                { x: 772, y: 422, side: 'right' },
                { x: 28,  y: 305, side: 'left' },
                { x: 28,  y: 173, side: 'left' },
                { x: 28,  y: 437, side: 'left' },
              ];

    triangles.forEach(triangle => {
      let t = new Triangle(triangle);
      t.addToRenderer(this.stage);
    });
  }

  _createPegs() {
    let id = 0;

    for (let row = 0; row < ROWS; row++) {
      for (let col = 1; col < COLS; col++) {
        let x = col * COL_SPACING;
        // leave extra space at top of frame to drop chips
        let y = VERTICAL_MARGIN + (row * ROW_SPACING);

        if (row % 2 === 1 && col === COLS - 1) {
          // skip last peg on odd rows
          break;
        } else if (row % 2 === 1) {
          // offset columns in odd rows by half
          x += HORIZONTAL_OFFSET;
        }

        const peg = new Peg({ id, x, y });
        this.pegs[id] = peg;
        id++;

        peg.addToRenderer(this.stage)
      }
    }
  }

  createEnvironment() {
    this._createWalls();
    this._createBucketWalls();
    this._createPegs();
    this._createTriangles();
  }
}
