FROM node:22-alpine AS build
WORKDIR /app/admin
COPY admin/package*.json ./
RUN npm ci
COPY admin/ ./

WORKDIR /app
COPY src ./src/
COPY public ./public/
ARG VITE_API_URL=http://localhost:3000
ENV VITE_API_URL=$VITE_API_URL

WORKDIR /app/admin
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/admin/dist /usr/share/nginx/html
COPY admin/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
