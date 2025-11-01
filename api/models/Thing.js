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

    setProperty(key, value) {
        if (!(key in this.properties)) throw new Error(`Property ${key} does not exist`);
        this.properties[key] = value;

        const EventService = require('../services/EventService');

        // Log avec toutes les propriétés
        EventService.log(this.id, this.type, 'propertyChanged', { properties: this.properties })
            .catch(() => {});

        fetch(`http://localhost:3000/things/${this.id}/updated`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
                // Note: pas de token ici car Thing n'a pas de token utilisateur
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


    async executeAction(actionName, params = {}) {
        if (!this.actions[actionName]) throw new Error(`Action ${actionName} not supported`);
        const result = await this.actions[actionName](params, this);
        this.emit('actionExecuted', { action: actionName, params, result });
        return result;
    }

    on(event, callback) {
        if (!this.eventListeners.has(event)) this.eventListeners.set(event, []);
        this.eventListeners.get(event).push(callback);
    }

    emit(event, data) {
        const listeners = this.eventListeners.get(event) || [];
        listeners.forEach(cb => cb({ ...data, thingId: this.id, thingType: this.type }));

        fetch('http://localhost:3000/event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ thingId: this.id, thingType: this.type, type: event, data })
        }).catch(() => {});
    }

    async register(maxRetries = 10, delay = 1000) {
        for (let i = 0; i < maxRetries; i++) {
            try {
                const res = await fetch('http://localhost:3000/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: this.name, type: this.type, endpoint: this.endpoint })
                });
                const data = await res.json();
                this.id = data.id;
                return data;
            } catch (err) {
                console.warn(`Register attempt ${i + 1}/${maxRetries} failed, retrying...`);
                await new Promise(r => setTimeout(r, delay));
            }
        }
        throw new Error('Failed to register');
    }

    toTD() {
        return {
            id: this.id, name: this.name, type: this.type, endpoint: this.endpoint,
            properties: Object.keys(this.properties).reduce((acc, k) => {
                acc[k] = { type: typeof this.properties[k], writable: true };
                return acc;
            }, {}),
            actions: Object.keys(this.actions)
        };
    }
}

module.exports = Thing;