const autobahn = require('autobahn');
const {spawn} = require('child_process');
const MP4Box = require('mp4box');

var RemoteStreamReceiverServer = function ( wsURL, realm, nbSamples ) {
	this.streams = [];
	this.wsURL = wsURL;
    this.realm = realm;
    this.nbSamples = nbSamples;
	this.started = false;
}

RemoteStreamReceiverServer.prototype = {
	init: function () {
		//Initialize websocket connection to crossbar server
		var self = this;
		var conversation_websocket = new autobahn.Connection({
 			  url: this.wsURL,
 			  realm: this.realm,
 			  serializers: [new autobahn.serializer.MsgpackSerializer()]
		  	});
		conversation_websocket.open();
		this.conversation_websocket = conversation_websocket;

		conversation_websocket.onopen = function ( session ) {
			//Setup once in the beginning
			if(self.started) return;
			self.started = true;

			//Initialize the websocket session
			self.session = session;

			console.log('connected');

			//Manage a new stream
			session.register("new_stream", function ( args, kwargs, details ) {
				console.log("new stream", args[0], args[1]);
				return self.handleNewStreamReceiverClient( session, details.caller, args[0], args[1], self.nbSamples );
			});

			//Handle session leave
			session.subscribe("wamp.session.on_leave", function ( onevent ) {
				console.log('leaving the stream');
		  		self.handleClientSessionLeave( onevent[0] );
		  	});
		}
	},

	//Handle New Stream Receiver Client
	handleNewStreamReceiverClient: function ( session, sessionId, uuid, streamURL, nbSamples ) {
		var self = this;

		//Init the MP4 Segmenter with MP4Box
		var mp4boxfile = MP4Box.createFile();

		//Keeping the current pointer to the stream
		var currentFileStart = 0;
		
		mp4boxfile.onReady = function ( info ) {
			console.log( info );
			console.log("track length", info.tracks.length);
			console.log("samples number", nbSamples);

			//Initial Tracks Info
			var initTracksInfo = {};

			//Add all tracks
			info.tracks.forEach(function ( track ) {
				console.log(track.kind);
				var trackInfo = {id: track.id, codec: track.codec};
				initTracksInfo[track.id] = trackInfo; 
				mp4boxfile.setSegmentOptions(track.id, trackInfo, { nbSamples: nbSamples });  
		    });

			//Handle New Segment Data
			mp4boxfile.onSegment = function (id, user, buffer) {
				var nodeBuffer = Buffer.from(buffer);
				//console.log(nodeBuffer, nodeBuffer.byteLength);
				session.publish(uuid + ".new_stream_data", [{id: user.id, buffer: nodeBuffer}]);
    			//console.log("Received segment on track "+id+" for object "+user+" with a length of "+buffer.byteLength);
			}

			//Get the initial segments
  			var initSegs = mp4boxfile.initializeSegmentation();  
  			console.log( initSegs );

  			//Setup the initial segments buffer in initTrackInfo
  			initSegs.forEach(function ( initSeg ) {
  				initSeg.user.init_seg_buffer = Buffer.from(initSeg.buffer);
  			});
  			
  			//Send initial tracks info.
  			session.publish(uuid + ".init_tracks_info", [{mime: info.mime, brands: info.brands, tracks: initTracksInfo}]);
  			
  			//Send initial segments data
  			initSegs.forEach(function ( initSeg ) {
  				session.publish(uuid + ".new_stream_data", [{id: initSeg.user.id, buffer: initSeg.user.init_seg_buffer}]);
  			});

  			//Start MP4 Segmentation
  			mp4boxfile.start();
		}

		//Launch ffmpeg
		var ffmpeg = spawn('ffmpeg', [
			'-i', streamURL,
			'-y',
			'-threads', '4',
			'-vcodec', 'copy',
			'-acodec', 'aac',
			'-strict', '-2',
			'-tune', '-zerolatency',
			"-movflags", "frag_keyframe+empty_moov+default_base_moof",
			'-f', 'mp4',
			'-'
		]);

		// If FFmpeg stops for any reason, close the WebSocket connection.
  		ffmpeg.on('close', (code, signal) => {
    		console.log('FFmpeg child process closed, code ' + code + ', signal ' + signal);
    		self.handleClientSessionLeave( sessionId );
  		});
  
  		// Handle STDIN pipe errors by logging to the console.
  		// These errors most commonly occur when FFmpeg closes and there is still
  		// data to write.  If left unhandled, the server will crash.
  		ffmpeg.stdin.on('error', (e) => {
    		console.log('FFmpeg STDIN Error', e);
  		});

  		//Append FFMPeg stream output to MP4Box
  		ffmpeg.stdout.on('data', function ( data ) {
  			//console.log( data, data.byteLength );
  			var buffer = data.buffer;
  			buffer.fileStart = currentFileStart;
  			currentFileStart += data.byteLength;
  			mp4boxfile.appendBuffer(buffer);
  		});

  
  		// FFmpeg outputs all of its messages to STDERR.  Let's log them to the console.
  		ffmpeg.stderr.on('data', (data) => {
    		console.log('FFmpeg STDERR:', data.toString());
  		});

  		//Add to the streams data
		this.streams.push({stream_url: streamURL, uuid: uuid,  sessionId: sessionId, ffmpeg: ffmpeg});

		return true;
	},

	//Shut down FFMPeg when a client disconnects from Web Socket 
	handleClientSessionLeave: function ( sessionId ) {
		var stream = this.streams.filter(function ( stream ) { return stream.sessionId === sessionId })[0];
		
		if( stream ) {
			console.log('killing ffmpeg process');
			//Remove the stream object
			this.streams.splice( this.streams.indexOf( stream ), 1 );

			//Stop ffmpeg from streaming
			stream.ffmpeg.kill('SIGINT');
		}
	}
}

module.exports = RemoteStreamReceiverServer;
