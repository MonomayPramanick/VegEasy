// middleware/ensureAdmin.js
module.exports = function(req, res, next) {
    if (req.session.isAdmin) {
        next();
    } else {
        res.redirect('/');
    }
};