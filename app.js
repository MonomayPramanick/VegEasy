const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const session = require('express-session');
const MongoStore = require('connect-mongo');
const hbs = require('hbs');
const Revenue = require('./models/revenue'); // Adjust the path as needed
const multer=require('multer');

const Sale = require('./models/sales');
const Cart = require('./models/cart');
const authMiddleware = require('./middleware/authMiddleware'); // Import authMiddleware


const storage=multer.diskStorage({
    destination: function(req,file,cb){
        return cb(null,"./uploads");
    },
    filename:function(req,file,cb){
        return cb(null,`${Date.now()}-${file.originalname}`);
    },
});

const upload=multer({storage});

const app = express();

// Register Handlebars helper
hbs.registerHelper('isAdmin', function (isAdmin, options) {
    if (isAdmin) {
        return options.fn(this);
    } else {
        return options.inverse(this);
    }
});

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use('/static', express.static(path.join(__dirname, 'public')));
app.set('view engine', 'hbs');
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// Session setup
app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: 'mongodb://localhost:27017/vegetable_market'
    }),
    cookie: { secure: false }
}));

app.use(express.urlencoded({extended:false}));
// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/vegetable_market', { useNewUrlParser: true, useUnifiedTopology: true });

// Models
const User = mongoose.model('User', new mongoose.Schema({
    username: String,
    email: String,
    phone: Number,
    address:String,
    profilePicture:String,
    userType:String,
    password: String,
    isAdmin: Boolean
}));

const Complaint = mongoose.model('Complaint', new mongoose.Schema({
    userId: mongoose.Schema.Types.ObjectId,
    complaintText: String
}));

const Market = mongoose.model('Market', new mongoose.Schema({
    type: { type: String, enum: ['fruit', 'vegetable'], required: true },
    name: String,
  
    picture: String
}));

// Routes
app.get('/', (req, res) => {
    res.render('home');
});

app.get('/user-id', (req, res) => {
    res.json({ userId: req.session.userId });
});

app.get('/login', (req, res) => {
    res.render('login');
});

app.get('/cart', authMiddleware, async (req, res) => {
    try {
        const cart = await Cart.findOne({ userId: req.userId });
        res.render('cart', { cart: cart || { items: [] } });
    } catch (error) {
        console.error('Error fetching cart:', error);
        res.status(500).send('Internal Server Error');
    }
});

function ensureAdmin(req, res, next) {
    if (req.session.isAdmin) {
        return next();
    } else {
        res.status(403).send('Access denied');
    }
}

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        // Find user by email
        const user = await User.findOne({ email });
        
        if (user && await bcrypt.compare(password, user.password)) {
            // Store user information in session
            req.session.userId = user._id;
            req.session.isAdmin = user.isAdmin;

            // Redirect based on user type
            if (user.isAdmin) {
                res.redirect('/admin');
            } else {
                switch (user.userType) {
                    case 'civilian':
                        res.redirect('/home');
                        break;
                    case 'farmer':
                        res.redirect('/farmer-dashboard');
                        break;
                    case 'retailer':
                        res.redirect('/retailer-dashboard');
                        break;
                    case 'wholeSeller':
                        res.redirect('/wholeseller-dashboard');
                        break;
                    default:
                        res.redirect('/login'); // Default redirect if userType is unknown
                        break;
                }
            }
        } else {
            // Invalid login attempt
            res.redirect('/login');
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Internal Server Error');
    }
});


app.get('/market-overview', async (req, res) => {
    try {
        const vegetables = await Market.find({ type: 'vegetable' });
        const fruits = await Market.find({ type: 'fruit' });
        res.render('market-overview', { vegetables, fruits });
    } catch (error) {
        console.error('Error fetching market data:', error);
        res.status(500).send('Internal Server Error');
    }
});


app.post('/signup',upload.single("profilePicture"), async (req, res) => {
    const { username, email, phone,address,userType, password } = req.body;
    const profilePicture=req.file ? req.file.filename : ''; 
    console.log(req.file.filename);
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, email, phone,address,userType,profilePicture, password: hashedPassword, isAdmin: false });
    await newUser.save();
    req.session.userId = newUser._id;
    res.redirect('/login');
});

