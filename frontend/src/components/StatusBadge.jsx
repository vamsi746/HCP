const colorMap = {
  ACTIVE: "bg-green-100 text-green-800",
  APPROVED: "bg-green-100 text-green-800",
  PENDING: "bg-yellow-100 text-yellow-800",
  UNDER_REVIEW: "bg-blue-100 text-blue-800",
  REVIEWED: "bg-blue-100 text-blue-800",
  REJECTED: "bg-red-100 text-red-800",
  FLAGGED: "bg-red-100 text-red-800",
  CLOSED: "bg-gray-100 text-gray-800",
  ESCALATED: "bg-purple-100 text-purple-800",
  CRITICAL: "bg-red-100 text-red-800",
  HIGH: "bg-orange-100 text-orange-800",
  MEDIUM: "bg-yellow-100 text-yellow-800",
  LOW: "bg-green-100 text-green-800"
};
const StatusBadge = ({ status }) => {
  const colors = colorMap[status] || "bg-gray-100 text-gray-800";
  return <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${colors}`}>{status.replace(/_/g, " ")}</span>;
};
export default StatusBadge;
