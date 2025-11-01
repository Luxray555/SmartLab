const Event = require('../models/Event');

class EventService {
    static async log(thingId, thingType, type, data) {
        const event = new Event({ thingId, thingType, type, data });
        await event.save();
        return event;
    }

    static async getUserEvents() {
        return Event.find({thingType: 'user'})
            .sort({timestamp: -1})
            .limit(100)
            .lean();
    }
}

module.exports = EventService;