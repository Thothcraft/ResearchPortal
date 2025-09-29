import {
  FiHelpCircle,
  FiMessageCircle,
  FiUsers,
  FiMessageSquare,
} from "react-icons/fi";

const resources = [
  {
    icon: <FiHelpCircle size={18} />,
    name: "Documentation",
    url: "#",
    color: "text-blue-500",
  },
  {
    icon: <FiMessageCircle size={18} />,
    name: "Help Center",
    url: "#",
    color: "text-green-500",
  },
  {
    icon: <FiUsers size={18} />,
    name: "Community Forums",
    url: "#",
    color: "text-purple-500",
  },
  {
    icon: <FiMessageSquare size={18} />,
    name: "Contact Support",
    url: "#",
    color: "text-amber-500",
  },
];

export default function ResourceLinks() {
  return (
    <div className="bg-white shadow-lg rounded-xl overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Resources</h2>
      </div>
      <div className="p-6">
        <ul className="space-y-4">
          {resources.map((item) => (
            <li key={item.name}>
              <a
                href={item.url}
                className="flex items-center p-3 rounded-lg hover:bg-blue-50 transition-colors"
              >
                <span className={`${item.color} mr-3`}>{item.icon}</span>
                <span className="text-gray-700 font-medium">{item.name}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
