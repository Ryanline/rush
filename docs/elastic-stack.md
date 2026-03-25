# Elastic Stack Experiment

This branch captures the temporary self-hosted Elastic observability setup used for the Rush app.

## Purpose

This setup is for short-term development and learning:

- send Rush app container logs into Elasticsearch
- inspect them in Kibana
- test auth failures and API traffic visibility
- build a lightweight monitoring dashboard

It is not intended as a hardened production observability stack.

## Components

- `Elasticsearch`
- `Kibana`
- `Logstash`
- `Filebeat`

All components are deployed into the existing `k3s` cluster on the Rush EC2 instance.

## Files

- `infra/k3s/elastic-stack.yaml`: Kubernetes manifests for the stack

## Public URL

- Kibana: `https://rush-api-ryan.duckdns.org/kibana/`

## Notes

- This experiment required upsizing the EC2 instance to `m7i-flex.large`.
- A `4 GB` swapfile was added on the host to reduce memory pressure.
- `vm.max_map_count=262144` was set on the host for Elasticsearch.
- Kibana is currently publicly reachable and not protected by auth.

## Current limitations

- Logstash currently forwards raw Fastify JSON logs mostly as a `message` string.
- The first dashboard version therefore uses message-based filters instead of structured request fields.
- Health probes create background noise in request charts unless explicitly filtered out.

## Suggested cleanup later

- add auth or IP restriction in front of Kibana
- parse Fastify JSON logs into structured fields during ingest
- move Elastic off the same app node if this becomes long-lived
