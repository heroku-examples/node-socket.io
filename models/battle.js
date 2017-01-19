const mongoose = require('mongoose');

const schema = new mongoose.Schema({
    denaBattleId: { type: String },
    denaDungeonId: { type: String },
    eventId: { type: String },
    eventType: { type: String },
    realm: { type: String },  //categorize the FF realm...aka ff1, ff5, ff13
    dungeonName: { type: String },
    battleName: { type: String },  //part1, part2, part 3 boss stage etc...
    stamina: { type: Number },  //with this we can compute the orb/stam ratio...not sure where to get it
    dropRates: mongoose.Schema.Types.Mixed,
    drops: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Drop' }]
});

module.exports = mongoose.model('Battle', schema);