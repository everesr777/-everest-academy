FROM node:20-alpine
WORKDIR /app
COPY . .
RUN cd admin/backend && npm install
EXPOSE 5000
CMD ["node", "admin/backend/server.js"]