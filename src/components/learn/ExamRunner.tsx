import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  Play,
  Trophy,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Question = {
  type: "multiple-choice" | "true-false" | "short-answer";
  question: string;
  options?: string[];
  answer?: string;
  points?: number;
  explanation?: string;
};

type Phase = "intro" | "running" | "done";

const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

function QuestionCard({
  question,
  index,
  total,
  selected,
  onSelect,
}: {
  question: Question;
  index: number;
  total: number;
  selected: string;
  onSelect: (v: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-card p-6">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-semibold uppercase tracking-wider text-lime-400/80">
          Question {index + 1} of {total}
        </span>
        <span className="rounded-full bg-white/5 px-2 py-0.5 font-medium">
          {question.points ?? 1} pt
        </span>
      </div>
      <h3 className="font-display mt-3 text-lg font-semibold leading-snug">
        {question.question}
      </h3>

      {question.type === "true-false" ? (
        <div className="mt-5 grid grid-cols-2 gap-3">
          {["True", "False"].map((opt) => (
            <OptionButton
              key={opt}
              label={opt}
              selected={selected === opt}
              onSelect={() => onSelect(opt)}
            />
          ))}
        </div>
      ) : question.type === "multiple-choice" ? (
        <div className="mt-5 space-y-2.5">
          {(question.options ?? []).map((opt, i) => (
            <OptionButton
              key={i}
              label={`${String.fromCharCode(65 + i)}. ${opt}`}
              value={opt}
              selected={selected === opt}
              onSelect={() => onSelect(opt)}
            />
          ))}
        </div>
      ) : (
        <textarea
          value={selected}
          onChange={(e) => onSelect(e.target.value)}
          placeholder="Type your answer… (a tutor may review this)"
          rows={4}
          className="mt-5 w-full rounded-xl border border-white/10 bg-black/20 p-3.5 text-sm outline-none focus:border-lime-400/50"
        />
      )}
    </div>
  );
}

function OptionButton({
  label,
  value,
  selected,
  onSelect,
}: {
  label: string;
  value?: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full rounded-xl border px-4 py-3 text-left text-sm transition-all",
        selected
          ? "border-lime-400/60 bg-lime-400/12 text-lime-200"
          : "border-white/10 bg-black/20 text-foreground hover:border-white/25",
      )}
    >
      {label}
    </button>
  );
}

export type ExamData = {
  _id: string;
  courseId: string;
  title: string;
  description: string;
  timeLimitMinutes: number;
  questions: Question[];
  passPercent: number;
  totalMarks: number;
};

type ExamResult = {
  score: number;
  totalMarks: number;
  percent: number;
  passed: boolean;
  timeTaken: number;
};

