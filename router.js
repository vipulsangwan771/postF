const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');

// Define contact schema (moved from server.js to avoid duplication)
const contactSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true, 
    trim: true,
    minlength: 2,
    maxlength: 100
  },
  email: { 
    type: String, 
    required: true, 
    trim: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  },
  subject: { 
    type: String, 
    required: true, 
    trim: true,
    minlength: 2,
    maxlength: 200
  },
  message: { 
    type: String, 
    required: true, 
    trim: true,
    minlength: 10,
    maxlength: 5000
  },
  timestamp: { 
    type: Date, 
    default: Date.now 
  }
});

// Create Contact model
const Contact = mongoose.model('Contact', contactSchema);

const downloadSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  },
  purpose: {
    type: String,
    required: true,
    trim: true,
    minlength: 5,
    maxlength: 500
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const Download = mongoose.model('Download', downloadSchema);
router.post('/download-cv', [
  body('email').isEmail().withMessage('Valid email is required'),
  body('purpose').isLength({ min: 5 }).withMessage('Purpose is required and must be meaningful')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  try {
    const { email, purpose } = req.body;

    const download = new Download({ email, purpose });
    await download.save();

    res.status(201).json({
      success: true,
      message: 'Download info saved'
    });
  } catch (error) {
    console.error('Error saving download data:', error);
    res.status(500).json({
      success: false,
      message: 'Server error. Could not save download info.',
      error: error.message
    });
  }
});


// Rate limiting middleware (prevents abuse)
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per window
  message: {
    success: false,
    message: 'Too many requests, please try again later'
  }
});

// Validation middleware
const validateContact = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please enter a valid email'),
  body('subject')
    .trim()
    .notEmpty()
    .withMessage('Subject is required')
    .isLength({ min: 2, max: 200 })
    .withMessage('Subject must be between 2 and 200 characters'),
  body('message')
    .trim()
    .notEmpty()
    .withMessage('Message is required')
    .isLength({ min: 10, max: 5000 })
    .withMessage('Message must be between 10 and 5000 characters')
];

// POST route to handle contact form submissions
router.post('/contact', contactLimiter, validateContact, async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Validation failed',
        errors: errors.array() 
      });
    }

    // Create new contact document
    const contact = new Contact({
      name: req.body.name,
      email: req.body.email,
      subject: req.body.subject,
      message: req.body.message
      // Remove timestamp from body to use schema default
    });

    // Save to database
    await contact.save();

    // Send success response
    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: {
        id: contact._id,
        name: contact.name,
        email: contact.email,
        subject: contact.subject,
        timestamp: contact.timestamp
      }
    });

  } catch (error) {
    console.error('Error saving contact:', error);
    
    // Handle specific MongoDB errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid data provided',
        errors: Object.values(error.errors).map(err => err.message)
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to save message',
      error: error.message
    });
  }
});

module.exports = router;