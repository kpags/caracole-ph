FROM node:22-alpine

RUN apk add --no-cache tzdata

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src
COPY scripts ./scripts

EXPOSE 3000

CMD ["npm", "run", "start"]
