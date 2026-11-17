import React from "react";
import { ArrowRight, Check, Clock, Lock } from "lucide-react";
import { isDone } from "../../lib/roadmap";
import { TrackBadge, VerifiedBadge } from "../ui";

/** One roadmap task; all starts, practice and completion happen in its lesson view. */
export default function TaskRow({ day, task, topicName, busy = false, onLearn, onToggle, compact = false }) {
  const done = isDone(task.status);
  const verified = task.status === "verified";
  const inProgress = task.status === "in_progress";

  const handleCheck = (e) => {
    e.stopPropagation();
    if (verified || busy) return;
    const nextStatus = done ? "not_started" : "completed";
    onToggle?.(day, task, nextStatus);
  };

  return (
    <div className={`task ${done ? "task-done" : ""} ${verified ? "task-verified" : ""}`}>
      <button
        type="button"
        className={`task-check ${done ? "task-check-done" : ""}`}
        disabled={verified || busy || !onToggle}
        onClick={handleCheck}
        title={verified ? "Verified by quiz" : done ? "Mark as not done" : "Mark as done"}
        aria-label={done ? "Completed" : inProgress ? "In progress" : "Not started"}
        style={{ cursor: onToggle && !verified ? "pointer" : "default" }}
      >
        {done ? <Check size={14} strokeWidth={3} aria-hidden="true" /> : null}
      </button>

      <div className="task-body">
        <strong>{task.taskName}</strong>
        {!compact && task.description && <p>{task.description}</p>}
        <div className="task-meta">
          <TrackBadge track={task.track} />
          {topicName && <span className="pill pill-plain">{topicName}</span>}
          <span className="meta-item"><Clock size={12} aria-hidden="true" /> {task.estimatedMinutes || 25} min</span>
          {task.isPartial && <span className="pill pill-plain">Part of a longer lesson</span>}
          {done ? <span className="pill pill-ok">Completed</span> : inProgress ? <span className="pill pill-warn">In progress</span> : <span className="pill pill-plain">Not started</span>}
          {verified && <VerifiedBadge compact />}
        </div>
      </div>

      {verified && <span className="locked-note" title="Verified by quiz"><Lock size={13} aria-hidden="true" /></span>}
      <button type="button" className="btn btn-sm btn-cream task-start" disabled={busy} onClick={() => onLearn(day, task)}>
        {done ? "Review lesson" : inProgress ? "Continue learning" : "Start learning"}
        <ArrowRight size={13} aria-hidden="true" />
      </button>
    </div>
  );
}
