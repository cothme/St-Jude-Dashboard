FROM node:22-alpine AS frontend-deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM frontend-deps AS frontend-build
WORKDIR /app
COPY . .
ENV VITE_API_BASE_URL=/api
RUN npm run build

FROM node:22-alpine AS backend-deps
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci

FROM backend-deps AS backend-build
WORKDIR /app/backend
COPY backend .
RUN npm run prisma:generate
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app/backend
ENV NODE_ENV=production
COPY --from=backend-build /app/backend/package*.json ./
COPY --from=backend-build /app/backend/node_modules ./node_modules
COPY --from=backend-build /app/backend/dist ./dist
COPY --from=backend-build /app/backend/prisma ./prisma
COPY --from=frontend-build /app/dist ./public
EXPOSE 3001
CMD ["npm", "run", "start:prod"]
