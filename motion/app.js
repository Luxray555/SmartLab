const express = require('express');
const cors = require('cors');
const MotionSensor = require('../api/models/Motion');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3003;
const motion = new MotionSensor({ endpoint: `http://localhost:${PORT}` });

motion.register()
    .then(() => console.log(`Motion Sensor registered with ID: ${motion.id}`))
    .catch(err => console.error('Failed to register motion sensor:', err));

app.get('/properties', (req, res) => {
    res.json(motion.properties);
});

app.get('/td', (req, res) => {
    res.json(motion.toTD());
});

app.post('/actions/:action', async (req, res) => {
    try {
        const result = await motion.executeAction(req.params.action, req.body);
        res.json({ success: true, result });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.post('/simulate/motion', (req, res) => {
    motion.setProperty('motion', true);
    motion.setProperty('lastDetected', new Date().toISOString());
    setTimeout(() => {
        motion.setProperty('motion', false);
    }, 2000);
    res.json({ status: 'Motion simulated' });
});

app.listen(PORT, () => {
    console.log(`Motion Sensor running on http://localhost:${PORT}`);
});