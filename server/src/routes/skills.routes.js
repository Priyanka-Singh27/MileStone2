// server/src/routes/skills.routes.js
 
const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload.middleware');
const { requireAuth, authenticate } = require('../middleware/auth.middleware');
const { getSkillGap, verifySkill, getVerifiedSkills, extractSkills } = require('../controllers/skills.controller');
 
router.post('/gap', requireAuth, getSkillGap);
router.get('/verified', requireAuth, getVerifiedSkills);
router.patch('/verify', authenticate({ allowInternal: true }), verifySkill);
router.post('/extract', requireAuth, upload.single('resume'), extractSkills);
 
module.exports = router;