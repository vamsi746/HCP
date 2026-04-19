import { Outlet } from "react-router-dom";
import Header from "./Header";
import Dock from "./Sidebar";
const Layout = () => <div className="h-screen flex flex-col"><Header /><main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 bg-[#f0f2f5] flex flex-col min-h-0"><Outlet /></main><Dock /></div>;
export default Layout;
