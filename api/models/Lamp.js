const Thing = require('./Thing');

class Lamp extends Thing {
    constructor({ id, name, endpoint }) {
        super({
            id,
            name: name || 'Lamp',
            type: 'lamp',
            endpoint,
            properties: { on: false, brightness: 100, color: 'white' },
            actions: {
                turnOn: async () => this.setProperty('on', true),
                turnOff: async () => this.setProperty('on', false),
                setBrightness: async (params) => {
                    const b = Math.max(0, Math.min(100, params.value));
                    return this.setProperty('brightness', b);
                },
                setColor: async (params) => this.setProperty('color', params.color)
            }
        });
    }
}

module.exports = Lamp;