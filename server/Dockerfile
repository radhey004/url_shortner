FROM node:22-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

ENV NODE_OPTIONS=--dns-result-order=ipv4first

EXPOSE 5000

CMD ["npm", "start"]