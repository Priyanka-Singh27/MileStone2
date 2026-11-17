// server/src/routes/roadmap.routes.js

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth.middleware');
const {
  estimateRoadmap,
  generateRoadmap,
  getRoadmap,
  updateTaskStatus,
  addTopic,
  getTaskLearning,
  updateLearningProgress,
} = require('../controllers/roadmap.controller');

router.use(requireAuth);

router.post('/estimate', estimateRoadmap);   // onboarding: "how long will this take?"
router.post('/generate', generateRoadmap);   // creates the roadmap + first window
router.post('/add-topic', addTopic);         // mid-journey: add extra topic & reshuffle
router.get('/task/:taskId/learning', getTaskLearning);
router.post('/task/:taskId/progress', updateLearningProgress);
router.get('/:userId', getRoadmap);          // fetch (auto-extends if running low)
router.patch('/task/:taskId', updateTaskStatus);

module.exports = router;