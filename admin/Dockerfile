FROM node:22-alpine AS build
WORKDIR /app
COPY admin/package*.json ./
RUN npm ci
COPY admin/ ./admin/
COPY src ./src/
ARG VITE_API_URL=http://localhost:3000
ENV VITE_API_URL=$VITE_API_URL
RUN npm --prefix admin run build

FROM nginx:1.27-alpine
COPY --from=build /app/admin/dist /usr/share/nginx/html
EXPOSE 80
