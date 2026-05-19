import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Layout from "@/components/Layout";
import Index from "./pages/Index.tsx";
import Tournament from "./pages/Tournament.tsx";
import Leaderboard from "./pages/Leaderboard.tsx";
import Events from "./pages/Events.tsx";
import Admin from "./pages/Admin.tsx";
import AdminTournament from "./pages/AdminTournament.tsx";
import AdminAchievements from "./pages/AdminAchievements.tsx";
import Journal from "./pages/Journal.tsx";
import Scan from "./pages/Scan.tsx";
import Profile from "./pages/Profile.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/scan" element={<Scan />} />
            <Route path="/events" element={<Events />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/t/:id" element={<Tournament />} />
            <Route path="/p/:handle" element={<Profile />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/admin/achievements" element={<AdminAchievements />} />
            <Route path="/journal" element={<Journal />} />
            <Route path="/journal/:handle" element={<Journal />} />
            <Route path="/admin/t/:id" element={<AdminTournament />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
