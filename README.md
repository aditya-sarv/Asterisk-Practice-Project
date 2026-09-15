# asterisk-ari-connection

Minimal, comment-heavy example of connecting to an Asterisk server through the
**ARI (Asterisk REST Interface)** using
[`node-ari-client`](https://github.com/asterisk/node-ari-client).

It only establishes the connection: it authenticates over REST, verifies the
link with `asterisk.getInfo()`, opens the event WebSocket, and registers a
Stasis application. No call handling logic beyond a couple of log lines.

## Layout

```
asterisk-ari-connection/
├── index.js               # Entry point: connect, stay alive, graceful shutdown
├── src/
│   ├── config.js          # Reads connection settings from environment / .env
│   └── ariConnection.js    # connect() / disconnect() helpers around ari-client
├── .env.example           # Template for local configuration
└── package.json
```

## Setup

```bash
cd asterisk-ari-connection
npm install
cp .env.example .env      # then edit .env with your Asterisk details
npm start
```

## Asterisk-side requirements

1. **`http.conf`** – enable the HTTP server that ARI rides on:

   ```ini
   [general]
   enabled = yes
   bindaddr = 0.0.0.0
   bindport = 8088
   ```

2. **`ari.conf`** – define the ARI user referenced by `.env`:

   ```ini
   [general]
   enabled = yes

   [asterisk]
   type = user
   password = asterisk
   ```

3. Reload/restart Asterisk (`asterisk -rx "core reload"`).

To actually send a call into the app, point the dialplan at it:

```
exten => 100,1,Answer()
 same => n,Stasis(ari_test_app)
 same => n,Hangup()
```
