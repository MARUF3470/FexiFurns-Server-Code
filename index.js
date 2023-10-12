const express = require('express')
const multer = require('multer');
const mongoose = require('mongoose');
var cors = require('cors');
require('dotenv').config()
const { ObjectId } = require('mongodb');
const app = express()
app.use(cors())
app.use(express.json()); // to store json data
const port = process.env.PORT || 5000

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
        console.log('database is notconnected');
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


const Product = mongoose.model("products", productsSchema)
//userName: FexiFurns
//password: lpLNrX6ITIUFuWGy
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
// const imageSchema = new mongoose.Schema({
//     images: [
//         {
//             filename: String,
//             path: String,
//         }
//     ]
// });

// const Image = mongoose.model('Image', imageSchema);

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
    try {
        const count = await Product.estimatedDocumentCount()
        const products = await Product.find().skip(page * size).limit(size)
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

app.get('/', (req, res) => {
    res.send('Hello World!')
})

