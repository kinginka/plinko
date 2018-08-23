import React, { Component } from 'react';
import PropTypes from 'prop-types';

import { WiredButton } from "wired-button";

export default class PlayerJoinForm extends Component {
  static propTypes = {
    userName: PropTypes.string,
    handleChange: PropTypes.func,
    handleSubmit: PropTypes.func,
  }

  state = {
    isJoinDisabled: true,
  }

  componentDidUpdate(prevProps) {
    if (this.props.userName !== prevProps.userName) {
      this.setState({isJoinDisabled: this.props.userName.trim() === ''}, () => {
        // wired-button does not allow for removal of disabled class through
        // React and className
        if (!this.state.isJoinDisabled) {
          document.querySelector('wired-button').classList.remove('disabled');
        } else {
          document.querySelector('wired-button').classList.add('disabled');
        }
      });
    }
  }

  updateName = (e) => {
    this.props.handleChange(e.target.value);
  }

  joinGame = (e) => {
    this.props.handleSubmit();
  }

  handleKeyUp = (e) => {
    // if user pressed enter key
    if (e.keyCode === 13) {
      this.joinGame();
    }
  }

  render() {
    console.log('disabled?', this.state.isJoinDisabled)
    return (
      <div className="name-form">
        <input type="text" placeholder="Your Name" value={this.props.userName} onChange={this.updateName} onKeyUp={this.handleKeyUp} maxLength="15"/>
        <wired-button disabled={this.state.isJoinDisabled} onClick={this.joinGame}>Join</wired-button>
    </div>
    )
  }
}
