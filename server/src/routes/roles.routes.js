const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth.middleware');
const { getRoles } = require('../controllers/roles.controller');

router.get('/', requireAuth, getRoles);

module.exports = router;