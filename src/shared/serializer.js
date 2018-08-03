// // Leaving this code here just for testing
//
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
//     angle: Math.random()
//   }
// }
//
// function generatePeg(id) {
//   let rand = rng(5);
//   let ownerId = rand === 0 ? null : rand - 1;
//   return { id, ownerId }
// }
//
// function generateSnapshot() {
//   let chips = [];
//   let pegs = [];
//
//   for (let i = 0; i < 5; i++) {
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
    encoded += this.toBinary(Math.floor(chip.x), 10);
    encoded += this.toBinary(Math.floor(chip.y), 10);

    if (chip.angle < 0) {
      chip.angle = (2 * Math.PI) + chip.angle;
    }

    encoded += this.toBinary(chip.angle.toFixed(3) * 1000, 10);

    return encoded;
  }

  static decodeChip(encodedChip) {
    let chip = {
    };

    let id = '';
    let ownerId = '';
    let x = '';
    let y = '';
    let angle = '';


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
      }

      chip.angle = parseInt(angle, 2) / 1000
    }


    return chip
  }

  static encodePeg(peg) {
    let output = '';

    output += this.toBinary(peg.id, 7);

    if (peg.ownerId === null) {
      output += this.toBinary(0, 3);
    } else {
      output += this.toBinary(peg.ownerId + 1, 3);
    }

    return output
  }

  static decodePeg(encodedPeg) {
    let peg = {};

    peg.id = parseInt(encodedPeg.slice(0, 7), 2)
    let ownerId = parseInt(encodedPeg.slice(7, 10), 2)

    if (ownerId === 0) {
      peg.ownerId = null
    } else {
      peg.ownerId = ownerId - 1
    }

    return peg
  }

  static encodeScore(score) {
    let output = '';

    output += this.toBinary(score[0], 6);
    output += this.toBinary(score[1], 6);
    output += this.toBinary(score[2], 6);
    output += this.toBinary(score[3], 6);

    return output;
  }

  static decodeScore(encodedScore) {
    let score = {}

    score[0] = parseInt(encodedScore.substring(0, 6), 2);
    score[1] = parseInt(encodedScore.substring(6, 12), 2);
    score[2] = parseInt(encodedScore.substring(12, 18), 2);
    score[3] = parseInt(encodedScore.substring(18, 24), 2);

    return score;
  }

  static encodeWinner(winner) {
    let output = '';
    let winnerFlag = winner === true ? '1' : '0';

    output += this.toBinary(winnerFlag, 1);

    return output;
  }

  static decodeWinner(encodedWinner) {
    let winner = encodedWinner === '1' ? true : false;
    return winner;   
  }

  static encodeTargetScore(targetScore) {
    let output = '';

    output += this.toBinary(targetScore, 6);

    return output;
  }

  static decodeTargetScore(encodedTargetScore) {
    let targetScore;

    targetScore = parseInt(encodedTargetScore.substring(0, 6), 2);

    return targetScore;
  }

  static encode({ chips, pegs, score, winner, targetScore }) {
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

    encoded += this.encodeWinner(winner);

    encoded += this.encodeTargetScore(targetScore);

    encoded += this.encodeScore(score)

    return encoded
  }

  static decode(encodedSnapshot) {
    if (!encodedSnapshot) { throw new Error('Must supply encoded snapshot')}
    const BITS_PER_CHIP = 41;
    const BITS_PER_PEG = 10;
    const BITS_FOR_SCORE = 24;
    const BITS_FOR_WINNER = 1;
    const BITS_FOR_TARGET_SCORE = 6;

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

    let winnerStart = 8 + numChips * BITS_PER_CHIP + 7 + numPegs * BITS_PER_PEG;
    let winner = this.decodeWinner(encodedSnapshot.substring(winnerStart, winnerStart + BITS_FOR_WINNER)); 
    
    let targetScoreStart = 8 + numChips * BITS_PER_CHIP + 7 + numPegs * BITS_PER_PEG + BITS_FOR_WINNER;
    let targetScore = this.decodeTargetScore(encodedSnapshot.substring(targetScoreStart, targetScoreStart + BITS_FOR_TARGET_SCORE)); 
    
    let scoreStart = 8 + numChips * BITS_PER_CHIP + 7 + numPegs * BITS_PER_PEG + BITS_FOR_WINNER + BITS_FOR_TARGET_SCORE;
    let score = this.decodeScore(encodedSnapshot.substring(scoreStart, scoreStart + BITS_FOR_SCORE))

    return { chips, pegs, score, winner, targetScore }
  }
}
