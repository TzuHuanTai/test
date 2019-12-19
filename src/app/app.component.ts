import { Component, ViewChild, OnInit, ComponentFactoryResolver, ElementRef } from '@angular/core';

@Component({
	selector: 'app-root',
	templateUrl: './app.component.html',
	styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
	resolver = [];

	isConntected: boolean = false;

	localConnection: RTCPeerConnection;
	remoteConnection: RTCPeerConnection;
	sendChannel: RTCDataChannel;
	receiveChannel: RTCDataChannel;
	sendImageChannel: RTCDataChannel;
	receiveImageChannel: RTCDataChannel;

	canvasWidth: number = 160;
	canvasHeight: number = 90;
	receiveImage: HTMLImageElement = new Image();
	strokeStyle: string = '#000';
	lineWidth: number = 2;
	undoDrawingHistory = [];
	redoDrawingHistory = [];

	@ViewChild('dataChannelSend', { static: true }) dataChannelSend: ElementRef;
	@ViewChild('dataChannelReceive', { static: true }) dataChannelReceive: ElementRef;
	@ViewChild('startButton', { static: true }) startButton: ElementRef;
	@ViewChild('sendButton', { static: true }) sendButton: ElementRef;
	@ViewChild('closeButton', { static: true }) closeButton: ElementRef;

	@ViewChild('localVideo', { static: true }) localVideo: ElementRef;
	@ViewChild('remoteVideo', { static: true }) remoteVideo: ElementRef;
	@ViewChild('localCanvas', { static: true }) localCanvas: ElementRef<HTMLCanvasElement>;
	@ViewChild('remoteCanvas', { static: true }) remoteCanvas: ElementRef<HTMLCanvasElement>;
	@ViewChild('drawingCanvas', { static: true }) drawingCanvas: ElementRef<HTMLCanvasElement>;

	constructor(ComponentFactoryResolver: ComponentFactoryResolver) {

		// Angular 8 is work, but 9.0 can't
		ComponentFactoryResolver['_factories'].forEach((element) => {
			console.log(element);
		});
		this.resolver = Array.from(ComponentFactoryResolver['_factories'].values());
	}

	ngOnInit() {
		this.startStream();

		this.initDrawPanel();

		this.remoteVideo.nativeElement.addEventListener('loadedmetadata', () => {
			this.localCanvas.nativeElement.width = this.canvasWidth;
			this.localCanvas.nativeElement.height = this.canvasHeight;
		}, false);

		// other
		this.closeButton.nativeElement.disabled = true;
		this.sendButton.nativeElement.disabled = true;
	}

	initDrawPanel() {
		/**
		 * putImageData以 drawImage更新畫面有效能問題！
		 * Issue: https://stackoverflow.com/questions/3952856/why-is-putimagedata-so-slow
		 */
		let isDrawing: boolean;
		let prevX: number, prevY: number, currX: number, currY: number;
		let canvas: HTMLCanvasElement = this.drawingCanvas.nativeElement;
		let context: CanvasRenderingContext2D = canvas.getContext('2d');
		canvas.width = this.canvasWidth;
		canvas.height = this.canvasHeight;

		canvas.onmousedown = (e) => {
			let buffer = this.getBufferCanvas(canvas)
			this.undoDrawingHistory.push(buffer);
			isDrawing = true;
			prevX = currX;
			prevY = currY;
			currX = e.clientX - canvas.offsetLeft + window.scrollX;
			currY = e.clientY - canvas.offsetTop + window.scrollY;
		};

		canvas.onmousemove = (e) => {
			if (isDrawing) {
				prevX = currX;
				prevY = currY;
				currX = e.clientX - canvas.offsetLeft + window.scrollX;
				currY = e.clientY - canvas.offsetTop + window.scrollY;
				context.beginPath();
				context.moveTo(prevX, prevY);
				context.lineTo(currX, currY);
				context.strokeStyle = this.strokeStyle;
				context.lineWidth = this.lineWidth;
				context.stroke();
			}
		};

		canvas.onmouseup = () => {
			isDrawing = false;
			this.redoDrawingHistory = [this.getBufferCanvas(canvas)];
		};

	}

	getBufferCanvas(canvas: HTMLCanvasElement): HTMLCanvasElement {
		let buffer = document.createElement('canvas');
		buffer.width = canvas.width;
		buffer.height = canvas.height;
		buffer.getContext('2d').drawImage(canvas, 0, 0);
		return buffer;
	}

	createConnection() {
		console.log('==========start createConnection==========');
		this.localConnection = new RTCPeerConnection();
		console.log('Created local peer connection object localConnection');

		this.sendChannel = this.localConnection.createDataChannel('sendMessageChannel', { negotiated: true, id: 1 });
		this.sendImageChannel = this.localConnection.createDataChannel('sendImageChannel', { negotiated: true, id: 2 });
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

		this.receiveChannel = this.remoteConnection.createDataChannel('sendMessageChannel', { negotiated: true, id: 1 });
		this.receiveImageChannel = this.remoteConnection.createDataChannel('sendImageChannel', { negotiated: true, id: 2 });
		this.receiveChannel.onmessage = ev => this.onReceiveMessageCallback(ev);
		this.receiveChannel.onopen = () => this.onReceiveChannelStateChange();
		this.receiveChannel.onclose = () => this.onReceiveChannelStateChange();
		this.receiveImageChannel.onmessage = (ev) => this.onReceiveImageCallback(ev);

		if (this.localVideo.nativeElement.srcObject) {
			this.connectStream();
		}

		this.localConnection.createOffer().then(
			desc => this.gotDescription1(desc),
			() => this.onCreateSessionDescriptionError
		);
		this.isConntected = true;
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
		let canvasContext = this.localCanvas.nativeElement.getContext('2d');
		canvasContext.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
		canvasContext.drawImage(this.remoteVideo.nativeElement, 0, 0, this.canvasWidth, this.canvasHeight);

	}

	sendImage() {
		let imageURL = this.localCanvas.nativeElement.toDataURL();
		this.sendImageChannel.send(imageURL);
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
		this.isConntected = false;
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

	onReceiveMessageCallback(event: MessageEvent) {
		console.log('Received Message');
		this.dataChannelReceive.nativeElement.value = event.data;
	}

	onReceiveImageCallback(event: MessageEvent) {
		console.log('Received Image');
		this.remoteCanvas.nativeElement.width = this.canvasWidth;
		this.remoteCanvas.nativeElement.height = this.canvasHeight;
		let remoteCanvasContext = this.remoteCanvas.nativeElement.getContext('2d');

		this.receiveImage.onload = (ev) => {
			remoteCanvasContext.drawImage(this.receiveImage, 0, 0);
			this.drawDrawingCanvas(this.receiveImage);
		}
		this.receiveImage.src = event.data;
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

	changeColor(obj: HTMLElement) {
		switch (obj.className) {
			case "green":
				this.strokeStyle = "green";
				break;
			case "blue":
				this.strokeStyle = "blue";
				break;
			case "red":
				this.strokeStyle = "red";
				break;
			case "yellow":
				this.strokeStyle = "yellow";
				break;
			case "orange":
				this.strokeStyle = "orange";
				break;
			case "black":
				this.strokeStyle = "black";
				break;
			case "white":
				this.strokeStyle = "white";
				break;
			case "cyan":
				this.strokeStyle = "cyan";
				break;
			case "magenta":
				this.strokeStyle = "magenta";
				break;
		}
		if (this.strokeStyle == "white") this.lineWidth = 14;
		else this.lineWidth = 2;
	}

	undo() {
		if (this.undoDrawingHistory.length > 0) {
			let imageURL = this.undoDrawingHistory.pop();
			this.redoDrawingHistory.push(imageURL);
			this.drawDrawingCanvas(imageURL);
		}
	}

	redo() {
		if (this.redoDrawingHistory.length > 1) {
			let imageURL = this.redoDrawingHistory.pop();
			this.undoDrawingHistory.push(imageURL);
			this.drawDrawingCanvas(this.redoDrawingHistory[this.redoDrawingHistory.length - 1]);
		}
	}

	sendDrawnCanvas() {
		let imageURL = this.drawingCanvas.nativeElement.toDataURL();
		this.sendImageChannel.send(imageURL);
	}

	clear() {
		this.redoDrawingHistory = [];
		this.undoDrawingHistory = [];
		this.drawDrawingCanvas(this.receiveImage);
	}

	drawDrawingCanvas(imgData: CanvasImageSource) {
		let canvas = this.drawingCanvas.nativeElement;
		let context = this.drawingCanvas.nativeElement.getContext('2d');
		context.clearRect(0, 0, canvas.width, canvas.height);
		context.drawImage(imgData, 0, 0);
	}
}
