FROM gcc:14.2.0-bookworm

RUN apt-get update \
    && apt-get install -y --no-install-recommends make vim nano \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd --gid 1000 learner \
    && useradd --uid 1000 --gid 1000 --create-home --shell /bin/bash learner \
    && mkdir -p /workspace \
    && chown learner:learner /workspace

WORKDIR /workspace
USER learner
CMD ["sleep", "infinity"]
