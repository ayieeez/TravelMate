const mongoose = require('mongoose');

const newsSchema = new mongoose.Schema({
  country: {
    type: String,
    required: true,
    default: 'MY'
  },
  city: {
    type: String,
    required: true
  },
  state: {
    type: String,
    required: true
  },
  article: {
    title: {
      type: String,
      required: true
    },
    description: {
      type: String,
      required: true
    },
    url: {
      type: String,
      required: true,
      unique: false // Allow same URL for different cities
    },
    urlToImage: {
      type: String,
      default: null
    },
    publishedAt: {
      type: Date,
      required: true
    },
    source: {
      name: {
        type: String,
        required: true
      }
    },
    content: {
      type: String,
      default: null
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Create compound index for efficient querying
newsSchema.index({ country: 1, city: 1, 'article.publishedAt': -1 });
newsSchema.index({ country: 1, state: 1, 'article.publishedAt': -1 });
newsSchema.index({ 'article.url': 1, city: 1 }, { unique: true });

module.exports = mongoose.model('News', newsSchema);
