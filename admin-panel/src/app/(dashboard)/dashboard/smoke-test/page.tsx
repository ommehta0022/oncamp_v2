"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { Activity, CheckCircle, XCircle, Loader2 } from "lucide-react";

export default function SmokeTestPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<any>([]);

  const tests = [
    { name: "System Health (/v1/health)", run: () => api.getSystemStatus() },
    { name: "Fetch Dashboard Stats", run: () => api.getDashboard() },
    { name: "Fetch Admin Settings", run: () => api.getSettings() },
    { name: "Ping Users Table", run: () => api.getUsers({ page: 1, limit: 1 }) },
    { name: "Ping Groups Table", run: () => api.getGroups({ page: 1, limit: 1 }) },
    { name: "Ping Institutions Table", run: () => api.getInstitutions({ page: 1, limit: 1 }) },
  ];

  const runTests = async () => {
    setIsRunning(true);
    const initialResults = tests.map((t) => ({ name: t.name, status: "pending" }));
    setResults(initialResults);

    for (let i = 0; i < tests.length; i++) {
      try {
        await tests[i].run();
        setResults((prev) => {
          const next = [...prev];
          next[i] = { ...next[i], status: "success" };
          return next;
        });
      } catch (err: any) {
        setResults((prev) => {
          const next = [...prev];
          next[i] = { ...next[i], status: "error", error: err.message || "Request failed" };
          return next;
        });
      }
    }
    setIsRunning(false);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
          <Activity className="w-8 h-8 mr-3 text-blue-500" />
          Production API Smoke Test
        </h1>
        <p className="text-gray-600 mt-1">
          Run quick diagnostic checks on critical backend endpoints and database tables.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold">Test Suite</h2>
          <button
            onClick={runTests}
            disabled={isRunning}
            className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isRunning && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{isRunning ? "Running Tests..." : "Run All Tests"}</span>
          </button>
        </div>

        <div className="space-y-4">
          {results.length === 0 && (
            <p className="text-gray-500 text-center py-8">Click "Run All Tests" to begin.</p>
          )}
          {results.map((res, idx) => (
            <div
              key={idx}
              className={\lex items-center justify-between p-4 rounded-lg border ${
                res.status === "pending"
                  ? "bg-gray-50 border-gray-200"
                  : res.status === "success"
                  ? "bg-green-50 border-green-200"
                  : "bg-red-50 border-red-200"
              }\}
            >
              <div className="flex items-center space-x-3">
                {res.status === "pending" && <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />}
                {res.status === "success" && <CheckCircle className="w-5 h-5 text-green-500" />}
                {res.status === "error" && <XCircle className="w-5 h-5 text-red-500" />}
                <span className="font-medium text-gray-900">{res.name}</span>
              </div>
              {res.status === "error" && (
                <span className="text-sm text-red-600">{res.error}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}