// // file: server/models/User.js
// import mongoose from 'mongoose';
//
// const userSchema = new mongoose.Schema({
//     googleId: String,
//     displayName: String,
//     email: String,
//     photo: String,
//     searchesLeft: { type: Number, default: 5 },
//     isPro: { type: Boolean, default: false },
//     subscriptionExpiresAt: { type: Date, default: null },
//     proSearchesLeft: { type: Number, default: 0 }
// });
//
// mongoose.model('users', userSchema);
// file: server/models/User.js



import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    googleId: String,
    displayName: String,
    email: String,
    photo: String,
    phoneNumber: { type: String, default: null },
    subscriptionTier: { type: String, default: 'free', enum: ['free', 'cinephile', 'directors_cut'] },
    searchesLeft: { type: Number, default: 5 }, // فقط برای کاربران free
    subscriptionExpiresAt: { type: Date, default: null },
    isLoggedIn: { type: Boolean, default: false }
});

mongoose.model('users', userSchema);