const mongoose = require('mongoose');

// Event schema for logging system activities
const EventSchema = new mongoose.Schema({
    thingId: { type: String, required: true },
    thingType: { type: String, required: true },
    type: { type: String, required: true },
    data: { type: mongoose.Schema.Types.Mixed },
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Event', EventSchema);