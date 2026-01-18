const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema({
    title: { type: String, required: true },
    author: { type: String, default: 'Anonymous' },
    genre: String,
    description: String,
    coverImage: String,
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Links book to a User
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Book', bookSchema);