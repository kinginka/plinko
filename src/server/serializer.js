// Leaving this code here just for testing

// function rng(n) {
//   return Math.floor(Math.random() * n)
// }
//
// function generateChip() {
//   return {
//     id: rng(255),
//     ownerId: rng(4),
//     x: rng(600),
//     y: rng(800),
//     angle: Math.random(),
//     velocity: {
//       x: rng(255),
//       y: rng(255),
//     },
//     angularVelocity: Math.random()
//   }
// }
//
// function generatePeg(id) {
//   return { id, ownerId: rng(4) }
// }
//
// function generateSnapshot() {
//   let chips = [];
//   let pegs = [];
//
//   for (let i = 0; i < 200; i++) {
//     chips.push(generateChip())
//   }
//
//   for (let i = 0; i < 68; i++) {
//     pegs.push(generatePeg(i))
//   }
//
//   return { chips, pegs }
// }
//
// let { chips, pegs } = generateSnapshot()

// TODO:
// Currently sending bits as a string, should transmit just a number
// Needs to send a separate "header" to indicate necessary bit length

export default class Serializer {
  static toBinary(num, bitLength) {
    let output = '';
    for (let i = 0; i < bitLength; i++) { output += '0' };
    output += num.toString(2);
    return output.slice(-(bitLength), output.length);
  }

  static encodeChip(chip) {
    let encoded = '';

    encoded += this.toBinary(chip.id, 8);
    encoded += this.toBinary(chip.ownerId, 3);
    encoded += this.toBinary(chip.x, 10);
    encoded += this.toBinary(chip.y, 10);
    encoded += this.toBinary(chip.angle.toFixed(3) * 1000, 10);
    encoded += this.toBinary(chip.velocity.x, 8)
    encoded += this.toBinary(chip.velocity.y, 8)
    encoded += this.toBinary(chip.angularVelocity.toFixed(3) * 1000, 10);

    return encoded;
  }

  static decodeChip(encodedChip) {
    let chip = {
      velocity: {}
    };

    let id = '';
    let ownerId = '';
    let x = '';
    let y = '';
    let angle = '';
    let velocityX = '';
    let velocityY = '';
    let angularVelocity = '';

    for (let i = 0; i < encodedChip.length; i++) {
      let char = encodedChip[i]

      if (i < 8) {
        id += char
      } else if (i < 11) {
        chip.id = parseInt(id, 2);
        ownerId += char
      } else if (i < 21) {
        chip.ownerId = parseInt(ownerId, 2);
        x += char
      } else if (i < 31) {
        chip.x = parseInt(x, 2);
        y += char;
      } else if (i < 41) {
        chip.y = parseInt(y, 2);
        angle += char
      } else if (i < 49) {
        chip.angle = parseInt(angle, 2) / 1000
        velocityX += char
      } else if (i < 57) {
        chip.velocity.x = parseInt(velocityX, 2)
        velocityY += char
      } else if (i < 67) {
        chip.velocity.y = parseInt(velocityY, 2)
        angularVelocity += char
      }
    }

    chip.angularVelocity = parseInt(angularVelocity, 2) / 1000

    return chip
  }

  static encodePeg(peg) {
    let output = '';

    output += this.toBinary(peg.id, 7);
    output += this.toBinary(peg.ownerId, 2);

    return output
  }

  static decodePeg(encodedPeg) {
    let peg = {};

    peg.id = parseInt(encodedPeg.slice(0, 7), 2)
    peg.ownerId = parseInt(encodedPeg.slice(7, 9), 2)

    return peg
  }

  static encode({ chips, pegs }) {
    let encoded = '';

    // Prepend the number of chips that need to be decoded
    // Up to 256 chips, so 8 bits required
    encoded += this.toBinary(chips.length, 8)

    for (let chip of chips) {
      encoded += this.encodeChip(chip)
    }

    // Prepend the number of pegs that need to be decoded
    // Always 68 so 7 bits required
    encoded += this.toBinary(pegs.length, 7)

    for (let peg of pegs) {
      encoded += this.encodePeg(peg)
    }

    return encoded
  }

  static decode(encodedSnapshot) {
    const BITS_PER_CHIP = 67
    const BITS_PER_PEG = 9

    let numChips = parseInt(encodedSnapshot.substring(0, 8), 2)
    let chips = [];
    let pegs = [];

    for (let i = 0; i < numChips; i++) {
      let chipStart = 8 + i * BITS_PER_CHIP
      chips.push(this.decodeChip(encodedSnapshot.substring(chipStart, chipStart + BITS_PER_CHIP )))
    }

    let chipsEnd = 8 + numChips * BITS_PER_CHIP
    let numPegs = parseInt(encodedSnapshot.substring(chipsEnd, chipsEnd + 7), 2)

    for (let i = 0; i < numPegs; i++) {
      let pegStart = chipsEnd + 7 + BITS_PER_PEG * i;
      pegs.push(this.decodePeg(encodedSnapshot.substring(pegStart, pegStart + BITS_PER_PEG)))
    }

    return { chips, pegs }
  }
}
