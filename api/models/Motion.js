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
                    this.setProperty('motion', true);
                    this.setProperty('lastDetected', new Date().toISOString());
                    setTimeout(() => this.setProperty('motion', false), 2000);
                }
            }
        });
    }
}

module.exports = Motion;