# Learn containers with medical-mcp

This server is a Node.js process that speaks MCP and calls public medical APIs. The cache and the rate limiters live in that process's memory. Nothing here needs a database. Each stage below was checked against this repository. The commands are the ones to run yourself. Stop after a stage if you want to look around before the next one.

If `docker` is not found, Docker Desktop is installed but its CLI is off your `PATH`. This works for the current terminal:

```bash
export PATH="/Applications/Docker.app/Contents/Resources/bin:$PATH"
docker version
```

You should see a client version and a server version. A server version means the Docker daemon is running.

## Stage 1 — the application

**What this is.** The same server you already run, with one HTTP fix so two clients can talk to it at the same time.

**Concepts.** A process is one running program. A port is the number clients use to open a connection to it. An MCP client (Cursor, Claude Desktop, or `curl` pretending) speaks JSON-RPC. This repository is the server that answers.

**How we know it works.** `npm test` includes `src/__tests__/http-transport.test.ts`. That test sends `initialize`, calls `get-cache-stats`, calls it again, and calls it twice at the same time. `get-cache-stats` stays inside the process, so the test does not depend on the FDA or PubMed being up.

### Startup

`npm run build` compiles TypeScript from `src/` into `build/`. `npm start` runs `node build/index.js`, which speaks MCP on stdin and stdout. `npm run start:http` adds `--http` and Express listens on `HOST` (default `0.0.0.0`) and `PORT` (default `3000`) at `/mcp`.

`0.0.0.0` means every network interface of this process. On your laptop that includes localhost. Inside a container it means every interface of that container. Publishing the port is a separate step, done later with Docker's `-p`.

Logs go to stderr. Stdio MCP reserves stdout for protocol messages, so a log line on stdout would corrupt the conversation.

Optional keys (`NCBI_API_KEY`, `MONID_API_KEY`, `TINYFISH_API_KEY`, `TYPESAFE_API_KEY`) are read from the environment when the process starts. The PubMed limiter picks 3 or 10 requests per second at that moment. A key added later, without a restart, does not change the limiter.

The cache, the token buckets, and the circuit breakers are maps in this process. They are shared by every request that process handles. They vanish when the process exits. A second process has its own empty maps.

### Two ways a client connects

**stdio.** The client starts the process and writes JSON-RPC to its stdin. Replies come back on stdout. One client owns that process. There is no port.

**HTTP.** The process is already running and listening. Any number of clients can POST to `/mcp`. This is the mode a container and a Kubernetes Service use, because those systems route network connections, not a single stdin stream.

HTTP mode here is stateless. Each POST is one JSON-RPC message. The server does not remember an MCP session id. That is what you want when more than one process might handle the next request.

### The bug that blocked that

The old HTTP handler kept one `McpServer` for the whole process. Each request connected a new transport to that same object, and the SDK stores only one transport. A second request replaced the first request's transport, so the reply could be written to the wrong client. Closing the shared server at the end of the first response could also close the second request.

The cache must stay shared. The MCP server object must not. Each HTTP request now builds its own `McpServer`, handles that one POST, and closes that pair. Stdio still uses one server for the life of the process, because stdio has one client.

### Experiment

Terminal A:

```bash
npm run dev:http
```

Stderr should include `Medical MCP Server (HTTP) on http://0.0.0.0:3000/mcp`.

Terminal B:

```bash
curl -sS http://127.0.0.1:3000/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"curl","version":"0"}}}'

curl -sS http://127.0.0.1:3000/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"get-cache-stats","arguments":{}}}' &
curl -sS http://127.0.0.1:3000/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"get-cache-stats","arguments":{}}}' &
wait
```

The first response is an SSE event whose JSON `"id"` is `1` and whose server name is `medical-mcp`. The next two responses are SSE events `"id"` `2` and `3`, both containing `Cache Statistics`. Then Ctrl-C the server in terminal A.

`/healthz` returning ok would not prove this. MCP is the POST conversation above.

## Stage 2 — Docker

