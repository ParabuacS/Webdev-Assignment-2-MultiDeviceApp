require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcryptjs');//This is a guard againts data breachers, recommended by Google Gemini

//A few things to take note of:
//MongoDB has three separate data types taken from the website
//User login details, book details, and chapter details
//These are all separated in their own folders on the database


const app = express(); 

//calls the files inside models folder
const User = require('./models/User');
const Book = require('./models/Book');
const Chapter = require('./models/Chapter');

//This will read whether you're logged in or not when you switch between web pages
app.use(session({
    secret: 'freewrite-secret-key',
    resave: false,
    saveUninitialized: false
}));


app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');

app.use((req, res, next) => {
    res.locals.currentUser = req.session.userId || null;
    next();
});

//Calling the main database
mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/FreeWrite')
  .then(() => console.log('✅ FreeWrite Database Connected'))
  .catch(err => console.error('❌ Connection Error:', err));

app.get('/register', (req, res) => res.render('pages/register'));
//Please note that usernames and emails must be unique/only used once
//This is because MongoDB might accidentally mix it up
app.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await User.create({ username, email, password: hashedPassword });
        req.session.userId = newUser._id;
        res.redirect('/');
    } catch (err) {
        res.status(500).send("Registration error: Username/Email might be taken.");
    }
});

//You can use previous details if you logged out and want to log back in
app.get('/login', (req, res) => res.render('pages/login'));
//These are separate ejs pages (register and login)
app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (user && await bcrypt.compare(password, user.password)) {
            req.session.userId = user._id;
            res.redirect('/');
        } else {
            res.send("Invalid credentials.");
        }
    } catch (err) {
        res.status(500).send("Login error.");
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/'));
});

//index annd dashboard pages have to grab information separately
app.get('/', async (req, res) => {
    const books = await Book.find().sort({ createdAt: -1 });
    res.render('pages/index', { books });
});

app.get('/dashboard', async (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    try {
        const user = await User.findById(req.session.userId);
        const myBooks = await Book.find({ authorId: req.session.userId }).sort({ createdAt: -1 });
        res.render('pages/dashboard', { user, books: myBooks });
    } catch (err) {
        res.status(500).send("Error loading dashboard.");
    }
});


app.get('/write', (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    res.render('pages/write');
});

app.post('/create-book', async (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    try {
        const user = await User.findById(req.session.userId);
        await Book.create({
            title: req.body.title,
            genre: req.body.genre,
            coverImage: req.body.image,
            description: req.body.description,
            authorId: user._id,
            author: user.username
        });
        res.redirect('/dashboard');//Instead of heading to whatever previous webpage you were on, you go to dashboard
    } catch (err) {
        res.status(500).send("Error creating book.");
    }
});

//This is book details on the reader perspective
app.get('/book/:id', async (req, res) => {
    try {
        const book = await Book.findById(req.params.id);
        const chapters = await Chapter.find({ bookId: req.params.id }).sort('chapterNumber');
        res.render('pages/book', { book, chapters });
    } catch (err) {
        res.status(404).send("Book not found");
    }
});

//we need this to delete both the book itself and chapters inside it
//This is because books and chapters are stored separately in MongoDB
app.get('/book/:id/delete', async (req, res) => {
    try {
        const book = await Book.findById(req.params.id);
        if (!req.session.userId || book.authorId.toString() !== req.session.userId) {
            return res.redirect('/dashboard');
        }
        await Chapter.deleteMany({ bookId: req.params.id });
        await Book.findByIdAndDelete(req.params.id);
        res.redirect('/dashboard');
    } catch (err) {
        res.status(500).send("Error deleting book.");
    }
});


app.get('/read/:chapterId', async (req, res) => {
    try {
        //Looking for the specific chapter inside a specific book
        const chapter = await Chapter.findById(req.params.chapterId).populate('bookId');
        if (!chapter) return res.status(404).send("Chapter not found");

        const book = chapter.bookId;

        //This is for the "Previous chapter" button in the read webpage
        const prevChapter = await Chapter.findOne({
            bookId: book._id,
            chapterNumber: chapter.chapterNumber - 1
        });

        //This is for the "Next chapter" button on that same webpage
        const nextChapter = await Chapter.findOne({
            bookId: book._id,
            chapterNumber: chapter.chapterNumber + 1
        });

        //Wil show everything on the screen as long as it's called in the ejs file
        res.render('pages/read', { 
            chapter, 
            book, 
            prevChapter, 
            nextChapter 
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Error loading chapter");
    }
});

//Adding chapters is separated from their specific books
app.get('/book/:id/add-chapter', async (req, res) => {
    try {
        const book = await Book.findById(req.params.id);
        if (!req.session.userId || book.authorId.toString() !== req.session.userId) {
            return res.redirect(`/book/${req.params.id}`);
        }
        res.render('pages/add-chapter', { book });
    } catch (err) {
        res.status(404).send("Book not found");
    }
});

app.post('/book/:id/add-chapter', async (req, res) => {
    try {
        await Chapter.create({
            bookId: req.params.id,
            title: req.body.title,
            content: req.body.content,
            chapterNumber: req.body.chapterNumber
        });
        res.redirect(`/book/${req.params.id}`);
    } catch (err) {
        res.status(500).send("Error saving chapter.");
    }
});

//Editing needs to be separate because it directly accesses existing MongoDB data
app.get('/chapter/:id/edit', async (req, res) => {
    try {
        const chapter = await Chapter.findById(req.params.id);
        const book = await Book.findById(chapter.bookId);
        if (!req.session.userId || book.authorId.toString() !== req.session.userId) {
            return res.redirect('/');
        }
        res.render('pages/edit-chapter', { chapter, book });
    } catch (err) {
        res.status(404).send("Chapter not found");
    }
});

//This will contact MongoDB to add the new changes and delete what was once there
app.post('/chapter/:id/edit', async (req, res) => {
    try {
        const chapter = await Chapter.findById(req.params.id);
        const book = await Book.findById(chapter.bookId);
        
        if (!req.session.userId || book.authorId.toString() !== req.session.userId) {
            return res.status(403).send("Unauthorized");
        }

        await Chapter.findByIdAndUpdate(req.params.id, {
            title: req.body.title,
            content: req.body.content,
            chapterNumber: req.body.chapterNumber
        });
        res.redirect(`/book/${book._id}`);
    } catch (err) {
        res.status(500).send("Error updating chapter.");
    }
});
//I could just do the link with 3000 inside it, but the teachers might need this variable
//This was recommended by Google's Gemini because I was worried on how the website is accessed via Github repository
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 FreeWrite running on http://localhost:${PORT}`));