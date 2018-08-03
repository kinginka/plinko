import React from 'react';
import PropTypes from 'prop-types';

const ScoreBar = ({ id, playerName, playerColorId, score, isWinner, targetPercentage }) => {
  const TOTAL_PEGS = 63;
  let widthPercentage = (Math.floor(score / TOTAL_PEGS * 100)) + '%';
  let leftPercentage = -(100 - targetPercentage);

  return (
    <li className={`player-color-${playerColorId}` + (isWinner ? " winner" : "")}>
      <span className="score-name">{playerName}</span>
      <span className="score-bar-container">
        <span className="score-bar" style={{width: widthPercentage}}></span>
        <span className="target-border" style={{left: leftPercentage + "%"}}></span>
      </span>
    </li>
  )
}

ScoreBar.propTypes = {
  id: PropTypes.string,
  playerName: PropTypes.string,
  score: PropTypes.number,
  isWinner: PropTypes.bool,
  targetPercentage: PropTypes.number,
}

export default ScoreBar;