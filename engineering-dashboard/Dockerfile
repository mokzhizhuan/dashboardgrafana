FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json /app/
RUN npm install

COPY . /app
RUN npm run build

FROM node:20-alpine

WORKDIR /app

RUN npm install -g serve

COPY --from=builder /app/dist /app/dist

EXPOSE 4173

CMD ["serve", "-s", "dist", "-l", "4173"]