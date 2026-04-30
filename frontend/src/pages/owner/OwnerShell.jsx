import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import OwnerNav from "./OwnerNav.jsx";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";
import { getMyRestaurant } from "../../services/restaurantService.js";
import { getOwnerReservations } from "../../services/reservationService.js";
import { getReviewsByRestaurantId } from "../../services/reviewService.js";
import { lazyWithRetry, preloadLazy } from "../../utils/lazyWithRetry.js";

const lazyImports = {
  OwnerProfile: () => import("./OwnerProfile.jsx"),
  OwnerMenu: () => import("./OwnerMenu.jsx"),
  RestaurantTableConfig: () => import("./RestaurantTableConfig.jsx"),
  OwnerEvents: () => import("./OwnerEvents.jsx"),
  OwnerReviews: () => import("./OwnerReviews.jsx"),
  OwnerReservations: () => import("./OwnerReservations.jsx"),
};

const OwnerProfile = lazyWithRetry(lazyImports.OwnerProfile, "pages/owner/OwnerProfile");
const OwnerMenu = lazyWithRetry(lazyImports.OwnerMenu, "pages/owner/OwnerMenu");
const RestaurantTableConfig = lazyWithRetry(lazyImports.RestaurantTableConfig, "pages/owner/RestaurantTableConfig");
const OwnerEvents = lazyWithRetry(lazyImports.OwnerEvents, "pages/owner/OwnerEvents");
const OwnerReviews = lazyWithRetry(lazyImports.OwnerReviews, "pages/owner/OwnerReviews");
const OwnerReservations = lazyWithRetry(lazyImports.OwnerReservations, "pages/owner/OwnerReservations");

const OWNER_SEEN_RESERVATIONS_KEY = "ds-owner-seen-reservation-ids";
const OWNER_SEEN_REVIEWS_KEY = "ds-owner-seen-review-ids";

const TabLoader = () => (
  <div className="placeholderPage">
    <p className="placeholderPage__text">Loading...</p>
  </div>
);

function normalizeReservationId(reservation) {
  return String(reservation?.id ?? "");
}

function normalizeReviewId(review) {
  return String(review?.id ?? "");
}

