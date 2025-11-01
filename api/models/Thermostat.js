const Thing = require('./Thing');

class Thermostat extends Thing {
    constructor({ id, name, endpoint }) {
        super({
            id,
            name: name || 'Thermostat',
            type: 'thermostat',
            endpoint,
            properties: {
                currentTemperature: 20.0,
                targetTemperature: 19.0,
                mode: 'comfort',
                heating: false
            },
            actions: {
                setTarget: async (params) => this.setProperty('targetTemperature', params.value),
                setMode: async (params) => this.setProperty('mode', params.mode),
                turnOn: async () => this.setProperty('mode', 'comfort'),
                turnOff: async () => this.setProperty('mode', 'off')
            }
        });

        setInterval(() => {
            const { currentTemperature, targetTemperature, mode } = this.properties;
            if (mode === 'off') {
                if (currentTemperature > 15) this.setProperty('currentTemperature', currentTemperature - 0.05);
                return;
            }
            const target = mode === 'eco' ? 17 : 19;
            this.setProperty('targetTemperature', target);
            const diff = target - currentTemperature;
            if (Math.abs(diff) > 0.1) {
                this.setProperty('heating', diff > 0);
                this.setProperty('currentTemperature', currentTemperature + (diff > 0 ? 0.1 : -0.05));
            } else {
                this.setProperty('heating', false);
            }
        }, 3000);
    }
}

module.exports = Thermostat;