import "./global.css";

import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "@/components/Toast";
import NavBar from "@/components/NavBar";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import History from "@/pages/History";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Admin from "@/pages/Admin";
import FaceRegister from "@/pages/FaceRegister";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ToastProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <div className="min-h-screen flex flex-col">
          <NavBar />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/riwayat" element={<History />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/face-register" element={<FaceRegister />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
          <footer className="border-t py-6 text-center text-sm text-zinc-500">
            © {new Date().getFullYear()} AbsensiLokasi
          </footer>
        </div>
      </BrowserRouter>
    </ToastProvider>
  </QueryClientProvider>
);

createRoot(document.getElementById("root")!).render(<App />);
