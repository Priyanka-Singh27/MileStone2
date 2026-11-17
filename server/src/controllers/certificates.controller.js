const mongoose = require('mongoose');
const Certificate = require('../models/Certificate.model');
const { uploadBuffer, tryDeleteFromUrl } = require('../services/cloudinary.service');
 
const DEFAULT_USER_ID = 'dev-user-1';
 
const uploadCertificate = async (req, res) => {
  try {
    const { userId, title, issuer, dateIssued, tags } = req.body;
 
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'A certificate file is required.' },
      });
    }
    if (!title || !issuer) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'title and issuer are required.' },
      });
    }
 
    const resolvedUserId = (req.user && req.user.userId) || userId || DEFAULT_USER_ID;
    let fileUrl = null;
    try {
      const { url } = await uploadBuffer(req.file.buffer, `certificates/${resolvedUserId}`);
      fileUrl = url;
    } catch (uploadErr) {
      console.warn('[uploadCertificate] Cloudinary upload unavailable, storing inline file URL:', uploadErr.message);
      fileUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    }

    const parsedTags = Array.isArray(tags)
      ? tags
      : (tags || '').split(',').map((t) => t.trim()).filter(Boolean);

    const certificate = await Certificate.create({
      userId: resolvedUserId,
      type: 'uploaded',
      title,
      issuer,
      dateIssued: dateIssued ? new Date(dateIssued) : new Date(),
      tags: parsedTags,
      fileUrl,
      quizScore: null,
    });
 
    res.status(201).json({ success: true, data: { certificate } });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
};
 
const createBadge = async (req, res) => {
  try {
    const { userId, topicId, title, quizScore } = req.body;
    const resolvedUserId = (req.user && req.user.userId) || userId;
 
    if (!resolvedUserId || !title) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'userId and title are required.' },
      });
    }
 
    const certificate = await Certificate.create({
      userId: resolvedUserId,
      type: 'badge',
      title,
      issuer: 'Platform-verified',
      dateIssued: new Date(),
      tags: topicId ? [topicId] : [],
      fileUrl: null,
      quizScore: typeof quizScore === 'number' ? quizScore : null,
    });
 
    res.status(201).json({ success: true, data: { certificate } });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
};
 
const getCertificates = async (req, res) => {
  try {
    const userId = (req.user && req.user.userId) || req.query.userId || DEFAULT_USER_ID;
    const filter = { userId };
    if (req.query.type) filter.type = req.query.type;
    if (req.query.tag) filter.tags = req.query.tag;
 
    const certificates = await Certificate.find(filter).sort({ dateIssued: -1 });
    res.status(200).json({ success: true, data: { certificates } });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
};
 
const deleteCertificate = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid id format.' },
      });
    }
    const certificate = await Certificate.findById(id);
 
    if (!certificate) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Certificate not found.' },
      });
    }
 
    if (certificate.type === 'badge') {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Badges cannot be deleted.' },
      });
    }
 
    await tryDeleteFromUrl(certificate.fileUrl);
    await Certificate.findByIdAndDelete(id);
 
    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
};
 
module.exports = { uploadCertificate, createBadge, getCertificates, deleteCertificate };
 