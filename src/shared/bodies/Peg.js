import { Body, Bodies } from 'matter-js';
import { PEG_FRICTION, PEG_RESTITUTION, PEG_RADIUS, PEG_DIAMETER } from '../constants/bodies';
import { PEG_TINT } from '../constants/colors';
import { PEG_SPRITE } from '../constants/sprites';
import GameObject from './GameObject';

let PIXI;

if (typeof window === 'object') {
  PIXI = require('pixi.js');
}

export default class Peg extends GameObject {
  constructor({ id, x, y }) {
    super({ id, x, y });
    this.ownerId = null;
    this.type = 'peg';

    this.createPhysics();
    this.createSprite();

    // Sprite and Body have references to each other so that we can
    // change renderer properties based on physics collisions
    this.body.sprite = this.sprite;
    this.sprite.body = this.body;

    this.body.parentObject = this;
    this.sprite.parentObject = this;
  }

  createPhysics() {
    let options = {
      friction: PEG_FRICTION,
      restitution: PEG_RESTITUTION,
    }

    this.body = Bodies.circle(this.x, this.y, PEG_RADIUS, options);
    Body.setDensity(this.body, 1)
    this.body.isStatic = true;
    this.body.position.x = this.x;
    this.body.position.y = this.y;
    this.body.label = this.type;
    this.body.isShrinking = false;
  }

  createSprite() {
    const peg = new PIXI.Sprite.fromImage(PEG_SPRITE);

    peg.position.x = this.x;
    peg.position.y = this.y;
    peg.height = PEG_DIAMETER;
    peg.width = PEG_DIAMETER;
    peg.tint = PEG_TINT;
    peg.anchor.set(0.5, 0.5);

    this.sprite = peg;
  }
}
