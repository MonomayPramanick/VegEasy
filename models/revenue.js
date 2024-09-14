const mongoose = require('mongoose');

const RevenueSchema = new mongoose.Schema({
    Month: String,
  Revenue:String,
});

module.exports = mongoose.model('revenue', RevenueSchema);