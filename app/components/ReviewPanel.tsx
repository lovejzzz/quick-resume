"use client";

import { useMemo } from "react";
import { analyseJobMatch, resumeCorpus } from "../lib/ats";
import { summariseReview } from "../lib/coach";
import { buildPreflight, type PreflightTarget } from "../lib/preflight";
import type { ResumeData, ResumeStyle } from "../lib/resume-model";

export type ReviewPanelProps = {
  data: ResumeData;
  jobDescription: string;
  onJobDescriptionChange: (value: string) => void;
  onNavigate: (target: PreflightTarget) => void;
  pageCount: number;
  style: ResumeStyle;
};

export function ReviewPanel({
  data,
  jobDescription,
  onJobDescriptionChange,
  onNavigate,
  pageCount,
  style,
}: ReviewPanelProps) {
  const match = useMemo(
    () => (jobDescription.trim() ? analyseJobMatch(jobDescription, data) : null),
    [data, jobDescription],
  );
  const review = useMemo(() => summariseReview(data), [data]);
  const preflight = useMemo(() => buildPreflight(data, style, pageCount), [data, pageCount, style]);
  const groupedFindings = useMemo(() => {
    const groups = new Map<string, typeof review.findings>();
    for (const finding of review.findings) {
      const key = `${finding.sectionTitle} — ${finding.entryHeading}`;
      const bucket = groups.get(key) ?? [];
      bucket.push(finding);
      groups.set(key, bucket);
    }
    return [...groups.entries()];
  }, [review]);
  const warnings = preflight.filter((item) => item.level === "warning").length;

  return (
    <section className="panel-block review-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Check</p>
          <h2>Ready to apply?</h2>
        </div>
        <span className={`preflight-count${warnings ? " has-warnings" : ""}`}>
          {warnings ? `${warnings} to review` : "Ready"}
        </span>
      </div>

      <div className="preflight-card">
        <ul className="preflight-list">
          {preflight.map((item) => (
            <li className={`preflight-item tone-${item.level}`} key={item.id}>
              <span aria-hidden="true" className="preflight-icon">
                {item.level === "pass" ? "✓" : "!"}
              </span>
              <div>
                <strong>{item.title}</strong>
                <small>{item.detail}</small>
              </div>
              <button onClick={() => onNavigate(item.target)} type="button">
                Open
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="job-match-card">
        <label className="field">
          <span>
            Job description <small>Paste the posting to check prominent terms</small>
          </span>
          <textarea
            onChange={(event) => onJobDescriptionChange(event.target.value)}
            placeholder="Paste the full job posting here. It stays in this editing session."
            rows={6}
            value={jobDescription}
          />
        </label>

        {match && match.totalTerms > 0 && (
          <>
            <div className="match-score">
              <div
                aria-label={`Keyword coverage ${match.score} percent`}
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={match.score}
                className="match-meter"
                role="progressbar"
                style={{ ["--match" as string]: `${match.score}%` }}
              >
                <span />
              </div>
              <div>
                <strong>{match.score}% keyword coverage</strong>
                <small>{match.matched.length} of {match.totalTerms} prominent terms appear</small>
              </div>
            </div>
            {match.missing.length > 0 && (
              <div className="keyword-group">
                <h3>Missing from your resume</h3>
                <ul className="keyword-list">
                  {match.missing.map((hit) => (
                    <li className="keyword missing" key={hit.term}>
                      {hit.term}{hit.count > 1 && <em>×{hit.count}</em>}
                    </li>
                  ))}
                </ul>
                <p className="keyword-note">
                  Add a term only when it is genuinely true of your experience.
                </p>
              </div>
            )}
            {match.matched.length > 0 && (
              <div className="keyword-group">
                <h3>Already covered</h3>
                <ul className="keyword-list">
                  {match.matched.map((hit) => <li className="keyword matched" key={hit.term}>{hit.term}</li>)}
                </ul>
              </div>
            )}
          </>
        )}
        {jobDescription.trim() && match?.totalTerms === 0 && (
          <p className="import-message">Not enough distinctive words in that text to analyse.</p>
        )}
      </div>

      <div className="coach-card">
        <div className="coach-summary">
          <div><strong>{review.bulletsChecked}</strong><small>bullets checked</small></div>
          <div><strong>{review.bulletsWithMetrics}</strong><small>contain a number</small></div>
          <div><strong>{review.findings.length}</strong><small>suggestions</small></div>
        </div>
        {groupedFindings.length === 0 ? (
          <p className="coach-clear">
            {review.bulletsChecked
              ? "No common bullet-writing issues found."
              : "Add experience bullets and they will be checked here."}
          </p>
        ) : (
          <div aria-label="Writing suggestions" className="coach-findings" role="region" tabIndex={0}>
            {groupedFindings.map(([heading, findings]) => (
              <div className="coach-group" key={heading}>
                <h3>{heading}</h3>
                <ul>
                  {findings.map((finding) => (
                    <li className={`coach-finding tone-${finding.severity}`} key={finding.id}>
                      <p className="coach-text">
                        {finding.bulletIndex === null ? "Details" : `Bullet ${finding.bulletIndex + 1}`}: “
                        {finding.text.slice(0, 90)}{finding.text.length > 90 ? "…" : ""}”
                      </p>
                      <p className="coach-message">{finding.message}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
        <p className="fine-print">These are conventions, not rules. Ignore anything that does not fit your field.</p>
      </div>

      <details className="ats-preview">
        <summary>Preview the text an ATS can read</summary>
        <pre>{resumeCorpus(data)}</pre>
      </details>
    </section>
  );
}
