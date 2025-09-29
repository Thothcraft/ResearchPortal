import React from "react";

interface StatCardProps {
  icon: React.ReactNode;
  title: string;
  value: number;
  color: string;
}

export default function StatCard({ icon, title, value, color }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden transition-all hover:shadow-xl hover:-translate-y-1">
      <div className="p-6">
        <div
          className={`flex items-center justify-center w-12 h-12 rounded-full mb-4 ${color}`}
        >
          {icon}
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-2xl font-semibold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}
