const express = require('express');
const cors = require('cors');
const Lamp = require('../api/models/Lamp');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3001;
const lamp = new Lamp({ endpoint: `http://localhost:${PORT}` });

lamp.register()
    .then(() => console.log(`Lamp registered with ID: ${lamp.id}`))
    .catch(err => console.error('Failed to register lamp:', err));

app.get('/properties', (req, res) => {
    res.json(lamp.properties);
});

app.get('/td', (req, res) => {
    res.json(lamp.toTD());
});

app.post('/actions/:action', async (req, res) => {
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