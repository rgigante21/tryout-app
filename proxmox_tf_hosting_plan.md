# Proxmox Terraform Self-Host Plan

## Summary

Build this as a staged self-hosted production environment:

- First upgrade the Proxmox host from `8.4.12` to Proxmox VE 9 using the official vendor upgrade path, not Terraform.
- Then use Terraform to provision one Ubuntu 24.04 Docker VM on Proxmox.
- Run the app with production Docker images pulled from a registry.
- Expose the app publicly over HTTPS through Caddy on the VM.
- Keep Postgres on the same VM for v1, with persistent storage and nightly backups to an NFS NAS share.
- Keep Terraform responsible for infrastructure and OS bootstrap only. App deploys are handled by a separate repeatable Docker Compose deploy step.

References used: [Proxmox official 8 to 9 upgrade guide](https://pve.proxmox.com/mediawiki/index.php?title=Upgrade_from_8_to_9), [bpg Proxmox Terraform provider](https://github.com/bpg/terraform-provider-proxmox), [bpg cloud-init guide](https://raw.githubusercontent.com/bpg/terraform-provider-proxmox/main/docs/guides/cloud-init.md).

## Key Changes

### Proxmox Host Upgrade

- Treat the Proxmox upgrade as a manual/vendor-controlled maintenance phase before Terraform rollout.
- Bring the host fully current on Proxmox VE `8.4.x`, then run `pve8to9 --full` and resolve warnings before the major upgrade.
- Back up existing VMs/containers and `/etc`, especially `/etc/pve`, network config, storage config, and firewall config.
- Upgrade to Proxmox VE 9 through the official apt-based flow or fresh-install/restore flow, depending on host risk and backup confidence.
- After reboot, verify storage, networking, repositories, guest backups, and Proxmox UI/API before running Terraform.

### Terraform Infrastructure

Create `infra/proxmox/` with:

- `bpg/proxmox` provider pinned below `1.0`, with `.terraform.lock.hcl` committed after first init.
- A dedicated Proxmox API token, not root credentials.
- A single VM resource using cloud-init, static LAN IP, QEMU guest agent, serial device, and a downloaded Ubuntu 24.04 cloud image.
- Default VM size: `2 vCPU`, `4 GB RAM`, `64 GB disk`, configurable through variables.
- Network defaults: bridge `vmbr0`, static IPv4 CIDR, gateway, DNS servers, and VM firewall rules.
- Cloud-init bootstrap that installs Docker, Docker Compose plugin, Caddy prerequisites if needed, NFS client tools, qemu guest agent, UFW, and creates `/opt/tryout-app`.
- NFS backup mount at `/mnt/tryout-backups` using `_netdev,nofail,x-systemd.automount`.

Terraform inputs should include:

- `proxmox_endpoint`
- `proxmox_api_token`
- `proxmox_node_name`
- `proxmox_datastore`
- `proxmox_snippets_datastore`
- `vm_name`
- `vm_id`
- `vm_ipv4_cidr`
- `vm_gateway`
- `vm_dns_servers`
- `admin_ssh_public_key`
- `admin_cidr`
- `app_domain`
- `nas_nfs_server`
- `nas_nfs_export`

Terraform outputs should include:

- VM name
- VM ID
- VM LAN IP
- SSH command
- App URL

### Production App Deployment

Add production deployment artifacts separate from Terraform:

- `backend/Dockerfile.prod`: Node 20 image, `npm ci --omit=dev`, no source mount, `CMD ["npm", "start"]`.
- `frontend/Dockerfile.prod`: build Vite assets and serve them from Nginx or Caddy static container.
- `docker-compose.prod.yml`: services for `caddy`, `frontend`, `backend`, `db`, and optional `backup-runner`.
- `Caddyfile`: terminate HTTPS for `app_domain`, route `/api/*` and `/health` to backend, route everything else to frontend, enable gzip/zstd, and set HSTS.
- `.env.production.example`: non-secret production variable names only.
- `scripts/deploy-prod.sh`: SSH-safe deploy command that logs into the registry, pulls pinned image tags, runs `docker compose pull`, `docker compose up -d`, and verifies health.

Use registry images:

- Add `.github/workflows/publish-images.yml`.
- Build and push backend/frontend images to GHCR.
- Tag images with commit SHA and optionally `main`.
- Production deploys should use immutable SHA tags, not `latest`.

### App Production Fixes

Make these repo changes before public HTTPS testing:

- Change backend DB SSL handling so `NODE_ENV=production` does not automatically force SSL for the local Postgres container.
- Add explicit `DB_SSL=true|false`, defaulting to `false`.
- Keep `NODE_ENV=production` enabled in the backend so Secure cookies, production logging, proxy trust, and required `CORS_ORIGINS` stay active.
- Set `CORS_ORIGINS=https://<app_domain>`.
- Remove Mailhog from production Compose unless real email features are added.
- Keep Postgres private on the Docker network; do not expose port `5432` publicly.
- Store `/opt/tryout-app/.env` on the VM with `0600` permissions. Do not render app secrets through Terraform user-data, because that would put them in Terraform state.

### Data, Backups, and Restore

- Keep Postgres data in a named Docker volume or a dedicated host path under `/opt/tryout-app/data/postgres`.
- Add a nightly systemd timer or backup container that runs `pg_dump`, compresses the dump, and writes to the mounted NFS share.
- Backup path format: `/mnt/tryout-backups/tryoutapp/YYYY/MM/tryoutapp-YYYYMMDD-HHMMSS.sql.gz`.
- Retention: 14 daily, 12 weekly, 12 monthly.
- Add a documented restore script that restores into a non-production database first.
- First production readiness milestone requires one successful restore test.

## Test Plan

- Run `pve8to9 --full` before and after the Proxmox upgrade and keep the output clean of blocking warnings.
- Run `terraform fmt`, `terraform validate`, and `terraform plan` from `infra/proxmox`.
- Apply Terraform first to a disposable/staging VM name and confirm cloud-init finishes.
- Verify SSH access, QEMU guest agent, static IP, UFW rules, Docker, Compose, NFS mount, and reboot persistence.
- Build backend/frontend production images locally once, then through GitHub Actions.
- Run backend tests against Postgres before publishing images.
- Deploy to the VM and verify:
  - `https://<app_domain>` loads the frontend.
  - `https://<app_domain>/health` returns backend health.
  - Login sets an HttpOnly, Secure, SameSite=Lax cookie.
  - `/api/auth/me` works after browser refresh.
  - Admin, scorer, CSV import, scoring, and finalization flows work.
  - Postgres is not reachable from outside the VM.
  - Nightly backup writes to the NFS share.
  - Restore works into a clean test database.

## Assumptions

- Proxmox is currently single-node `8.4.12`; production Terraform rollout waits until the host is upgraded and stable on Proxmox VE 9.
- Public DNS will be an owned domain or subdomain with router port forwards for `80` and `443` to the VM LAN IP.
- Caddy will terminate TLS directly on the app VM.
- NAS backups use NFS.
- Images will be published to GHCR unless a different registry is chosen later.
- Terraform state remains local for v1 and is not committed. `terraform.tfvars`, state files, registry tokens, app `.env`, and private keys stay out of git.
