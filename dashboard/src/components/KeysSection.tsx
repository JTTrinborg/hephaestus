import { useKeys } from "../api/hooks";
import { KeyBadge } from "./ModelsSection";
import { Empty, ErrorBox, Loading, Section } from "./ui";

// Whether each key the platform needs is set in .env. The API only says set or missing, never the value
export function KeysSection() {
  const keys = useKeys();
  const missing = keys.data?.filter((k) => !k.set).length ?? 0;

  return (
    <Section title="Keys">
      <p className="mb-3 text-sm text-muted">
        Keys live in <code className="font-mono">.env</code> and are never shown here.{" "}
        {keys.data && (missing ? `${missing} of ${keys.data.length} missing.` : `All ${keys.data.length} are set.`)}
      </p>
      {keys.isLoading ? (
        <Loading />
      ) : keys.error ? (
        <ErrorBox error={keys.error} />
      ) : keys.data?.length ? (
        <ul className="card divide-y divide-line">
          {keys.data.map((k) => (
            <li key={k.name} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
              <code className="break-all font-mono text-sm">{k.name}</code>
              <KeyBadge set={k.set} />
            </li>
          ))}
        </ul>
      ) : (
        <Empty>No keys are needed.</Empty>
      )}
    </Section>
  );
}
