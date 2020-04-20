FROM crossbario/crossbar

USER root

RUN apt-get update

RUN apt-get install -y curl gnupg

RUN curl -sL https://deb.nodesource.com/setup_11.x  | bash -

RUN apt-get -y install nodejs

RUN apt-get install -y ffmpeg

RUN mkdir /home/remote_stream_receiver_server/

WORKDIR /home/remote_stream_receiver_server/

COPY package.json .

RUN npm install

COPY stream_config.js .

COPY remote_stream_receiver_server.js .

COPY launch_remote_stream_receiver_server.js .

COPY config.json /node/.crossbar/
