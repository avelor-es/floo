<p align="center">
  <img src="floo.svg" alt="floo — deploy from anywhere" width="700"/>
</p>

---

*From "A Practical Guide to Muggle Deployment Sorcery," Chapter XII.*

---

## The Floo Network

In the wizarding world, the **Floo Network** is a method of magical transportation connecting thousands of fireplaces across Britain. A witch or a wizard steps into the flames, speaks the name of their destination clearly, and arrives there moments later — no matter the distance.

Muggle servers present a remarkably similar predicament. You have a machine somewhere in the world. You wish to deliver fresh code to it. The traditional method — opening a terminal, typing an incantation of SSH commands, pulling, installing, building, restarting — is tedious, error-prone, and impossible to automate without exposing a secret password to a CI pipeline.

`@avelor/floo` solves this the wizarding way: an **agent** runs on your server, much like a lit fireplace awaiting a traveler. You run a single command from your machine — or from any CI pipeline — speak the project name, and the deployment happens. The logs stream back to you in real time, as if you were standing in the server room yourself.

No Docker. No Kubernetes. No monthly subscription to a platform that does too much and charges too much for it. Just a fireplace on each end, and a name spoken clearly.

---

## Installation

Install the package globally on **both** machines — the server and your local machine:

```bash
npm install -g @avelor/floo
```

---

## Preparing the Fireplace (server setup)

On your server, begin by creating the projects configuration:

```bash
floo init
```

This creates `~/.config/floo/projects.yml`. Edit it to define your projects and the steps each deployment should execute:

```yaml
projects:
  myapp:
    cwd: /var/www/html/myapp
    env:
      NODE_ENV: production
    steps:
      - git pull origin main
      - npm install
      - npm run build
      - pm2 restart myapp --update-env

  staging:
    cwd: /var/www/html/staging_myapp
    steps:
      - git pull origin main
      - npm install
      - npm run build
      - pm2 restart myapp-staging --update-env
```

Start the agent:

```bash
# foreground
floo agent --port 4001

# or as a background daemon
floo agent --port 4001 --daemon
floo status
floo stop
```

Now issue a token for each project. Each token is scoped — it only grants access to its designated project:

```bash
floo token issue --project myapp
floo token issue --project staging
```

Keep the raw token values somewhere safe. They will not be shown again.

```bash
floo token list      # view all active tokens
floo token revoke <id>  # revoke one
```

---

## Stepping Through (local setup)

On your machine, configure each project with its server URL and token:

```bash
floo use myapp   http://your-server:4001  fl_the_token_you_issued
floo use staging http://your-server:4001  fl_the_staging_token
```

Deploy:

```bash
floo myapp
```

The logs stream back in real time. Exit code `0` on success, `1` if any step fails.

---

## CI/CD — Enchanting Your Pipeline

`floo` reads from environment variables when no local configuration is found. Set these in your secrets:

| Variable | Description |
|---|---|
| `FLOO_TOKEN` | The token issued for this project |
| `FLOO_URL` | The URL of the floo agent |

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy via floo
        run: npx @avelor/floo myapp
        env:
          FLOO_TOKEN: ${{ secrets.FLOO_MYAPP_TOKEN }}
          FLOO_URL:   ${{ secrets.FLOO_SERVER_URL }}
```

---

## Reference

```
AGENT  (run on the server)
  floo agent [--port 4001] [--host 0.0.0.0] [--daemon]
  floo stop
  floo status
  floo init
  floo token issue --project <name>
  floo token list
  floo token revoke <id>

CLIENT  (run locally or in CI)
  floo use <project> <url> <token>
  floo <project>
```

---

## Security notes

- Tokens are stored **hashed** (SHA-256) on the server. The raw value is shown once at issuance.
- Each token is scoped to a single project. A compromised token cannot deploy other projects.
- A token is scoped to one project: using it against any other project name returns `403`, so an attacker cannot enumerate project names without a valid token for each one.
- The agent runs over plain HTTP. For production, place it behind a reverse proxy (nginx, Caddy) with TLS.

---

<p align="center">
  <sub>Avelor · <a href="https://pkg.avelor.es">pkg.avelor.es</a></sub>
</p>
