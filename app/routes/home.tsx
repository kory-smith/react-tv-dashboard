import { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { useLoaderData, useNavigation, useSubmit, useOutletContext } from "react-router";
import { type LoaderFunctionArgs, json } from "@remix-run/node";
import { db } from "~/lib/db"; // Import db client
import { type User } from "@prisma/client"; // Import User type
import { Role } from "@prisma/client"; // Import Role enum
import { useSSE } from "~/hooks/useSSE"; // Import the SSE hook

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
  timestamp: string;
  score: number;
}

interface Employee {
  id: number;
  name: string;
  wrongNumbers: number;
  scores: Score[];
  trendPoints: TrendPoint[];
  processedScores?: {
    day: number;
    week: number;
    month: number;
  };
}

// --- Context Type ---
// Update context type to include flags from root loader
type OutletContextType = { 
  user: User | null; 
  isAdmin: boolean; 
  isManager: boolean; 
};

// -------------------- Component --------------------

// Fetch data directly in the loader, DO NOT require authentication
export async function loader({ request }: LoaderFunctionArgs) {
  const today = new Date();
  const startOfDay = new Date(today);
  startOfDay.setHours(0, 0, 0, 0);
  
  const startOfWeek = new Date(today);
  const dayOfWeek = startOfWeek.getDay();
  const diff = startOfWeek.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  startOfWeek.setDate(diff);
  startOfWeek.setHours(0, 0, 0, 0);
  
  const startOfMonth = new Date(today);
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const employees = await db.employee.findMany({
    // Filter to include only employees linked to a user with the EMPLOYEE role
    where: {
      user: {
        role: Role.EMPLOYEE
      }
    },
    include: {
      scores: {
        orderBy: {
          timestamp: "desc"
        }
      },
      trendPoints: {
        orderBy: {
          timestamp: "asc",
        },
      },
    },
  });

  // Process employees to get the latest score for each time period
  const processedEmployees = employees.map(employee => {
    const latestDayScore = employee.scores.find(score => 
      new Date(score.timestamp) >= startOfDay
    )?.score ?? 0;

    const latestWeekScore = employee.scores.find(score => 
      new Date(score.timestamp) >= startOfWeek
    )?.score ?? 0;

    const latestMonthScore = employee.scores.find(score => 
      new Date(score.timestamp) >= startOfMonth
    )?.score ?? 0;

    return {
      ...employee,
      processedScores: {
        day: latestDayScore,
        week: latestWeekScore,
        month: latestMonthScore
      }
    };
  });

  return json(processedEmployees);
}

