const express = require('express');
const cors = require('cors');
const Thermostat = require('../api/models/Thermostat');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3002;
const thermostat = new Thermostat({ endpoint: `http://localhost:${PORT}` });

thermostat.register()
    .then(() => console.log(`Thermostat registered with ID: ${thermostat.id}`))
    .catch(err => console.error('Failed to register thermostat:', err));

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

app.get('/properties', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token || !(await validateToken(token))) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    res.json(thermostat.properties);
});

app.post('/actions/:action', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token || !(await validateToken(token))) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
        const result = await thermostat.executeAction(req.params.action, req.body);
        res.json({ success: true, result });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

setInterval(() => {
    const { currentTemperature, targetTemperature, mode, heating } = thermostat.properties;

    if (mode === 'off') {
        thermostat.setProperty('heating', false);
        if (currentTemperature > 15) {
            thermostat.setProperty('currentTemperature', currentTemperature - 0.05);
        }
        return;
    }

    if (mode === 'eco') {
        thermostat.setProperty('targetTemperature', 17);
    } else if (mode === 'comfort') {
        thermostat.setProperty('targetTemperature', 19);
    }

    const diff = targetTemperature - currentTemperature;
    if (Math.abs(diff) > 0.1) {
        thermostat.setProperty('heating', diff > 0);
        const change = diff > 0 ? 0.1 : -0.05;
        thermostat.setProperty('currentTemperature', currentTemperature + change);
    } else {
        thermostat.setProperty('heating', false);
    }
}, 3000);

app.listen(PORT, () => {
    console.log(`Thermostat service running on http://localhost:${PORT}`);
});