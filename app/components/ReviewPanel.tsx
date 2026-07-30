"use client";

import { useMemo } from "react";
import { compareJobTerms, resumeCorpus } from "../lib/ats";
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
  const termComparison = useMemo(
    () => (jobDescription.trim() ? compareJobTerms(jobDescription, data) : null),
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
  const mustFix = preflight.filter(
    (item) => item.category === "required" && item.level === "warning",
  );
  const passedChecks = preflight.filter((item) => item.level === "pass");
  const layoutSuggestions = preflight.filter(
    (item) => item.category === "review" && item.level === "warning",
  );

  return (
    <section className="panel-block review-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Final review</p>
          <h2>Catch problems before export</h2>
        </div>
        <span className={`preflight-count${mustFix.length ? " has-warnings" : ""}`}>
          {mustFix.length ? `${mustFix.length} must fix` : "No blockers"}
        </span>
      </div>
      <p className="review-disclosure">
        Quicky Resume checks mechanical issues and simple writing conventions. It does not use AI
        or judge whether you are qualified for a role.
      </p>

      <div className="preflight-card review-section">
        <div className="review-section-heading">
          <div>
            <p className="review-kicker">Must fix</p>
            <h3>Objective problems</h3>
          </div>
          <span>{mustFix.length}</span>
        </div>
        {mustFix.length ? (
          <ul className="preflight-list">
            {mustFix.map((item) => (
              <li className="preflight-item tone-warning" key={item.id}>
                <span aria-hidden="true" className="preflight-icon">!</span>
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
        ) : (
          <p className="review-clear">No objective problems found.</p>
        )}
        <details className="passed-checks">
          <summary>{passedChecks.length} mechanical checks passed</summary>
          <ul>
            {passedChecks.map((item) => <li key={item.id}>{item.title}</li>)}
          </ul>
        </details>
      </div>

      <div className="coach-card review-section">
        <div className="review-section-heading">
          <div>
            <p className="review-kicker">Worth reviewing</p>
            <h3>Layout and writing suggestions</h3>
          </div>
          <span>{layoutSuggestions.length + review.findings.length}</span>
        </div>
        <p className="review-section-note">
          These are simple rules and common conventions, not judgments about writing quality.
        </p>
        {layoutSuggestions.length > 0 && (
          <ul className="preflight-list">
            {layoutSuggestions.map((item) => (
              <li className="preflight-item tone-review" key={item.id}>
                <span aria-hidden="true" className="preflight-icon">?</span>
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
        )}
        <div className="coach-summary">
          <div><strong>{review.bulletsChecked}</strong><small>bullets reviewed</small></div>
          <div><strong>{review.bulletsWithMetrics}</strong><small>include a number</small></div>
          <div><strong>{review.findings.length}</strong><small>possible improvements</small></div>
        </div>
        {groupedFindings.length === 0 ? (
          <p className="coach-clear">
            {review.bulletsChecked
              ? "No common bullet-writing patterns were flagged."
              : "Add experience bullets to run the writing rules."}
          </p>
        ) : (
          <div aria-label="Rule-based writing suggestions" className="coach-findings" role="region" tabIndex={0}>
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
        <p className="fine-print">Use only suggestions that fit your field and actual experience.</p>
      </div>

      <div className="job-terms-card review-section">
        <div className="review-section-heading">
          <div>
            <p className="review-kicker">Job-posting terms</p>
            <h3>Literal term comparison</h3>
          </div>
          <span>Not a score</span>
        </div>
        <p className="review-section-note">
          This finds selected repeated or distinctive terms in both texts. It does not understand
          your experience or predict job fit.
        </p>
        <label className="field">
          <span>
            Job description <small>Paste a posting to compare its wording</small>
          </span>
          <textarea
            onChange={(event) => onJobDescriptionChange(event.target.value)}
            placeholder="Paste the full job posting here. It stays in this editing session."
            rows={6}
            value={jobDescription}
          />
        </label>

        {termComparison && termComparison.totalTerms > 0 && (
          <>
            <div className="term-comparison-summary" aria-label="Term comparison summary">
              <div>
                <strong>{termComparison.matched.length}</strong>
                <small>appear in the résumé</small>
              </div>
              <div>
                <strong>{termComparison.missing.length}</strong>
                <small>were not found</small>
              </div>
            </div>
            {termComparison.missing.length > 0 && (
              <div className="keyword-group">
                <h3>Not found in the résumé</h3>
                <ul className="keyword-list">
                  {termComparison.missing.map((hit) => (
                    <li className="keyword missing" key={hit.term}>
                      {hit.term}{hit.count > 1 && <em>×{hit.count}</em>}
                    </li>
                  ))}
                </ul>
                <p className="keyword-note">
                  A missing term is not a problem by itself. Add it only when it is accurate.
                </p>
              </div>
            )}
            {termComparison.matched.length > 0 && (
              <div className="keyword-group">
                <h3>Appears in the résumé</h3>
                <ul className="keyword-list">
                  {termComparison.matched.map((hit) => (
                    <li className="keyword matched" key={hit.term}>{hit.term}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
        {jobDescription.trim() && termComparison?.totalTerms === 0 && (
          <p className="import-message">Not enough distinctive wording to compare.</p>
        )}
      </div>

      <details className="ats-preview">
        <summary>ATS-readable text</summary>
        <p>This is the plain text Quicky Resume can extract. Actual hiring systems vary.</p>
        <pre>{resumeCorpus(data)}</pre>
      </details>
    </section>
  );
}
