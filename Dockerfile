FROM node:16.0.0
WORKDIR /home/node/app

COPY . .

RUN apt-get update -y
RUN apt-get -y install ffmpeg

RUN npm install --silent
RUN npm run build

CMD ["node", "index.js"]
