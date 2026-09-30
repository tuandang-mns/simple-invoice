# ---- build: compile the static bundle ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_API_BASE_URL=http://localhost:3000
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

# ---- runtime: unprivileged nginx serving static files on :8080 ----
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime
ARG VITE_API_BASE_URL=http://localhost:3000
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY security-headers.conf /etc/nginx/security-headers.conf
# Allow the browser to call the API origin under the Content-Security-Policy.
USER root
RUN sed -i "s#__API_ORIGIN__#${VITE_API_BASE_URL}#" /etc/nginx/security-headers.conf
USER nginx
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/ >/dev/null || exit 1
