import React from "react";

export function FlowSelector({
  mode,
  setMode,
  flow,
  setFlow,
}: {
  mode: "websocket" | "api";
  setMode: (m: "websocket" | "api") => void;
  flow: "oneClick" | "twoClick";
  setFlow: (f: "oneClick" | "twoClick") => void;
}) {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="p-4 rounded-md border">
        <div className="text-sm font-semibold mb-2">Mode</div>
        <div className="flex gap-2">
          <button
            onClick={() => setMode("websocket")}
            className={`px-3 py-2 rounded text-sm ${
              mode === "websocket" ? "bg-indigo-600 text-white" : "bg-gray-200 text-gray-700"
            }`}
          >
            WebSocket
          </button>
          <button
            onClick={() => setMode("api")}
            className={`px-3 py-2 rounded text-sm ${
              mode === "api" ? "bg-indigo-600 text-white" : "bg-gray-200 text-gray-700"
            }`}
          >
            API
          </button>
        </div>
      </div>
      <div className="p-4 rounded-md border">
        <div className="text-sm font-semibold mb-2">Flow</div>
        <div className="flex gap-2">
          <button
            onClick={() => setFlow("oneClick")}
            className={`px-3 py-2 rounded text-sm ${
              flow === "oneClick" ? "bg-indigo-600 text-white" : "bg-gray-200 text-gray-700"
            }`}
          >
            One-Click (backend executes)
          </button>
          <button
            onClick={() => setFlow("twoClick")}
            className={`px-3 py-2 rounded text-sm ${
              flow === "twoClick" ? "bg-indigo-600 text-white" : "bg-gray-200 text-gray-700"
            }`}
          >
            Two-Click (user executes)
          </button>
        </div>
      </div>
    </div>
  );
}


