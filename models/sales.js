const mongoose = require('mongoose');

const SaleSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Market' },
    quantity: Number,
    totalPrice: Number,
    date: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Sale', SaleSchema);
