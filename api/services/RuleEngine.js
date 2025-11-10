const ThingService = require('./ThingService');

class RuleEngine {
    static state = {
        motion: { active: false, lastDetected: null },
        lamp: { on: false },
        thermostat: { current: 20, target: 19, mode: 'comfort' },
        lastManual: null
    };

    static async trigger(thing, action, params = {}) {
        fetch(`${thing.endpoint}/actions/${action}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params)
        }).catch(() => {});
    }

    static update(event) {
        if (event.type !== 'propertyChanged') return;
        const { key, value } = event.data;
        if (event.thingType === 'motion') {
            if (key === 'motion') this.state.motion.active = value;
            if (key === 'lastDetected') this.state.motion.lastDetected = value;
        }
        if (event.thingType === 'lamp' && key === 'on') this.state.lamp.on = value;
        if (event.thingType === 'thermostat') {
            if (key === 'currentTemperature') this.state.thermostat.current = value;
            if (key === 'mode') this.state.thermostat.mode = value;
        }
    }

    static async run() {
        const now = Date.now();
        const fiveMin = 5 * 60 * 1000;
        const oneMin = 60 * 1000;
        const cooldown = 30 * 1000;

        if (this.state.lastManual && now - this.state.lastManual < cooldown) return;

        const lamp = await ThingService.findByType('lamp');
        const thermostat = await ThingService.findByType('thermostat');
        if (!lamp || !thermostat) return;

        if (this.state.motion.active && !this.state.lamp.on) {
            this.trigger(lamp, 'turnOn');
            setTimeout(() => this.trigger(lamp, 'turnOff'), oneMin);
        }

        if (this.state.thermostat.current < 19 && this.state.motion.active) {
            this.trigger(thermostat, 'setMode', { mode: 'comfort' });
            this.trigger(lamp, 'turnOn');
        }

        if (this.state.motion.lastDetected) {
            const last = new Date(this.state.motion.lastDetected).getTime();
            if (now - last > fiveMin) {
                this.trigger(lamp, 'turnOff');
                this.trigger(thermostat, 'setMode', { mode: 'eco' });
            }
        }
    }
}

module.exports = RuleEngine;