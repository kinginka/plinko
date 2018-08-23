import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { NavLink } from 'react-router-dom';
import { WiredCard } from 'wired-elements';

import Header from './Header';
import PlayerJoinForm from './PlayerJoinForm';
import StartGameButton from './StartGameButton';
import StartBanner from './StartBanner';

export default class Lobby extends Component {
  static propTypes = {
    userId: PropTypes.string,
    activeUsers: PropTypes.object,
    waitingUsers: PropTypes.object,
    gameIsRunning: PropTypes.bool,
    handleStartGameClick: PropTypes.func,
    handleUserJoin: PropTypes.func,
    gameInProgress: PropTypes.bool,
    startBannerVisible: PropTypes.bool,
    startCount: PropTypes.number,
  }

  state = {
    userName: '',
  }

  cardStyles = {
    backgroundColor: '#e6ebe0',
  }

  isActiveUser = () => {
    return Object.keys(this.props.activeUsers).includes(this.props.userId);
  }

  isWaitingUser = () => {
    return Object.keys(this.props.waitingUsers).includes(this.props.userId);
  }

  isNameFormOpen = () => {
    return !this.isActiveUser() && !this.isWaitingUser();
  }

  handleNameChange = (input) => {
    this.setState({
      userName: input,
    });
  }

  handleUserJoin = () => {
    this.props.handleUserJoin(this.state.userName.trim());
  }

  activeUserList = () => {
    if (!!Object.keys(this.props.activeUsers).length) {
      return (
        <div className="active-players row">
          <div className="players-container four columns">
            <h2>{"You're up next"}</h2>
            <ul>
              {this.userItems(this.props.activeUsers, true)}
            </ul>
          </div>

          {!this.props.startBannerVisible && this.gameStartElement()}
        </div>
      )
    } else {
      return null;
    }
  }

  waitingUserList = () => {
    if (!!Object.keys(this.props.waitingUsers).length) {
      return (
        <div className="waiting-players">
          <div className="players-container">
            <h2>Your turn is coming up</h2>
            <ul>
              {this.userItems(this.props.waitingUsers)}
            </ul>
        </div>
        </div>
      )
    } else {
      return null;
    }
  }

  userItems = (usersObj, active=false) => {
    return Object.keys(usersObj).map(id => {
      let user = usersObj[id];
      return (
        <li key={"player-" + id} className={active ? "player-" + user.playerId : ""}>
          <span className="dot"></span>
          {user.name}
        </li>
      )
    })
  }

  gameStartElement = () => {
    if (this.props.gameInProgress) {
      return (
        <p className="alert five columns offset-by-two">
          A game is currently in progress. When it's over, you and the other active players can start a new game.
        </p>
      )
    } else if (this.isActiveUser()) {
      return (
        <div className="button-container three columns offset-by-three">
          <StartGameButton
            handleClick={this.props.handleStartGameClick}
          />
        </div>
      )
    }
  }

  playerInfo = () => {
    if (this.isNameFormOpen()) {
      return (
        <div className="player-info">
          {<PlayerJoinForm userName={this.state.userName} handleSubmit={this.handleUserJoin} handleChange={this.handleNameChange} />}

          <div className="rules">
            <div className="rule">
              <wired-card style={this.cardStyles}><h2>Objective</h2></wired-card>
              <p>Hit the pegs as fast as you can to change their color.</p>
            </div>
            <div className="rule">
              <wired-card style={this.cardStyles}><h2>Playing with friends?</h2></wired-card>
              <p>Reach the target peg percentage before anyone else.</p>
              <p>Watch out! Other players can steal your pegs.</p>
            </div>
            <div className="rule">
              <wired-card style={this.cardStyles}><h2>Playing alone? </h2></wired-card>
              <p>Reach the target peg percentage as fast as you can.</p>
              <p>Can you hit 90% of pegs? How about 95%?</p>
            </div>
          </div>
        </div>
      )
    } else {
      return (
        <div className="player-info">
          {this.activeUserList()}
          {this.waitingUserList()}

          <div className="reminder">
            <p>Forget the rules and don't want to wing it? Get <NavLink to="help">help</NavLink>.</p>
          </div>
        </div>
      )
    }
  }

  render() {
    return (
      <main>
        <Header />
        <div className="main-content lobby">
          {this.props.startBannerVisible && <StartBanner count={this.props.startCount} />}
          {this.playerInfo()}
        </div>
      </main>
    )
  }
}
