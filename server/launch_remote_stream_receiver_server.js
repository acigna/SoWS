const stream_config = require('./stream_config');
const RemoteStreamReceiverServer = require('./remote_stream_receiver_server');
var rtrs = new RemoteStreamReceiverServer(stream_config.ws_url, stream_config.realm, stream_config.nb_samples);
rtrs.init();