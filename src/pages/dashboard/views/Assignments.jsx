import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../../lib/supabase";

const API = import.meta.env.VITE_API_BASE_URL.replace(/\/$/, "");

// ─── Success Modal ────────────────────────────────────────────────────────────
const SuccessModal = ({ score, total, onClose }) => {
  const pct   = Math.round((score / total) * 100);
  const color = pct >= 75 ? "#3B6D11" : pct >= 50 ? "#854F0B" : "#A32D2D";
  const bg    = pct >= 75 ? "#EAF3DE" : pct >= 50 ? "#FAEEDA" : "#FCEBEB";
  const grade =
    pct >= 90 ? "Excellent!" : pct >= 75 ? "Well done!" : pct >= 50 ? "Good effort!" : "Keep practicing!";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.45)" }}>
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden"
        style={{ animation: "popIn 0.35s cubic-bezier(0.34,1.56,0.64,1)" }}
      >
        <div className="h-1.5 w-full" style={{ background: color }} />
        <div className="p-8 text-center">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5" style={{ background: bg }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-1">Assessment submitted!</h2>
          <p className="text-sm text-slate-500 mb-6">You have successfully completed this assessment.</p>
          <div className="rounded-2xl p-5 mb-4" style={{ background: bg }}>
            <p className="text-4xl font-bold mb-1" style={{ color }}>
              {score}
              <span className="text-2xl font-normal text-slate-400"> / {total}</span>
            </p>
            <p className="text-sm font-medium" style={{ color }}>{pct}% · {grade}</p>
          </div>
          <p className="text-xs text-slate-400 mb-5">Close to review the answer key for this assessment.</p>
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl font-medium text-white text-sm transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ background: color }}
          >
            Review answer key →
          </button>
        </div>
      </div>
      <style>{`
        @keyframes popIn {
          0%   { opacity: 0; transform: scale(0.85) translateY(20px); }
          100% { opacity: 1; transform: scale(1)    translateY(0); }
        }
      `}</style>
    </div>
  );
};

