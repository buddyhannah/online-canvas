const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/user');

const router = express.Router();

const JWT_SECRET = 'secret';

// Register a new user
router.post('/register', async (req, res) => {
    const { username, password } = req.body;
    const salt = await bcrypt.genSalt() // Generates a salt, default 10 rounds
    const passwordHash = await bcrypt.hash(password, salt);
    try {
      const user = await User.create({ username, passwordHash, displayName: username });
      user.save().then(function(){
        console.log("Added new user to database");
      });

      const token = jwt.sign({ id: user._id, displayName: user.displayName }, JWT_SECRET);
      res.json({ token });
    } catch (err) {
      res.status(400).json({ error: 'Username already exists' });
    }
});

// Login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user._id, displayName: user.displayName }, JWT_SECRET);
    res.json({ token });
});

module.exports = router;