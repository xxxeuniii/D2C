# CI/CD

GitHub Actions workflow: `.github/workflows/ci-cd.yml`

## Pipeline

- Pull requests and pushes to `master` run backend syntax validation and a production frontend build.
- Successful pushes to `master` deploy to `/opt/d2c/releases/<commit-sha>`.
- The deployment script keeps `.env`, ChromaDB data, and generated output in `/opt/d2c/shared`.
- A release becomes active only after it builds successfully. Failed post-switch health checks roll back to the previous release.
- The five newest releases are retained.

## Required GitHub Actions Secrets

Create these repository or `production` environment secrets:

| Secret | Value |
| --- | --- |
| `SSH_HOST` | `106.53.77.119` |
| `SSH_USER` | `d2c-deploy` |
| `SSH_PRIVATE_KEY` | Private key authorized for the deployment user |
| `SSH_KNOWN_HOSTS` | Output of `ssh-keyscan -H 106.53.77.119` |

The deployment user must be able to restart `d2c-backend` and `d2c-web` with passwordless `sudo`.

## Production

- URL: `http://106.53.77.119/d2c`
- Current release: `/opt/d2c/current`
- Shared data: `/opt/d2c/shared`

Manual rollback:

```bash
ln -sfn /opt/d2c/releases/<previous-sha> /opt/d2c/current
sudo systemctl restart d2c-backend d2c-web
```
