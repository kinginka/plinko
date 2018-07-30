import Renderer from './renderer';
import Synchronizer from './synchronizer';
import Chip from '../shared/bodies/Chip';
import Peg from '../shared/bodies/Peg';
import Triangle from '../shared/bodies/Triangle';
import { VerticalWall, HorizontalWall, BucketWall } from '../shared/bodies/Wall';
import HoverChip from '../shared/bodies/HoverChip';
import { DROP_BOUNDARY, TIMESTEP } from '../shared/constants/game'
import { PLAYER_COLORS } from '../shared/constants/colors';
import { CANVAS, ROWS, ROW_SPACING, COLS, COL_SPACING, VERTICAL_MARGIN, HORIZONTAL_OFFSET } from '../shared/constants/canvas'
import io from 'socket.io-client';
import EventEmitter from 'eventemitter3';
import { Snapshot, SnapshotBuffer } from './snapshot.js';
import Serializer from '../server/serializer';

/**

  ClientEngine holds all of the logic for running the game loop, rendering
  the objects to the canvas, connecting to the server through websockets. Also
  generates the world and binds events.

**/

export default class ClientEngine {
  constructor({ url }) {
    this.env = 'client';
    this.socket = io.connect(url);
    this.renderer = new Renderer();
    this.stage = this.renderer.stage;
    this.eventEmitter = new EventEmitter();
    // this.synchronizer = new Synchronizer(this.socket, this.eventEmitter).init();
  }

  init() {
    this.chips = {};
    this.pegs = {};
    this.isRunning = false;
    this.lastChipId = 0;
    this.newSnapshot = false;
    this.snapshotBuffer = new SnapshotBuffer();

    this.createEnvironment();
    // this.registerPhysicsEvents();
    this.registerCanvasEvents();
    this.registerSocketEvents();
    // this.establishSynchronization();

    return this;
  }

  // establishSynchronization() {
  //   this.synchronizer.handshake();
  //
  //   this.eventEmitter.once('handshake complete', () => {
  //     this.socket.emit('request server frame');
  //   })
  // }

  registerSocketEvents() {
    this.socket.on('connection established', ({ playerId }) => {
      window.playerId = playerId;
      this.frame = 0;
      !this.isRunning && this.startGame();
    });

    this.socket.on('snapshot', ({ frame, encodedSnapshot }) => {
      let { chips, pegs, score } = Serializer.decode(encodedSnapshot)

      if (this.isRunning) {
        this.snapshotBuffer.push(new Snapshot({ frame, pegs, chips, score, timestamp: performance.now() }));
      }
    });

    this.socket.on('end game', ({ score }) => {
      console.log('game over!');
      console.log('final score: ', score);
      this.highlightWinner(score);
      this.stopGame();
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
    let currentSnapshot = this.snapshotBuffer.shift();

    if (!currentSnapshot) { return }

    let snapshotFrame = currentSnapshot.frame;

    let chipsInCurrentSnapshot = {}

    currentSnapshot.chips.forEach(chipInfo => {
      const { id, ownerId, x, y, angle } = chipInfo;

      let combinedId = String(ownerId) + String(id)

      chipsInCurrentSnapshot[combinedId] = true

      if (typeof this.chips[combinedId] === 'undefined') {
        const chip = new Chip({ id, ownerId, x, y });
        console.log("Id: ", String(id))
        console.log("ownerId: ", String(ownerId));
        console.log("Combined: ", combinedId);

        chip.addToRenderer(this.stage);
        this.chips[combinedId] = chip;
      }

      this.chips[combinedId].recentlyDropped = undefined;

      const chip = this.chips[combinedId];

      chip.sprite.position.x = x;
      chip.sprite.position.y = y;
      chip.sprite.rotation = angle;
    });

    for (let id of Object.keys(this.chips)) {
      if (!chipsInCurrentSnapshot[id] && !this.chips[id].recentlyDropped) {
        this.stage.removeChild(this.chips[id].sprite)
        delete this.chips[id]
      }
    }

    currentSnapshot.pegs.forEach(pegInfo => {
      const { id, ownerId } = pegInfo;

      const peg = this.pegs[pegInfo.id];

      peg.ownerId = pegInfo.ownerId;

      if (peg.ownerid) {
        peg.sprite.tint = PLAYER_COLORS[peg.ownerId];
      }
    });

    this.updateScoreboard(currentSnapshot.score);
  }

  highlightWinner(score) {
    let winner;
    let playerElement;
    let highScore = 0;
    let scores = Object.values(score);

    scores.map(score => parseInt(score, 10));
    scores.forEach((playerScores, id) => {
      if (playerScores > highScore) {
        highScore = playerScores;
        winner = id;
      }
    });
    
    playerElement = '.player-' + winner;
    document.body.querySelector(playerElement).style.color = 'yellow';
    console.log('winner: ', winner);
    console.log('score: ', highScore);
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

    let timeSinceLastSync = timestamp - this.lastSyncTime

    if (timeSinceLastSync > 6000) {
      this.lastSyncTime = timestamp;
    } else if (timeSinceLastSync > 5000) {
      this.eventEmitter.emit('initiate sync');
      this.lastSyncTime = timestamp;
    }

    // Wait for next rAF if not enough time passed for engine update

    this.delta += timestamp - this.lastFrameTime;
    this.lastFrameTime = timestamp;

    while (this.delta >= TIMESTEP) {
      this.frameSync();
      this.delta -= TIMESTEP;
    }

    // this.renderer.interpolate(this.chips, 1);
    // this.renderer.spriteUpdate(this.chips);
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
    const ownerId = window.playerId;
    const id = this.lastChipId++ % 255;

    let frame = this.frame;

    let chip = new Chip({ id, ownerId, x, y });
    chip.recentlyDropped = true;
    chip.addToRenderer(this.stage);
    this.chips[String(ownerId) + String(id)] = chip;
    this.socket.emit('new chip', { frame, id, x, y, ownerId });
  }

  onMouseEnter = (e) => {
    const x = e.offsetX;
    const y = e.offsetY;
    const hoverChip = new HoverChip({ x, y, ownerId: window.playerId });
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

    if (typeof window === 'object') {
      walls.forEach(wall => wall.addToRenderer(this.stage));
    }

  }


  _createBucketWalls() {
    for (let i = 1; i < COLS; i++) {
      let bucket = new BucketWall({ x: i * COL_SPACING });

      if (typeof window === 'object') { bucket.addToRenderer(this.stage) };
    }
  }

  _createTriangles() {
    // Positional calculations and vertices for the wall triangles.
    let triangles = [
                {x: 772, y: 290, side: 'right'},
                {x: 772, y: 158, vertices: '50 150 15 75 50 0', side: 'right'},
                {x: 772, y: 422, vertices: '50 150 15 75 50 0', side: 'right'},
                {x: 28, y: 305,  vertices: '50 150 85 75 50 0', side: 'left'},
                {x: 28, y: 173,  vertices: '50 150 85 75 50 0', side: 'left'},
                {x: 28, y: 437,  vertices: '50 150 85 75 50 0', side: 'left'},
              ];

    triangles.forEach(triangle => {
      let t = new Triangle(triangle);
      if (typeof window === 'object') { t.addToRenderer(this.stage) };
    });
  }

  _createPegs() {
    const verticalOffset = ROW_SPACING / 2;
    const horizontalOffset = COL_SPACING / 2;

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
        let peg = new Peg({ id, x, y });
        this.pegs[id] = peg;

        if (peg.sprite) { peg.addToRenderer(this.stage) };

        id++;
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
