"use client";

import { useMemo, useState } from "react";
import { analyseJobMatch } from "../lib/ats";
import { summariseReview } from "../lib/coach";
import type { ResumeData } from "../lib/resume-model";

export type ReviewPanelProps = {
  data: ResumeData;
};

export function ReviewPanel({ data }: ReviewPanelProps) {
  const [jobDescription, setJobDescription] = useState("");

  const match = useMemo(
    () => (jobDescription.trim() ? analyseJobMatch(jobDescription, data) : null),
    [data, jobDescription],
  );
  const review = useMemo(() => summariseReview(data), [data]);

  const findings = review.findings;
  const groupedFindings = useMemo(() => {
    const groups = new Map<string, typeof findings>();
    for (const finding of findings) {
      const key = `${finding.sectionTitle} — ${finding.entryHeading}`;
      const bucket = groups.get(key) ?? [];
      bucket.push(finding);
      groups.set(key, bucket);
    }
    return [...groups.entries()];
  }, [findings]);

  return (
    <section className="panel-block review-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Review</p>
          <h2>Check before you send</h2>
        </div>
      </div>

      <div className="job-match-card">
        <label className="field">
          <span>
            Job description <small>Paste the posting to see which of its terms are missing</small>
          </span>
          <textarea
            onChange={(event) => setJobDescription(event.target.value)}
            placeholder="Paste the full job posting here. It stays in your browser."
            rows={6}
            value={jobDescription}
          />
        </label>

        {match && match.totalTerms > 0 && (
          <>
            <div className="match-score">
              <div
                aria-label={`Keyword coverage ${match.score} percent`}
                className="match-meter"
                role="img"
                style={{ ["--match" as string]: `${match.score}%` }}
              >
                <span />
              </div>
              <div>
                <strong>{match.score}% keyword coverage</strong>
                <small>
                  {match.matched.length} of {match.totalTerms} prominent terms appear in your resume
                </small>
              </div>
            </div>

            {match.missing.length > 0 && (
              <div className="keyword-group">
                <h3>Missing from your resume</h3>
                <ul className="keyword-list">
                  {match.missing.map((hit) => (
                    <li className="keyword missing" key={hit.term}>
                      {hit.term}
                      {hit.count > 1 && <em>×{hit.count}</em>}
                    </li>
                  ))}
                </ul>
                <p className="keyword-note">
                  Only add a term if it is genuinely true of your experience. Keyword stuffing is obvious to the
                  human who reads the resume next.
                </p>
              </div>
            )}

            {match.matched.length > 0 && (
              <div className="keyword-group">
                <h3>Already covered</h3>
                <ul className="keyword-list">
                  {match.matched.map((hit) => (
                    <li className="keyword matched" key={hit.term}>
                      {hit.term}
                    </li>
                  ))}
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
          <div>
            <strong>{review.bulletsChecked}</strong>
            <small>bullets checked</small>
          </div>
          <div>
            <strong>{review.bulletsWithMetrics}</strong>
            <small>contain a number</small>
          </div>
          <div>
            <strong>{review.warnings}</strong>
            <small>worth fixing</small>
          </div>
        </div>

        {groupedFindings.length === 0 ? (
          <p className="coach-clear">
            {review.bulletsChecked
              ? "No issues found. Bullets lead with an action and most carry a number."
              : "Add some experience bullets and they will be checked here."}
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
                        {finding.bulletIndex === null
                          ? "Details"
                          : `Bullet ${finding.bulletIndex + 1}`}
                        : “{finding.text.slice(0, 90)}
                        {finding.text.length > 90 ? "…" : ""}”
                      </p>
                      <p className="coach-message">{finding.message}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
        <p className="fine-print">
          These are conventions, not rules. Ignore anything that does not fit your field.
        </p>
      </div>
    </section>
  );
}
