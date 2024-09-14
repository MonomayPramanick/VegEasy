const mongoose = require('mongoose');

const MarketSchema = new mongoose.Schema({
    vegetableName: String,
    wholesalerPrice: Number,
    retailerPrice: Number,
    govPrice: Number,
    region: String,
    inflationRate: Number,
    availableQuantity: Number,
    lastMonthRevenue: Number,
    commercialUseBookings: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Booking' }]
});

module.exports = mongoose.model('Market', MarketSchema);