export default function OwnerShell() {
  const [active, setActive] = useState("profile");
  const [openedTabs, setOpenedTabs] = useState({ profile: true });
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);
  const navigate = useNavigate();
  const { user, logout, loading } = useAuth();
  const [restaurantLogoUrl, setRestaurantLogoUrl] = useState("");
  const [approvalStatus, setApprovalStatus] = useState("");
  const [approvalNotice, setApprovalNotice] = useState("");
  const [unseenReservationCount, setUnseenReservationCount] = useState(0);
  const [unseenReviewCount, setUnseenReviewCount] = useState(0);

  useEffect(() => {
    if (!loading && (!user || user.role !== "owner")) {
      navigate("/", { replace: true });
    }
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!["profile", "menu", "table-config", "events", "reviews", "reservations"].includes(active)) return;
    setOpenedTabs((prev) => {
      if (prev[active]) return prev;
      return { ...prev, [active]: true };
    });
  }, [active]);

  useEffect(() => {
    const runWhenIdle = window.requestIdleCallback || ((callback) => window.setTimeout(callback, 250));
    const cancelIdle = window.cancelIdleCallback || window.clearTimeout;

    const idleId = runWhenIdle(() => {
      preloadLazy(lazyImports.OwnerProfile, "pages/owner/OwnerProfile");
      preloadLazy(lazyImports.OwnerMenu, "pages/owner/OwnerMenu");
      preloadLazy(lazyImports.RestaurantTableConfig, "pages/owner/RestaurantTableConfig");
      preloadLazy(lazyImports.OwnerEvents, "pages/owner/OwnerEvents");
      preloadLazy(lazyImports.OwnerReviews, "pages/owner/OwnerReviews");
      preloadLazy(lazyImports.OwnerReservations, "pages/owner/OwnerReservations");
    });

    return () => cancelIdle(idleId);
  }, []);

  const fetchApprovalStatus = () => {
    if (!user?.id) return;
    getMyRestaurant()
      .then((restaurant) => {
        setApprovalStatus(String(restaurant?.approval_status || ""));
      })
      .catch(() => {
        // keep last known status
      });
  };

  useEffect(() => {
    fetchApprovalStatus();
  }, [user?.id]);

  const isApproved = useMemo(() => approvalStatus === "approved", [approvalStatus]);

  useEffect(() => {
    if (approvalStatus === "pending") {
      setActive("profile");
    }
  }, [approvalStatus]);

  useEffect(() => {
    if (!user?.id || !isApproved) {
      setUnseenReservationCount(0);
      return;
    }

    const storageKey = `${OWNER_SEEN_RESERVATIONS_KEY}:${user.id}`;
    let cancelled = false;

    async function syncReservationBadge(markAllAsSeen = false) {
      try {
        const data = await getOwnerReservations();
        if (cancelled) return;

        const reservations = Array.isArray(data) ? data : [];
        const reservationIds = reservations.map(normalizeReservationId).filter(Boolean);

        if (markAllAsSeen) {
          localStorage.setItem(storageKey, JSON.stringify(reservationIds));
          setUnseenReservationCount(0);
          return;
        }

        const savedRaw = localStorage.getItem(storageKey);

        if (!savedRaw) {
          localStorage.setItem(storageKey, JSON.stringify(reservationIds));
          setUnseenReservationCount(0);
          return;
        }

        let seenIds = [];
        try {
          seenIds = JSON.parse(savedRaw);
        } catch {
          seenIds = [];
        }

        const seenSet = new Set((Array.isArray(seenIds) ? seenIds : []).map(String));
        const unseenCount = reservationIds.filter((id) => !seenSet.has(id)).length;
        setUnseenReservationCount(unseenCount);
      } catch {
        // keep last known count
      }
    }

    if (active === "reservations") {
      syncReservationBadge(true);
      return () => {
        cancelled = true;
      };
    }

    syncReservationBadge(false);

    return () => {
      cancelled = true;
    };
  }, [user?.id, isApproved, active]);

  useEffect(() => {
    if (!user?.id || !isApproved) {
      setUnseenReviewCount(0);
      return;
    }

    const storageKey = `${OWNER_SEEN_REVIEWS_KEY}:${user.id}`;
    let cancelled = false;

    async function syncReviewBadge(markAllAsSeen = false) {
      try {
        const restaurant = await getMyRestaurant();
        if (cancelled || !restaurant?.id) return;

        const data = await getReviewsByRestaurantId(restaurant.id);
        if (cancelled) return;

        const reviews = Array.isArray(data) ? data : [];
        const reviewIds = reviews.map(normalizeReviewId).filter(Boolean);

        if (markAllAsSeen) {
          localStorage.setItem(storageKey, JSON.stringify(reviewIds));
          setUnseenReviewCount(0);
          return;
        }

        const savedRaw = localStorage.getItem(storageKey);

        if (!savedRaw) {
          localStorage.setItem(storageKey, JSON.stringify(reviewIds));
          setUnseenReviewCount(0);
          return;
        }

        let seenIds = [];
        try {
          seenIds = JSON.parse(savedRaw);
        } catch {
          seenIds = [];
        }

        const seenSet = new Set((Array.isArray(seenIds) ? seenIds : []).map(String));
        const unseenCount = reviewIds.filter((id) => !seenSet.has(id)).length;
        setUnseenReviewCount(unseenCount);
      } catch {
        // keep last known count
      }
    }

    if (active === "reviews") {
      syncReviewBadge(true);
      return () => {
        cancelled = true;
      };
    }

    syncReviewBadge(false);

    function onReviewChanged() {
      syncReviewBadge(false);
    }

    window.addEventListener("ds:review-changed", onReviewChanged);

    return () => {
      cancelled = true;
      window.removeEventListener("ds:review-changed", onReviewChanged);
    };
  }, [user?.id, isApproved, active]);

  if (loading) return null;
  if (!user || user.role !== "owner") return null;

  function handleLogout() {
    setConfirmLogoutOpen(false);
    logout();
    navigate("/");
  }

  if (approvalStatus === "pending") {
    return (
      <div className="ownerArea ownerArea--pending">
        <main className="ownerArea__main ownerArea__main--pending">
          <div className="formCard formCard--userProfile ownerPendingCard">
            <div className="formCard__title ownerPendingCard__title">Approval Pending</div>
            <p className="userProfileFormHint ownerPendingCard__text">
              Your restaurant is awaiting admin approval. You can still update your profile and upload your business
              license here while the rest of the owner tools stay locked.
            </p>
          </div>
          <Suspense fallback={<TabLoader />}>
            <OwnerProfile onLogoPreviewChange={setRestaurantLogoUrl} onSaved={fetchApprovalStatus} />
          </Suspense>
        </main>
      </div>
    );
  }

  if (approvalStatus === "rejected") {
    return (
      <div className="ownerArea ownerArea--pending">
        <main className="ownerArea__main ownerArea__main--pending">
          <div className="formCard formCard--userProfile ownerPendingCard">
            <div className="formCard__title ownerPendingCard__title" style={{ color: "#e53e3e" }}>
              Restaurant Rejected
            </div>
            <p className="userProfileFormHint ownerPendingCard__text">
              Your restaurant application has been rejected by the admin. Please contact support for more information.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="ownerArea">
      <OwnerNav
        active={active}
        onChange={(tab) => {
          setApprovalNotice("");
          setActive(tab);
        }}
        avatarSrc={restaurantLogoUrl}
        onLogout={() => setConfirmLogoutOpen(true)}
        isApproved={isApproved}
        unseenReservationCount={unseenReservationCount}
        unseenReviewCount={unseenReviewCount}
      />

      <main className="ownerArea__main">
        {approvalNotice && (
          <div className="formCard__error" style={{ marginBottom: 12 }}>
            {approvalNotice}
          </div>
        )}

        <Suspense fallback={<TabLoader />}>
          {openedTabs.profile && (
            <div style={{ display: active === "profile" ? "block" : "none" }}>
              <OwnerProfile onLogoPreviewChange={setRestaurantLogoUrl} onSaved={fetchApprovalStatus} />
            </div>
          )}

          {openedTabs.menu && (
            <div style={{ display: active === "menu" ? "block" : "none" }}>
              <OwnerMenu />
            </div>
          )}

          {openedTabs["table-config"] && (
            <div style={{ display: active === "table-config" ? "block" : "none" }}>
              <RestaurantTableConfig />
            </div>
          )}

          {openedTabs.events && (
            <div style={{ display: active === "events" ? "block" : "none" }}>
              <OwnerEvents />
            </div>
          )}

          {openedTabs.reviews && (
            <div style={{ display: active === "reviews" ? "block" : "none" }}>
              <OwnerReviews />
            </div>
          )}

          {openedTabs.reservations && (
            <div style={{ display: active === "reservations" ? "block" : "none" }}>
              <OwnerReservations />
            </div>
          )}
        </Suspense>

        {active !== "profile" &&
          active !== "menu" &&
          active !== "table-config" &&
          active !== "events" &&
          active !== "reviews" &&
          active !== "reservations" && (
            <div className="placeholderPage">
              <h1 className="placeholderPage__title">
                {active.charAt(0).toUpperCase() + active.slice(1)}
              </h1>
              <p className="placeholderPage__text">This page will be built next.</p>
            </div>
          )}
      </main>

      <ConfirmDialog
        open={confirmLogoutOpen}
        title="Log out?"
        message="Are you sure you want to log out?"
        confirmLabel="Log Out"
        cancelLabel="Cancel"
        onConfirm={handleLogout}
        onCancel={() => setConfirmLogoutOpen(false)}
      />
    </div>
  );
}