app.post('/cart/add', authMiddleware, async (req, res) => {
    const { productId } = req.body;
    const userId = req.session.userId;

    if (!productId || !userId) {
        return res.status(400).json({ message: 'Product ID and User ID are required' });
    }

    try {
        let cart = await Cart.findOne({ userId });

        if (cart) {
            const itemIndex = cart.items.findIndex(item => item.productId.toString() === productId);
            if (itemIndex > -1) {
                cart.items[itemIndex].quantity += 1;
            } else {
                cart.items.push({ productId, quantity: 1});
            }
            await cart.save();
        } else {
            cart = new Cart({ userId, items: [{ productId, quantity: 1 }] });
            await cart.save();
        }

        res.json({ message: 'Item added to cart successfully' });
    } catch (error) {
        console.error('Error adding item to cart:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.get('/profile', authMiddleware, async (req, res) => {
    const userId = req.session.userId;

    try {
        const user = await User.findById(userId);
        res.render('profile', { user });
    } catch (error) {
        console.error('Error fetching user data:', error);
        res.status(500).send('Internal server error');
    }
});

app.post('/cart/update', authMiddleware, async (req, res) => {
    try {
        const { items } = req.body;
        await Cart.updateOne({ userId: req.userId }, { items }, { upsert: true });
        res.redirect('/cart');
    } catch (error) {
        console.error('Error updating cart:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/fruit', async (req, res) => {
    const fruits = await Market.find({ type: 'fruit' });
    res.render('fruit2', { fruits });
});

app.get('/farmer-dashboard', async (req, res) => {
   
    res.render('farmer-dashboard');
});


app.get('/wholeseller-dashboard', async (req, res) => {
   
    res.render('wholeseller-dashboard');
});



app.get('/retailer-dashboard', async (req, res) => {
   
    res.render('retailer-dashboard');
});

app.get('/bestseller', async (req, res) => {
   
    res.render('bestretailer');
});


app.get('/veg', async (req, res) => {
    const vegetables = await Market.find({ type: 'vegetable' });
    res.render('vegetable2', { vegetables });
});

app.get('/market-overview', (req, res) => {
    const vegetables = [
        { name: 'Tomato', quantity: '100kg', price: '50 Rs/kg' },
        { name: 'Potato', quantity: '200kg', price: '20 Rs/kg' }
    ];
    res.render('market-overview', { vegetables });
});

app.get('/complaint-feedback', (req, res) => {
    res.render('complaint-feedback');
});

app.post('/complaint-feedback', async (req, res) => {
    const { userId, complaintText} = req.body;
    const newComplaint = new Complaint({ userId, complaintText });
    await newComplaint.save();
    res.send('Complaint/Feedback submitted!');
});

app.get('/help', (req, res) => {
    res.render('help');
});

app.get('/stock',ensureAdmin ,(req, res) => {
    res.render('Stocks');
});

app.get('/sales',ensureAdmin,(req,res)=>{
    res.render('sales');
})

app.get('/payment', (req, res) => {
    res.render('payment');
});

app.get('/admin', authMiddleware, ensureAdmin, async (req, res) => {
    const products = await Market.find();
    res.render('admin', { products });
});

app.get('/add-fruits',async(req,res)=>{
    res.render('add-fruit');
})

app.get('/add-vegetable',async(req,res)=>{
    res.render('add-vegetable');
})


app.post('/add-fruits', authMiddleware, ensureAdmin, async (req, res) => {
    const { type, name, price, picture } = req.body;
    const newProduct = new Market({ type, name, price, picture });
    await newProduct.save();
    res.redirect('/admin');
});


app.post('/add-veg', authMiddleware, ensureAdmin, async (req, res) => {
    const { type, name, price, picture } = req.body;
    const newProduct = new Market({ type, name, price, picture });
    await newProduct.save();
    res.redirect('/admin');
});



app.get('/Revenue', ensureAdmin, async (req, res) => {
    try {
        const revenue = await Revenue.find(); // Fetch revenue data from the database
        console.log(revenue); // Log the data
        res.render('Revenue', { revenue });
    } catch (error) {
        console.error('Error fetching revenue data:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/complain',ensureAdmin,async(req,res)=>{
    try {
        const complain = await Complaint.find(); // Fetch revenue data from the database
        console.log(complain); // Log the data
        res.render('Complain', { complain });
    } catch (error) {
        console.error('Error fetching revenue data:', error);
        res.status(500).send('Internal Server Error');
    }
})

app.get('/users', ensureAdmin, async (req, res) => {
    const users = await User.find();
    res.render('admin-users', { users });
});

app.get('/prices', async (req, res) => {
    const markets = await Market.find();
    res.render('prices', { markets });
});

app.post('/submit-complaint', async (req, res) => {
    const { userId, complaintText } = req.body;
    const newComplaint = new Complaint({ userId, complaintText });
    await newComplaint.save();
    res.send('Complaint submitted');
});

// app.post('/create-checkout-session', async (req, res) => {
//     const session = await stripe.checkout.sessions.create({
//         payment_method_types: ['card'],
//         line_items: [
//             {
//                 price_data: {
//                     currency: 'INR',
//                     product_data: {
//                         name: 'Vegetable Purchase'
//                     },
//                     unit_amount: 2000
//                 },
//                 quantity: 1
//             }
//         ],
//         mode: 'payment',
//         success_url: `${req.headers.origin}/success`,
//         cancel_url: `${req.headers.origin}/cancel`
//     });

//     res.json({ id: session.id });
// });

app.post('/create-checkout-session', async (req, res) => {
    res.render('payment');
});


app.listen(3000, () => {
    console.log('Server is running on port 3000');
});
