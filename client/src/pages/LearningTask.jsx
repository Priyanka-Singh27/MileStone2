import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Clock3, Pause, Play, RotateCcw, Sparkles } from "lucide-react";
import { roadmapApi } from "../api";
import { useAuth } from "../context/AuthContext";
import { useRoadmap } from "../context/RoadmapContext";
import { useToast } from "../context/ToastContext";
import { friendlyError } from "../config/errors";
import { Frame, PageHead } from "../components/ui";

const timeText = (seconds = 0) => {
  const total = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(total / 3600)).padStart(2, "0")}:${String(Math.floor((total % 3600) / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

export default function LearningTask() {
  const { taskId = "" } = useParams();
  const [search] = useSearchParams();
  const dayNumber = Number(search.get("dayNumber"));
  const { userId } = useAuth();
  const roadmap = useRoadmap();
  const toast = useToast();
  const navigate = useNavigate();
  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [answers, setAnswers] = useState({});
  const [feedback, setFeedback] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [completed, setCompleted] = useState(false);

  const patchRoadmap = useCallback((taskStatus, progress) => {
    roadmap.setRoadmap((current) => current && ({
      ...current,
      days: current.days.map((day) => day.dayNumber !== dayNumber ? day : ({
        ...day,
        tasks: day.tasks.map((task) => task.id !== taskId ? task : ({
          ...task,
          status: taskStatus || task.status,
          learningProgress: progress ? {
            ...(task.learningProgress || {}),
            completedExerciseIds: progress.completedExerciseIds,
            knowledgeCheckPassed: progress.knowledgeCheckPassed,
            knowledgeCheckScore: progress.knowledgeCheckScore,
            elapsedSeconds: progress.elapsedSeconds,
            timerRunning: progress.timerRunning,
          } : task.learningProgress,
        })),
      })),
    }));
  }, [dayNumber, roadmap.setRoadmap, taskId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await roadmapApi.getTaskLearning(taskId, dayNumber);
      setLesson(data);
      setElapsed(data.progress.elapsedSeconds || 0);
      const previous = Object.fromEntries((data.progress.knowledgeCheckAnswers || []).map((a) => [a.questionId, a.selectedIndex]));
      setAnswers(previous);
      setCompleted(data.task.status === "completed" || data.task.status === "verified");
      patchRoadmap(data.task.status, data.progress);

      // The first click from the roadmap opens a real lesson and starts its
      // persisted timer only after the lesson has successfully loaded.
      if (data.task.status === "not_started") {
        const started = await roadmapApi.updateLearningProgress(taskId, { action: "start", dayNumber });
        setLesson((current) => current && ({ ...current, task: { ...current.task, ...started.task }, progress: started.progress }));
        setElapsed(started.progress.elapsedSeconds || 0);
        patchRoadmap(started.task.status, started.progress);
      }
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [dayNumber, patchRoadmap, taskId]);

  useEffect(() => { load(); }, [load, userId]);

  const timerRunning = Boolean(lesson?.progress?.timerRunning) && !completed;
  useEffect(() => {
    if (!timerRunning) return undefined;
    const id = window.setInterval(() => setElapsed((seconds) => seconds + 1), 1000);
    return () => window.clearInterval(id);
  }, [timerRunning]);

  const requiredExerciseIds = useMemo(() => (lesson?.learningContent?.exercises || []).map((e) => e.id), [lesson]);
  const doneExerciseIds = lesson?.progress?.completedExerciseIds || [];
  const allExercisesDone = requiredExerciseIds.length > 0 && requiredExerciseIds.every((id) => doneExerciseIds.includes(id));
  const quizPassed = Boolean(lesson?.progress?.knowledgeCheckPassed);

  async function saveAction(action, extra = {}) {
    setBusy(true);
    try {
      const data = await roadmapApi.updateLearningProgress(taskId, { action, dayNumber, ...extra });
      if (data.progress) {
        setLesson((current) => current && ({ ...current, task: { ...current.task, ...(data.task || {}) }, progress: data.progress }));
        setElapsed(data.progress.elapsedSeconds || 0);
        patchRoadmap(data.task?.status, data.progress);
      }
      return data;
    } catch (err) {
      toast.error(friendlyError(err));
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function submitCheck() {
    const questions = lesson?.learningContent?.knowledgeCheck || [];
    if (questions.some((q) => !Number.isInteger(answers[q.id]))) {
      toast.error("Choose an answer for every question first.");
      return;
    }
    const data = await saveAction("submit_knowledge_check", {
      answers: questions.map((q) => ({ questionId: q.id, selectedIndex: answers[q.id] })),
    });
    if (!data) return;
    setFeedback(data.feedback);
    toast[data.passed ? "success" : "info"](data.passed ? "Knowledge check passed!" : "Review the explanations and try again.");
  }

  async function finishLesson() {
    setBusy(true);
    try {
      await roadmapApi.updateLearningProgress(taskId, { action: "complete_lesson", dayNumber });
      setCompleted(true);
      setLesson((current) => current && ({
        ...current,
        task: { ...current.task, status: "completed" },
        progress: { ...current.progress, timerRunning: false, completedExerciseIds: requiredExerciseIds, knowledgeCheckPassed: true },
      }));
      patchRoadmap("completed", { ...lesson?.progress, timerRunning: false, completedExerciseIds: requiredExerciseIds, knowledgeCheckPassed: true, elapsedSeconds: elapsed });
      toast.success("Lesson complete! Your daily and roadmap progress are updated.");
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Frame className="card learning-state"><p>Preparing your lesson…</p></Frame>;
  if (error || !lesson) return <Frame className="card learning-state"><h1>We couldn’t open this lesson</h1><p>{friendlyError(error)}</p><div className="row-gap"><button className="btn btn-gold" onClick={load}>Try again</button><Link className="btn btn-cream" to="/roadmap">Back to roadmap</Link></div></Frame>;

  const { task, learningContent: content } = lesson;

  return (
    <div className="learning-page">
      <Link className="learning-back" to="/roadmap"><ArrowLeft size={15} /> Back to roadmap</Link>
      <PageHead kicker={`DAY ${task.dayNumber} · ${task.date}`} title={task.taskName} text={task.description || "Learn the idea, practise it, and check your understanding."} who="captain">
        <div className="learning-timer" aria-live="off">
          <Clock3 size={16} /><span className="learning-time">{timeText(elapsed)}</span>
          {completed ? <span className="pill pill-ok">Completed</span> : timerRunning ? <span className="pill pill-warn">Timer running</span> : <span className="pill pill-plain">Timer paused</span>}
          {!completed && <button className="btn btn-sm btn-cream" disabled={busy} onClick={() => saveAction(timerRunning ? "pause" : lesson.progress.startedAt ? "resume" : "start")}>
            {timerRunning ? <Pause size={13} /> : <Play size={13} />}{timerRunning ? "Pause" : lesson.progress.startedAt ? "Resume" : "Start learning"}
          </button>}
        </div>
      </PageHead>

      {completed && <div className="learning-success" role="status"><Check size={18} /> You completed this lesson. Your daily goal and overall roadmap counts now include it.</div>}

      <Frame className="card learning-objectives">
        <div className="learning-section-title"><Sparkles size={17} /><h2>By the end, you can</h2></div>
        <ul>{content.objectives.map((objective) => <li key={objective}>{objective}</li>)}</ul>
      </Frame>

      <div className="learning-flow" aria-label="Learning flow"><span>Understand</span><ArrowRight size={15} /><span>Work an example</span><ArrowRight size={15} /><span>Practise</span><ArrowRight size={15} /><span>Check yourself</span></div>

      {content.sections.map((section, index) => (
        <Frame className="card learning-section" key={`${section.heading}-${index}`}>
          <span className="kicker">LESSON {index + 1}</span><h2>{section.heading}</h2>
          <p>{section.body}</p>
          {section.example && <div className="learning-example"><strong>Example</strong><p>{section.example}</p></div>}
        </Frame>
      ))}

      <Frame className="card learning-section">
        <span className="kicker">ACTIVE PRACTICE</span><h2>Try it yourself</h2>
        <p className="muted">Do the activity before marking it complete. Your completion is saved to your account.</p>
        <div className="learning-exercises">
          {content.exercises.map((exercise) => {
            const checked = doneExerciseIds.includes(exercise.id);
            return <article className={`learning-exercise ${checked ? "is-done" : ""}`} key={exercise.id}>
              <div><h3>{exercise.title}</h3><p>{exercise.instructions}</p>{exercise.completionHint && <small>{exercise.completionHint}</small>}</div>
              <button className={`btn btn-sm ${checked ? "btn-cream" : "btn-gold"}`} disabled={busy || completed || checked} onClick={() => saveAction("complete_exercise", { exerciseId: exercise.id })}>
                {checked ? <><Check size={13} /> Done</> : "I did this"}
              </button>
            </article>;
          })}
        </div>
      </Frame>

      <Frame className="card learning-section">
        <span className="kicker">KNOWLEDGE CHECK</span><h2>Can you explain it?</h2>
        <p className="muted">Answer all questions. You need at least two correct to pass; you can retry after reviewing the lesson.</p>
        {content.knowledgeCheck.map((question, i) => {
          const result = feedback?.find((item) => item.questionId === question.id);
          return <fieldset className="learning-question" key={question.id}>
            <legend>{i + 1}. {question.prompt}</legend>
            {question.options.map((option, optionIndex) => <label className={result ? (result.correctAnswerIndex === optionIndex ? "answer-correct" : answers[question.id] === optionIndex ? "answer-wrong" : "") : ""} key={`${option}-${optionIndex}`}>
            <input type="radio" name={question.id} value={optionIndex} checked={answers[question.id] === optionIndex} disabled={busy || completed || quizPassed} onChange={() => { setFeedback(null); setAnswers((current) => ({ ...current, [question.id]: optionIndex })); }} />{option}
            </label>)}
            {result && <p className="learning-feedback">{result.correct ? "Correct. " : "Review: "}{result.explanation}</p>}
          </fieldset>;
        })}
        {!completed && <button className="btn btn-gold" disabled={busy || quizPassed} onClick={submitCheck}>{busy ? "Checking…" : "Check answers"}</button>}
        {quizPassed && <p className="learning-passed" role="status"><Check size={15} /> Passed · {lesson.progress.knowledgeCheckScore}%</p>}
      </Frame>

      <Frame className="card learning-finish">
        <div><span className="kicker">LESSON PROGRESS</span><h2>{completed ? "Lesson completed" : "Ready to finish?"}</h2><p>{allExercisesDone ? "Practice activities complete" : `${doneExerciseIds.length} of ${requiredExerciseIds.length} activities complete`} · {quizPassed ? "Knowledge check passed" : "Click Complete to finish this lesson"}</p></div>
        {completed ? <Link className="btn btn-cream" to="/roadmap">Return to roadmap <ArrowRight size={14} /></Link> : <button className="btn btn-gold" disabled={busy || !allExercisesDone || !quizPassed} onClick={finishLesson}><Check size={15} /> Complete task</button>}
      </Frame>
    </div>
  );
}
