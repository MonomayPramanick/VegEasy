const mongoose = require('mongoose');

const ComplaintSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    complaintText: String,
    status: { type: String, default: 'Pending' }
});

module.exports = mongoose.model('Complaint', ComplaintSchema);
