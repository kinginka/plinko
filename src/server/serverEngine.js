import EventEmitter from 'eventemitter3';
import { Body, World, Engine, Events } from 'matter-js';
import { DROP_BOUNDARY, TIMESTEP, TARGET_SCORE } from '../shared/constants/game';
import Chip from '../shared/bodies/Chip';
import Peg from '../shared/bodies/Peg';
import Triangle from '../shared/bodies/Triangle';
import { VerticalWall, HorizontalWall, BucketWall } from '../shared/bodies/Wall';
import { Input, InputBuffer } from './inputBuffer';
import Serializer from '../shared/serializer';
import User from './user';
import UserCollection from './userCollection';
import WaitingQueue from './waitingQueue';

import { CANVAS,
         ROWS,
         COLS,
         ROW_SPACING,
         COL_SPACING,
         VERTICAL_MARGIN,
         HORIZONTAL_OFFSET } from '../shared/constants/canvas'

import { CONNECTION,
         CONNECTION_ESTABLISHED,
         NEW_CHIP,
         PING_MESSAGE,
         PONG_MESSAGE,
         SERVER_FRAME,
         REQUEST_SERVER_FRAME,
         SNAPSHOT,
         INITIATE_SYNC,
         HANDSHAKE_COMPLETE } from '../shared/constants/events'

/**

  TODO: Write description

**/

export default class ServerEngine {
  constructor({ io }) {
    this.users = new UserCollection();
    this.activeUsers = new UserCollection();
    this.io = io;
    this.engine = Engine.create();
    this.frame = 0;
    this.inputBuffer = new InputBuffer();
    this.waitingQueue = new WaitingQueue();
    this.gameIsRunning = false;
    this.gameLoop = undefined;
    this.colorIds = {0: null, 1: null, 2: null, 3: null};
  }

  init() {
    this.chips = {};
    this.pegs = [];
    this.winner = false;
    this.initializeScore();
    this.createEnvironment();
    this.registerPhysicsEvents();
    this.registerSocketEvents();

    return this;
  }

  initializeScore() {
    this.targetScore = TARGET_SCORE;
    this.targetScoreInterval = false;
    this.score = { 0: 0, 1: 0, 2: 0, 3: 0 };
  }

  incrementScore(chipOwner) {
    this.score[chipOwner] += 1;
  }

  decrementScore(formerPegOwner) {
    this.score[formerPegOwner] -= 1;
  }

  updateScore = (peg, chip) => {
    // Assuming pegs are always the bodyA and chips are always the bodyB (Matter.js implementation)
    const formerPegOwner = peg.parentObject.ownerId;
    const chipOwner = chip.parentObject.ownerId;

    if (chipOwner !== formerPegOwner) {
      this.incrementScore(chipOwner);

      // Pegs initialize with owner set to null
      if (formerPegOwner) { this.decrementScore(formerPegOwner); }
    }
  }

  onCollisionStart = (event) => {
    const pairs = event.pairs;

    for (let i = 0; i < pairs.length; i++) {
      const pair = pairs[i];
      const bodyA = pair.bodyA;
      const bodyB = pair.bodyB;

      if (bodyA.label === 'peg' && bodyB.label === 'chip' && !this.winner) {
        this.updateScore(bodyA, bodyB);
      }

      if (bodyA.label === 'peg') {
        bodyA.parentObject.ownerId = bodyB.parentObject.ownerId;
      }

      if (bodyA.label === 'ground') {
        const chip = bodyB.parentObject;
        const combinedId = String(chip.ownerId) + String(chip.id);

        World.remove(this.engine.world, chip.body);
        delete this.chips[combinedId];
      }
    }
  }

  registerPhysicsEvents() {
    // Collision Events
    Events.on(this.engine, 'collisionStart', this.onCollisionStart);
  }

  fillActiveUsers = () => {
    while (this.waitingQueue.length > 0 && this.activeUsers.length < 4) {
      let user = this.waitingQueue.dequeue();
      if (this.users.get(user.userId)) {
        let colorId;

        for (let id in this.colorIds) {
          if (!this.colorIds[id]) {
            user.colorId = id;
            this.colorIds[id] = user.userId;
            break;
          }
        }

        this.activeUsers.add(user);
        user.setActive();
      }
    }
  }

  registerSocketEvents() {
    this.io.on(CONNECTION, socket => {
      let user;

      socket.emit(CONNECTION_ESTABLISHED, { message: 'congratulations' });

      socket.on('new user', ({ name }) => {
        user = new User({ socket });
        user.name = name;

        this.users.add(user);
        this.waitingQueue.enqueue(user);
        this.fillActiveUsers();
        socket.emit('new user ack', { userId: user.userId });
        this.broadcastUserList();
      });

      socket.on('reconnection', ({ userId }) => {
        user = this.users.get(userId);
        user.socket = socket;
        this.waitingQueue.enqueue(user);
        this.fillActiveUsers();
      });

      // Events must be set on socket established through connection
      socket.on(NEW_CHIP, (chipInfo) => {
        this.inputBuffer.insert(new Input(chipInfo));
      });

      socket.on(PING_MESSAGE, () => {
        socket.emit(PONG_MESSAGE, { serverTime: Date.now() });
      });

      socket.on(REQUEST_SERVER_FRAME, () => {
        socket.emit(SERVER_FRAME, { frame: this.frame });
      });

      socket.on('start game', () => {
        this.startGame();
      });

      socket.on('disconnect', () => {
        this.activeUsers.delete(user);
        this.colorIds[user.colorId] = null;

        if (this.gameIsRunning) {
          if (this.activeUsers.length === 0) {
            this.stopGame();
          }
        } else {
          this.fillActiveUsers();
        }
      });
    });
  }

