const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const connectDB = require('../api/db');
const UserService = require('../api/services/UserService');
const EventService = require('../api/services/EventService');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

connectDB();

const fs = require('fs');
const path = require('path');

// Initialize system: create "system" user and save token
async function initSystem() {
    let user = await UserService.findByUsername('system');
    if (!user) {
        user = await UserService.create('system', 'SuperSecret123!');
    }
    const token = await UserService.generateToken('system');

    // Save token to .env file
    const envPath = path.join(__dirname, '..', '.env');
    const envLine = `SYSTEM_TOKEN=${token}\n`;

    try {
        let envContent = '';
        if (fs.existsSync(envPath)) {
            envContent = fs.readFileSync(envPath, 'utf8');
            const lines = envContent.split('\n').filter(line => !line.startsWith('SYSTEM_TOKEN='));
            lines.push(envLine);
            envContent = lines.join('\n');
        } else {
            envContent = envLine;
        }
        fs.writeFileSync(envPath, envContent.trim() + '\n', 'utf8');
        console.log('SYSTEM_TOKEN saved to .env');
    } catch (err) {
        console.error('Failed to save SYSTEM_TOKEN to .env:', err);
    }

    RuleEngine.setSystemToken(token);
    console.log('System token ready for RuleEngine');
}

initSystem().catch(console.error);

// Connected things registry
const things = new Map();

const RuleEngine = require('../api/services/RuleEngine');
RuleEngine.setRegistry(things);
RuleEngine.start();

// Middleware: user authentication
const authenticateToken = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token || !(await UserService.validateToken(token))) {
        return res.status(401).json({ error: 'Invalid or missing token' });
    }
    req.token = token;
    next();
};

// Middleware: verify system token
const isSystemToken = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Missing token' });

    try {
        const user = await UserService.findByToken(token);
        if (user.username !== 'system') {
            return res.status(403).json({ error: 'System token required' });
        }
        next();
    } catch {
        return res.status(401).json({ error: 'Invalid token' });
    }
};

// Token validation
app.post('/validate-token', async (req, res) => {
    const { token } = req.body;
    if (!token) {
        return res.status(400).json({ valid: false });
    }

    const isValid = await UserService.validateToken(token);
    res.json({ valid: isValid });
});

// List connected things
app.get('/things', authenticateToken, async (req, res) => {
    res.json(Array.from(things.values()));
});

// Register a new thing (system only)
app.post('/things', isSystemToken, async (req, res) => {
    const { name, type, endpoint } = req.body;
    const id = `${type}-${Date.now()}`;

    const thing = { id, name, type, endpoint };
    things.set(id, thing);

    io.emit('thing:registered', thing);
    res.json(thing);
});

// Create user
app.post('/users', async (req, res) => {
    try {
        const user = await UserService.create(req.body.username, req.body.password);
        res.json(user);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// User login
app.post('/login', async (req, res) => {
    try {
        const user = await UserService.login(req.body.username, req.body.password);
        await EventService.log('system', 'user', 'login', { username: req.body.username });
        res.json(user);
    } catch (err) {
        res.status(401).json({ error: err.message });
    }
});

// User logout
app.post('/logout', async (req, res) => {
    const token = req.body?.token || req.headers.authorization?.split(' ')[1];
    if (token) await UserService.invalidateToken(token);
    await EventService.log('system', 'user', 'logout');
    console.log('user logged out');
    res.json({ ok: true });
});

// Get user events
app.get('/analytics', authenticateToken, async (req, res) => {
    const events = await EventService.getUserEvents();
    res.json(events);
});

// Log an event (system only)
app.post('/event', isSystemToken, async (req, res) => {
    const { thingId, thingType, type, data } = req.body;
    if (!thingId || !type) return res.status(400).json({ error: 'Missing fields' });

    const EventService = require('../api/services/EventService');
    await EventService.log(thingId, thingType, type, data).catch(() => {});

    res.json({ success: true });
});

// Thing update notification
app.post('/things/:id/updated', async (req, res) => {
    const { thingId, type, properties } = req.body;

    const thing = things.get(req.params.id);
    if (!thing) {
        return res.status(404).json({ error: 'Thing not found' });
    }

    io.emit('thing:updated', { thingId, type, properties });

    // Trigger rule engine rules
    for (const [key, value] of Object.entries(properties)) {
        await RuleEngine.update({
            type: 'propertyChanged',
            thingType: type,
            thingId,
            data: { key, value }
        });
    }

    res.json({ success: true });
});

// Get thing properties (proxy to service)
app.get('/things/:id/properties', authenticateToken, async (req, res) => {
    const thingId = req.params.id;
    const thing = things.get(thingId);

    if (!thing) {
        return res.status(404).json({ error: 'Thing not found' });
    }

    try {
        const response = await fetch(`${thing.endpoint}/properties`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${req.token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const error = await response.text();
            return res.status(response.status).json({
                error: 'Failed to fetch properties',
                details: error
            });
        }

        const properties = await response.json();
        res.json({ thingId, type: thing.type, properties });
    } catch (err) {
        console.error(`Gateway failed to proxy properties for ${thingId}:`, err);
        res.status(502).json({ error: 'Service unavailable' });
    }
});

// WebSocket connection handling
io.on('connection', async (socket) => {
    const token = socket.handshake.auth.token;
    if (!token || !(await UserService.validateToken(token))) {
        socket.disconnect();
        return;
    }

    let username;
    try {
        username = (await UserService.findByToken(token)).username;
    } catch (err) {
        socket.disconnect();
        return;
    }
    await EventService.log('user', 'user', 'connect', { username });

    // Execute action on thing via WebSocket
    socket.on('thing:action', async (data) => {
        if (!(await UserService.validateToken(data.token))) return;
        const thing = things.get(data.thingId);
        if (thing) {
            await EventService.log('user', 'user', 'action', {
                username,
                thingId: data.thingId,
                action: data.action,
                params: data.params
            });
            console.log(`Triggering action ${data.action} on thing ${data.thingId}`);
            fetch(`${thing.endpoint}/actions/${data.action}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${data.token}`
                },
                body: JSON.stringify(data.params)
            }).catch(() => {
                console.error(`Failed to trigger action ${data.action} on thing ${data.thingId}`);
            });
        }
    });

    socket.on('disconnect', async () => {
        await EventService.log('user', 'user', 'disconnect', { username });
    });
});

server.listen(3000, () => console.log('Gateway on :3000'));