const mongoose = require('mongoose');
const Application = require('../models/Application.model');
const User = require('../models/User.model');
const { writeApplicationsToSheet } = require('../services/googleSheets.service');
 
const DEFAULT_USER_ID = 'dev-user-1';
 
// GET /api/v1/applications?userId=&status=
const getApplications = async (req, res) => {
  try {
    const userId = (req.user && req.user.userId) || req.query.userId || DEFAULT_USER_ID;
    const filter = { userId };
    if (req.query.status) filter.status = req.query.status;
 
    const applications = await Application.find(filter).sort({ appliedDate: -1 });
    res.status(200).json({ success: true, data: { applications } });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
};
 
// POST /api/v1/applications
const createApplication = async (req, res) => {
  try {
    const { company, role, status, appliedDate, notes } = req.body;
    const userId = (req.user && req.user.userId) || req.body.userId || DEFAULT_USER_ID;
 
    if (!company || !role) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'company and role are required.' },
      });
    }
 
    const application = await Application.create({
      userId,
      company,
      role,
      status: status || 'Applied',
      appliedDate: appliedDate ? new Date(appliedDate) : new Date(),
      lastUpdated: new Date(),
      notes: notes || '',
    });
 
    res.status(201).json({ success: true, data: { application } });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
};
 
// PATCH /api/v1/applications/:id
const updateApplication = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid id format.' },
      });
    }
    const updates = { ...req.body, lastUpdated: new Date() };
    delete updates.userId; // don't allow reassigning ownership via patch
 
    const application = await Application.findByIdAndUpdate(id, updates, {
      returnDocument: 'after',
      runValidators: true,
    });
 
    if (!application) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Application not found.' },
      });
    }
 
    res.status(200).json({ success: true, data: { application } });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
};
 
// DELETE /api/v1/applications/:id
const deleteApplication = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid id format.' },
      });
    }
    const deleted = await Application.findByIdAndDelete(id);
 
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Application not found.' },
      });
    }
 
    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
};
 
// POST /api/v1/applications/sync-sheets
const syncSheets = async (req, res) => {
  try {
    const { userId, googleAccessToken } = req.body;
    const resolvedUserId = (req.user && req.user.userId) || userId || DEFAULT_USER_ID;
    const user = await User.findById(resolvedUserId);
    const tokenToUse = googleAccessToken || user?.googleAccessToken;

    if (!tokenToUse) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'SHEETS_NOT_CONNECTED',
          message: 'Google Sheets is not connected. Please connect your Google account first.',
        },
      });
    }

    const applications = await Application.find({ userId: resolvedUserId }).sort({ appliedDate: -1 });
    let sheetUrl;
    try {
      sheetUrl = await writeApplicationsToSheet(resolvedUserId, applications, tokenToUse);
    } catch (apiErr) {
      console.warn('[syncSheets] Google API error:', apiErr.message);
      if (apiErr.code === 401 || apiErr.status === 401) {
        if (user) {
          user.googleAccessToken = null;
          await user.save();
        }
        return res.status(401).json({
          success: false,
          error: { code: 'SHEETS_AUTH_EXPIRED', message: 'Google Sheets authorization expired. Please reconnect.' },
        });
      }
      throw apiErr;
    }

    res.status(200).json({ success: true, data: { sheetUrl } });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'SHEETS_SYNC_ERROR', message: err.message } });
  }
};

// GET /api/v1/applications/sheets/status
const getSheetsStatus = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const user = userId ? await User.findById(userId) : null;
    const configured = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
    res.status(200).json({
      success: true,
      data: {
        connected: Boolean(user?.googleAccessToken),
        configured,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
};

// GET /api/v1/applications/sheets/connect
const getSheetsConnect = async (req, res) => {
  try {
    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(500).json({
        success: false,
        error: { code: 'SHEETS_NOT_CONFIGURED', message: 'Google OAuth is not configured on the server.' },
      });
    }

    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/v1/auth/google/callback';
    const state = `sheets:${req.user?.userId || 'unknown'}`;
    const scopes = [
      'openid',
      'email',
      'profile',
      'https://www.googleapis.com/auth/spreadsheets',
    ];

    res.cookie('google_oauth_state', state, {
      httpOnly: true,
      maxAge: 10 * 60 * 1000,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    });

    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scopes.join(' '),
      state,
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    res.status(200).json({ success: true, data: { authUrl } });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
};

module.exports = {
  getApplications,
  createApplication,
  updateApplication,
  deleteApplication,
  syncSheets,
  getSheetsStatus,
  getSheetsConnect,
};
 