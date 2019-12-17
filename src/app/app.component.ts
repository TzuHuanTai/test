import { Component, ViewChild, OnInit, ComponentFactoryResolver, ElementRef } from '@angular/core';

@Component({
	selector: 'app-root',
	templateUrl: './app.component.html',
	styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
	title = 'ng9new';
	resolver = [];

	localConnection: RTCPeerConnection;
	remoteConnection: RTCPeerConnection;
	sendChannel: RTCDataChannel;
	receiveChannel: RTCDataChannel;
	canvasWidth: number = 320;
	canvasHeight: number = 180;
	canvasContext: CanvasRenderingContext2D;
	@ViewChild('dataChannelSend', { static: true }) dataChannelSend: ElementRef;
	@ViewChild('dataChannelReceive', { static: true }) dataChannelReceive: ElementRef;
	@ViewChild('startButton', { static: true }) startButton: ElementRef;
	@ViewChild('sendButton', { static: true }) sendButton: ElementRef;
	@ViewChild('closeButton', { static: true }) closeButton: ElementRef;

	@ViewChild('localVideo', { static: true }) localVideo: ElementRef;
	@ViewChild('remoteVideo', { static: true }) remoteVideo: ElementRef;
	@ViewChild('canvas', { static: true }) canvas: ElementRef<HTMLCanvasElement>;
	@ViewChild('image', { static: true }) image: ElementRef<HTMLImageElement>;


	constructor(ComponentFactoryResolver: ComponentFactoryResolver) {

		console.log('AppComponent');
		ComponentFactoryResolver['_factories'].forEach((element) => {
			console.log(element)
		});
		this.resolver = Array.from(ComponentFactoryResolver['_factories'].values());
	}

	ngOnInit() {
		this.startStream();

		this.canvasContext = this.canvas.nativeElement.getContext('2d');

		this.remoteVideo.nativeElement.addEventListener('loadedmetadata', () => {
			this.canvas.nativeElement.width = this.canvasWidth;
			this.canvas.nativeElement.height = this.canvasHeight;
		}, false);

		this.closeButton.nativeElement.disabled = true;
		this.sendButton.nativeElement.disabled = true;
	}

	enableStartButton() {
		this.startButton.nativeElement.disabled = false;
	}

	disableSendButton() {
		this.sendButton.nativeElement.disabled = true;
	}

	createConnection() {
		console.log('=====start createConnection=====');
		this.dataChannelSend.nativeElement.placeholder = '';
		this.localConnection = new RTCPeerConnection();
		console.log('Created local peer connection object localConnection');

		this.sendChannel = this.localConnection.createDataChannel('sendMessageChannel');
		console.log('Created send data channel');

		this.localConnection.onicecandidate = e => {
			this.onIceCandidate(this.localConnection, e);
		};
		this.sendChannel.onopen = () => this.onSendChannelStateChange();
		this.sendChannel.onclose = () => this.onSendChannelStateChange();

		this.remoteConnection = new RTCPeerConnection();
		console.log('Created remote peer connection object remoteConnection');

		this.remoteConnection.onicecandidate = e => {
			this.onIceCandidate(this.remoteConnection, e);
		};
		this.remoteConnection.ondatachannel = (ev) => this.receiveChannelCallback(ev);

		this.connectStream();

		this.localConnection.createOffer().then(
			desc => this.gotDescription1(desc),
			() => this.onCreateSessionDescriptionError
		);
		this.startButton.nativeElement.disabled = true;
		this.closeButton.nativeElement.disabled = false;
	}

	onCreateSessionDescriptionError(error) {
		console.log('Failed to create session description: ' + error.toString());
	}

	sendMessage() {
		const data = this.dataChannelSend.nativeElement.value;
		this.sendChannel.send(data);
		console.log('Sent Data: ' + data);
	}

	startStream() {
		navigator.mediaDevices.getUserMedia({
			audio: true,
			video: { width: 1280, height: 720 }
		}).then((stream: MediaStream) => {
			this.localVideo.nativeElement.srcObject = stream;
		}, (err) => {
			console.log(err)
		});
	}

	stopStream() {
		let stream: MediaStream = this.localVideo.nativeElement.srcObject;

		stream.getTracks().forEach((track: MediaStreamTrack) => {
			track.stop();
		});

		this.localVideo.nativeElement.srcObject = null;
	}

	connectStream() {
		let stream: MediaStream = this.localVideo.nativeElement.srcObject;

		stream.getTracks().forEach((track: MediaStreamTrack) => {
			this.localConnection.addTrack(track, stream);
		});

		this.remoteConnection.ontrack = (ev) => {
			if (ev.streams && ev.streams[0]) {
				this.remoteVideo.nativeElement.srcObject = ev.streams[0];
			}
		}
	}

	snap() {
		this.canvasContext.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
		this.canvasContext.drawImage(this.remoteVideo.nativeElement, 0, 0, this.canvasWidth, this.canvasHeight);
		let imageURL = this.canvas.nativeElement.toDataURL('image/jpeg');
		this.image.nativeElement.src = imageURL;
	}

	closeDataChannels() {
		console.log('=====start closing data channels=====');
		this.sendChannel.close();
		console.log('Closed data channel with label: ' + this.sendChannel.label);
		this.receiveChannel.close();
		console.log('Closed data channel with label: ' + this.receiveChannel.label);
		this.localConnection.close();
		this.remoteConnection.close();
		this.localConnection = null;
		this.remoteConnection = null;
		console.log('Closed peer connections');
		this.startButton.nativeElement.disabled = false;
		this.sendButton.nativeElement.disabled = true;
		this.closeButton.nativeElement.disabled = true;
		this.dataChannelSend.nativeElement.value = '';
		this.dataChannelReceive.nativeElement.value = '';
		this.dataChannelSend.nativeElement.disabled = true;
		this.disableSendButton();
		this.enableStartButton();
		console.log('=====closed Data Channels======');
	}

	gotDescription1(desc: RTCSessionDescriptionInit) {
		this.localConnection.setLocalDescription(desc);
		console.log(`Offer from localConnection\n${desc.sdp}`);
		this.remoteConnection.setRemoteDescription(desc);
		this.remoteConnection.createAnswer().then(
			desc => this.gotDescription2(desc),
			() => this.onCreateSessionDescriptionError
		);
	}

	gotDescription2(desc) {
		this.remoteConnection.setLocalDescription(desc);
		console.log(`Answer from remoteConnection\n${desc.sdp}`);
		this.localConnection.setRemoteDescription(desc);
	}

	getOtherPc(pc) {
		return (pc === this.localConnection) ? this.remoteConnection : this.localConnection;
	}

	getName(pc) {
		return (pc === this.localConnection) ? 'localPeerConnection' : 'remotePeerConnection';
	}

	onIceCandidate(pc, event: RTCPeerConnectionIceEvent) {
		this.getOtherPc(pc)
			.addIceCandidate(event.candidate)
			.then(
				() => this.onAddIceCandidateSuccess(),
				err => this.onAddIceCandidateError(err)
			);
		console.log(`${this.getName(pc)} ICE candidate: ${event.candidate ? event.candidate.candidate : '(null)'}`);
	}

	onAddIceCandidateSuccess() {
		console.log('AddIceCandidate success.');
	}

	onAddIceCandidateError(error) {
		console.log(`Failed to add Ice Candidate: ${error.toString()}`);
	}

	receiveChannelCallback(event) {
		console.log('Receive Channel Callback');
		this.receiveChannel = event.channel;
		this.receiveChannel.onmessage = ev => this.onReceiveMessageCallback(ev);
		this.receiveChannel.onopen = (ev) => this.onReceiveChannelStateChange();
		this.receiveChannel.onclose = (ev) => this.onReceiveChannelStateChange();
	}

	onReceiveMessageCallback(event) {
		console.log('Received Message');
		this.dataChannelReceive.nativeElement.value = event.data;
	}

	onSendChannelStateChange() {
		const readyState = this.sendChannel.readyState;
		console.log('Send channel state is: ' + readyState);
		if (readyState === 'open') {
			this.dataChannelSend.nativeElement.disabled = false;
			this.dataChannelSend.nativeElement.focus();
			this.sendButton.nativeElement.disabled = false;
			this.closeButton.nativeElement.disabled = false;
		} else {
			this.dataChannelSend.nativeElement.disabled = true;
			this.sendButton.nativeElement.disabled = true;
			this.closeButton.nativeElement.disabled = true;
		}
	}

	onReceiveChannelStateChange() {
		const readyState = this.receiveChannel.readyState;
		console.log(`Receive channel state is: ${readyState}`);
	}
}
