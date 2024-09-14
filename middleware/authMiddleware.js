
// middleware/authMiddleware.js
module.exports = function(req, res, next) {
    if (req.session && req.session.userId) {
        req.userId = req.session.userId;
        next();
    } else {
        res.redirect('/login');
    }
};
