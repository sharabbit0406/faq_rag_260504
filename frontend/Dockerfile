FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# NEXT_PUBLIC_* vars are baked into the client bundle at build time
ENV NEXT_PUBLIC_API_URL=https://faqrag-backend-l5jxtxzjha-uc.a.run.app
ENV NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyCZ7DSOKvu8RJ9W22HoGHWj6sfMsWHTNWE
ENV NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=claude-code-faq-rag-260504.firebaseapp.com
ENV NEXT_PUBLIC_FIREBASE_PROJECT_ID=claude-code-faq-rag-260504
ENV NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=claude-code-faq-rag-260504.firebasestorage.app
ENV NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=953754688378
ENV NEXT_PUBLIC_FIREBASE_APP_ID=1:953754688378:web:e27015cedf16b6c78f54c3
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
