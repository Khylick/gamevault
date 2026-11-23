import {
  ChartNoAxesCombined,
  FolderClosed,
  LayoutDashboard,
  LibraryBig,
  ListTodo,
  Settings,
  Sparkles,
} from "lucide-react";

export const dashboardLink = { href: "/", label: "Dashboard", icon: LayoutDashboard };

export const sections = [
  {
    slug: "library",
    label: "My Library",
    title: "Ma bibliothèque",
    description: "Tes jeux apparaîtront ici après la synchronisation de ta bibliothèque Steam.",
    icon: LibraryBig,
  },
  {
    slug: "backlog",
    label: "Backlog",
    title: "Backlog",
    description: "Cette section accueillera les jeux que tu veux commencer, reprendre ou terminer.",
    icon: ListTodo,
  },
  {
    slug: "collections",
    label: "Collections",
    title: "Collections",
    description: "Tu pourras créer des collections pour regrouper tes jeux comme tu le souhaites.",
    icon: FolderClosed,
  },
  {
    slug: "analytics",
    label: "Analytics",
    title: "Statistiques",
    description: "Les analyses de tes habitudes de jeu s’appuieront sur l’activité disponible dans GameVault.",
    icon: ChartNoAxesCombined,
  },
  {
    slug: "game-advisor",
    label: "Game Advisor",
    title: "Game Advisor",
    description: "Le conseiller t’aidera à choisir un jeu à partir de ta bibliothèque et de tes préférences.",
    icon: Sparkles,
  },
  {
    slug: "settings",
    label: "Settings",
    title: "Paramètres",
    description: "Tu pourras connecter ton compte Steam et gérer la synchronisation depuis cette section.",
    icon: Settings,
  },
] as const;
