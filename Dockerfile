FROM node:24-alpine
COPY --from=ghcr.io/pnpm/pnpm:12-alpine /opt/pnpm /opt/pnpm
RUN for bin in pnpm pn pnpx pnx; do ln -s "/opt/pnpm/$bin" "/usr/local/bin/$bin"; done
WORKDIR /app
COPY package.json pnpm-lock.yaml ./ 
RUN pnpm install --frozen-lockfile
COPY . .
CMD ["node", "server.js"]