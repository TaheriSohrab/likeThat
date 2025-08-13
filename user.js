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