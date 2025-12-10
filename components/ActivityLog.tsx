import React from "react";

export interface ActivityLogItem {
  t: number; // ms timestamp
  m: string; // message
}

export function ActivityLog({ title, items }: { title: string; items: ActivityLogItem[] }) {
  return (
    <div className="p-4 border rounded-md">
      <div className="font-semibold mb-2 text-gray-800">{title}</div>
      <div className="h-40 overflow-auto bg-gray-50 border rounded p-2 text-xs text-gray-800">
        {items.length === 0 ? <div className="text-gray-500">No activity yet.</div> : null}
        {items.map((it, idx) => {
          const ts = new Date(it.t).toLocaleTimeString();
          return (
            <div key={idx} className="whitespace-pre-wrap break-all">
              <span className="text-gray-500">[{ts}] </span>
              {it.m}
            </div>
          );
        })}
      </div>
    </div>
  );
}


