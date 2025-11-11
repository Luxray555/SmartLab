const Thing = require('./Thing');

class Motion extends Thing {
    constructor({ id, name, endpoint }) {
        super({
            id,
            name: name || 'Motion Sensor',
            type: 'motion',
            endpoint,
            properties: { motion: false, lastDetected: null },
            actions: {
                simulateMotion: async () => {
                    const now = new Date().toISOString();
                    this.setProperties({
                        motion: true,
                        lastDetected: now
                    });
                    // Auto-off après 5 sec
                    setTimeout(() => {
                        this.setProperty('motion', false);
                    }, 5000);
                }
            }
        });
    }
}

module.exports = Motion;