var stream_config = {
	ws_url: "ws://localhost:8080/ws",
	realm: "remote_stream",
	stream_url: "rtmp://wowzaec2demo.streamlock.net/vod/mp4:BigBuckBunny_115k.mov",
	nb_samples: 20
}


try {
	module.exports = stream_config;
} catch(e) {

}