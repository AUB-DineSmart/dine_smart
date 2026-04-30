const DEFAULT_LOADING_TEXT = "Loading your dashboard...";

export default function DashboardLoading({ text = DEFAULT_LOADING_TEXT }) {
  return (
    <div className="placeholderPage userDashboardLoading" aria-live="polite" aria-busy="true">
      <h1 className="placeholderPage__title userDashboardLoading__title" aria-label={text}>
        {text.split("").map((character, index) => (
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