export function ExamRunner({
  exam,
  onExit,
  onResult,
  allowRetry = true,
}: {
  exam: ExamData;
  onExit: () => void;
  /** Hide the retry button after a passed final exam. */
  allowRetry?: boolean;
  onResult?: (result: ExamResult) => void;
}) {
  const submitExam = useMutation(api.exams.submitFinalExam);

  const [phase, setPhase] = useState<Phase>("intro");
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [secondsLeft, setSecondsLeft] = useState(exam.timeLimitMinutes * 60);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ExamResult | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finishRef = useRef<((manual: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    if (phase !== "running") return;
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase]);

  useEffect(() => {
    if (phase === "running" && secondsLeft <= 0 && !submitting) {
      void finishRef.current?.(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, phase, submitting]);

  const timeTaken = exam.timeLimitMinutes * 60 - secondsLeft;

  const finish = async (manual: boolean) => {
    if (submitting) return;
    setSubmitting(true);
    const answerList = Object.entries(answers).map(([i, a]) => ({
      questionIndex: Number(i),
      answer: a,
    }));

    // Local grading for immediate feedback; server is the source of truth.
    let score = 0;
    let gradedMax = 0;
    let pending = false;
    for (let i = 0; i < exam.questions.length; i++) {
      const q = exam.questions[i];
      const points = q.points ?? 1;
      if (q.type === "short-answer") {
        pending = true;
        continue;
      }
      gradedMax += points;
      const given = normalize(answers[i] ?? "");
      if (given && given === normalize(q.answer ?? "")) {
        score += points;
      }
    }

    const pct =
      gradedMax > 0
        ? Math.round((score / gradedMax) * 100)
        : 0;
    const passed =
      gradedMax > 0 && pct >= exam.passPercent;
    const time = manual ? timeTaken : exam.timeLimitMinutes * 60;

    const local: ExamResult = {
      score,
      totalMarks: exam.totalMarks,
      percent: pct,
      passed,
      timeTaken: time,
    };

    setResult(local);
    setPhase("done");
    onResult?.(local);

    try {
      const server = await submitExam({
        examId: exam._id as never,
        answers: answerList,
        timeTakenSeconds: time,
      });
      if (server) {
        const updated: ExamResult = {
          score: server.score,
          totalMarks: server.totalMarks ?? exam.totalMarks,
          percent: server.percent,
          passed: server.passed,
          timeTaken: time,
        };
        setResult(updated);
        onResult?.(updated);
      }
    } catch {
      // result already shown locally
    }
    setSubmitting(false);
  };

  finishRef.current = finish;

  const unanswered = useMemo(
    () => exam.questions.filter((q, i) => !answers[i]).length,
    [answers, exam.questions],
  );

  if (phase === "intro") {
    return (
      <div className="rounded-3xl border border-white/10 bg-card p-8 text-center sm:p-10">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-lime-400/15 text-lime-300">
          <Trophy className="size-7" />
        </span>
        <h3 className="font-display mt-5 text-2xl font-bold">{exam.title}</h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          {exam.description}
        </p>
        <div className="mx-auto mt-6 grid max-w-sm grid-cols-5 gap-3 text-center">
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="font-display text-xl font-bold">
              {exam.questions.length}
            </p>
            <p className="text-[11px] text-muted-foreground">Questions</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="font-display text-xl font-bold">{exam.totalMarks}</p>
            <p className="text-[11px] text-muted-foreground">Marks</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="font-display text-xl font-bold">{exam.passPercent}%</p>
            <p className="text-[11px] text-muted-foreground">To pass</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 col-span-2 p-3">
            <p className="font-display text-xl font-bold">{exam.timeLimitMinutes} min</p>
            <p className="text-[11px] text-muted-foreground">Time limit</p>
          </div>
        </div>
        <p className="mt-5 text-xs text-muted-foreground">
          Multiple choice and true/false are auto-graded. Short answers may be reviewed
          before the result is final.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button variant="outline" onClick={onExit}>
            Cancel
          </Button>
          <Button
            className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300"
            onClick={() => {
              setSecondsLeft(exam.timeLimitMinutes * 60);
              setPhase("running");
            }}
          >
            <Play className="size-4" /> Start exam
          </Button>
        </div>
      </div>
    );
  }

  if (phase === "done" && result) {
    return (
      <div className="rounded-3xl border border-white/10 bg-card p-8 text-center sm:p-10">
        <span
          className={cn(
            "mx-auto flex size-16 items-center justify-center rounded-full",
            result.passed ? "bg-lime-400/15 text-lime-300" : "bg-amber-400/12 text-amber-300",
          )}
        >
          {result.passed ? (
            <CheckCircle2 className="size-8" />
          ) : (
            <AlertCircle className="size-8" />
          )}
        </span>
        <h3 className="font-display mt-5 text-2xl font-bold">
          {result.passed ? "Exam passed!" : "Keep studying"}
        </h3>
        <p className="mt-2 text-muted-foreground">
          You scored{" "}
          <span className="font-display text-2xl font-bold text-lime-300">
            {result.score}/{result.totalMarks}
          </span>{" "}
          ({result.percent}%)
        </p>
        {!result.passed && (
          <p className="mx-auto mt-3 max-w-md text-xs text-muted-foreground">
            Pass mark is {exam.passPercent}%. Review the lessons and try again when
            you're ready.
          </p>
        )}
        <div className="mx-auto mt-6 max-w-lg space-y-3 text-left">
          {exam.questions.map((q, i) => {
            const given = answers[i];
            const isAuto = q.type !== "short-answer";
            const correct =
              isAuto && normalize(given ?? "") === normalize(q.answer ?? "");
            return (
              <div
                key={i}
                className={cn(
                  "rounded-xl border p-4",
                  isAuto
                    ? correct
                      ? "border-lime-400/25 bg-lime-400/5"
                      : "border-rose-400/20 bg-rose-400/5"
                    : "border-white/10 bg-black/20",
                )}
              >
                <div className="flex items-start gap-2.5">
                  {isAuto ? (
                    correct ? (
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-lime-400" />
                    ) : (
                      <XCircle className="mt-0.5 size-4 shrink-0 text-rose-400" />
                    )
                  ) : (
                    <Clock className="mt-0.5 size-4 shrink-0 text-amber-300" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{q.question}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {isAuto
                        ? given
                          ? `Your answer: ${given}`
                          : "No answer"
                        : given
                          ? `Your answer: ${given} (may be reviewed)`
                          : "No answer submitted"}
                    </p>
                    {isAuto && !correct && q.answer && (
                      <p className="mt-0.5 text-xs text-lime-300">
                        Correct answer: {q.answer}
                      </p>
                    )}
                    {q.explanation && (
                      <p className="mt-1 text-xs text-muted-foreground">{q.explanation}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-7 flex justify-center gap-3">
          <Button variant="outline" onClick={onExit}>
            Back to course
          </Button>
          {allowRetry && (
            <Button
              className="bg-lime-400 font-semibold text-black hover:bg-lime-300"
              onClick={() => {
                setAnswers({});
                setResult(null);
                setCurrent(0);
                setSecondsLeft(exam.timeLimitMinutes * 60);
                setPhase("running");
              }}
            >
              Retry exam
            </Button>
          )}
        </div>
      </div>
    );
  }

  const q = exam.questions[current];

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-display text-lg font-bold">{exam.title}</h3>
          <p className="text-xs text-muted-foreground">
            {unanswered > 0
              ? `${unanswered} question${unanswered > 1 ? "s" : ""} left unanswered`
              : "All questions answered"}
          </p>
        </div>
        <span
          className={cn(
            "inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-sm font-bold",
            secondsLeft < 60
              ? "border-rose-400/40 bg-rose-400/10 text-rose-300"
              : "border-lime-400/30 bg-lime-400/10 text-lime-300",
          )}
        >
          <Clock className="size-4" />
          {Math.floor(secondsLeft / 60)}:
          {String(Math.max(0, secondsLeft) % 60).padStart(2, "0")}
        </span>
      </div>

      <QuestionCard
        question={q}
        index={current}
        total={exam.questions.length}
        selected={answers[current] ?? ""}
        onSelect={(v) => setAnswers((a) => ({ ...a, [current]: v }))}
      />

      <div className="mt-4 flex flex-wrap gap-1.5">
        {exam.questions.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={cn(
              "h-2 rounded-full transition-all",
              i === current
                ? "w-6 bg-lime-400"
                : answers[i] !== undefined
                  ? "w-2 bg-lime-400/40"
                  : "w-2 bg-white/15",
            )}
          />
        ))}
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          disabled={current === 0}
          onClick={() => setCurrent((c) => c - 1)}
        >
          <Clock className="mr-1 size-4" /> Previous
        </Button>
        <div className="flex gap-2">
          {current < exam.questions.length - 1 ? (
            <Button onClick={() => setCurrent((c) => c + 1)}>
              Next <Clock className="ml-1 size-4" />
            </Button>
          ) : (
            <Button
              onClick={() => void finish(true)}
              disabled={submitting}
              className="bg-lime-400 font-semibold text-black hover:bg-lime-300"
            >
              {submitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Submit exam"
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
