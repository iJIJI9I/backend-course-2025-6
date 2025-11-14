FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 3000
ENTRYPOINT ["node", "index.js"]
CMD ["-p", "3000", "-c", "/app/cache", "-h", "0.0.0.0"]
