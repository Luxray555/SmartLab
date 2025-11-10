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
                turnOff: async () => this.setProperty('mode', 'manual')
            }
        });
    }
}

module.exports = Thermostat;