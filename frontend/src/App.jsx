import React, { Suspense, useCallback, useEffect, useState } from "react";
import { Routes, Route, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "./auth/AuthContext.jsx";

import Background from "./components/Background.jsx";
import Nav from "./components/Nav.jsx";
import Hero from "./components/Hero.jsx";
import MobileMenu from "./components/MobileMenu.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { lazyWithRetry, preloadLazy } from "./utils/lazyWithRetry.js";

// Code-split heavy areas — only loaded when the user navigates there
const lazyImports = {
  AuthModal: () => import("./components/AuthModal.jsx"),
  DiscoverCarousel: () => import("./components/DiscoverCarousel.jsx"),
  LandingHighlights: () => import("./components/LandingHighlights.jsx"),
  EventsInviteSection: () => import("./components/EventsInviteSection.jsx"),
  ContactSection: () => import("./components/ContactSection.jsx"),
  OwnerShell: () => import("./pages/owner/OwnerShell.jsx"),
  UserShell: () => import("./pages/User/UserShell.jsx"),
  AdminShell: () => import("./pages/admin/AdminShell.jsx"),
  AdminAccessPage: () => import("./pages/admin/AdminAccessPage.jsx"),
  UserSearch: () => import("./pages/User/UserSearch.jsx"),
  VerifyEmail: () => import("./pages/VerifyEmail.jsx"),
  ResetPasswordPage: () => import("./pages/ResetPasswordPage.jsx"),
};

const AuthModal = lazyWithRetry(lazyImports.AuthModal, "components/AuthModal");
const DiscoverCarousel = lazyWithRetry(lazyImports.DiscoverCarousel, "components/DiscoverCarousel");
const LandingHighlights = lazyWithRetry(lazyImports.LandingHighlights, "components/LandingHighlights");
const EventsInviteSection = lazyWithRetry(lazyImports.EventsInviteSection, "components/EventsInviteSection");
const ContactSection = lazyWithRetry(lazyImports.ContactSection, "components/ContactSection");
const OwnerShell = lazyWithRetry(lazyImports.OwnerShell, "pages/owner/OwnerShell");
const UserShell = lazyWithRetry(lazyImports.UserShell, "pages/User/UserShell");
const AdminShell = lazyWithRetry(lazyImports.AdminShell, "pages/admin/AdminShell");
const AdminAccessPage = lazyWithRetry(lazyImports.AdminAccessPage, "pages/admin/AdminAccessPage");
const UserSearch = lazyWithRetry(lazyImports.UserSearch, "pages/User/UserSearch");
const VerifyEmail = lazyWithRetry(lazyImports.VerifyEmail, "pages/VerifyEmail");
const ResetPasswordPage = lazyWithRetry(lazyImports.ResetPasswordPage, "pages/ResetPasswordPage");

import AdminRoute from "./routes/AdminRoute.jsx";

const PageLoader = () => (
  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
    <div style={{ width: 120, height: 8, borderRadius: 4 }} className="loadingSkeleton" />
  </div>
);

function getAuthenticatedHomePath(user) {
  if (!user) return "";
  if (user.role === "owner") return "/owner/profile";
  if (user.role === "admin") return "/admin/dashboard";
  return "/user";
}

function AppContent() {
  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState("signup");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [landingView, setLandingView] = useState("full");
  const [searchPresetCuisine, setSearchPresetCuisine] = useState("");
  const [searchPresetToken, setSearchPresetToken] = useState(0);

  const { user, loading, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const authenticatedHomePath = getAuthenticatedHomePath(user);

  const openModal = useCallback((nextMode) => {
    setMode(nextMode);
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => setModalOpen(false), []);
  const toggleMode = useCallback(() => {
    setMode((m) => (m === "signup" ? "login" : "signup"));
  }, []);

  const openMobile = useCallback(() => setMobileOpen(true), []);
  const closeMobile = useCallback(() => setMobileOpen(false), []);

  useEffect(() => {
    const runWhenIdle = window.requestIdleCallback || ((callback) => window.setTimeout(callback, 250));
    const cancelIdle = window.cancelIdleCallback || window.clearTimeout;

    const idleId = runWhenIdle(() => {
      preloadLazy(lazyImports.UserSearch, "pages/User/UserSearch");
      preloadLazy(lazyImports.DiscoverCarousel, "components/DiscoverCarousel");

      if (user?.role === "user") preloadLazy(lazyImports.UserShell, "pages/User/UserShell");
      if (user?.role === "owner") preloadLazy(lazyImports.OwnerShell, "pages/owner/OwnerShell");
      if (user?.role === "admin") preloadLazy(lazyImports.AdminShell, "pages/admin/AdminShell");
    });

    return () => cancelIdle(idleId);
  }, [user?.role]);

  const goToSection = useCallback((view, id) => {
    setLandingView(view);
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  useEffect(() => {
    const hash = location.hash?.replace("#", "");
    if (!hash) return;

    const frame = window.requestAnimationFrame(() => {
      if (hash === "search") goToSection("search", "search");
      else if (hash === "discover" || hash === "hero" || hash === "contact") {
        goToSection("full", hash);
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [location.hash, goToSection]);

  useEffect(() => {
    if (loading || !authenticatedHomePath || location.pathname !== "/") return;
    navigate(authenticatedHomePath, { replace: true });
  }, [loading, authenticatedHomePath, location.pathname, navigate]);

  if (!loading && authenticatedHomePath && location.pathname === "/") {
    return <PageLoader />;
  }

  return (
    <>
      <Background />

      <main className="page">
        <section className={`card${landingView === "search" ? " card--searchView" : ""}`} aria-label="DineSmart landing">
          <Nav
            user={user}
            loading={loading}
            onLogout={logout}
            onLogin={() => openModal("login")}
            onSignup={() => openModal("signup")}
            onOpenMobile={openMobile}
            onCloseMobile={closeMobile}
            isMobileOpen={mobileOpen}
            onGoSearch={() => goToSection("search", "search")}
            onGoDiscover={() => goToSection("full", "discover")}
            onGoHero={() => goToSection("full", "hero")}
            onGoContact={() => goToSection("full", "contact")}
          />

          {landingView === "full" && (
            <>
              <section id="hero">
                <Hero onGettingStarted={() => openModal("signup")} />
              </section>

              <Suspense fallback={null}>
                <section id="discover">
                  <DiscoverCarousel
                    onSelectCuisine={(cuisineLabel) => {
                      setSearchPresetCuisine(cuisineLabel);
                      setSearchPresetToken((prev) => prev + 1);
                      goToSection("search", "search");
                    }}
                  />
                </section>

                <LandingHighlights
                  onBookNow={() => openModal("signup")}
                  onAskDiney={() => openModal("signup")}
                  onExploreMap={() => openModal("signup")}
                />

                <section id="events-invite">
                  <EventsInviteSection onJoinEvents={() => openModal("signup")} />
                </section>

                <section id="contact">
                  <ContactSection />
                </section>
              </Suspense>
            </>
          )}

          <section id="search">
            {landingView === "search" && (
              <UserSearch
                isGuest={!user}
                onRequireSignup={() => openModal("signup")}
                onSearchActiveChange={(active) => {
                  if (active) setLandingView("search");
                }}
                initialCuisine={searchPresetCuisine}
                initialCuisineToken={searchPresetToken}
              />
            )}
          </section>
        </section>
      </main>

      <MobileMenu
        isOpen={mobileOpen}
        onClose={closeMobile}
        onLogin={() => {
          closeMobile();
          openModal("login");
        }}
        onSignup={() => {
          closeMobile();
          openModal("signup");
        }}
        onGoHero={() => goToSection("full", "hero")}
        onGoDiscover={() => goToSection("full", "discover")}
        onGoSearch={() => goToSection("search", "search")}
        onGoContact={() => goToSection("full", "contact")}
      />

      {modalOpen && (
        <Suspense fallback={null}>
          <AuthModal
            isOpen={modalOpen}
            mode={mode}
            onClose={closeModal}
            onToggleMode={toggleMode}
          />
        </Suspense>
      )}
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<AppContent />} />

          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          <Route path="/owner/profile" element={<OwnerShell />} />
          <Route path="/owner/*" element={<OwnerShell />} />

          <Route path="/admin/auth" element={<AdminAccessPage />} />
          <Route
            path="/admin/dashboard"
            element={
              <AdminRoute>
                <AdminShell />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/*"
            element={
              <AdminRoute>
                <AdminShell />
              </AdminRoute>
            }
          />

          <Route path="/explore" element={<UserShell initialActive="explore" />} />
          <Route path="/user/profile" element={<UserShell />} />
          <Route path="/user/*" element={<UserShell />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
