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
import {
  useLoaderData,
  useNavigation,
  useSubmit,
  useOutletContext,
  Link,
} from "react-router";
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

// Loader return type
interface LoaderData {
  employees: Employee[];
  view: ViewMode;
}

// -------------------- Component --------------------

// Fetch data directly in the loader, DO NOT require authentication
export async function loader({ request }: LoaderFunctionArgs) {
  // Get the view parameter from the URL
  const url = new URL(request.url);
  const viewParam = url.searchParams.get("view") as ViewMode | null;
  const view = viewParam && ["day", "week", "month"].includes(viewParam) ? viewParam : "day";

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
        role: Role.EMPLOYEE,
      },
    },
    include: {
      scores: {
        orderBy: {
          timestamp: "desc",
        },
      },
      trendPoints: {
        orderBy: {
          timestamp: "asc",
        },
      },
    },
  });

  // Process employees to get the accumulated score for each time period
  const processedEmployees = employees.map((employee) => {
    // Sum all scores for today
    const dayScores = employee.scores
      .filter((score) => new Date(score.timestamp) >= startOfDay);
    const latestDayScore = Math.max(0, dayScores.reduce((sum, score) => sum + score.score, 0));

    // Sum all scores for this week
    const weekScores = employee.scores
      .filter((score) => new Date(score.timestamp) >= startOfWeek);
    const latestWeekScore = Math.max(0, weekScores.reduce((sum, score) => sum + score.score, 0));

    // Sum all scores for this month
    const monthScores = employee.scores
      .filter((score) => new Date(score.timestamp) >= startOfMonth);
    const latestMonthScore = Math.max(0, monthScores.reduce((sum, score) => sum + score.score, 0));

    return {
      ...employee,
      processedScores: {
        day: latestDayScore,
        week: latestWeekScore,
        month: latestMonthScore,
      },
    };
  });

  // Convert the data to match our interfaces
  const employeesWithCorrectTypes = processedEmployees.map(emp => ({
    ...emp,
    scores: emp.scores.map(score => ({
      ...score,
      timestamp: score.timestamp.toString()
    })),
    trendPoints: emp.trendPoints.map(point => ({
      ...point,
      timestamp: point.timestamp.toString()
    }))
  }));

  return json<LoaderData>({
    employees: employeesWithCorrectTypes as Employee[],
    view,
  });
}

