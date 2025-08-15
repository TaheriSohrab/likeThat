// // file: server/services/passport.js
// import passport from 'passport';
// import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
// import mongoose from 'mongoose';
//
// const User = mongoose.model('users');
//
// passport.serializeUser((user, done) => {
//     done(null, user.id);
// });
//
// passport.deserializeUser((id, done) => {
//     User.findById(id).then(user => {
//         done(null, user);
//     });
// });
//
// passport.use(
//     new GoogleStrategy({
//             clientID: process.env.GOOGLE_CLIENT_ID,
//             clientSecret: process.env.GOOGLE_CLIENT_SECRET,
//             callbackURL: '/auth/google/callback',
//             proxy: true // Important for deployment on services like Heroku
//         },
//         async (accessToken, refreshToken, profile, done) => {
//             try {
//                 const existingUser = await User.findOne({ googleId: profile.id });
//                 if (existingUser) {
//                     // User already exists, just return them
//                     return done(null, existingUser);
//                 }
//                 // New user, create and save them
//                 const user = await new User({
//                     googleId: profile.id,
//                     displayName: profile.displayName,
//                     email: profile.emails[0].value,
//                     photo: profile.photos[0].value
//                 }).save();
//                 done(null, user);
//             } catch (err) {
//                 done(err, null);
//             }
//         })
// );
//
// import passport from 'passport';
// import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
// import mongoose from 'mongoose';
// const User = mongoose.model('users');
// passport.serializeUser((user, done) => done(null, user.id));
// passport.deserializeUser((id, done) => User.findById(id).then(user => done(null, user)));
// passport.use(new GoogleStrategy({
//     clientID: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET,
//     callbackURL: 'https://likethat.onrender.com/auth/google/callback',
//     proxy: true
// }, async (accessToken, refreshToken, profile, done) => {
//     try {
//         const existingUser = await User.findOne({ googleId: profile.id });
//         if (existingUser) return done(null, existingUser);
//         let primaryPhoneNumber = null;
//         if (profile._json?.phoneNumbers?.length > 0) {
//             const primaryPhone = profile._json.phoneNumbers.find(p => p.metadata.primary);
//             primaryPhoneNumber = primaryPhone ? primaryPhone.value : profile._json.phoneNumbers[0].value;
//         }
//         const user = await new User({
//             googleId: profile.id, displayName: profile.displayName, email: profile.emails[0].value,
//             photo: profile.photos[0].value, phoneNumber: primaryPhoneNumber
//         }).save();
//         done(null, user);
//     } catch (err) { done(err, null); }
// }));




import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import mongoose from 'mongoose';
const User = mongoose.model('users');

passport.serializeUser((user, done) => done(null, user.id));

passport.deserializeUser((id, done) => {
    User.findById(id).then(user => done(null, user));
});

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || '/auth/google/callback',
    proxy: true
}, async (accessToken, refreshToken, profile, done) => {
    try {
        const existingUser = await User.findOne({ googleId: profile.id });
        if (existingUser) return done(null, existingUser);

        let primaryPhoneNumber = null;
        if (profile._json?.phoneNumbers?.length > 0) {
            const primaryPhone = profile._json.phoneNumbers.find(p => p.metadata.primary);
            primaryPhoneNumber = primaryPhone ? primaryPhone.value : profile._json.phoneNumbers[0].value;
        }

        const user = await new User({
            googleId: profile.id,
            displayName: profile.displayName,
            email: profile.emails[0]?.value || null,
            photo: profile.photos[0]?.value || null,
            phoneNumber: primaryPhoneNumber
        }).save();

        done(null, user);
    } catch (err) {
        done(err, null);
    }
}));
