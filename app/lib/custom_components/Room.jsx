import React from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import ReactTooltip from 'react-tooltip';
import classnames from 'classnames';
import clipboardCopy from 'clipboard-copy';
import * as appPropTypes from './appPropTypes';
import { withRoomContext } from '../RoomContext';
import * as requestActions from '../redux/requestActions';
import { Appear } from './transitions';
import Me from './Me';
import ChatInput from './ChatInput';
import Peers from './Peers';
import Stats from './Stats';
import Notifications from './Notifications';
import NetworkThrottle from './NetworkThrottle';

class Room extends React.Component {
	render() {
		const {
			roomClient,
			room,
			me,
			amActiveSpeaker,
			onRoomLinkCopy
		} = this.props;

		const mediasoupClientVersion = room.mediasoupClientVersion === '__MEDIASOUP_CLIENT_VERSION__'
			? 'dev'
			: room.mediasoupClientVersion;

		return (
			<div duration={300}>
				<div data-component='Room'>
					<Peers />
					<div
						className={classnames('me-container', {
							'active-speaker': amActiveSpeaker
						})}
					>
						<Me />
					</div>
					<div className="ui horizontal divider">
						视频管理
					</div>
					<div className='sidebar'>
						<div
							className={classnames('button', 'hide-videos', {
								on: me.audioOnly,
								disabled: me.audioOnlyInProgress
							})}
							data-tip={'关闭/开启所有视频'}
							onClick={() => {
								me.audioOnly
									? roomClient.disableAudioOnly()
									: roomClient.enableAudioOnly();
							}}
						/>
						<div
							className={classnames('button', 'mute-audio', {
								on: me.audioMuted
							})}
							data-tip={'关闭/开启所有语音'}
							onClick={() => {
								me.audioMuted
									? roomClient.unmuteAudio()
									: roomClient.muteAudio();
							}}
						/>

						<div
							className={classnames('button', 'restart-ice', {
								disabled: me.restartIceInProgress
							})}
							data-tip='重新连接'
							onClick={() => roomClient.restartIce()}
						/>
					</div>


					<If condition={window.NETWORK_THROTTLE_SECRET}>
						<NetworkThrottle
							secret={window.NETWORK_THROTTLE_SECRET}
						/>
					</If>

					<ReactTooltip
						type='light'
						effect='solid'
						delayShow={100}
						delayHide={100}
						delayUpdate={50}
					/>
				</div>
			</div>
		);
	}

	componentDidMount() {
		const { roomClient } = this.props;

		roomClient.join();
	}
}

Room.propTypes =
{
	roomClient: PropTypes.any.isRequired,
	room: appPropTypes.Room.isRequired,
	me: appPropTypes.Me.isRequired,
	amActiveSpeaker: PropTypes.bool.isRequired,
	onRoomLinkCopy: PropTypes.func.isRequired
};

const mapStateToProps = (state) => {
	return {
		room: state.room,
		me: state.me,
		amActiveSpeaker: state.me.id === state.room.activeSpeakerId
	};
};

const mapDispatchToProps = (dispatch) => {
	return {
		onRoomLinkCopy: () => {
			dispatch(requestActions.notify(
				{
					text: 'Room link copied to the clipboard'
				}));
		}
	};
};

const RoomContainer = withRoomContext(connect(
	mapStateToProps,
	mapDispatchToProps
)(Room));

export default RoomContainer;
