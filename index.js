const express = require('express')
const fs = require('fs');
const multer = require('multer'); // nodejs pakage for storing images
const mongoose = require('mongoose'); // for connecting mongoose
var cors = require('cors'); // to sent the data from frontent and get the data in frontent 
const { ObjectId } = require('mongodb');
const app = express()
app.use(express.json()); // to store json data
require('dotenv').config()
app.use(cors())
const port = process.env.PORT || 5000

// intregating Stripe
const stripe = require("stripe")(`${process.env.STRIPE_SECRATE_KEY}`)

app.listen(port, async () => {
    console.log(`Example app listening on port ${port}`)
    await connectDB()
})
const uri = `mongodb+srv://${process.env.USER}:${process.env.PASSWORD}@cluster0.x5paqdg.mongodb.net/?retryWrites=true&w=majority`;
const connectDB = async () => {
    try {
        await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })
        console.log('database is connected');
    } catch (error) {
        console.log('database is not-connected');
        console.log(error);
        process.exit(1)
    }

}

const productsSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    description: String,
    price: Number,
    quantity: Number,
    images: [
        {
            filename: String,
            path: String,
        }
    ],
    category: String,
    type: String,
    createdAt: {
        type: Date,
        default: Date.now()
    }

})
const cartSchema = new mongoose.Schema({
    id: String,
    email: String
})
const paymentSchema = new mongoose.Schema({
    id: String,
    customerEmail: String,
    productId: String,
    paidAmount: Number,
    OrderQuantity: Number,
    date: String,
    orderStatus: String
})
const usersSchema = new mongoose.Schema({
    name: String,
    userImage: String,
    email: String,
    role: String
})

const Users = mongoose.model('users', usersSchema)
const Cart = mongoose.model('carts', cartSchema)
const Payment = mongoose.model('payments', paymentSchema)
const Product = mongoose.model("products", productsSchema)

app.get('/', async (req, res) => {
    res.json('Hello')
})

app.use('/uploads', express.static('uploads'));
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage })


app.post('/products', upload.array('images'), async (req, res) => {

    try {
        const images = req.files.map((file) => {
            return { filename: file.filename, path: file.path };
        });
        const { name, description, price, quantity, type, category } = req.body
        const savedProducts = await Product.create({ name, description, price, quantity, images, type, category });
        res.json({ message: 'Product Uploaded Successfully', savedProducts });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
})
app.get('/products', async (req, res) => {
    const page = parseInt(req.query.page);
    const size = parseInt(req.query.size);
    const keyword = req.query.keyword
    try {
        let query = {};
        if (keyword) {
            query = { name: { $regex: new RegExp(keyword, 'i') } };
            //Converting the keyword to a regular expression using RegExp is important because it allows you to perform a more flexible and powerful search, particularly when you want to match a pattern in a case-insensitive manner.
            // using a regular expression allows you to construct patterns that provide more advanced matching options than simple string comparisons.
            //The 'i' flag (stands for "ignore case") is one of several flags you can use with regular expressions.
            // When you append 'i' to the regular expression, it tells the regular expression engine to perform a case -insensitive match
        }
        const count = await Product.countDocuments(query)
        const products = await Product.find(query).skip(page * size).limit(size)
        res.json({ count, products });
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
app.get('/products/:type', async (req, res) => {
    const type = req.params
    try {
        const products = await Product.find(type);
        res.json(products);
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
app.get('/product/:id', async (req, res) => {
    const id = req.params.id
    const query = { _id: ObjectId(id) }
    try {
        const products = await Product.findOne(query);
        res.json(products);
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
app.delete('/product/:id', async (req, res) => {
    const id = req.params.id
    const query = { _id: ObjectId(id) }
    try {

        // Retrieve the product to get the associated images
        const product = await Product.findOne(query);

        // Delete the images from the 'uploads' folder
        if (product && product?.images) {
            product.images.forEach((image) => {
                fs.unlink(image.path, (err) => {
                    if (err) {
                        console.error('Error deleting image:', err);
                    }
                });
            });
        }
        const result = await Product.deleteOne(query)
        res.send(result)
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
})
app.patch('/product/:id', async (req, res) => {
    const id = req.params.id
    const newQuantity = req.body.quantity
    try {
        const result = await Product.findOneAndUpdate({ _id: ObjectId(id) }, { $set: { quantity: newQuantity } }, { new: true })
        res.send(result)
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
})
app.post('/cartItems', async (req, res) => {
    const cartData = req.body
    try {
        const cartItem = await Cart.create(cartData);
        res.json({ message: 'item added to cart', cartItem })
    }
    catch (err) {
        res.status(500).json({ err: 'Internal server error' });
    }

})
app.get('/cartItems/:email', async (req, res) => {
    const email = req.params
    const cart = await Cart.find(email)
    res.json(cart)
})

// creating stripe payment intend
app.post("/create-payment-intent", async (req, res) => {
    const { price } = req.body;

    // it calculte the price in cents
    const amount = price * 100
    console.log(price, amount);
    // Create a PaymentIntent with the order amount and currency
    const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        // In the latest version of the API, specifying the `automatic_payment_methods` parameter is optional because Stripe enables its functionality by default.
        // automatic_payment_methods: {
        //     enabled: true,
        // },
        payment_method_types: ["card"],
    });

    res.send({
        clientSecret: paymentIntent.client_secret,
    });
});

// saving customer payment details
app.post('/payments', async (req, res) => {
    const { id,
        customerEmail,
        productId,
        paidAmount,
        OrderQuantity,
        date,
        orderStatus
    } = req.body
    try {
        const payments = await Payment.create({ id, customerEmail, OrderQuantity, paidAmount, productId, date, orderStatus })
        res.json({ message: 'payment details saved Successfully', payments });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
})

app.delete('/cartItem/:id', async (req, res) => {
    const id = req.params.id
    const email = req.query.email; // Retrieve the email parameter from the query string
    console.log(id, email);
    if (!email) {
        return res.status(400).json({ error: 'Email parameter is missing.' });
    }
    const query = { id, email };
    try {
        const cart = await Cart.deleteOne(query)
        res.json(cart)
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
})
app.post('/users', async (req, res) => {
    const { email, name, userImage, role } = req.body
    try {
        const savedUser = await Users.create({ name, email, userImage, role });
        res.json({ message: 'user saved Successfully', savedUser });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
})
app.get('/users', async (req, res) => {
    const users = await Users.find()
    res.json(users)
})
app.get('/user/:email', async (req, res) => {
    const email = req.params

    try {
        const user = await Users.findOne(email)
        res.json(user)
    } catch (error) {
        console.log(error);
    }
})
app.delete('/user/:email', async (req, res) => {
    const email = req.params
    try {
        const user = await Users.deleteOne(email)
        res.json(user)
    } catch (error) {
        console.log(error);
    }
})


