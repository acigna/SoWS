function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

RemoteStreamReceiverClient = function ( ws_url, streamURL ) {
	this.uuid = uuidv4();
	this.ws_url = ws_url;
	this.streamURL = streamURL;
	this.started = false;
	this.sources = {};
}

RemoteStreamReceiverClient.prototype = {
	startReceiveStreaming: function () {
		var self = this;
		var conversation_websocket = new autobahn.Connection({
 			  url: this.ws_url,
 			  realm: "remote_stream",
 			  serializers: [new autobahn.serializer.MsgpackSerializer()]
		  });
		conversation_websocket.open();
		this.conversation_websocket = conversation_websocket;
		conversation_websocket.onopen = function ( session ) {
			console.log('connected');
			
			self.session = session;
			
			//Never resetup on reconnection
			if(self.started) return;
			self.started = true;

			//Setup a new stream
			session.call('new_stream', [self.uuid, self.streamURL]).then(function () {
				self.initStreamingSession( session, self.videoElement );
			});


			session.subscribe(self.uuid + '.init_tracks_info', function ( data ) {
				self.handleInitTracksInfo( data[0] );
			});

			session.subscribe(self.uuid + '.' + 'new_stream_data', function ( data ) {
				self.handleNewStreamData( data[0] );
			});
		}
	},

	handleNewStreamData: function ( stream_data ) {
		var source = this.sources[stream_data.id],
			streamBufferData = stream_data.buffer, 
			sourceBuffer = source.buffer,
			queue = source.queue;


		if( sourceBuffer.updating ) {
			sourceBuffer.addEventListener('updateend', function () {
				if( !sourceBuffer.updating && queue.length ) {
					sourceBuffer.appendBuffer( queue.shift() );
				}
			});
			queue.push( streamBufferData );
		} else {
			sourceBuffer.appendBuffer( streamBufferData );
		}	
	},

	handleInitTracksInfo: function ( initTracksInfo )  {
		var self = this,
			mediaSource = this.mediaSource;

		//Initiate Source Buffers
		console.log('readyState', this.mediaSource.readyState);
		if( mediaSource.readyState === 'open' ) {
			this.setUpSourceBuffers( mediaSource, initTracksInfo );
		} else {
			mediaSource.addEventListener('sourceopen', function () {
				self.setUpSourceBuffers( mediaSource, initTracksInfo );
			});	
		}
	},

	setUpSourceBuffers: function ( mediaSource, initTracksInfo ) {
		console.log( "init tracks info", initTracksInfo );
		var self = this,
			mediaSource = this.mediaSource,
			sources = this.sources,
			mimeTypeParts = initTracksInfo.mime.split(';'),
			mainMime = mimeTypeParts[0],
			codecs = mimeTypeParts[1].slice(9, -1).split(','),
			profiles = mimeTypeParts[2].slice(11, -1).split(',');
		console.log( mimeTypeParts, mainMime, codecs, profiles );
		if( !Object.keys(sources).length ) {
			Object.keys(initTracksInfo.tracks).forEach(function ( keyIndex, index ) {
				var track = initTracksInfo.tracks[ keyIndex ];
				var trackMime = mainMime + '; codecs="' + codecs[ index ]  + '"; profiles="' + 
					profiles[ index ] + '"';
				console.log( "key index", keyIndex );
				console.log( "track mime", trackMime );
				console.log(MediaSource.isTypeSupported(trackMime));
				var sourceBuffer = mediaSource.addSourceBuffer(trackMime);
				sourceBuffer.mode = 'sequence';
				sources[keyIndex] = {};
				sources[keyIndex].buffer = sourceBuffer;
				sources[keyIndex].queue = [];
			});
		}
		
	},

	initStreamingSession: function ( session, videoElement ) {
		var mediaSource = new MediaSource(),
			self = this;
		this.mediaSource = mediaSource;
		this.onStreamingSessionStart( mediaSource );

	},


	createVideoElementFromMediaSource: function ( mediaSource ) {
      var videoElement = document.createElement('video');
      videoElement.setAttribute('autoplay', '');
      videoElement.id = 'stream2';
      videoElement.src = URL.createObjectURL(mediaSource);
      return videoElement;
    },
	
	onStreamingSessionStart: function ( mediaSource ) {

	}
}
