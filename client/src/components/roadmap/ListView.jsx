import React, { useState } from "react";
import { Anchor, ChevronDown, Coffee, Dumbbell, Swords } from "lucide-react";
import { Frame, ProgressBar } from "../ui";
import TaskRow from "./TaskRow";
import { PracticePlanCard } from "./Panels";
import { describeDay, formatDate, isDone, weekIndexOf, weekRange } from "../../lib/roadmap";

/**
 * Plain, keyboard- and screen-reader-friendly list of every day grouped by
 * calendar week. Past days stay visible so unfinished lessons can be continued.
 * Weeks are collapsible; non-current weeks default to collapsed when all done.
 */
export default function ListView({ days, today, topicMap, trackFilter, onLearn, onToggle }) {
  const weeks = [...new Set(days.map((d) => weekIndexOf(days, d)))];
  const firstPractice = days.find((d) => d.phase === "practice");

  // Determine current week index to keep it expanded by default
  const currentWeek = (() => {
    const todayDay = days.find((d) => d.date === today);
    return todayDay ? weekIndexOf(days, todayDay) : 0;
  })();

  // Track collapsed state per week — past completed weeks start collapsed
  const [collapsedWeeks, setCollapsedWeeks] = useState(() => {
    const init = {};
    weeks.forEach((w) => {
      if (w === currentWeek) { init[w] = false; return; }
      // collapse weeks that are entirely before today
      const { days: wd } = weekRange(days, w);
      const allPast = wd.every((d) => d.date < today);
      init[w] = allPast;
    });
    return init;
  });

  const toggleWeek = (w) => setCollapsedWeeks((prev) => ({ ...prev, [w]: !prev[w] }));

  return (
    <div className="list-view">
      {weeks.map((w) => {
        const { days: wd, first, last } = weekRange(days, w);
        const tasks = wd.filter((d) => !d.isBufferDay).flatMap((d) => d.tasks || []);
        const done = tasks.filter((t) => isDone(t.status)).length;
        const collapsed = collapsedWeeks[w];

        return (
          <Frame as="section" className="week-card" key={w} aria-labelledby={`week-${w}`}>
            <button
              className={`week-head week-head-toggle ${collapsed ? "week-head-collapsed" : ""}`}
              onClick={() => toggleWeek(w)}
              aria-expanded={!collapsed}
              aria-controls={`week-body-${w}`}
            >
              <div className="week-head-left">
                <h3 id={`week-${w}`}>Week {w + 1}</h3>
                <span className="muted week-date-range">{formatDate(first, { day: "numeric", month: "short" })} – {formatDate(last, { day: "numeric", month: "short" })}</span>
              </div>
              <div className="week-head-right">
                {tasks.length > 0 && <span className="week-progress-text muted">{done}/{tasks.length} tasks</span>}
                <ChevronDown size={16} className="week-chevron" aria-hidden="true" />
              </div>
            </button>
            {tasks.length > 0 && !collapsed && (
              <div className="week-progress-bar">
                <ProgressBar value={done} max={tasks.length} label={`${done}/${tasks.length} tasks`} />
              </div>
            )}

            <div id={`week-body-${w}`} className={`week-body ${collapsed ? "week-body-hidden" : ""}`}>
              {wd.map((day) => {
                const info = describeDay(day, today, topicMap);
                const shown = (day.tasks || []).filter((t) => trackFilter === "all" || t.track === trackFilter);
                return (
                  <React.Fragment key={day.dayNumber}>
                    {firstPractice && day.dayNumber === firstPractice.dayNumber && (
                      <div className="phase-divider" role="separator">
                        <Swords size={16} aria-hidden="true" /> Practice phase begins
                      </div>
                    )}
                    <article className={`day-row day-${info.state} ${day.date === today ? "day-today" : ""}`} aria-label={`Day ${day.dayNumber}`}>
                      <div className="day-row-head">
                        <strong>Day {day.dayNumber}</strong>
                        <span className="muted">{formatDate(day.date)}</span>
                        {day.date === today && <span className="pill pill-core">Today</span>}
                        {info.state === "missed" && <span className="pill pill-warn"><Anchor size={11} aria-hidden="true" /> Missed</span>}
                        {info.kind === "rest" && <span className="pill pill-plain"><Coffee size={11} aria-hidden="true" /> Catch-up day</span>}
                        {info.kind === "practice" && <span className="pill pill-gold"><Dumbbell size={11} aria-hidden="true" /> Practice</span>}
                      </div>
                      {info.kind === "practice" && <PracticePlanCard plan={day.practicePlan} />}
                      <div className="day-tasks">
                        {shown.map((t) => {
                          const key = `${day.dayNumber}::${t.id}`;
                          return <TaskRow key={key} day={day} task={t} topicName={topicMap.get(t.topicId)?.name} onLearn={onLearn} onToggle={onToggle} compact />;
                        })}
                      </div>
                      {info.kind === "rest" && <p className="muted">No new tasks. Use today to catch up.</p>}
                    </article>
                  </React.Fragment>
                );
              })}
            </div>
          </Frame>
        );
      })}
    </div>
  );
}
