class Thing {
    constructor({ id, name, type, endpoint, properties = {}, actions = {} }) {
        this.id = id || null;
        this.name = name;
        this.type = type;
        this.endpoint = endpoint;
        this.properties = properties;
        this.actions = actions;
        this.eventListeners = new Map();
    }

    getProperty(key) { return this.properties[key]; }

    // Update a single property and notify gateway
    setProperty(key, value) {
        if (!(key in this.properties)) throw new Error(`Property ${key} does not exist`);
        this.properties[key] = value;

        fetch(`http://localhost:3000/things/${this.id}/updated`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                thingId: this.id,
                type: this.type,
                properties: this.properties
            })
        }).catch((err) => console.error('Failed to notify gateway of property change:', err));

        this.emit('propertyChanged', { properties: this.properties });

        return this;
    }

    // Update multiple properties at once (only sends changes)
    setProperties(newProperties) {
        const changed = {};

        for (const [key, value] of Object.entries(newProperties)) {
            if (this.properties[key] !== value) {
                this.properties[key] = value;
                changed[key] = value;
            }
        }

        // Send only changed properties to gateway
        if (Object.keys(changed).length > 0) {
            fetch(`http://localhost:3000/things/${this.id}/updated`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    thingId: this.id,
                    type: this.type,
                    properties: changed
                })
            }).catch(() => {});

            this.emit('propertyChanged', { properties: changed });
        }

        return this;
    }

    // Execute an action on this thing
    async executeAction(actionName, params = {}) {
        if (!this.actions[actionName]) throw new Error(`Action ${actionName} not supported`);
        const result = await this.actions[actionName](params, this);
        this.emit('actionExecuted', { action: actionName, params, result });
        return result;
    }

    // Register event listener
    on(event, callback) {
        if (!this.eventListeners.has(event)) this.eventListeners.set(event, []);
        this.eventListeners.get(event).push(callback);
    }

    // Emit event to listeners and gateway
    emit(event, data) {
        const listeners = this.eventListeners.get(event) || [];
        listeners.forEach(cb => cb({ ...data, thingId: this.id, thingType: this.type }));

        fetch('http://localhost:3000/event', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ thingId: this.id, thingType: this.type, type: event, data })
        }).catch(() => {});
    }

    // Register thing with gateway (with retry mechanism)
    async register(maxRetries = 20, delay = 1000) {
        for (let i = 0; i < maxRetries; i++) {
            const dotenv = require('dotenv').config({ path: require('path').join(__dirname, '../..', '.env') });
            const systemToken = dotenv.parsed.SYSTEM_TOKEN;

            if (!systemToken) {
                console.warn(`SYSTEM_TOKEN not found. Retrying in ${delay}ms... (${i + 1}/${maxRetries})`);
                await new Promise(r => setTimeout(r, delay));
                continue;
            }

            try {
                const res = await fetch('http://localhost:3000/things', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${systemToken}`
                    },
                    body: JSON.stringify({ name: this.name, type: this.type, endpoint: this.endpoint })
                });

                if (!res.ok) {
                    const err = await res.text();
                    console.warn(`Register failed: ${res.status} ${err}. Retrying...`);
                    await new Promise(r => setTimeout(r, delay));
                    continue;
                }

                const data = await res.json();
                this.id = data.id;
                this.deviceToken = data.deviceToken;
                console.log(`Registered: ${this.id}`);
                return data;
            } catch (err) {
                console.warn(`Network error. Retrying... (${i + 1}/${maxRetries})`);
                await new Promise(r => setTimeout(r, delay));
            }
        }
        throw new Error('Failed to register after max retries');
    }
}

module.exports = Thing;