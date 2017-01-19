const mongoose = require('mongoose');

const schema = new mongoose.Schema({
	email: String,
	phone: String,
	dena: {
		sessionId: String,
		userId: String,
		accessToken: String
	},
	drops: [{type: mongoose.Schema.Types.ObjectId, ref:'Drop'}]
});

module.exports = mongoose.model('User', schema);
