import React, { useState } from "react";
import { ArrowRight, Check, ChevronDown, Clock, Lock } from "lucide-react";
import { isDone } from "../../lib/roadmap";
import { TrackBadge, VerifiedBadge } from "../ui";

/** One roadmap task; all starts, practice and completion happen in its lesson view. */
export default function TaskRow({ day, task, topicName, busy = false, onLearn, onToggle, compact = false }) {
  const done = isDone(task.status);
  const verified = task.status === "verified";
  const inProgress = task.status === "in_progress";
  const [descOpen, setDescOpen] = useState(false);

  const hasDesc = !!task.description;

  const handleCheck = (e) => {
    e.stopPropagation();
    if (verified || busy) return;
    const nextStatus = done ? "not_started" : "completed";
    onToggle?.(day, task, nextStatus);
  };

  return (
    <div className={`task ${done ? "task-done" : ""} ${verified ? "task-verified" : ""}`}>
      {/* Top row: checkbox + title + (optional) expand icon */}
      <div className="task-top">
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

        <strong className={`task-title ${done ? "task-title-done" : ""}`}>{task.taskName}</strong>

        {!compact && hasDesc && (
          <button
            type="button"
            className={`task-desc-toggle ${descOpen ? "task-desc-toggle-open" : ""}`}
            onClick={() => setDescOpen((v) => !v)}
            aria-expanded={descOpen}
            aria-label={descOpen ? "Hide description" : "Show description"}
          >
            <ChevronDown size={13} aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Collapsible description */}
      {!compact && hasDesc && descOpen && (
        <p className="task-desc">{task.description}</p>
      )}

      {/* Bottom row: metadata tags + CTA */}
      <div className="task-footer">
        <div className="task-meta">
          <TrackBadge track={task.track} />
          {topicName && <span className="task-topic" title={topicName}>{topicName}</span>}
          <span className="task-time"><Clock size={11} aria-hidden="true" /> {task.estimatedMinutes || 25} min</span>
          {task.isPartial && <span className="pill pill-plain">Part of a longer lesson</span>}
          <span className={`task-status-pill ${done ? "task-status-done" : inProgress ? "task-status-progress" : "task-status-new"}`}>
            {done ? "Completed" : inProgress ? "In progress" : "Not started"}
          </span>
          {verified && <VerifiedBadge compact />}
        </div>

        <div className="task-actions">
          {verified && <span className="locked-note" title="Verified by quiz"><Lock size={12} aria-hidden="true" /></span>}
          <button type="button" className="btn btn-sm btn-cream task-start" disabled={busy} onClick={() => onLearn(day, task)}>
            {done ? "Review" : inProgress ? "Continue" : "Start learning"}
            <ArrowRight size={12} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
