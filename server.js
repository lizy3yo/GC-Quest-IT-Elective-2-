/**
 * Custom Next.js Server with WebSocket Support
 * 
 * This server enables WebSocket functionality alongside Next.js
 * Run with: node server.js
 */

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { WebSocketServer } = require('ws');

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOST || 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Store active connections
const clients = new Map();

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('Internal server error');
    }
  });

  // Create WebSocket server
  const wss = new WebSocketServer({ 
    server,
    path: '/ws',
  });

  wss.on('connection', (ws, req) => {
    const url = parse(req.url, true);
    const token = url.query.token;
    const clientId = generateClientId();

    console.log(`[WebSocket] Client connected: ${clientId}`);

    // Store client connection
    clients.set(clientId, {
      ws,
      token,
      subscriptions: new Set(),
      userId: null, // Set after authentication
    });

    // Send welcome message
    ws.send(JSON.stringify({
      type: 'connected',
      payload: { clientId, timestamp: Date.now() },
    }));

    // Handle incoming messages
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        handleMessage(clientId, message);
      } catch (error) {
        console.error('[WebSocket] Error parsing message:', error);
        ws.send(JSON.stringify({
          type: 'error',
          payload: { message: 'Invalid message format' },
        }));
      }
    });

    // Handle pong (heartbeat response)
    ws.on('pong', () => {
      const client = clients.get(clientId);
      if (client) {
        client.lastPong = Date.now();
      }
    });

    // Handle disconnection
    ws.on('close', () => {
      console.log(`[WebSocket] Client disconnected: ${clientId}`);
      clients.delete(clientId);
    });

    // Handle errors
    ws.on('error', (error) => {
      console.error(`[WebSocket] Error for client ${clientId}:`, error);
    });
  });

  // Heartbeat to keep connections alive
  const heartbeatInterval = setInterval(() => {
    clients.forEach((client, clientId) => {
      if (client.ws.readyState === 1) { // OPEN
        client.ws.ping();
      } else {
        clients.delete(clientId);
      }
    });
  }, 30000); // Every 30 seconds

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> WebSocket server ready on ws://${hostname}:${port}/ws`);
  });
});

/**
 * Handle incoming WebSocket messages
 */
function handleMessage(clientId, message) {
  const client = clients.get(clientId);
  if (!client) return;

  const { type, payload } = message;

  switch (type) {
    case 'ping':
      client.ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
      break;

    case 'subscribe':
      handleSubscribe(clientId, payload);
      break;

    case 'unsubscribe':
      handleUnsubscribe(clientId, payload);
      break;

    case 'authenticate':
      handleAuthenticate(clientId, payload);
      break;

    case 'typing:start':
      broadcastToChannel(payload.roomId, {
        type: 'typing:update',
        payload: { roomId: payload.roomId, userId: client.userId, action: 'start' },
      }, clientId);
      break;

    case 'typing:stop':
      broadcastToChannel(payload.roomId, {
        type: 'typing:update',
        payload: { roomId: payload.roomId, userId: client.userId, action: 'stop' },
      }, clientId);
      break;

    default:
      console.log(`[WebSocket] Unknown message type: ${type}`);
  }
}

/**
 * Handle channel subscription
 */
function handleSubscribe(clientId, payload) {
  const client = clients.get(clientId);
  if (!client) return;

  const { channel } = payload;
  client.subscriptions.add(channel);

  console.log(`[WebSocket] Client ${clientId} subscribed to ${channel}`);

  client.ws.send(JSON.stringify({
    type: 'subscribed',
    payload: { channel },
  }));
}

/**
 * Handle channel unsubscription
 */
function handleUnsubscribe(clientId, payload) {
  const client = clients.get(clientId);
  if (!client) return;

  const { channel } = payload;
  client.subscriptions.delete(channel);

  console.log(`[WebSocket] Client ${clientId} unsubscribed from ${channel}`);

  client.ws.send(JSON.stringify({
    type: 'unsubscribed',
    payload: { channel },
  }));
}

/**
 * Handle authentication
 */
function handleAuthenticate(clientId, payload) {
  const client = clients.get(clientId);
  if (!client) return;

  // TODO: Verify token and extract user ID
  // For now, just accept the userId from payload
  client.userId = payload.userId;

  console.log(`[WebSocket] Client ${clientId} authenticated as user ${payload.userId}`);

  client.ws.send(JSON.stringify({
    type: 'authenticated',
    payload: { userId: client.userId },
  }));
}

/**
 * Broadcast message to all clients subscribed to a channel
 */
function broadcastToChannel(channel, message, excludeClientId = null) {
  clients.forEach((client, clientId) => {
    if (clientId !== excludeClientId && 
        client.subscriptions.has(channel) && 
        client.ws.readyState === 1) {
      client.ws.send(JSON.stringify(message));
    }
  });
}

/**
 * Broadcast message to specific user
 */
function sendToUser(userId, message) {
  clients.forEach((client) => {
    if (client.userId === userId && client.ws.readyState === 1) {
      client.ws.send(JSON.stringify(message));
    }
  });
}

/**
 * Broadcast message to all connected clients
 */
function broadcast(message, excludeClientId = null) {
  clients.forEach((client, clientId) => {
    if (clientId !== excludeClientId && client.ws.readyState === 1) {
      client.ws.send(JSON.stringify(message));
    }
  });
}

/**
 * Generate unique client ID
 */
function generateClientId() {
  return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Export functions for use in API routes
module.exports = {
  broadcastToChannel,
  sendToUser,
  broadcast,
};
