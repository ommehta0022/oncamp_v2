"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Database,
  Table,
  Play,
  AlertTriangle,
  Eye,
  Edit2,
  Trash2,
  Plus,
} from "lucide-react";

export default function DatabasePage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("tables");
  const [selectedTable, setSelectedTable] = useState("");
  const [sqlQuery, setSqlQuery] = useState("");
  const [queryResult, setQueryResult] = useState<any>(null);
  const [page, setPage] = useState(1);

  const { data: tables } = useQuery({
    queryKey: ["admin-db-tables"],
    queryFn: () => api.getTables(),
  });

  const { data: tableData } = useQuery({
    queryKey: ["admin-table-data", selectedTable, page],
    queryFn: () => api.getTableData(selectedTable, { page, limit: 50 }),
    enabled: !!selectedTable,
  });

  const executeQueryMutation = useMutation({
    mutationFn: (query: string) => api.executeQuery(query),
    onSuccess: (data) => {
      setQueryResult(data);
    },
    onError: (error: any) => {
      alert(`Query failed: ${error.message || "Unknown error"}`);
    },
  });

  const handleExecuteQuery = () => {
    if (!sqlQuery.trim()) {
      alert("Please enter a SQL query");
      return;
    }

    // Safety warning for destructive operations
    const dangerous = /^(DELETE|DROP|TRUNCATE|ALTER)/i.test(sqlQuery.trim());
    if (dangerous) {
      const confirmed = confirm(
        "⚠️ WARNING: This is a destructive operation that cannot be undone. Are you absolutely sure?"
      );
      if (!confirmed) return;
    }

    executeQueryMutation.mutate(sqlQuery);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <Database className="w-8 h-8 mr-3 text-blue-500" />
            Database Management
          </h1>
          <p className="text-gray-600 mt-1">
            Direct database access and SQL query execution (Super Admin Only)
          </p>
        </div>
        <div className="bg-red-100 border border-red-300 rounded-lg px-4 py-2">
          <div className="flex items-center space-x-2 text-red-800">
            <AlertTriangle className="w-5 h-5" />
            <span className="text-sm font-medium">Production Database</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-4 px-6">
            <button
              onClick={() => setActiveTab("tables")}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === "tables"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Browse Tables
            </button>
            <button
              onClick={() => setActiveTab("query")}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === "query"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              SQL Query
            </button>
          </nav>
        </div>

        <div className="p-6">
          {/* Browse Tables Tab */}
          {activeTab === "tables" && (
            <div className="space-y-6">
              {/* Table Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Table
                </label>
                <select
                  value={selectedTable}
                  onChange={(e) => {
                    setSelectedTable(e.target.value);
                    setPage(1);
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Select a table --</option>
                  {tables?.map((table: any) => (
                    <option key={table.table_name} value={table.table_name}>
                      {table.table_name} ({table.column_count} columns)
                    </option>
                  ))}
                </select>
              </div>

              {/* Table Data */}
              {selectedTable && tableData && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                      <Table className="w-5 h-5 mr-2 text-blue-500" />
                      {selectedTable}
                    </h3>
                    <div className="flex items-center space-x-4">
                      <span className="text-sm text-gray-600">
                        Total Rows: {tableData.meta?.total || 0}
                      </span>
                      <button
                        onClick={() => {
                          if (!tableData?.data?.length) return;
                          const headers = Object.keys(tableData.data[0]);
                          const rows = tableData.data.map((row: any) =>
                            headers.map(h => JSON.stringify(row[h] ?? "")).join(",")
                          );
                          const blob = new Blob([[headers.join(","), ...rows].join("\n")], { type: "text/csv" });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `${selectedTable}-export.csv`;
                          a.click();
                        }}
                        disabled={!tableData?.data?.length}
                        className="text-sm px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md"
                      >
                        Export CSV
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto border border-gray-200 rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          {tableData.data?.[0] ? (
                            Object.keys(tableData.data[0]).map((key) => (
                              <th
                                key={key}
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                              >
                                {key}
                              </th>
                            ))
                          ) : (
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              No data found
                            </th>
                          )}
                        </tr>
                      </thead>
                        {tableData.data?.length === 0 ? (
                          <tr>
                            <td className="px-6 py-8 text-center text-sm text-gray-500" colSpan={100}>
                              This table is currently empty.
                            </td>
                          </tr>
                        ) : (
                          tableData.data?.map((row: any, idx: number) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              {Object.values(row).map((value: any, i: number) => (
                                <td
                                  key={i}
                                  className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                                >
                                  {value === null
                                    ? <span className="text-gray-400 italic">NULL</span>
                                    : typeof value === "object"
                                    ? JSON.stringify(value).substring(0, 50)
                                    : String(value).substring(0, 50)}
                                </td>
                              ))}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {tableData.meta && tableData.meta.total > 50 && (
                    <div className="flex items-center justify-between mt-4">
                      <div className="text-sm text-gray-700">
                        Page {page} of {Math.ceil(tableData.meta.total / 50)}
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          disabled={page === 1}
                          className="px-4 py-2 bg-white border rounded-lg text-sm disabled:opacity-50"
                        >
                          Previous
                        </button>
                        <button
                          onClick={() => setPage((p) => p + 1)}
                          disabled={page >= Math.ceil(tableData.meta.total / 50)}
                          className="px-4 py-2 bg-white border rounded-lg text-sm disabled:opacity-50"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* SQL Query Tab */}
          {activeTab === "query" && (
            <div className="space-y-6">
              {/* Warning Banner */}
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-medium text-red-800">
                      Danger Zone - Direct Database Access
                    </h4>
                    <p className="text-sm text-red-700 mt-1">
                      Executing SQL queries directly can cause irreversible data loss.
                      Always backup data before running DELETE, DROP, or TRUNCATE
                      operations.
                    </p>
                  </div>
                </div>
              </div>

              {/* Query Editor */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  SQL Query
                </label>
                <textarea
                  value={sqlQuery}
                  onChange={(e) => setSqlQuery(e.target.value)}
                  placeholder="SELECT * FROM users LIMIT 10;"
                  rows={8}
                  className="w-full px-4 py-3 font-mono text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-gray-50"
                />
                <div className="mt-2 flex items-center justify-between">
                  <div className="text-xs text-gray-500">
                    Tip: Add "-- CONFIRMED" comment for destructive operations
                  </div>
                  <button
                    onClick={handleExecuteQuery}
                    disabled={executeQueryMutation.isPending}
                    className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Play className="w-4 h-4" />
                    <span>
                      {executeQueryMutation.isPending ? "Executing..." : "Execute Query"}
                    </span>
                  </button>
                </div>
              </div>

              {/* Query Result */}
              {queryResult && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-3">
                    Query Result
                  </h4>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                      <span className="text-sm text-gray-600">
                        {Array.isArray(queryResult)
                          ? `${queryResult.length} rows returned`
                          : "Query executed successfully"}
                      </span>
                    </div>
                    <div className="p-4 bg-white overflow-x-auto">
                      <pre className="text-xs text-gray-900">
                        {JSON.stringify(queryResult, null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>
              )}

              {/* Query Templates */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">
                  Quick Templates
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <button
                    onClick={() =>
                      setSqlQuery("SELECT * FROM users ORDER BY created_at DESC LIMIT 10;")
                    }
                    className="text-left p-3 bg-gray-50 hover:bg-gray-100 rounded-lg text-sm"
                  >
                    Recent Users
                  </button>
                  <button
                    onClick={() =>
                      setSqlQuery("SELECT * FROM groups ORDER BY created_at DESC LIMIT 10;")
                    }
                    className="text-left p-3 bg-gray-50 hover:bg-gray-100 rounded-lg text-sm"
                  >
                    Recent Groups
                  </button>
                  <button
                    onClick={() =>
                      setSqlQuery("SELECT COUNT(*) as total FROM users;")
                    }
                    className="text-left p-3 bg-gray-50 hover:bg-gray-100 rounded-lg text-sm"
                  >
                    Count Users
                  </button>
                  <button
                    onClick={() =>
                      setSqlQuery("SELECT status, COUNT(*) as count FROM users GROUP BY status;")
                    }
                    className="text-left p-3 bg-gray-50 hover:bg-gray-100 rounded-lg text-sm"
                  >
                    User Status Distribution
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