**What this is.** A recipe that builds this server into an image, and a running container from that image.

**Concepts.**

- An **image** is a snapshot of a filesystem plus the command to run. `medical-mcp:local` is a name you choose for that snapshot.
- A **container** is a process started from an image. You can delete the container without deleting the image, and start another container from the same image.
- The **build context** is the directory Docker sends to the daemon. `.dockerignore` keeps `node_modules`, `build`, `.git`, and `.env` out of that upload so a secret in `.env` is not baked in, and so the image is built from the lockfile rather than whatever happens to be installed on your laptop.
- A **layer** is one Dockerfile instruction. Docker reuses a layer when the instruction and its inputs have not changed. Copying `package.json` and `package-lock.json` before the source means `npm ci` is skipped when only TypeScript changed.
- A **multi-stage build** uses a first stage to compile and a second stage as the image you run. The compiler and the tests stay in the first stage. The image you run has production `node_modules`, `build/`, and a non-root user.
- **`-p 3000:3000`** publishes container port 3000 on host port 3000. Without `-p`, the process listens inside the container and your browser cannot reach it. `HOST=0.0.0.0` is required so the process listens on the container's network interface, not only on a localhost that exists inside the container.
- **`-e NAME`** copies an environment variable from your shell into the process. The value is not stored in the image.
- **Lifecycle.** `docker build` makes an image. `docker run` starts a container. `docker ps` lists running containers. `docker logs` shows stdout and stderr. `docker stop` sends SIGTERM, waits, then SIGKILL.

The image is Node 22.17, the same major and minor as this machine, on Debian slim. The SDK requires Node 18 or newer. `npm ci --ignore-scripts` installs from `package-lock.json` and skips `scripts/postinstall.js`, which would otherwise try to edit Claude Desktop's config during the build.

On SIGTERM or SIGINT the HTTP server stops accepting connections and the process exits. The cache cleanup timer does not hold the process open after that. `docker stop` is how you will see it.

### Commands

```bash
docker build -t medical-mcp:local .
docker run --name medical-mcp --rm -p 3000:3000 medical-mcp:local
```

Other terminal:

```bash
docker ps
docker logs medical-mcp
```

`docker ps` shows a container named `medical-mcp`, image `medical-mcp:local`, and `0.0.0.0:3000->3000/tcp`. Logs include the HTTP ready line on stderr.

Repeat the Stage 1 `curl` commands against `http://127.0.0.1:3000/mcp`. Then:

```bash
docker stop medical-mcp
```

The container exits because the process handled SIGTERM. `docker ps` no longer lists it. The image remains: `docker image ls medical-mcp`.

### stdio in a container

```bash
docker run -i --rm medical-mcp:local node build/index.js
```

`-i` keeps stdin open. That is the pipe an MCP client writes to. Do not add `-t`. A TTY expects a human terminal and can change bytes in the stream. Stdout must stay a clean protocol pipe. This process writes logs to stderr, which `docker logs` still shows, and which an MCP client does not parse as JSON-RPC.

HTTP is the default command because Kubernetes will connect over the network.

### Experiment

Build once. Change a comment in `src/index.ts`. Build again. The `npm ci` layers should say `CACHED`. The compile layer should run again. That is layer caching: Docker did not reinstall dependencies because the lockfile layer did not change.

## Stage 3 — liveness, readiness, and memory that is not shared

**What this is.** Two URLs Kubernetes can call, and a clear statement of what a restart or a second copy loses.

**Concepts.**

- **Liveness** (`GET /healthz`) answers "is this process alive?" It returns `{"status":"ok"}` without calling the FDA, PubMed, or any other upstream API. If liveness fails, Kubernetes kills and replaces the Pod. An upstream outage must not do that, or the cluster would restart us for a failure we do not control.
- **Readiness** (`GET /readyz`) answers "should new clients be sent here?" It returns `{"status":"ready"}` while the process is accepting connections. On SIGTERM the process marks itself not ready and closes the port. A request that is already inside that window gets `503` and `{"status":"shutting-down"}`. After the port closes, new connections are refused. Kubernetes treats both as "not ready" and stops sending new clients. A failed readiness check does not restart the Pod.
- The MCP tool named `health-check` is different. That tool pings upstream sources on purpose. Do not point a liveness probe at it.

