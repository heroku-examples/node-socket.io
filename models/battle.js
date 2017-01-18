const mongoose = require('mongoose');

const schema = new mongoose.Schema({
	denaBattleId: { type: String },
	dropRates: mongoose.Schema.Types.Mixed,
	drops: [{type: mongoose.Schema.Types.ObjectId, ref:'Drop'}]
});

module.exports = mongoose.model('Battle', schema);
