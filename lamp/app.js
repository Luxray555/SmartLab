const express = require('express');
const cors = require('cors');
const Lamp = require('../api/models/Lamp');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3001;
const lamp = new Lamp({ endpoint: `http://localhost:${PORT}` });

// Register lamp with the gateway
lamp.register()
    .then(() => console.log(`Lamp registered with ID: ${lamp.id}`))
    .catch(err => console.error('Failed to register lamp:', err));

// Validate token with the gateway
const validateToken = async (token) => {
    try {
        const response = await fetch('http://localhost:3000/validate-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
        });
        return response.ok;
    } catch {
        return false;
    }
};

// Get lamp properties
app.get('/properties', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token || !(await validateToken(token))) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    res.json(lamp.properties);
});

// Execute action on lamp
app.post('/actions/:action', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token || !(await validateToken(token))) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
        const result = await lamp.executeAction(req.params.action, req.body);
        res.json({ success: true, result });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Lamp service running on http://localhost:${PORT}`);
});