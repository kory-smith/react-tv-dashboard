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
import { useLoaderData, useNavigation, useSubmit } from "react-router";
import { db } from "~/lib/db"; // Import db client

// -------------------- Types --------------------

type ViewMode = "day" | "week" | "month";

interface TrendPoint {
  id: number;
  employeeId: number;
  timestamp: string;
  score: number;
}

interface Score {
  id: number;
  employeeId: number;
  day: number;
  week: number;
  month: number;
  updatedAt: string;
}

interface Employee {
  id: number;
  name: string;
  wrongNumbers: number;
  scores: Score;
  trendPoints: TrendPoint[];
}

// -------------------- Component --------------------

// Fetch data directly in the loader
export async function loader() {
  const employees = await db.employee.findMany({
    include: {
      scores: true,
      trendPoints: {
        orderBy: {
          timestamp: "asc",
        },
      },
    },
  });
  // Return the raw data - React Router will handle serialization
  return employees;
}

export default function EmployeePerformanceDashboard() {
  const employees = useLoaderData() as Employee[];
  const navigation = useNavigation();
  const submit = useSubmit();
  const [view, setView] = useState<ViewMode>("day");
  const [newEmployeeName, setNewEmployeeName] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  // When changing a field, submit to the API
  const updateField = async (employeeId: number, field: 'day' | 'week' | 'month' | 'wrongNumbers', change: 1 | -1) => {
    submit(
      { field, change },
      {
        method: "post",
        action: `/api/employees/${employeeId}`,
        encType: "application/json",
        navigate: false,
      }
    );
  };

  // Add new employee
  const addEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (newEmployeeName.trim() === "") return;
    
    submit(
      { name: newEmployeeName },
      {
        method: "post",
        action: "/api/employees/create",
        encType: "application/json",
        navigate: false,
      }
    );
    
    setNewEmployeeName("");
    setShowAddForm(false);
  };

  // Delete employee
  const deleteEmployee = (id: number) => {
    if (confirm("Are you sure you want to remove this employee?")) {
      submit(
        {},
        {
          method: "delete",
          action: `/api/employees/delete/${id}`,
          navigate: false,
        }
      );
    }
  };

  const trendData = (() => {
    // Average trend across employees for the chart
    const pointsMap: Record<string, { total: number; count: number }> = {};
    employees.forEach((e) => {
      e.trendPoints.forEach((pt) => {
        const ts = new Date(pt.timestamp).getTime();
        pointsMap[ts] = pointsMap[ts] || { total: 0, count: 0 };
        pointsMap[ts].total += pt.score;
        pointsMap[ts].count += 1;
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

  const isLoading = navigation.state === "loading";

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8 overflow-hidden">
      <header className="flex items-center gap-4 mb-8">
        <h1 className="text-4xl lg:text-6xl font-bold mr-auto select-none">
          Employee Performance
        </h1>
        
        {/* Add employee toggle button */}
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-5 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-xl"
        >
          {showAddForm ? "Cancel" : "Add Employee"}
        </button>
        
        <button
          onClick={() => document.documentElement.requestFullscreen()}
          className="px-5 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-xl lg:text-2xl"
        >
          ⛶ Fullscreen
        </button>
      </header>

      {/* Add employee form */}
      {showAddForm && (
        <form onSubmit={addEmployee} className="mb-6 flex gap-4">
          <input
            type="text"
            value={newEmployeeName}
            onChange={(e) => setNewEmployeeName(e.target.value)}
            placeholder="Employee name"
            className="px-4 py-3 rounded-xl bg-slate-800 text-white text-xl flex-grow"
            disabled={navigation.state === "submitting"}
            autoFocus
          />
          <button
            type="submit"
            disabled={navigation.state === "submitting" || newEmployeeName.trim() === ""}
            className="px-6 py-3 rounded-xl bg-green-600 hover:bg-green-700 disabled:bg-slate-700 disabled:opacity-50 text-xl"
          >
            Add
          </button>
        </form>
      )}

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
      <section className={`grid 2xl:grid-cols-5 xl:grid-cols-4 lg:grid-cols-3 md:grid-cols-2 sm:grid-cols-2 gap-4 mb-12 ${navigation.state === "loading" ? "opacity-50" : ""}`}>
        {employees.map((emp) => {
          const score = emp.scores[view];
          const wrongNumbers = emp.wrongNumbers;
          return (
            <div
              key={emp.id}
              className={`rounded-3xl p-6 flex flex-col items-center justify-center ${bgColor(score)}`}
            >
              {/* Remove employee button */}
              <button
                onClick={() => deleteEmployee(emp.id)}
                className="self-end text-slate-300 hover:text-white opacity-60 hover:opacity-100 mb-1"
                aria-label={`Remove ${emp.name}`}
              >
                ✕
              </button>
              
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
              
              {/* Score Controls */}
              <div className="flex gap-2 mt-3">
                <button 
                  onClick={() => updateField(emp.id, view, -1)}
                  disabled={navigation.state === "submitting" || score <= 0}
                  className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed w-10 h-10 rounded-full flex items-center justify-center"
                  aria-label={`Decrease ${emp.name}'s ${view} score`}
                >
                  <span className="text-2xl font-bold">-</span>
                </button>
                <button 
                  onClick={() => updateField(emp.id, view, 1)}
                  disabled={navigation.state === "submitting" || score >= 100}
                  className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed w-10 h-10 rounded-full flex items-center justify-center"
                  aria-label={`Increase ${emp.name}'s ${view} score`}
                >
                  <span className="text-2xl font-bold">+</span>
                </button>
              </div>

              {/* Wrong Numbers Display and Controls */}
              <div className="mt-4 text-center">
                <span className="text-sm opacity-70 select-none">WRONG #'s</span>
                <div className="flex items-center justify-center gap-2 mt-1">
                  <button
                    onClick={() => updateField(emp.id, 'wrongNumbers', -1)}
                    disabled={navigation.state === "submitting" || wrongNumbers <= 0}
                    className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed w-8 h-8 rounded-full flex items-center justify-center text-sm"
                    aria-label={`Decrease ${emp.name}'s wrong numbers`}
                  >
                    <span className="text-xl font-bold">-</span>
                  </button>
                  <span className="text-xl font-semibold select-none min-w-[2ch]">
                    {wrongNumbers}
                  </span>
                  <button
                    onClick={() => updateField(emp.id, 'wrongNumbers', 1)}
                    disabled={navigation.state === "submitting"}
                    className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed w-8 h-8 rounded-full flex items-center justify-center text-sm"
                    aria-label={`Increase ${emp.name}'s wrong numbers`}
                  >
                    <span className="text-xl font-bold">+</span>
                  </button>
                </div>
              </div>
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