  broadcastUserList() {
    this.users.forEach((user) => {
      if (user.status === 'waiting' || user.status === 'active') {
        let activeUsers = {};
        let waitingUsers = {};
        let colorId

        this.activeUsers.forEach(user => {
          activeUsers[user.userId] = {
            name: user.name,
            colorId: user.colorId,
          }
        });

        this.waitingQueue.forEach(user => {
          waitingUsers[user.userId] = {
            name: user.name,
          }
        });

        user.socket.emit('user list', ({ activeUsers, waitingUsers }));
      }
    })
  }

  processInputBuffer() {
    while (!this.inputBuffer.isEmpty()) {
      let input = this.inputBuffer.shift()

      let chip = new Chip({ id: input.id, ownerId: input.ownerId, x: input.x, y: input.y })
      chip.addToEngine(this.engine.world);

      let combinedId = String(input.ownerId) + String(input.id)
      this.chips[combinedId] = chip;
    }
  }

  detectWinner() {
    let scores = Object.values(this.score);
    let winningPlayer = scores.some(score => score >= this.targetScore);

    if (winningPlayer) {
      this.winner = true;

      // this may need to move once we change game ending mechanisms
      this.stopGame();
    }
  }

  reduceTargetScoreInterval() {
    this.targetScoreInterval = true;
    setInterval(() => {
      this.targetScore -= 1;
    }, 5000);
  }

  startGame() {
    this.gameIsRunning = true;

    this.nextTimestep = this.nextTimestep || Date.now();

    while (Date.now() > this.nextTimestep) {
      this.frame++

      !this.inputBuffer.isEmpty() && this.processInputBuffer();


      Engine.update(this.engine, TIMESTEP);

      if (!this.winner) { this.detectWinner() }
      if (!this.targetScoreInterval) { this.reduceTargetScoreInterval() }

      let snapshot = this.generateSnapshot(this.chips, this.pegs, this.score,
                                           this.winner, this.targetScore);

      this.broadcastSnapshot(snapshot);

      this.nextTimestep += TIMESTEP;
    }

    this.gameLoop = setImmediate(this.startGame.bind(this))
  }

  stopGame() {
    clearImmediate(this.gameLoop);
    this.gameIsRunning = false;
    this.resetGame();
  }

  resetGame() {
    this.activeUsers = new UserCollection();
    this.engine = Engine.create();
    this.frame = 0;
    this.inputBuffer = new InputBuffer();
    this.gameLoop = undefined;
    this.chips = {};
    this.pegs = [];
    this.winner = false;
    this.initializeScore();
    this.createEnvironment();
  }

  generateSnapshot(chips, pegs, score, winner, targetScore) {
    // chips is an object with combinedId as the key and chip as values
    // so we want to access the values
    chips = Object.values(chips);

    const chipInfo = chips.map(chip => {
      return {
           id: chip.id,
           ownerId: chip.ownerId,
           x: chip.body.position.x,
           y: chip.body.position.y,
           angle: chip.body.angle
         };
    });

    const pegInfo = pegs.map(peg => {
      return { id: peg.id, ownerId: peg.ownerId };
    });

    return { chips: chipInfo, pegs: pegInfo, score, winner: winner, targetScore: targetScore }
  }

  broadcastSnapshot({ chips, pegs, score, winner, targetScore }) {
    let encodedSnapshot = Serializer.encode({ chips, pegs, score, winner, targetScore })

    this.users.forEach(user => {
      let socket = user.socket;
      socket.emit(SNAPSHOT, { frame: this.frame, encodedSnapshot, score, targetScore });
    })
  }

  _createWalls() {
    const leftWall = new VerticalWall({x: 0, y: CANVAS.HEIGHT / 2});
    const rightWall = new VerticalWall({x: CANVAS.WIDTH, y: CANVAS.HEIGHT / 2});
    const ground = new HorizontalWall();

    [leftWall, rightWall, ground].forEach(wall => wall.addToEngine(this.engine.world));
  }

  _createBucketWalls() {
    for (let i = 1; i < COLS; i++) {
      let bucket = new BucketWall({ x: i * COL_SPACING });
      bucket.addToEngine(this.engine.world);
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
      t.addToEngine(this.engine.world);
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
        peg.addToEngine(this.engine.world);

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