export default function EmployeePerformanceDashboard() {
  // Explicitly type the expected data from the loader
  const { employees: initialEmployees, view } = useLoaderData<typeof loader>();
  // Use state to manage employees data so it can be updated by SSE
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees);
  // Get user and flags from Outlet context
  const { user, isAdmin, isManager } = useOutletContext<OutletContextType>();

  const navigation = useNavigation();
  const submit = useSubmit();

  // -- SSE Hook Integration --
  const { lastEvent, isConnected, error: sseError } = useSSE("/api/events");

  // Effect to update local state when an SSE event is received
  useEffect(() => {
    if (lastEvent) {
      console.log("Processing SSE event:", lastEvent);
      setEmployees((currentEmployees) =>
        currentEmployees.map((emp) => {
          if (emp.id === lastEvent.employeeId) {
            console.log(
              `Updating employee ${emp.id} field ${lastEvent.field} to ${lastEvent.newValue}`
            );
            // Create a new employee object with the updated field
            const updatedEmp = { ...emp };
            if (lastEvent.field === "wrongNumbers") {
              updatedEmp.wrongNumbers = lastEvent.newValue;
            } else if (updatedEmp.processedScores) {
              // For score updates, update scores for all time periods
              // This ensures that when switching views, the latest score is always displayed
              if (["day", "week", "month"].includes(lastEvent.field)) {
                // Create a new score entry with the latest timestamp
                const newScore = {
                  id: Date.now(), // Use a temporary ID
                  employeeId: emp.id,
                  timestamp: new Date().toISOString(),
                  score: lastEvent.newValue,
                };
                
                // Add the new score to the beginning of the scores array
                updatedEmp.scores = [newScore, ...emp.scores];
                
                // Calculate which time periods this score update affects
                const now = new Date();
                const scoreTime = new Date(newScore.timestamp);
                
                // Get the start of day, week, and month
                const startOfDay = new Date(now);
                startOfDay.setHours(0, 0, 0, 0);
                
                const startOfWeek = new Date(now);
                const dayOfWeek = startOfWeek.getDay();
                const diff = startOfWeek.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
                startOfWeek.setDate(diff);
                startOfWeek.setHours(0, 0, 0, 0);
                
                const startOfMonth = new Date(now);
                startOfMonth.setDate(1);
                startOfMonth.setHours(0, 0, 0, 0);
                
                // Check which time periods the score falls within
                const isWithinDay = scoreTime >= startOfDay;
                const isWithinWeek = scoreTime >= startOfWeek;
                const isWithinMonth = scoreTime >= startOfMonth;
                
                // When we receive an SSE event, the lastEvent.newValue is already the total sum
                // calculated on the server side, so we directly set it (don't add to existing)
                updatedEmp.processedScores = {
                  ...updatedEmp.processedScores,
                  // Update with the new total score value from the server
                  day: lastEvent.field === "day" ? lastEvent.newValue : updatedEmp.processedScores.day,
                  week: lastEvent.field === "week" ? lastEvent.newValue : updatedEmp.processedScores.week,
                  month: lastEvent.field === "month" ? lastEvent.newValue : updatedEmp.processedScores.month,
                };
              }
            } else {
              console.warn(
                `Scores object not found for employee ${emp.id} during SSE update.`
              );
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
  const updateField = async (
    employeeId: number,
    field: "day" | "week" | "month" | "wrongNumbers",
    change: 1 | -1
  ) => {
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
    
    // Calculate the start date for the current view
    const today = new Date();
    let startDate: Date;
    
    // Set start date based on view
    if (view === "day") {
      startDate = new Date(today);
      startDate.setHours(0, 0, 0, 0);
    } else if (view === "week") {
      startDate = new Date(today);
      const dayOfWeek = startDate.getDay();
      const diff = startDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      startDate.setDate(diff);
      startDate.setHours(0, 0, 0, 0);
    } else { // month
      startDate = new Date(today);
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);
    }
    
    // Set end date to end of current period
    const endDate = new Date();
    if (view === "day") {
      endDate.setHours(23, 59, 59, 999);
    } else if (view === "week") {
      const endOfWeek = new Date(startDate);
      endOfWeek.setDate(startDate.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);
      endDate.setTime(endOfWeek.getTime());
    } else { // month
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      endOfMonth.setHours(23, 59, 59, 999);
      endDate.setTime(endOfMonth.getTime());
    }
    
    employees.forEach((e) => {
      if (Array.isArray(e.trendPoints)) {
        e.trendPoints.forEach((pt) => {
          if (pt.timestamp && typeof pt.score === "number") {
            try {
              const timestamp = new Date(pt.timestamp);
              const ts = timestamp.getTime();
              
              // Only include points within the current view period
              if (!isNaN(ts) && timestamp >= startDate && timestamp <= endDate) {
                pointsMap[ts] = pointsMap[ts] || { total: 0, count: 0 };
                pointsMap[ts].total += pt.score;
                pointsMap[ts].count += 1;
              } else {
                // Skip points outside the current view period
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

  const scoreColor = (score: number) => {
    if (score >= 150) return "text-purple-400";
    if (score >= 100) return "text-blue-400";
    if (score >= 75) return "text-green-400";
    if (score >= 60) return "text-yellow-400";
    return "text-red-400";
  };

  const bgColor = (score: number) => {
    if (score >= 150) return "bg-purple-700/50";
    if (score >= 100) return "bg-blue-700/50";
    if (score >= 75) return "bg-green-700/50";
    if (score >= 60) return "bg-yellow-700/50";
    return "bg-red-700/50";
  };

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

      {/* Period info and view toggle */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl lg:text-3xl font-semibold select-none">
          {(() => {
            const today = new Date();
            
            if (view === "day") {
              // For day view: show today's date
              return `Today (${today.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })})`;
            } else if (view === "week") {
              // For week view: start of current week to end of current week
              const startOfWeek = new Date(today);
              const dayOfWeek = startOfWeek.getDay();
              const diff = startOfWeek.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
              startOfWeek.setDate(diff);
              startOfWeek.setHours(0, 0, 0, 0);
              
              const endOfWeek = new Date(startOfWeek);
              endOfWeek.setDate(startOfWeek.getDate() + 6);
              endOfWeek.setHours(23, 59, 59, 999);
              
              // Use consistent date format
              const dateFormat = { day: '2-digit', month: '2-digit', year: 'numeric' };
              return `Week (${startOfWeek.toLocaleDateString('en-GB', dateFormat)} - ${endOfWeek.toLocaleDateString('en-GB', dateFormat)})`;
            } else {
              // For month view: start of current month to end of current month
              const startOfMonth = new Date(today);
              startOfMonth.setDate(1);
              startOfMonth.setHours(0, 0, 0, 0);
              
              const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
              endOfMonth.setHours(23, 59, 59, 999);
              
              // Use consistent date format
              const dateFormat = { day: '2-digit', month: '2-digit', year: 'numeric' };
              return `Month (${startOfMonth.toLocaleDateString('en-GB', dateFormat)} - ${endOfMonth.toLocaleDateString('en-GB', dateFormat)})`;
            }
          })()}
        </h2>
        
        <div className="flex gap-4">
          {["day", "week", "month"].map((v) => (
            <Link
              key={v}
              to={`?view=${v}`}
              className={`px-6 py-3 rounded-2xl text-xl transition-colors ${
                view === v ? "bg-blue-600" : "bg-slate-800 hover:bg-slate-700"
              }`}
            >
              {v.toUpperCase()}
            </Link>
          ))}
        </div>
      </div>

      {/* Employee Grid */}
      <section
        className={`grid 2xl:grid-cols-5 xl:grid-cols-4 lg:grid-cols-3 md:grid-cols-2 sm:grid-cols-2 gap-4 mb-12 ${
          navigation.state === "loading" && !lastEvent ? "opacity-50" : ""
        }`}
      >
        {/* Check if employees is an array before mapping */}
        {Array.isArray(employees) &&
          employees.map((emp) => {
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
                  className={`text-4xl lg:text-5xl font-extrabold ${scoreColor(
                    score
                  )} select-none transition-colors duration-300 ease-in-out`}
                >
                  {score}
                </span>
                <span className="mt-1 text-base lg:text-lg opacity-70 select-none">
                  Numbers
                </span>

                {/* Score Controls - only shown for day view */}
                {(user?.employeeId === emp.id || isManager) && view === "day" && (
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
                  <span className="text-sm opacity-70 select-none">
                    WRONG numbers
                  </span>
                  <div className="flex items-center justify-center gap-2 mt-1">
                    {/* Decrease Wrong # Button - only shown for day view */}
                    {isAdmin && view === "day" && (
                      <button
                        onClick={() => updateField(emp.id, "wrongNumbers", -1)}
                        disabled={
                          navigation.state === "submitting" || wrongNumbers <= 0
                        }
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
                    {/* Increase Wrong # Button - only shown for day view */}
                    {isManager && view === "day" && (
                      <button
                        onClick={() => updateField(emp.id, "wrongNumbers", 1)}
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
      <h2 className="text-3xl lg:text-4xl font-semibold mb-4 select-none">
        Average Trend
      </h2>
      <div className="h-80 w-full bg-slate-800/50 rounded-3xl p-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={trendData}
            margin={{ left: 16, right: 16, top: 8, bottom: 8 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.1)"
            />
            <XAxis
              dataKey="ts"
              tickFormatter={(ts) => {
                const date = new Date(ts);
                
                // Format based on current view
                if (view === "day") {
                  return date.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit"
                  });
                } else if (view === "week") {
                  return date.toLocaleDateString([], {
                    weekday: "short",
                    month: "numeric",
                    day: "numeric"
                  });
                } else { // month
                  return date.toLocaleDateString([], {
                    month: "numeric",
                    day: "numeric"
                  });
                }
              }}
              stroke="#aaa"
            />
            <YAxis domain={[0, "auto"]} stroke="#aaa" />
            <Tooltip
              labelFormatter={(ts) => {
                const date = new Date(Number(ts));
                
                // Format tooltip based on current view
                if (view === "day") {
                  return date.toLocaleString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit"
                  });
                } else if (view === "week") {
                  return date.toLocaleString([], {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit"
                  });
                } else { // month
                  return date.toLocaleString([], {
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit"
                  });
                }
              }}
              contentStyle={{
                background: "#1e293b",
                border: "none",
                borderRadius: "0.75rem",
              }}
            />
            <Line
              type="monotone"
              dataKey="score"
              stroke="#10b981"
              strokeWidth={4}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}
