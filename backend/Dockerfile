# Debian-based (not alpine): puppeteer's bundled Chromium download is built
# against glibc and does not run on musl libc (alpine) without switching to
# puppeteer-core + a system Chromium package — a separate change, not this one.
FROM node:20-bookworm-slim

# Chromium's runtime shared-library dependencies. Without these, puppeteer's
# browser.launch() fails at runtime even though the image builds fine and
# node_modules/puppeteer's own Chromium download succeeded.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libxss1 \
    wget \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies first so this layer only re-runs (and re-downloads
# Chromium) when package.json/package-lock.json actually change, not on
# every source edit.
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "server.js"]
