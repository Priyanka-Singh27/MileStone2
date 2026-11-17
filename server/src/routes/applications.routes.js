const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth.middleware');
const {
  getApplications,
  createApplication,
  updateApplication,
  deleteApplication,
  syncSheets,
  getSheetsStatus,
  getSheetsConnect,
} = require('../controllers/applications.controller');

router.use(requireAuth);

router.get('/sheets/status', getSheetsStatus);
router.get('/sheets/connect', getSheetsConnect);
router.get('/', getApplications);
router.post('/', createApplication);
router.patch('/:id', updateApplication);
router.delete('/:id', deleteApplication);
router.post('/sync-sheets', syncSheets);

module.exports = router;
