const express = require('express');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const User = require('../models/User');
const { authenticateJWT, generateToken, verifyPassword } = require('../middleware/auth');
const { validate } = require('../middleware/validator');
const { authLimiter } = require('../middleware/rateLimiter');
const logger = require('../utils/logger');

const router = express.Router();

// OAuth - Google Strategy
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: '/api/auth/google/callback',
}, async (accessToken, refreshToken, profile, done) => {
  try {
    let user = await User.findOne({ oauthProvider: 'google', oauthId: profile.id });
    if (!user) {
      user = await User.create({
        email: profile.emails[0].value,
        firstName: profile.name.givenName,
        lastName: profile.name.familyName,
        oauthProvider: 'google',
        oauthId: profile.id,
        password: require('crypto').randomBytes(32).toString('hex'),
        emailVerified: true,
      });
    }
    done(null, user);
  } catch (error) {
    done(error, null);
  }
}));

// OAuth - GitHub Strategy
passport.use(new GitHubStrategy({
  clientID: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
  callbackURL: '/api/auth/github/callback',
}, async (accessToken, refreshToken, profile, done) => {
  try {
    let user = await User.findOne({ oauthProvider: 'github', oauthId: profile.id });
    if (!user) {
      user = await User.create({
        email: profile.emails?.[0]?.value || `${profile.username}@github.local`,
        firstName: profile.displayName?.split(' ')[0] || profile.username,
        lastName: profile.displayName?.split(' ').slice(1).join(' ') || '',
        oauthProvider: 'github',
        oauthId: profile.id,
        password: require('crypto').randomBytes(32).toString('hex'),
      });
    }
    done(null, user);
  } catch (error) {
    done(error, null);
  }
}));

// Register
router.post('/register', validate('register'), async (req, res) => {
  try {
    const { email, password, firstName, lastName, phone } = req.validatedBody;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const user = await User.create({ email, password, firstName, lastName, phone });
    const token = generateToken(user);

    logger.info('User registered', { userId: user._id, email });
    res.status(201).json({ token, user: user.toJSON() });
  } catch (error) {
    logger.error('Registration failed', { error: error.message });
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', authLimiter, validate('login'), async (req, res) => {
  try {
    const { email, password } = req.validatedBody;
    const user = await User.findOne({ email }).select('+password');

    if (!user || !(await verifyPassword(password, user.password))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user);
    logger.info('User logged in', { userId: user._id, email });
    res.json({ token, user: user.toJSON() });
  } catch (error) {
    logger.error('Login failed', { error: error.message });
    res.status(500).json({ error: 'Login failed' });
  }
});

// Google OAuth routes
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/google/callback', passport.authenticate('google', { session: false }), (req, res) => {
  const token = generateToken(req.user);
  res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}`);
});

// GitHub OAuth routes
router.get('/github', passport.authenticate('github', { scope: ['user:email'] }));
router.get('/github/callback', passport.authenticate('github', { session: false }), (req, res) => {
  const token = generateToken(req.user);
  res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}`);
});

// Get current user
router.get('/me', authenticateJWT, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user.toJSON());
});

module.exports = router;
