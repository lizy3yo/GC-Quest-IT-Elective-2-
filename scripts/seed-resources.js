// Seed script to populate the database with sample educational resources
// Run with: node seed-resources.js

require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gcquest';

const resourceSchema = new mongoose.Schema({
  title: String,
  description: String,
  type: String,
  category: String,
  subject: String,
  url: String,
  thumbnailUrl: String,
  author: String,
  source: String,
  downloads: Number,
  views: Number,
  bookmarkedBy: [mongoose.Schema.Types.ObjectId],
  tags: [String],
  uploadedBy: mongoose.Schema.Types.ObjectId,
  isVerified: Boolean,
}, { timestamps: true });

const Resource = mongoose.models.Resource || mongoose.model('Resource', resourceSchema);

const sampleResources = [
  {
    title: "Introduction to Calculus",
    description: "Comprehensive guide covering limits, derivatives, and integrals with practical examples and exercises.",
    type: "pdf",
    category: "Study Guide",
    subject: "Mathematics",
    url: "https://ocw.mit.edu/courses/mathematics/",
    author: "MIT OpenCourseWare",
    source: "MIT OCW",
    downloads: 0,
    views: 0,
    tags: ["calculus", "mathematics", "derivatives", "integrals"],
    isVerified: true,
  },
  {
    title: "Physics 101: Classical Mechanics",
    description: "Video lecture series on Newton's laws, energy, momentum, and rotational motion.",
    type: "video",
    category: "Video Lecture",
    subject: "Physics",
    url: "https://www.khanacademy.org/science/physics",
    author: "Khan Academy",
    source: "Khan Academy",
    downloads: 0,
    views: 0,
    tags: ["physics", "mechanics", "newton", "motion"],
    isVerified: true,
  },
  {
    title: "Organic Chemistry Lecture Notes",
    description: "Complete lecture notes covering functional groups, reactions, and synthesis strategies.",
    type: "document",
    category: "Lecture Notes",
    subject: "Chemistry",
    url: "https://ocw.mit.edu/courses/chemistry/",
    author: "MIT OpenCourseWare",
    source: "MIT OCW",
    downloads: 0,
    views: 0,
    tags: ["chemistry", "organic", "reactions", "synthesis"],
    isVerified: true,
  },
  {
    title: "Computer Science Fundamentals",
    description: "Interactive course on algorithms, data structures, and problem-solving techniques.",
    type: "link",
    category: "Interactive Course",
    subject: "Computer Science",
    url: "https://www.coursera.org/courses?query=computer%20science",
    author: "Coursera",
    source: "Coursera",
    downloads: 0,
    views: 0,
    tags: ["computer science", "algorithms", "data structures", "programming"],
    isVerified: true,
  },
  {
    title: "World History Timeline",
    description: "Comprehensive timeline of major historical events from ancient civilizations to modern times.",
    type: "pdf",
    category: "Reference Material",
    subject: "History",
    url: "https://www.khanacademy.org/humanities/world-history",
    author: "Khan Academy",
    source: "Khan Academy",
    downloads: 0,
    views: 0,
    tags: ["history", "timeline", "civilizations", "world history"],
    isVerified: true,
  },
  {
    title: "English Grammar Guide",
    description: "Detailed guide on grammar rules, sentence structure, and writing techniques.",
    type: "document",
    category: "Study Guide",
    subject: "English",
    url: "https://www.coursera.org/courses?query=english%20grammar",
    author: "Various Authors",
    source: "Open Educational Resources",
    downloads: 0,
    views: 0,
    tags: ["english", "grammar", "writing", "composition"],
    isVerified: true,
  },
  {
    title: "Biology: Cell Structure and Function",
    description: "Audio lectures explaining cellular components, metabolism, and genetic processes.",
    type: "audio",
    category: "Podcast",
    subject: "Biology",
    url: "https://www.khanacademy.org/science/biology",
    author: "Khan Academy",
    source: "Khan Academy",
    downloads: 0,
    views: 0,
    tags: ["biology", "cells", "genetics", "metabolism"],
    isVerified: true,
  },
  {
    title: "Introduction to Psychology",
    description: "Video series covering cognitive psychology, behavioral theory, and mental processes.",
    type: "video",
    category: "Video Lecture",
    subject: "Psychology",
    url: "https://www.coursera.org/courses?query=psychology",
    author: "Yale University",
    source: "Coursera",
    downloads: 0,
    views: 0,
    tags: ["psychology", "cognitive", "behavior", "mental health"],
    isVerified: true,
  },
  {
    title: "Statistics and Probability Handbook",
    description: "Complete reference guide for statistical methods, probability theory, and data analysis.",
    type: "pdf",
    category: "Reference Material",
    subject: "Mathematics",
    url: "https://ocw.mit.edu/courses/mathematics/",
    author: "MIT OpenCourseWare",
    source: "MIT OCW",
    downloads: 0,
    views: 0,
    tags: ["statistics", "probability", "data analysis", "mathematics"],
    isVerified: true,
  },
  {
    title: "Environmental Science Essentials",
    description: "Comprehensive study guide on ecosystems, climate change, and sustainability.",
    type: "document",
    category: "Study Guide",
    subject: "Science",
    url: "https://www.khanacademy.org/science",
    author: "Khan Academy",
    source: "Khan Academy",
    downloads: 0,
    views: 0,
    tags: ["environment", "ecology", "climate", "sustainability"],
    isVerified: true,
  },
];

async function seedResources() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    console.log('Clearing existing resources...');
    await Resource.deleteMany({});

    console.log('Adding sample resources...');
    await Resource.insertMany(sampleResources);

    console.log(`Successfully added ${sampleResources.length} resources!`);
    
    const count = await Resource.countDocuments();
    console.log(`Total resources in database: ${count}`);

  } catch (error) {
    console.error('Error seeding resources:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

seedResources();
