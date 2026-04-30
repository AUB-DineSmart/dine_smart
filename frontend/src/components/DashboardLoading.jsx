const DEFAULT_LOADING_MESSAGE = "Loading your dashboard...";

export default function DashboardLoading({ message = DEFAULT_LOADING_MESSAGE, text }) {
  const loadingText = text || message;

  return (
    <div className="placeholderPage userDashboardLoading" aria-live="polite" aria-busy="true">
      <h1 className="placeholderPage__title userDashboardLoading__title" aria-label={loadingText}>
        {loadingText.split("").map((character, index) => (
          <span
            key={`${character}-${index}`}
            className="userDashboardLoading__letter"
            style={{ animationDelay: `${index * 0.045}s` }}
            aria-hidden="true"
          >
            {character === " " ? "\u00a0" : character}
          </span>
        ))}
      </h1>
    </div>
  );
}
