// server/src/controllers/quiz.controller.js

const {
  generateOrGetQuiz,
  submitQuizAttempt,
  isTopicFullyCompleted,
  COOLDOWN_HOURS,
} = require('../services/quiz.service');
const QuizAttempt = require('../models/QuizAttempt.model');
const MAX_ATTEMPTS = 3;

/**
 * POST /api/v1/quiz/generate/:topicId
 * Generates a quiz or returns the cached quiz for the specified topic and role context.
 *
 * Important: correct answers and explanations must never be sent before submission.
 */
async function generateQuiz(req, res) {
  try {
    const { topicId } = req.params;
    const userId = req.user.userId;

    const roleId = req.body?.roleId || req.query?.roleId;
    const roleName =
      req.body?.role ||
      req.body?.roleName ||
      req.query?.role ||
      req.query?.roleName;

    const result = await generateOrGetQuiz({
      topicId,
      userId,
      roleId,
      roleName,
    });

    // Send only the public question fields.
    // Never expose correctOptionIndex or explanation before submission.
    const safeQuiz = {
      ...result.quiz,
      questions: result.quiz.questions.map((question) => ({
        id: question.id,
        question: question.question,
        options: question.options,
      })),
    };

    return res.status(200).json({
      success: true,
      data: {
        quiz: safeQuiz,
      },
    });
  } catch (err) {
    const statusCode = err.statusCode || 500;
    const code = err.code || 'SERVER_ERROR';
    const message = err.message || 'An unexpected error occurred.';

    return res.status(statusCode).json({
      success: false,
      error: {
        code,
        message,
      },
    });
  }
}

/**
 * POST /api/v1/quiz/submit
 * Submits answers, calculates the score, verifies attempts/cooldown,
 * and triggers Person A & Person C integrations on a pass.
 *
 * Correct answers and explanations are returned only after submission.
 */
async function submitQuiz(req, res) {
  try {
    const { quizId, topicId, answers } = req.body;

    const userId = req.user.userId;

    const result = await submitQuizAttempt({
      userId,
      quizId,
      topicId,
      answers,
    });

    return res.status(200).json({
      success: true,
      data: {
        attempt: result.attempt,
        score: result.score,
        passed: result.passed,
        wrongQuestionIndices: result.wrongQuestionIndices,
        feedback: result.feedback,
      },
    });
  } catch (err) {
    const statusCode = err.statusCode || 500;
    const code = err.code || 'SERVER_ERROR';
    const message = err.message || 'An unexpected error occurred.';

    return res.status(statusCode).json({
      success: false,
      error: {
        code,
        message,
      },
    });
  }
}

/**
 * GET /api/v1/quiz/availability/:topicId
 * Checks whether all tasks for a topic are complete and the quiz is available.
 */
async function checkQuizAvailability(req, res) {
  try {
    const { topicId } = req.params;

    const userId = req.user.userId;

    const isComplete = await isTopicFullyCompleted(userId, topicId);

    return res.status(200).json({
      success: true,
      data: {
        topicId,
        isComplete,
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: err.message,
      },
    });
  }
}

/**
 * GET /api/v1/quiz/status/:topicId
 * Detailed status for quiz eligibility, attempts left, cooldown, pass state.
 */
async function getQuizStatus(req, res) {
  try {
    const { topicId } = req.params;
    const userId = req.user.userId;

    const isComplete = await isTopicFullyCompleted(userId, topicId);

    const attempts = await QuizAttempt.find({ userId, topicId })
      .sort({ attemptedAt: -1 })
      .lean();

    const passedAttempt = attempts.find(a => a.passed);
    if (passedAttempt) {
      return res.status(200).json({
        success: true,
        data: {
          status: {
            canAttempt: false,
            blockedReason: 'ALREADY_PASSED',
            attemptsLeft: 0,
            cooldownEndsAt: null,
            isComplete,
            topicId,
          },
        },
      });
    }

    if (!isComplete) {
      return res.status(200).json({
        success: true,
        data: {
          status: {
            canAttempt: false,
            blockedReason: 'TOPIC_NOT_COMPLETE',
            attemptsLeft: Math.max(0, MAX_ATTEMPTS - attempts.length),
            cooldownEndsAt: null,
            isComplete,
            topicId,
          },
        },
      });
    }

    if (attempts.length >= MAX_ATTEMPTS) {
      return res.status(200).json({
        success: true,
        data: {
          status: {
            canAttempt: false,
            blockedReason: 'MAX_ATTEMPTS_REACHED',
            attemptsLeft: 0,
            cooldownEndsAt: null,
            isComplete,
            topicId,
          },
        },
      });
    }

    const lastAttempt = attempts[0];
    if (lastAttempt && !lastAttempt.passed) {
      const cooldownMs = (COOLDOWN_HOURS || 10) * 60 * 60 * 1000;
      const elapsed = Date.now() - new Date(lastAttempt.attemptedAt).getTime();
      if (elapsed < cooldownMs) {
        return res.status(200).json({
          success: true,
          data: {
            status: {
              canAttempt: false,
              blockedReason: 'COOLDOWN_ACTIVE',
              attemptsLeft: MAX_ATTEMPTS - attempts.length,
              cooldownEndsAt: new Date(new Date(lastAttempt.attemptedAt).getTime() + cooldownMs).toISOString(),
              isComplete,
              topicId,
            },
          },
        });
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        status: {
          canAttempt: true,
          blockedReason: null,
          attemptsLeft: MAX_ATTEMPTS - attempts.length,
          cooldownEndsAt: null,
          isComplete,
          topicId,
        },
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: err.message },
    });
  }
}

module.exports = {
  generateQuiz,
  submitQuiz,
  checkQuizAvailability,
  getQuizStatus,
};