// ─── Radio Option ─────────────────────────────────────────────────────────────
const RadioOption = ({ opt, label, state, disabled, onClick }) => {
  const styles = {
    default:  { border: "1.5px solid #e2e8f0", bg: "#ffffff", text: "#334155" },
    selected: { border: "1.5px solid #3b82f6", bg: "#eff6ff", text: "#1e40af" },
    correct:  { border: "1.5px solid #22c55e", bg: "#f0fdf4", text: "#15803d" },
    wrong:    { border: "1.5px solid #ef4444", bg: "#fef2f2", text: "#b91c1c" },
  };
  const s = styles[state] || styles.default;

  return (
    <div
      onClick={disabled ? undefined : onClick}
      className={`flex items-center gap-4 px-4 py-3.5 rounded-xl mb-2.5 transition-all duration-150 select-none ${
        disabled ? "cursor-default" : "cursor-pointer hover:scale-[1.005]"
      }`}
      style={{ border: s.border, background: s.bg }}
    >
      <div className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center" style={{ border: `2px solid ${s.text}` }}>
        {(state === "selected" || state === "correct" || state === "wrong") && (
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: s.text }} />
        )}
      </div>
      <span className="flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-xs font-semibold" style={{ background: s.text + "18", color: s.text }}>
        {opt}
      </span>
      <span className="text-sm leading-snug" style={{ color: s.text }}>{label}</span>
      {state === "correct" && (
        <span className="ml-auto text-green-600">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
        </span>
      )}
      {state === "wrong" && (
        <span className="ml-auto text-red-500">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </span>
      )}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const Assignments = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [student, setStudent]               = useState(null);
  const [studentLoading, setStudentLoading] = useState(true);
  const [listLoading, setListLoading]       = useState(false);
  const [attemptLoading, setAttemptLoading] = useState(false);

  const [assignments, setAssignments]       = useState([]);
  const [questions, setQuestions]           = useState([]);
  const [answers, setAnswers]               = useState({});
  const [result, setResult]                 = useState(null);
  const [attempt, setAttempt]               = useState(null);
  const [semesterFilter, setSemesterFilter] = useState("All Semesters");
  const [searchTerm, setSearchTerm]         = useState("");
  const [showModal, setShowModal]           = useState(false);
  const [showAnswerKey, setShowAnswerKey]   = useState(false);

  // ── 1. Load student once ──────────────────────────────────────────
  useEffect(() => {
    const loadUser = async () => {
      setStudentLoading(true);
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (!authData?.user) return;
        const { data: studentData } = await supabase
          .from("students")
          .select("*")
          .eq("id", authData.user.id)
          .maybeSingle();
        if (studentData) setStudent(studentData);
      } finally {
        setStudentLoading(false);
      }
    };
    loadUser();
  }, []);

  // ── 2. Set default semester filter from student profile ──────────
  useEffect(() => {
    if (!student?.year) return;
    const currentSemester =
      Number(student.year) === 1 ? "1st Year" : `${student.year}-${student.semester}`;
    setSemesterFilter(currentSemester);
  }, [student]);

  // ── 3. Load assignments list — runs on mount AND when returning from quiz ──
  const loadAssignments = useCallback(async (studentId) => {
    if (!studentId) return;
    setListLoading(true);
    try {
      const res  = await fetch(`${API}/assignments/${studentId}`);
      const data = await res.json();
      setAssignments(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("loadAssignments error:", err);
      setAssignments([]);
    } finally {
      setListLoading(false);
    }
  }, []);

  // Fetch list when: student is ready OR when we return to list (id goes away)
  useEffect(() => {
    if (!student?.id) return;
    if (!id) {
      // On list page — always re-fetch so completed status is up-to-date
      loadAssignments(student.id);
    }
  }, [student?.id, id, loadAssignments]);

  // ── 4. Load quiz ──────────────────────────────────────────────────
  useEffect(() => {
    if (!id || !student?.id) return;

    const loadData = async () => {
      setQuestions([]);
      setAnswers({});
      setResult(null);
      setAttempt(null);
      setShowAnswerKey(false);
      setAttemptLoading(true);

      try {
        const [qRes, aRes] = await Promise.all([
          fetch(`${API}/assessment/${id}`),
          fetch(`${API}/attempt/${id}/${student.id}`),
        ]);
        const qData = await qRes.json();
        const aData = await aRes.json();

        if (Array.isArray(qData)) {
          setQuestions(
            qData
              .filter((q) => q && q.question)
              .map((q, index) => ({
                ...q,
                id:      String(q.id ?? index + 1).trim(),
                order:   index + 1,
                correct: q.correct?.toString().trim().toUpperCase() || "",
              }))
          );
        }

        // aData is non-empty when the student already submitted
        if (aData && typeof aData === "object" && Object.keys(aData).length > 0 && !aData.detail) {
          setAttempt(aData);
          setAnswers(aData.answers_json || {});
          setResult({
            score:          aData.score,
            total:          aData.total,
            correctAnswers: aData.correctAnswers || aData.correct_answers || {},
          });
          setShowAnswerKey(true);
        }
      } catch (err) {
        console.error("loadData error:", err);
      } finally {
        setAttemptLoading(false);
      }
    };

    loadData();
  }, [id, student?.id]);

  // ── Handlers ──────────────────────────────────────────────────────
  const handleSelect = (qid, option) => {
    if (attempt || showAnswerKey) return;
    setAnswers((prev) => ({ ...prev, [qid]: option }));
  };

  const handleSubmit = async () => {
    if (!student) return;
    const unanswered = questions.filter((q) => !answers[q.id]);
    if (unanswered.length > 0) {
      alert(`Please answer all questions. ${unanswered.length} remaining.`);
      return;
    }
    try {
      const normalizedAnswers = {};
      Object.keys(answers).forEach((key) => {
        normalizedAnswers[String(key).trim()] = String(answers[key]).trim().toUpperCase();
      });
      const res = await fetch(`${API}/submit/${id}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ student_id: student.id, answers: normalizedAnswers }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.detail || "Submission failed"); return; }

      setAttempt({
        answers_json:    normalizedAnswers,
        score:           data.score,
        total:           data.total,
        correct_answers: data.correctAnswers,
      });
      setResult({
        score:          data.score,
        total:          data.total,
        correctAnswers: data.correctAnswers,
      });
      setShowModal(true);
    } catch (err) {
      console.error("SUBMIT ERROR:", err);
      alert("Something went wrong while submitting.");
    }
  };

  // Close modal → stay on page, show answer key
  const handleModalClose = () => {
    setShowModal(false);
    setShowAnswerKey(true);
  };

  // Navigate back to list — refresh assignments so completed status shows
  const handleBackToList = () => {
    navigate("/dashboard/assignments");
  };

  // ── Option state ──────────────────────────────────────────────────
  const getOptionState = (q, opt) => {
    const userAns = answers[q.id];
    const correct = result?.correctAnswers?.[String(q.id).trim()];
    if ((attempt || showAnswerKey) && correct) {
      if (correct === opt)                        return "correct";
      if (userAns === opt && userAns !== correct) return "wrong";
      return "default";
    }
    return userAns === opt ? "selected" : "default";
  };

  // ── Progress ──────────────────────────────────────────────────────
  const answeredCount = questions.filter((q) => answers[q.id]).length;
  const progressPct   = questions.length ? (answeredCount / questions.length) * 100 : 0;

  // ── Filtered assignments ──────────────────────────────────────────
  const filteredAssignments = assignments.filter((a) => {
    const searchMatch =
      !searchTerm ||
      a.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.subject?.toLowerCase().includes(searchTerm.toLowerCase());

    if (!searchMatch) return false;
    if (semesterFilter === "All Semesters") return true;

    if (semesterFilter === "1st Year") {
      return Number(a.year) === 1;
    }
    const parts = semesterFilter.split("-");
    if (parts.length === 2) {
      const filterYear = Number(parts[0]);
      const filterSem  = Number(parts[1]);
      return Number(a.year) === filterYear && Number(a.semester) === filterSem;
    }
    return true;
  });

  // ═══════════════════════════════════════════════════════════════════
  // LOADING: waiting for student profile
  // ═══════════════════════════════════════════════════════════════════
  if (studentLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Loading…</p>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // LIST VIEW  (no :id in URL)
  // ═══════════════════════════════════════════════════════════════════
  if (!id) {
    return (
      <div className="p-6 max-w-6xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-1">Assignments</h1>
          <p className="text-slate-500">View and attempt your semester assessments.</p>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-3 mb-8">
          <div className="flex-1 relative">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              type="text"
              placeholder="Search by title or subject…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 border border-slate-200 rounded-2xl bg-white outline-none focus:ring-2 focus:ring-blue-400 text-sm"
            />
          </div>
          <select
            value={semesterFilter}
            onChange={(e) => setSemesterFilter(e.target.value)}
            className="border border-slate-200 rounded-2xl px-4 py-3 bg-white outline-none focus:ring-2 focus:ring-blue-400 text-sm"
          >
            <option value="All Semesters">All Semesters</option>
            <option value="1st Year">1st Year</option>
            <option value="2-1">2-1</option>
            <option value="2-2">2-2</option>
            <option value="3-1">3-1</option>
            <option value="3-2">3-2</option>
            <option value="4-1">4-1</option>
            <option value="4-2">4-2</option>
          </select>
        </div>

        {/* Cards */}
        {listLoading ? (
          <div className="flex items-center justify-center h-48">
            <div className="text-center">
              <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-slate-500 text-sm">Loading assignments…</p>
            </div>
          </div>
        ) : filteredAssignments.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
            </svg>
            <p className="text-sm">No assignments found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredAssignments.map((a) => {
              const isCompleted = !!a.attempt;
              return (
                <div
                  key={a.id}
                  onClick={() => { if (!isCompleted) navigate(`/dashboard/assignments/${a.id}`); }}
                  className={`group bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden transition-all duration-200 ${
                    isCompleted
                      ? "opacity-95 cursor-default"
                      : "hover:shadow-lg hover:-translate-y-1 cursor-pointer"
                  }`}
                >
                  {/* Card header */}
                  <div
                    className="p-5 relative overflow-hidden"
                    style={{
                      background: isCompleted
                        ? "linear-gradient(135deg,#f0fdf4,#dcfce7)"
                        : "linear-gradient(135deg,#eff6ff,#dbeafe)",
                    }}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 text-xl"
                      style={{ background: isCompleted ? "#bbf7d0" : "#bfdbfe" }}
                    >
                      {isCompleted ? "✅" : "📋"}
                    </div>
                    <h3 className="font-semibold text-slate-800 text-base leading-snug line-clamp-2">{a.title}</h3>
                    <p className="text-xs text-slate-500 mt-1">{a.subject}</p>
                  </div>

                  {/* Card body */}
                  <div className="p-5 flex flex-col gap-3">
                    {/* Status badge */}
                    <div className="flex items-center gap-2">
                      {isCompleted ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                          Completed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs font-semibold">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                          Pending
                        </span>
                      )}
                    </div>

                    {/* Score row */}
                    {isCompleted && a.attempt && (
                      <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
                        <span className="text-xs text-slate-500 font-medium">Your score</span>
                        <span className="text-sm font-bold text-slate-800">
                          {a.attempt.score} / {a.attempt.total}
                          <span className="ml-1.5 text-xs font-medium text-slate-500">
                            ({Math.round((a.attempt.score / a.attempt.total) * 100)}%)
                          </span>
                        </span>
                      </div>
                    )}

                    {/* CTA */}
                    {!isCompleted && (
                      <div className="mt-auto flex items-center justify-between pt-2 border-t border-slate-100">
                        <span className="text-sm font-medium text-blue-600 group-hover:text-blue-700">Start assessment</span>
                        <svg className="text-blue-400 group-hover:translate-x-1 transition-transform" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                      </div>
                    )}

                    {isCompleted && (
                      <p className="text-xs text-slate-400 text-center pt-1">Assessment completed · read-only</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // QUIZ VIEW  (:id present)
  // ═══════════════════════════════════════════════════════════════════
  if (attemptLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Loading assessment…</p>
        </div>
      </div>
    );
  }

  if (!questions.length) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
        No questions available for this assessment.
      </div>
    );
  }

  const currentAssignment = assignments.find((a) => String(a.id) === String(id));

  return (
    <>
      {showModal && result && (
        <SuccessModal score={result.score} total={result.total} onClose={handleModalClose} />
      )}

      <div className="max-w-3xl mx-auto px-4 py-8">

        {/* Back */}
        <button
          onClick={handleBackToList}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 mb-6 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          Back to assignments
        </button>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-xs text-slate-400 font-medium uppercase tracking-wider mb-2">
            <span>{currentAssignment?.subject}</span>
            {currentAssignment?.unit && <><span>·</span><span>{currentAssignment.unit}</span></>}
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">
            {currentAssignment?.title || "Assessment"}
          </h1>
          <p className="text-sm text-slate-500 mb-5">
            {attempt || showAnswerKey
              ? "Assessment completed. Your answers are shown below with feedback."
              : "Select one answer per question and submit when done."}
          </p>

          {/* Progress bar */}
          {!attempt && !showAnswerKey && (
            <div>
              <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                <span>{answeredCount} of {questions.length} answered</span>
                <span>{Math.round(progressPct)}%</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all duration-300" style={{ width: `${progressPct}%` }} />
              </div>
            </div>
          )}

          {/* Score banner */}
          {(attempt || showAnswerKey) && result && (
            <div className="flex items-center gap-4 bg-emerald-50 border border-emerald-100 rounded-2xl px-5 py-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-emerald-800">Assessment completed</p>
                <p className="text-xs text-emerald-600 mt-0.5">
                  Score: {result.score} / {result.total} &nbsp;·&nbsp;
                  {Math.round((result.score / result.total) * 100)}%
                </p>
              </div>
              <span className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 text-xs font-semibold">
                Answer key
              </span>
            </div>
          )}
        </div>

        {/* Questions */}
        <div className="space-y-5">
          {questions.map((q, idx) => (
            <div key={q.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-6 pt-5 pb-4 border-b border-slate-50">
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-blue-50 text-blue-600 text-xs font-bold flex items-center justify-center mt-0.5">
                    {idx + 1}
                  </span>
                  <p className="text-sm font-medium text-slate-800 leading-relaxed">{q.question}</p>
                </div>
              </div>
              <div className="px-6 py-4">
                {["A", "B", "C", "D"].map((opt) => {
                  const raw = q[`option_${opt.toLowerCase()}`];
                  if (!raw || raw === "nan" || raw === "undefined" || String(raw).trim() === "") return null;
                  return (
                    <RadioOption
                      key={opt}
                      opt={opt}
                      label={raw}
                      state={getOptionState(q, opt)}
                      disabled={!!(attempt || showAnswerKey)}
                      onClick={() => handleSelect(q.id, opt)}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Submit button */}
        {!attempt && !showAnswerKey && (
          <div className="mt-8 flex items-center justify-between">
            <p className="text-sm text-slate-400">
              {questions.length - answeredCount > 0
                ? `${questions.length - answeredCount} question${questions.length - answeredCount > 1 ? "s" : ""} remaining`
                : "All questions answered — ready to submit!"}
            </p>
            <button
              onClick={handleSubmit}
              disabled={answeredCount < questions.length}
              className={`flex items-center gap-2 px-7 py-3 rounded-xl font-semibold text-sm transition-all duration-150 ${
                answeredCount === questions.length
                  ? "bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow active:scale-[0.98]"
                  : "bg-slate-100 text-slate-400 cursor-not-allowed"
              }`}
            >
              Submit assessment
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </button>
          </div>
        )}

        {/* Done reviewing */}
        {(attempt || showAnswerKey) && (
          <div className="mt-10 flex justify-center">
            <button
              onClick={handleBackToList}
              className="flex items-center gap-2 px-8 py-3 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-semibold text-sm transition-all active:scale-[0.98] shadow-sm"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
              Back to assignments
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default Assignments;