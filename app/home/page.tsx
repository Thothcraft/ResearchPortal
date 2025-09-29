"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FiMessageSquare,
  FiBook,
  FiUsers,
  FiFile,
  FiUpload,
  FiBookOpen,
  FiActivity,
} from "react-icons/fi";
import StatCard from "@/components/StatCard";
import QuickActionButton from "@/components/QuickActionButton";
import ResourceLinks from "@/components/ResourceLinks";

export default function DashboardHome() {
  const [username, setUsername] = useState<string>("");

  const router = useRouter();

  const handleSignOut = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    router.push("/auth/login");
  };

  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        setUsername(user.username || "");
      } catch {
        setUsername("");
      }
    }
  }, []);

  const [files, setFiles] = useState<{ id: string; filename: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch files on mount
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    fetch("https://web-production-d7d37.up.railway.app/files", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setFiles(data);
        } else if (data && Array.isArray(data.files)) {
          setFiles(data.files);
        } else {
          setFiles([]);
        }
      })
      .catch(() => setFiles([]));
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    const token = localStorage.getItem("token");
    try {
      await fetch("https://web-production-d7d37.up.railway.app/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          // Do NOT set Content-Type; browser will set it for FormData
        },
        body: formData,
      });
      // Refresh file list
      const filesRes = await fetch(
        "https://web-production-d7d37.up.railway.app/files",
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const filesData = await filesRes.json();
      setFiles(filesData);
    } catch {
      setError("Upload failed");
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const sendHeartbeat = () => {
      fetch("https://web-production-d7d37.up.railway.app/device/heartbeat", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ timestamp: Date.now() }),
      });
    };

    const interval = setInterval(sendHeartbeat, 30000); // Send heartbeat every 30 seconds
    sendHeartbeat();

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex-1 overflow-auto bg-gradient-to-br from-blue-100 via-pink-100 to-indigo-100 min-h-screen">
      <div className="bg-gradient-to-r from-blue-400 to-pink-300 px-4 py-16 sm:px-6 lg:px-8 shadow">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div
                  className="bg-gradient-to-r from-yellow-400 via-yellow-300 to-amber-500 px-6 py-2 rounded-xl shadow-lg text-3xl font-extrabold tracking-widest text-yellow-900 border-2 border-yellow-500 drop-shadow-lg"
                  style={{ letterSpacing: "0.15em" }}
                >
                  THOTH
                </div>
              </div>
              <h1 className="text-4xl font-bold text-white drop-shadow">
                Welcome{username ? `, ${username}` : ""}!
              </h1>
              <p className="mt-2 text-lg text-blue-50 drop-shadow">
                Here's what's happening today
              </p>
            </div>
            <div className="mt-4 md:mt-0 flex gap-3">
              <Link
                href="/chat"
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-gradient-to-r from-pink-400 to-indigo-400 hover:from-pink-500 hover:to-indigo-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white"
              >
                <FiMessageSquare className="mr-2" />
                Start New Chat
              </Link>
              <button
                onClick={handleSignOut}
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-yellow-900 bg-gradient-to-r from-yellow-300 to-amber-400 hover:from-yellow-400 hover:to-amber-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
                type="button"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 -mt-12">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          {[
            {
              icon: <FiBook size={24} />,
              title: "Courses",
              value: 0,
              color: "bg-indigo-200 text-indigo-700",
            },
            {
              icon: <FiUsers size={24} />,
              title: "Friends",
              value: 0,
              color: "bg-green-200 text-green-700",
            },
            {
              icon: <FiFile size={24} />,
              title: "Files",
              value: 0,
              color: "bg-purple-200 text-purple-700",
            },
            {
              icon: <FiMessageSquare size={24} />,
              title: "Messages",
              value: 0,
              color: "bg-amber-200 text-amber-700",
            },
          ].map((stat) => (
            <StatCard key={stat.title} {...stat} />
          ))}
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <QuickActionButton
              icon={<FiMessageSquare size={20} />}
              title="New Chat"
              href="/chat"
              color="bg-blue-200 text-blue-800 hover:bg-blue-300"
            />
            <QuickActionButton
              icon={<FiBookOpen size={20} />}
              title="Enroll in Course"
              href="/courses"
              color="bg-green-200 text-green-800 hover:bg-green-300"
            />
            <QuickActionButton
              icon={<FiUpload size={20} />}
              title={uploading ? "Uploading..." : "Upload File"}
              color="bg-purple-200 text-purple-800 hover:bg-purple-300"
              onClick={() => fileInputRef.current?.click()} // Only this one has onClick!
              disabled={uploading}
            />
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: "none" }}
              onChange={handleUpload}
              accept=".pdf,.txt"
            />
            <QuickActionButton
              icon={<FiUsers size={20} />}
              title="Join Community"
              href="/community"
              color="bg-amber-200 text-amber-800 hover:bg-amber-300"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="bg-white shadow-lg rounded-xl overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Recent Activity
              </h2>
            </div>
            <div className="p-6">
              <div className="text-center py-8">
                <FiActivity className="mx-auto h-12 w-12 text-gray-300" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                  No recent activity
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Your activity will appear here
                </p>
              </div>
            </div>
          </div>

          <ResourceLinks />
        </div>
      </div>
    </div>
  );
}