**What restarts and replicas do.** The cache, rate-limit buckets, and circuit breakers are inside one process.

- `docker stop` or a Pod replacement starts a new process with an empty cache. The next search is slow again and pays the upstream rate limit from a full bucket.
- Two containers do not share those maps. Each one will call PubMed at its own limit. Two replicas can send about twice as much traffic upstream. Scaling does not multiply the cache hit rate, and it does not split one shared budget.

### Experiment

With the container from Stage 2 still running:

```bash
curl -sS http://127.0.0.1:3000/healthz
curl -sS http://127.0.0.1:3000/readyz
```

You should see `{"status":"ok"}` and `{"status":"ready"}`. Neither request appears in the logs as an FDA or PubMed call.

Call `get-cache-stats` twice with the Stage 1 `curl`. The second call still reports cache counters for this process only. Stop the container and start it again. The counters are back to a new process. That is the whole durability story: there is no disk cache.

## Stage 4 — one Pod on a local cluster

**What this is.** Kubernetes keeps one copy of this container running and gives it a stable address inside the cluster.

**Concepts, using `k8s/medical-mcp.yaml`.**

- A **Pod** is the running container (plus Kubernetes metadata). You usually do not create Pods by hand.
- A **Deployment** declares the desired state: one replica, this image, these env vars, these probes. Kubernetes creates a Pod to match. If the Pod disappears, it creates another. That loop is the controller. You edit the desired state; you do not SSH in and fix a machine.
- **Labels** are tags, here `app: medical-mcp`. The Deployment **selector** and the Service selector both require that label. The Service sends traffic only to Pods with the label. A label typo is a Service with no backends.
- A **Service** of type **ClusterIP** is a virtual address inside the cluster. Pod IPs change. The Service name `medical-mcp` stays. Port 3000 on the Service forwards to the container port named `http`.
- A **ConfigMap** holds non-secret settings (`PORT`, `LOG_LEVEL`, `CACHE_ENABLED`). The Pod receives them as environment variables. Editing the ConfigMap does not restart a running Pod. A new Pod, or `kubectl rollout restart deployment/medical-mcp`, picks up the change.
- A **Secret** is the same mechanism for values you do not want in a manifest you commit. `k8s/secret.example.yaml` has empty placeholders. `stringData` lets you type the value in plain text; Kubernetes stores it base64-encoded. Base64 is encoding, not encryption. Anyone allowed to read the Secret can decode it. The Deployment references those keys as `optional`, so the first deploy works before you create a Secret.
- **Requests** are what the scheduler reserves (`100m` CPU, `128Mi` memory). **Limits** are the ceiling (`500m`, `512Mi`). `100m` means one tenth of a CPU. The process is killed if it goes past the memory limit.
- **Probes** call `/readyz` and `/healthz` inside the Pod, not the public internet.
- **terminationGracePeriodSeconds: 15** is how long Kubernetes waits after SIGTERM before SIGKILL. Our process closes the HTTP server on SIGTERM.

This machine already runs Kubernetes in Docker Desktop. The context is `docker-desktop`, the node is Kubernetes v1.34.3, and it uses the same images as `docker build`. There is nothing to load. `imagePullPolicy: IfNotPresent` uses `medical-mcp:local` from that local image store.

Two `kubectl` binaries are installed. The one on the default `PATH` is v1.29.3, which is too old for this cluster. Docker Desktop's client is v1.34.1 and matches the server. Put it first:

```bash
export PATH="/Applications/Docker.app/Contents/Resources/bin:$PATH"
kubectl config current-context
kubectl version
```

`current-context` should print `docker-desktop`. The client and server versions should both be 1.34.x.

```bash
docker build -t medical-mcp:local .
kubectl apply -f k8s/medical-mcp.yaml
kubectl rollout status deployment/medical-mcp
kubectl get pods,svc
```

