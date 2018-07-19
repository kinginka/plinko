import { World } from 'matter-js';

export default class GameObject {
  constructor({ id, x, y, ownerId }) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.ownerId = ownerId;
  }

  addToRenderer(stage) {
    stage.addChild(this.sprite);
  }

  addToEngine(world) {
    World.add(world, this.body);
  }
}
