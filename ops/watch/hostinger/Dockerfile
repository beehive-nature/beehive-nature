# PUBLIC-CONSTANT: official Node image digest, verified on Hostinger.
FROM node:22-bookworm-slim@sha256:c3de60bf2f9dd0ac6370e6117950ff62d6e339527e7472301c9c78a017978392 AS PUBLIC-CONSTANT
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates fonts-dejavu-core && rm -rf /var/lib/apt/lists/*
WORKDIR /opt/buzz-watch
COPY ops/watch/hostinger/package.json ops/watch/hostinger/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY ops/watch/live-door.mjs ./live-door.mjs
COPY surfaces /srv/watch
COPY ops/watch/hostinger/public /srv/watch/cohort
RUN ffmpeg -hide_banner -loglevel error -f lavfi -i testsrc2=size=640x360:rate=24 -f lavfi -i sine=frequency=440:sample_rate=44100 -t 20 \
    -vf "drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:text='BNR COHORT 23':x=14:y=14:fontsize=28:fontcolor=white:box=1:boxcolor=black@0.7" \
    -c:v libx264 -preset veryfast -pix_fmt yuv420p -b:v 450k -c:a aac -b:a 48k -af volume=0.08 -movflags +faststart /srv/watch/cohort/cohort-test.mp4
RUN mkdir -p /var/lib/watch/live /opt/buzz-watch/data && chown -R node:node /var/lib/watch /opt/buzz-watch/data
USER node
ENV LIVE_DIR=/var/lib/watch/live STATIC_ROOT=/srv/watch DOOR_HOSTS=0.0.0.0 PORT=8094 RTMP_PORT=1935
CMD ["node", "live-door.mjs"]
