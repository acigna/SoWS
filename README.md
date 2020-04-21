# SoWS
Stream over Web Socket : Managing for now the reception of remote streams in web browser using MSE and Web Socket.

This work is part of a projet on 5G video streaming services at the Edge to VR devices. Some examples will be included showing the VR usage. 

# Architecture
The following Figure shows the system architecture :
![Architecture Image](/architecture.png)

On the server side, the RemoteStreamReceiverServer NodeJS process (Crossbario Guest Worker) receives remote streams (RTSP, RTMP, HTTP, etc.) using FFMPEG. The process uses MP4Box module to extract tracks and segment the MP4 stream. 

On the client side, the RemoteStreamReceiverClient receives the stream and uses the [Media Source Extension](https://developer.mozilla.org/en-US/docs/Web/API/Media_Source_Extensions_API "Media Source Extension API") or MSE to output the stream to a video element.

# Installation


# TODO 
