class RuleEngine {
    // Global device state (updated by gateway)
    static state = {
        motion: { active: false, lastDetected: null },
        lamp: { on: false },
        thermostat: { current: 20, target: 19, mode: 'comfort' },
        lastManual: null
    };

    // Reference to global registry (injected by index.js)
    static things = null;

    static systemToken = null;

    static setSystemToken(token) {
        this.systemToken = token;
        console.log('RuleEngine: System token injected');
    }

    static setRegistry(registry) {
        this.things = registry;
    }

    static getThingByType(type) {
        return Array.from(this.things.values()).find(t => t.type === type);
    }

    // Trigger an action on a thing
    static async trigger(thing, action, params = {}) {
        if (!thing) return;
        try {
            await fetch(`${thing.endpoint}/actions/${action}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.systemToken}`
                },
                body: JSON.stringify(params)
            });
        } catch (err) {
            console.error(`RuleEngine: failed to trigger ${action} on ${thing.id}`, err);
        }
    }

    // Process property changes and apply rules
    static async update(event) {
        if (event.type !== 'propertyChanged') return;
        const { key, value } = event.data;
        const type = event.thingType;

        // Update internal state
        if (type === 'motion') {
            if (key === 'motion') this.state.motion.active = value;
            if (key === 'lastDetected') this.state.motion.lastDetected = value;
        }
        if (type === 'lamp' && key === 'on') this.state.lamp.on = value;
        if (type === 'thermostat') {
            if (key === 'currentTemperature') this.state.thermostat.current = value;
            if (key === 'targetTemperature') this.state.thermostat.target = value;
            if (key === 'mode') {
                this.state.thermostat.mode = value;
                if (value === 'manual') {
                    this.state.lastManual = Date.now();
                }
            }
        }

        // Manual override cooldown: skip rules if manual mode was set recently
        const now = Date.now();
        const cooldown = 30 * 1000;

        if (this.state.lastManual && now - this.state.lastManual < cooldown) {
            return;
        }

        const lamp = this.getThingByType('lamp');
        const thermostat = this.getThingByType('thermostat');
        if (!lamp || !thermostat) return;

        // Rule 1: Motion detected → turn on lamp + auto-off after 2 seconds
        if (type === 'motion' && key === 'motion' && value === true && !this.state.lamp.on) {
            console.log('Rule 1: Motion → Lamp ON');
            await this.trigger(lamp, 'turnOn');
            setTimeout(() => this.trigger(lamp, 'turnOff'), 2000);
        }

        // Rule 2: Temp < 18°C + motion → comfort mode
        if (type === 'thermostat' && key === 'currentTemperature' && value < 18 && this.state.motion.active) {
            if (this.state.thermostat.mode !== 'comfort') {
                console.log('Rule 2: Cold + Presence → Comfort Mode');
                await this.trigger(thermostat, 'setMode', { mode: 'comfort' });
            }
        }
    }

    // Periodic: Temperature simulation (every 3 seconds)
    static startTemperatureSimulation() {
        setInterval(async () => {
            const thermostat = this.getThingByType('thermostat');
            if (!thermostat) return;

            const { current, target, mode, heating } = this.state.thermostat;
            let newTemp = current;
            let newHeating = heating;

            if (mode === 'off') {
                newHeating = false;
                if (current > 15) newTemp -= 0.05;
            } else {
                const targetTemp = mode === 'eco' ? 17 : mode === 'comfort' ? 19 : target;
                const diff = targetTemp - current;

                if (Math.abs(diff) > 0.1) {
                    newHeating = diff > 0;
                    newTemp += diff > 0 ? 0.1 : -0.05;
                } else {
                    newHeating = false;
                }
            }

            newTemp = parseFloat(newTemp.toFixed(2));
            if (newTemp !== current || newHeating !== heating) {
                this.state.thermostat.current = newTemp;
                this.state.thermostat.heating = newHeating;

                // Notify gateway of temperature change
                await fetch(`http://localhost:3000/things/${thermostat.id}/updated`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.systemToken}`
                    },
                    body: JSON.stringify({
                        thingId: thermostat.id,
                        type: 'thermostat',
                        properties: {
                            currentTemperature: newTemp,
                            heating: newHeating
                        }
                    })
                }).catch(() => {});
            }
        }, 3000);
    }

    // Periodic: Check for inactivity (every 30 seconds)
    static startInactivityCheck() {
        setInterval(async () => {
            const now = Date.now();
            const fiveMin = 5 * 60 * 1000;
            const cooldown = 30 * 1000;

            if (this.state.lastManual && now - this.state.lastManual < cooldown) return;

            const lamp = this.getThingByType('lamp');
            const thermostat = this.getThingByType('thermostat');
            if (!lamp || !thermostat) return;

            // Rule 3: No motion for 5 minutes → Eco mode + lamp off
            if (this.state.motion.lastDetected) {
                const last = new Date(this.state.motion.lastDetected).getTime();
                if (now - last > fiveMin) {
                    console.log('Rule 3: No motion 5min → Eco + OFF');
                    await this.trigger(lamp, 'turnOff');
                    await this.trigger(thermostat, 'setMode', { mode: 'eco' });
                }
            }

            // Rule 2 backup: Cold + presence → comfort mode
            if (this.state.thermostat.current < 18 && this.state.motion.active) {
                if (this.state.thermostat.mode !== 'comfort') {
                    await this.trigger(thermostat, 'setMode', { mode: 'comfort' });
                }
                if (!this.state.lamp.on) {
                    await this.trigger(lamp, 'turnOn');
                }
            }
        }, 30 * 1000);
    }

    // Start all periodic tasks
    static start() {
        this.startTemperatureSimulation();
        this.startInactivityCheck();
    }
}

module.exports = RuleEngine;