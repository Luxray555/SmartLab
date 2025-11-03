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
    res.json(motion.properties);
});

app.post('/actions/:action', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token || !(await validateToken(token))) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
        const result = await motion.executeAction(req.params.action, req.body);
        res.json({ success: true, result });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Motion Sensor running on http://localhost:${PORT}`);
});