// server/src/seed/seedRoles.js
// Consolidates seeding for Software Developer, AI Engineer, and Data Analyst roles.

require('dotenv').config();
const mongoose = require('mongoose');
const Role = require('../models/Role.model');

const softwareDevTopics = require('./software-developer-curriculum.json');
const aiEngineerTopics = require('./ai-engineer-curriculum.json');
const dataAnalystTopics = require('./data-analyst-curriculum.json');

const rolesToSeed = [
  {
    name: 'Software Developer',
    description: 'Role curriculum researched from job postings, roadmap.sh, and interview-question sources.',
    topics: softwareDevTopics,
  },
  {
    name: 'AI Engineer',
    description: 'Role curriculum researched from job postings, roadmap.sh, and interview-question sources.',
    topics: aiEngineerTopics,
  },
  {
    name: 'Data Analyst',
    description: 'Role curriculum researched from job postings, roadmap.sh, and interview-question sources.',
    topics: dataAnalystTopics,
  },
];

async function seedRoles() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not defined in environment.');
    process.exit(1);
  }

  await mongoose.connect(process.env.DATABASE_URL);
  console.log('Connected to database for role seeding...');

  for (const roleDef of rolesToSeed) {
    const existing = await Role.findOne({ name: roleDef.name });
    if (existing) {
      console.log(`⚠️  Role "${roleDef.name}" already exists (${existing.topics?.length || 0} topics) — skipping.`);
    } else {
      const created = await Role.create(roleDef);
      console.log(`✅ Created role "${created.name}" with ${created.topics.length} topics.`);
    }
  }

  await mongoose.disconnect();
  console.log('Role seeding finished.');
}

if (require.main === module) {
  seedRoles()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Error seeding roles:', err);
      process.exit(1);
    });
}

module.exports = { seedRoles, rolesToSeed };
