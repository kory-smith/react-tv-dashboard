import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

// -------------------- Types --------------------

type ViewMode = "day" | "week" | "month";

interface TrendPoint {
  timestamp: number; // unix ms
  score: number;
}

interface Employee {
  id: number;
  name: string;
  scores: {
    day: number;
    week: number;
    month: number;
    trend: TrendPoint[];
  };
}

// -------------------- Mock data helpers --------------------

const NAMES = [
  "Alice",
  "Bob",
  "Charlie",
  "Diana",
  "Ethan",
  "Fiona",
  "George",
  "Hannah",
  "Ian",
  "Julia",
  "Kevin",
  "Laura",
  "Michael",
  "Nancy",
  "Oscar",
  "Patricia",
  "Quincy",
  "Rachel",
  "Steve",
  "Tina",
];

const randomScore = () => Math.floor(Math.random() * 51) + 50; // 50‑100

const now = () => Date.now();

function makeInitialEmployees(): Employee[] {
  return NAMES.map((name, i) => ({
    id: i + 1,
    name,
    scores: {
      day: randomScore(),
      week: randomScore(),
      month: randomScore(),
      trend: Array.from({ length: 30 }, (_, k) => ({
        timestamp: now() - (29 - k) * 3600_000,
        score: randomScore(),
      })),
    },
  }));
}

function bumpScores(prev: Employee[]): Employee[] {
  return prev.map((emp) => {
    const delta = () => (Math.random() < 0.5 ? -1 : 1) * Math.floor(Math.random() * 4);
    const newDay = clamp(emp.scores.day + delta());
    const newWeek = clamp(emp.scores.week + delta());
    const newMonth = clamp(emp.scores.month + delta());
    return {
      ...emp,
      scores: {
        day: newDay,
        week: newWeek,
        month: newMonth,
        trend: [
          ...emp.scores.trend.slice(-29),
          { timestamp: now(), score: newDay },
        ],
      },
    };
  });
}

function clamp(n: number) {
  return Math.max(0, Math.min(100, n));
}

// -------------------- Component --------------------

export default function EmployeePerformanceDashboard() {
  const [view, setView] = useState<ViewMode>("day");
  const [employees, setEmployees] = useState<Employee[]>(makeInitialEmployees);

  // Auto‑refresh every 30 min (use quicker 60s in dev)
  useEffect(() => {
    const interval = setInterval(() => {
      setEmployees((prev) => bumpScores(prev));
    }, 60_000); // change to 1_800_000 for prod
    return () => clearInterval(interval);
  }, []);

  const trendData = (() => {
    // Average trend across employees for the chart
    const pointsMap: Record<number, { total: number; count: number }> = {};
    employees.forEach((e) => {
      e.scores.trend.forEach((pt) => {
        pointsMap[pt.timestamp] = pointsMap[pt.timestamp] || { total: 0, count: 0 };
        pointsMap[pt.timestamp].total += pt.score;
        pointsMap[pt.timestamp].count += 1;
      });
    });
    return Object.entries(pointsMap)
      .map(([ts, { total, count }]) => ({
        ts: Number(ts),
        score: total / count,
      }))
      .sort((a, b) => a.ts - b.ts);
  })();

  const scoreColor = (score: number) =>
    score >= 75 ? "text-green-400" : score >= 60 ? "text-yellow-400" : "text-red-400";

  const bgColor = (score: number) =>
    score >= 75 ? "bg-green-700/50" : score >= 60 ? "bg-yellow-700/50" : "bg-red-700/50";

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8 overflow-hidden">
      <header className="flex items-center gap-4 mb-8">
        <h1 className="text-4xl lg:text-6xl font-bold mr-auto select-none">
          Employee Performance
        </h1>
        <button
          onClick={() => document.documentElement.requestFullscreen()}
          className="px-5 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-xl lg:text-2xl"
        >
          ⛶ Fullscreen
        </button>
      </header>

      {/* View Toggle */}
      <div className="flex gap-4 mb-6">
        {["day", "week", "month"].map((v) => (
          <button
            key={v}
            onClick={() => setView(v as ViewMode)}
            className={`px-6 py-3 rounded-2xl text-xl lg:text-2xl transition-colors ${view === v ? "bg-blue-600" : "bg-slate-800 hover:bg-slate-700"}`}
          >
            {v.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Employee Grid */}
      <section className="grid 2xl:grid-cols-5 xl:grid-cols-4 lg:grid-cols-3 md:grid-cols-2 sm:grid-cols-2 gap-4 mb-12">
        {employees.map((emp) => {
          const score = emp.scores[view];
          return (
            <div
              key={emp.id}
              className={`rounded-3xl p-6 flex flex-col items-center justify-center ${bgColor(score)}`}
            >
              <span className="text-xl lg:text-2xl font-semibold mb-1 select-none">
                {emp.name}
              </span>
              <span
                className={`text-4xl lg:text-5xl font-extrabold ${scoreColor(score)} select-none`}
              >
                {score}
              </span>
              <span className="mt-1 text-base lg:text-lg opacity-70 select-none">
                {view.toUpperCase()}
              </span>
            </div>
          );
        })}
      </section>

      {/* Trend Chart */}
      <h2 className="text-3xl lg:text-4xl font-semibold mb-4 select-none">Average Trend</h2>
      <div className="h-80 w-full bg-slate-800/50 rounded-3xl p-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trendData} margin={{ left: 16, right: 16, top: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis
              dataKey="ts"
              tickFormatter={(ts) => new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              stroke="#aaa"
            />
            <YAxis domain={[0, 100]} stroke="#aaa" />
            <Tooltip
              labelFormatter={(ts) => new Date(Number(ts)).toLocaleString()}
              contentStyle={{ background: "#1e293b", border: "none", borderRadius: "0.75rem" }}
            />
            <Line type="monotone" dataKey="score" stroke="#10b981" strokeWidth={4} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
