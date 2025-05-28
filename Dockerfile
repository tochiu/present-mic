FROM node:18
WORKDIR /home/node/app

COPY . .

RUN apt-get update -y
RUN apt-get -y install ffmpeg

RUN npm install --silent

CMD ["node", "index.js"]
