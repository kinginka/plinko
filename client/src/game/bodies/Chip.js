import { CHIP } from '../../shared/constants/bodies';
import { PLAYER_COLORS } from '../../shared/constants/colors';
import { CHIP_SPRITE } from '../../shared/constants/sprites';
import { toDegrees } from '../../shared/utils/math';
import GameObject from './GameObject';

export default class Chip extends GameObject {
  static count = 0;
  static fillStyles = [
    'hachure',
    'zigzag',
    'cross-hatch',
    // 'solid',
  ];

  constructor({ id, x, y, ownerId }) {
    super({ id, x, y, ownerId });
    this.type = 'chip';
    this.diameter = CHIP.DIAMETER;
    this.shrinking = false;
    this.fillStyle = Chip.fillStyles[Math.floor(Math.random() * Chip.fillStyles.length)];
    this.angle = 0; // stored in radians
    Chip.count++;
  }

  draw(rough) {
    rough.circle(this.x, this.y, this.diameter, {
      fill: PLAYER_COLORS[this.ownerId],
      fillStyle: this.fillStyle,
      fillWeight: 1,
      roughness: 0.1,
      hachureAngle: toDegrees(this.angle * -1), // convert to degrees for Rough and switch sign
    });
  }

  shrink(callback) {
    if (this.shrinking) { return }
    this.shrinking = true;

    setTimeout(() => {
      // 1 + Math.log(0.95) / N
      // where N is number of chips before max shrinking
      // Here, it is 0.995 for N = 10
      // 0.95 is max shrinking factor

      const SHRINK_FACTOR = Math.max(0.95, Math.min(0.995, 0.995 ** Chip.count));

      const interval = setInterval(() => {
        this.diameter *= SHRINK_FACTOR ** 2;

        if (this.diameter < 0.1) {
          Chip.count--;
          clearInterval(interval);
          if (callback) callback();
        }
      }, 10)
    }, 50)
  }
}
