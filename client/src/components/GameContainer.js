import React, { Component } from 'react';

import openSocketConnection from '../game/socket';

import Game from './Game';
import Lobby from './Lobby';

export default class GameContainer extends Component {
  // these will likely change after integration
  // e.g. we may need to differentiate between "active players" (top 4),
  // some of whom may be waiting for the next game to start, and
  // "currently playing players," who are all playing now
  state = {
    socket: undefined,
    userId: undefined,
    gameInProgress: false, // a game is currently running
    userInGame: false,     // the user is part of the currently running game
    activePlayers: {},     // users in top 4, will include this user if userInGame OR user is up in next round
    waitingPlayers: {},    // users below top 4, may include this user
  }

  componentDidMount() {
    const socket = openSocketConnection('localhost:3001');

    this.setState(() => {
      return {
        socket: socket,
        userId: "0",
        userName: '',
        gameInProgress: false,
        activePlayers: {
          0: {
            name: 'Branko',
            score: 0,
            colorId: 0,
          },
          1: {
            name: 'Josh',
            score: 0,
            colorId: 1,
          },
          2: {
            name: 'Ryann',
            score: 0,
            colorId: 2,
          },
          3: {
            name: 'Longest Name 15',
            score: 0,
            colorId: 3,
          },
        },
        waitingPlayers: {
          41231: {
            name: 'Poor Schmuck',
          },
          75654: {
            name: 'Sad Sack',
          }
        }
      }
    });
  }

  handleEndGameClick = () => {
    console.log('This should stop the current game and return users to lobby');
    this.setState({userInGame: false});
  }

  handleStartGameClick = () => {
    console.log('This should start a new game with the top 4 players in lobby');
    this.setState({userInGame: true});
  }

  handleNameSubmit = (name) => {
    console.log(`This should submit the new name "${name}" to the server from GameContainer, which should broadcast updated player lists to all players in lobby, which should close the form`)
  }

  render() {
    if (this.state.userInGame) {
      return (
        <Game
          socket={this.state.socket}
          players={this.state.activePlayers}
          handleEndGameClick={this.handleEndGameClick}
        />
      )
    } else {
      return (
        <Lobby
          userId={this.state.userId}
          activePlayers={this.state.activePlayers}
          waitingPlayers={this.state.waitingPlayers}
          gameInProgress={this.state.gameInProgress}
          isNameFormOpen={this.state.isNameFormOpen}
          handleStartGameClick={this.handleStartGameClick}
          handleNameSubmit={this.handleNameSubmit}
        />
      )
    }
  }
}
