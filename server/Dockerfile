FROM node:22-alpine

RUN apk add --no-cache tzdata

WORKDIR /app

COPY server/package*.json ./
RUN npm ci --omit=dev

COPY server/prisma ./prisma
RUN npx prisma generate

COPY server/src ./src
COPY server/scripts ./scripts
COPY assets/designers /seed-assets/designers
ENV DESIGNER_SEED_DIR=/seed-assets/designers

EXPOSE 3000

CMD ["npm", "run", "start"]