export default function EmployeePerformanceDashboard() {
  // Explicitly type the expected data from the loader
  const initialEmployees = useLoaderData<Employee[]>();
  // Use state to manage employees data so it can be updated by SSE
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees);
  // Get user and flags from Outlet context
  const { user, isAdmin, isManager } = useOutletContext<OutletContextType>();

  const navigation = useNavigation();
  const submit = useSubmit();
  const [view, setView] = useState<ViewMode>("day");

  // -- SSE Hook Integration --
  const { lastEvent, isConnected, error: sseError } = useSSE('/api/events');

  // Effect to update local state when an SSE event is received
  useEffect(() => {
    if (lastEvent) {
      console.log("Processing SSE event:", lastEvent);
      setEmployees(currentEmployees => 
        currentEmployees.map(emp => {
          if (emp.id === lastEvent.employeeId) {
            console.log(`Updating employee ${emp.id} field ${lastEvent.field} to ${lastEvent.newValue}`);
            // Create a new employee object with the updated field
            const updatedEmp = { ...emp };
            if (lastEvent.field === 'wrongNumbers') {
              updatedEmp.wrongNumbers = lastEvent.newValue;
            } else if (updatedEmp.processedScores) {
              updatedEmp.processedScores = {
                ...updatedEmp.processedScores,
                [lastEvent.field]: lastEvent.newValue,
              };
            } else {
              console.warn(`Scores object not found for employee ${emp.id} during SSE update.`);
            }
            return updatedEmp;
          }
          return emp;
        })
      );
    }
  }, [lastEvent]);

  // Log SSE connection status and errors (optional)
  useEffect(() => {
    if (isConnected) {
      console.log("SSE Connected.");
    } else {
      console.log("SSE Disconnected.");
    }
    if (sseError) {
      console.error("SSE Connection Error:", sseError);
    }
  }, [isConnected, sseError]);
  // -------------------------

  // When changing a field, submit to the API
  const updateField = async (employeeId: number, field: 'day' | 'week' | 'month' | 'wrongNumbers', change: 1 | -1) => {
    submit(
      { field, change }, // Send change as a number
      {
        method: "post",
        action: `/api/employees/${employeeId}`,
        encType: "application/json", 
        navigate: false, 
      }
    );
  };

  const trendData = (() => {
    const pointsMap: Record<string, { total: number; count: number }> = {};
    if (!Array.isArray(employees)) {
        console.error("Employees data is not an array:", employees);
        return []; 
    }
    employees.forEach((e) => {
      if (Array.isArray(e.trendPoints)) {
          e.trendPoints.forEach((pt) => {
            if (pt.timestamp && typeof pt.score === 'number') {
                try {
                    const ts = new Date(pt.timestamp).getTime();
                    if (!isNaN(ts)) { 
                      pointsMap[ts] = pointsMap[ts] || { total: 0, count: 0 };
                      pointsMap[ts].total += pt.score;
                      pointsMap[ts].count += 1;
                    } else {
                        console.warn("Invalid timestamp format:", pt.timestamp);
                    }
                } catch (error) {
                    console.error("Error parsing timestamp:", pt.timestamp, error);
                }
            } else {
                console.warn("Invalid trend point data:", pt);
            }
          });
      } else {
          // console.warn("Employee missing trendPoints array:", e);
      }
    });
    const calculatedTrendData = Object.entries(pointsMap)
      .map(([ts, { total, count }]) => ({
        ts: Number(ts),
        score: count > 0 ? total / count : 0, 
      }))
      .sort((a, b) => a.ts - b.ts);
      
    return calculatedTrendData;
  })();

  const scoreColor = (score: number) =>
    score >= 75 ? "text-green-400" : score >= 60 ? "text-yellow-400" : "text-red-400";

  const bgColor = (score: number) =>
    score >= 75 ? "bg-green-700/50" : score >= 60 ? "bg-yellow-700/50" : "bg-red-700/50";

  return (
    <>
      {/* Add employee form (Show only for Admins via context flag) */}
      {/* {isAdmin && showAddForm && (
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
      )} */}

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
      <section className={`grid 2xl:grid-cols-5 xl:grid-cols-4 lg:grid-cols-3 md:grid-cols-2 sm:grid-cols-2 gap-4 mb-12 ${navigation.state === "loading" && !lastEvent ? "opacity-50" : ""}`}>
        {/* Check if employees is an array before mapping */}
        {Array.isArray(employees) && employees.map((emp) => {
          // Safely access score from processedScores
          const score = emp.processedScores?.[view] ?? 0;
          const wrongNumbers = emp.wrongNumbers;
          const currentBgColor = bgColor(score);

          return (
            <div
              key={emp.id}
              className={`rounded-3xl p-6 flex flex-col items-center justify-center ${currentBgColor} relative transition-colors duration-300 ease-in-out`}
            >
              {/* Remove employee button (Show only for Admins via context flag) */}
              {/* {isAdmin && (
                  <button
                    onClick={() => deleteEmployee(emp.id)}
                    className="absolute top-2 right-2 text-slate-300 hover:text-white opacity-60 hover:opacity-100 p-1 rounded-full bg-black/20 hover:bg-black/40"
                    aria-label={`Remove ${emp.name}`}
                  >
                    ✕
                  </button>
              )} */}
              
              <span className="text-xl lg:text-2xl font-semibold mb-1 select-none">
                {emp.name}
              </span>
              <span
                className={`text-4xl lg:text-5xl font-extrabold ${scoreColor(score)} select-none transition-colors duration-300 ease-in-out`}
              >
                {score}
              </span>
              <span className="mt-1 text-base lg:text-lg opacity-70 select-none">
              Numbers
              </span>
              
              {/* Score Controls */}
              {(user?.employeeId === emp.id || isManager) && (
                  <div className="flex gap-2 mt-3">
                    {/* Decrease Score Button */}
                    <button 
                      onClick={() => updateField(emp.id, view, -1)}
                      disabled={navigation.state === "submitting" || score <= 0}
                      className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed w-10 h-10 rounded-full flex items-center justify-center"
                      aria-label={`Decrease ${emp.name}'s ${view} score`}
                    >
                      <span className="text-2xl font-bold">-</span>
                    </button>
                    {/* Increase Score Button */}
                    <button 
                      onClick={() => updateField(emp.id, view, 1)}
                      disabled={navigation.state === "submitting"}
                      className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed w-10 h-10 rounded-full flex items-center justify-center"
                      aria-label={`Increase ${emp.name}'s ${view} score`}
                    >
                      <span className="text-2xl font-bold">+</span>
                    </button>
                  </div>
              )}

              {/* Wrong Numbers Display and Controls */}
              <div className="mt-4 text-center">
                <span className="text-sm opacity-70 select-none">WRONG numbers</span>
                <div className="flex items-center justify-center gap-2 mt-1">
                  {/* Decrease Wrong # Button */}
                  {isAdmin && (
                    <button
                      onClick={() => updateField(emp.id, 'wrongNumbers', -1)}
                      disabled={navigation.state === "submitting" || wrongNumbers <= 0}
                      className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed w-8 h-8 rounded-full flex items-center justify-center text-sm"
                      aria-label={`Decrease ${emp.name}'s wrong numbers`}
                    >
                      <span className="text-xl font-bold">-</span>
                    </button>
                  )}
                  {/* Display Wrong # Count */}
                  <span className="text-xl font-semibold select-none min-w-[2ch]">
                    {wrongNumbers}
                  </span>
                  {/* Increase Wrong # Button */}
                  {isManager && (
                    <button
                      onClick={() => updateField(emp.id, 'wrongNumbers', 1)}
                      disabled={navigation.state === "submitting"}
                      className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed w-8 h-8 rounded-full flex items-center justify-center text-sm"
                      aria-label={`Increase ${emp.name}'s wrong numbers`}
                    >
                      <span className="text-xl font-bold">+</span>
                    </button>
                  )}
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
    </>
  );
}