`kind` is the other local option, and it is not installed here. Use it only when Docker Desktop's Kubernetes is off. A kind cluster is a separate Docker container, so it cannot see your images until you copy them in:

```bash
kind create cluster --name medical-mcp
docker build -t medical-mcp:local .
kind load docker-image medical-mcp:local --name medical-mcp
kubectl apply -f k8s/medical-mcp.yaml
```

The Service is only inside the cluster. From your laptop:

```bash
kubectl port-forward svc/medical-mcp 3000:3000
```

Leave that running. Repeat the Stage 1 `curl` commands and the `/healthz` curl against `http://127.0.0.1:3000`. Port-forward is a tunnel for learning. It is not how Pods inside the cluster reach each other; they use the Service name.

### Experiment

```bash
kubectl describe deployment medical-mcp
kubectl describe service medical-mcp
```

In the Deployment, find the selector `app=medical-mcp`, the image, the probes, and the resource lines. In the Service, find the same selector and the endpoints. The endpoints should list the Pod's IP. That IP is the running container. The Service is the stable name in front of it.

## Stage 5 — break it on purpose

Do these in order. Watch `kubectl get pods -w` in a second terminal when you want to see Pods appear and disappear.

**Delete a Pod.** The Pod name changes; copy it from `kubectl get pods`.

```bash
kubectl delete pod -l app=medical-mcp
kubectl get pods
```

The Deployment's desired state is still one replica, so a new Pod appears. The cache in the deleted Pod is gone. `get-cache-stats` through port-forward shows a fresh process.

**Scale to two.** Read Stage 3 again first. Two Pods do not share a cache or a rate-limit budget. Together they can call each upstream API at about twice the single-process limit. PubMed without a key is 3 requests per second per process.

```bash
kubectl scale deployment/medical-mcp --replicas=2
kubectl get pods
```

You should see two Pods, both `Running` and `Ready`. The Service selector matches both labels, so it spreads connections across them. Scale back before the next step so the rolling update is easy to watch:

```bash
kubectl scale deployment/medical-mcp --replicas=1
```

**Rolling update.** Tag the same local image with a second name and change the desired image. On kind, load `medical-mcp:v2` into the cluster first. Docker Desktop already sees the tag. Kubernetes starts a new Pod before it stops the old one (`maxUnavailable: 0`, `maxSurge: 1`).

```bash
docker tag medical-mcp:local medical-mcp:v2
kubectl set image deployment/medical-mcp medical-mcp=medical-mcp:v2
kubectl rollout status deployment/medical-mcp
```

**Roll back.**

```bash
kubectl rollout undo deployment/medical-mcp
kubectl rollout status deployment/medical-mcp
kubectl get pods -o jsonpath='{.items[*].spec.containers[*].image}{"\n"}'
```

The image should be `medical-mcp:local` again.

**A bad config.** This sets `PORT` to 9999. The process will listen there, while the probes and the Service still use 3000, so the Pod will not become Ready.

```bash
kubectl set env deployment/medical-mcp PORT=9999
kubectl get pods
kubectl describe pod -l app=medical-mcp
kubectl logs -l app=medical-mcp --tail=20
```

`describe` shows probe failures and Events. `logs` shows the process listening on 9999. Put it back with a rollback, which restores the previous Pod template, including the ConfigMap's `PORT`:

```bash
kubectl rollout undo deployment/medical-mcp
kubectl rollout status deployment/medical-mcp
```

**Clean up.** On Docker Desktop, delete the objects from the manifest and leave the cluster running:

```bash
kubectl delete -f k8s/medical-mcp.yaml
```

If you created a kind cluster instead, delete that cluster. Your image `medical-mcp:local` stays in Docker either way.

```bash
kind delete cluster --name medical-mcp
```

Ingress, TLS, authentication, a shared cache, Helm, and a cloud cluster are separate problems. They are useful once the Pod, the Service, and a rolling update are familiar.
