"use client";

import { useMemo, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { assetPath } from "../lib/asset-path";

type CollegeRecord = {
  city: string;
  name: string;
  state: string;
};

let collegeDirectoryPromise: Promise<CollegeRecord[]> | null = null;

/** The 330 KB directory is fetched once, lazily, and only on first focus. */
function loadCollegeDirectory() {
  collegeDirectoryPromise ??= fetch(assetPath("/data/us-colleges.json"))
    .then((response) => {
      if (!response.ok) throw new Error("College directory could not be loaded.");
      return response.json() as Promise<CollegeRecord[]>;
    })
    .catch((error) => {
      collegeDirectoryPromise = null;
      throw error;
    });
  return collegeDirectoryPromise;
}

export type SchoolAutocompleteProps = {
  entryId: string;
  onChange: (value: string) => void;
  value: string;
};

export function SchoolAutocomplete({ entryId, onChange, value }: SchoolAutocompleteProps) {
  const [colleges, setColleges] = useState<CollegeRecord[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const listId = `school-options-${entryId}`;
  const query = value.trim().toLocaleLowerCase();

  const suggestions = useMemo(() => {
    if (query.length < 2) return [];
    const prefix: CollegeRecord[] = [];
    const contains: CollegeRecord[] = [];
    for (const college of colleges) {
      const name = college.name.toLocaleLowerCase();
      const location = `${college.city} ${college.state}`.toLocaleLowerCase();
      if (name.startsWith(query)) prefix.push(college);
      else if (name.includes(query) || location.includes(query)) contains.push(college);
      if (prefix.length + contains.length >= 24) break;
    }
    return [...prefix, ...contains].slice(0, 8);
  }, [colleges, query]);

  const openDirectory = () => {
    setIsOpen(true);
    if (colleges.length || isLoading) return;
    setIsLoading(true);
    setLoadFailed(false);
    loadCollegeDirectory()
      .then(setColleges)
      .catch(() => setLoadFailed(true))
      .finally(() => setIsLoading(false));
  };

  const chooseCollege = (college: CollegeRecord) => {
    onChange(college.name);
    setIsOpen(false);
    setActiveIndex(0);
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setIsOpen(false);
      return;
    }
    if (!suggestions.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((current) => (current + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((current) => (current - 1 + suggestions.length) % suggestions.length);
    } else if (event.key === "Enter" && isOpen) {
      event.preventDefault();
      chooseCollege(suggestions[activeIndex] || suggestions[0]);
    }
  };

  const showMenu = isOpen && query.length >= 2;
  const activeOptionId = showMenu && suggestions.length ? `${listId}-${activeIndex}` : undefined;

  return (
    <div
      className="school-autocomplete"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsOpen(false);
      }}
    >
      <label className="field">
        <span>School</span>
        <input
          aria-activedescendant={activeOptionId}
          aria-autocomplete="list"
          aria-controls={showMenu ? listId : undefined}
          aria-expanded={showMenu}
          autoComplete="off"
          onChange={(event) => {
            onChange(event.target.value);
            setActiveIndex(0);
            openDirectory();
          }}
          onFocus={openDirectory}
          onKeyDown={handleKeyDown}
          placeholder="Start typing a U.S. college"
          role="combobox"
          value={value}
        />
      </label>
      {showMenu && (
        <div className="school-suggestion-menu">
          {isLoading ? (
            <p className="school-suggestion-status">Loading colleges…</p>
          ) : loadFailed ? (
            <p className="school-suggestion-status">Suggestions are unavailable. You can still type any school.</p>
          ) : suggestions.length ? (
            <ul id={listId} role="listbox">
              {suggestions.map((college, index) => (
                <li
                  aria-selected={index === activeIndex}
                  className={index === activeIndex ? "active" : ""}
                  id={`${listId}-${index}`}
                  key={`${college.name}-${college.city}-${college.state}`}
                  role="option"
                >
                  <button
                    onClick={() => chooseCollege(college)}
                    onMouseDown={(event) => event.preventDefault()}
                    tabIndex={-1}
                    type="button"
                  >
                    <strong>{college.name}</strong>
                    <span>{[college.city, college.state].filter(Boolean).join(", ")}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="school-suggestion-status">No matching U.S. college. You can keep your custom entry.</p>
          )}
          <p className="school-directory-credit">U.S. Department of Education · IPEDS</p>
        </div>
      )}
      <p aria-live="polite" className="sr-only">
        {showMenu && !isLoading ? `${suggestions.length} school suggestions available.` : ""}
      </p>
    </div>
  );
}
