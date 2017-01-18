const mongoose = require('mongoose');
const Battle = require('./battle.js');
const lodash = require('lodash');

const schema = new mongoose.Schema({
	denaItemId: {type: String},
	battle: {type: mongoose.Schema.Types.ObjectId, ref: 'Battle'},
});

schema.pre('save', function (next) {

	Battle
	.update( {_id: this.battle}, { $addToSet: {drops: this._id } } )
	.then(( (battles) => { console.log(battles); next(); }))
	.error(( (err) => next(err) ));
});

schema.post('save', function (drop) {
	mongoose.model('Drop', schema)	
	.find({battle: drop.battle})
	.then(function(drops) {
		return [drops, Battle.findById(drop.battle)]
	})
	.spread(function(drops, battle) {
		///TODO: totally not transactionally safe
		battle.dropRates = battle.dropRates || {};
		for(var i in battle.dropRates) {
			battle.dropRates[i] = {
				total: drops.length,
				hits: lodash.filter(drops, (d) => { return i == d.denaItemId }).length
			};
		}

		battle.dropRates[drop.denaItemId].rate = (battle.dropRates[drop.denaItemId].hits * 1.0 ) / (battle.dropRates[drop.denaItemId].total * 1.0);

		return Battle.update({_id: drop.battle}, {dropRates: battle.dropRates});
	});
});

module.exports = mongoose.model('Drop', schema);