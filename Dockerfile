# GCC production image — Azure Container Apps / any OCI runtime
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* must be present at `next build` so the browser bundle is inlined.
# Do NOT pass SUPABASE_SERVICE_ROLE_KEY (or any server secret) as a build arg.
#
# Dual-mode build:
# - Supabase rollback / current prod: pass NEXT_PUBLIC_SUPABASE_*
# - Microsoft-native (AUTH_PROVIDER=entra): pass NEXT_PUBLIC_AUTH_PROVIDER=entra;
#   Supabase public keys are optional placeholders for the rollback client bundle.
ARG NEXT_PUBLIC_SUPABASE_URL=
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY=
ARG NEXT_PUBLIC_AUTH_PROVIDER=supabase
ARG NEXT_PUBLIC_APP_URL=https://app.growthcommandcenter.com
ARG NEXT_PUBLIC_MARKETING_URL=https://growthcommandcenter.com

ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_AUTH_PROVIDER=$NEXT_PUBLIC_AUTH_PROVIDER
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_MARKETING_URL=$NEXT_PUBLIC_MARKETING_URL

# Fail closed unless Microsoft-native browser flag is set OR Supabase public keys exist.
RUN if [ "$NEXT_PUBLIC_AUTH_PROVIDER" != "entra" ]; then \
      test -n "$NEXT_PUBLIC_SUPABASE_URL" || (echo "BLOCKER: NEXT_PUBLIC_SUPABASE_URL build-arg missing (or set NEXT_PUBLIC_AUTH_PROVIDER=entra)" >&2; exit 1); \
      test -n "$NEXT_PUBLIC_SUPABASE_ANON_KEY" || (echo "BLOCKER: NEXT_PUBLIC_SUPABASE_ANON_KEY build-arg missing (or set NEXT_PUBLIC_AUTH_PROVIDER=entra)" >&2; exit 1); \
    fi

RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN apk add --no-cache wget \
  && addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]
