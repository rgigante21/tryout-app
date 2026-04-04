FROM node:20-alpine

WORKDIR /app

# Install dependencies into the image layer first (cache-friendly)
COPY package*.json ./
RUN npm install

COPY . .

# Entrypoint ensures node_modules are populated even when
# a named volume masks the image layer's copy
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 4000

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["npm", "run", "dev"]
