import express from 'express';
import passport from 'passport';
import jsonwebtoken from 'jsonwebtoken';
import mongoose from 'mongoose';

const router = express.Router();
const User = mongoose.model('users');

router.get(
    '/auth/google',
    passport.authenticate('google', {
        scope: [
            'profile',
            'email',
            'https://www.googleapis.com/auth/user.phonenumbers.read'
        ]
    })
);

router.get(
    '/auth/google/callback',
    passport.authenticate('google', { failureRedirect: `${process.env.CLIENT_URL}/login/failed` }),
    async (req, res) => {
        await User.findByIdAndUpdate(req.user.id, { isLoggedIn: true });
        const token = jsonwebtoken.sign({ id: req.user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
        res.redirect(`${process.env.CLIENT_URL}?token=${token}`);
    }
);

export default router;
