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

const things = new Map();

app.get('/things', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token || !(await UserService.validateToken(token))) {
        return res.status(401).json({ error: 'Invalid token' });
    }
    res.json(Array.from(things.values()));
});

app.post('/register', async (req, res) => {
    const { name, type, endpoint } = req.body;
    const id = `${type}-${Date.now()}`;

    const thing = { id, name, type, endpoint };
    things.set(id, thing);

    io.emit('thing:registered', thing);
    res.json(thing);
});

app.post('/users', async (req, res) => {
    try {
        const user = await UserService.create(req.body.username, req.body.password);
        res.json(user);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.post('/login', async (req, res) => {
    try {
        const user = await UserService.login(req.body.username, req.body.password);
        await EventService.log('system', 'user', 'login', { username: req.body.username });
        res.json(user);
    } catch (err) {
        res.status(401).json({ error: err.message });
    }
});

app.get('/analytics', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token || !(await UserService.validateToken(token))) {
        return res.status(401).json({ error: 'Invalid token' });
    }
    const events = await EventService.getUserEvents();
    res.json(events);
});

app.post('/event', async (req, res) => {
    const { thingId, thingType, type, data } = req.body;
    if (!thingId || !type) return res.status(400).json({ error: 'Missing fields' });

    const EventService = require('../api/services/EventService');
    await EventService.log(thingId, thingType, type, data).catch(() => {});

    res.json({ success: true });
});

app.post('/things/:id/updated', async (req, res) => {
    const { thingId, type, properties } = req.body;

    const thing = things.get(req.params.id);
    if (!thing) {
        return res.status(404).json({ error: 'Thing not found' });
    }

    io.emit('thing:updated', { thingId, type, properties });

    res.json({ success: true });
});

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
                headers: { 'Content-Type': 'application/json' },
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