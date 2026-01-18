const mongoose = require('mongoose');

const chapterSchema = new mongoose.Schema({
    bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true }, // Links chapter to a Book
    title: { type: String, required: true },
    content: { type: String, required: true },
    chapterNumber: Number,
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Chapter', chapterSchema);