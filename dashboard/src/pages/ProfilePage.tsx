import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../api/client";
import { useProfile, useSaveProfile, useSettings } from "../api/hooks";
import type { Profile } from "../api/types";
import { ErrorBox, Loading } from "../components/ui";

// The API answers 400 with these when the skills YAML is wrong, so the error goes under that field
const isYamlError = (e: unknown) =>
  e instanceof ApiError && e.status === 400 && /yaml|skills/i.test(e.message);

// Edit the text about me and the skills YAML that agents with profile access read
export function ProfilePage() {
  const profile = useProfile();
  const settings = useSettings();
  const save = useSaveProfile();
  const [form, setForm] = useState<Profile | null>(null);

  // Fill the form once the stored profile arrives
  useEffect(() => {
    if (profile.data && form === null) setForm(profile.data);
  }, [profile.data, form]);

  if (profile.isLoading || (!form && !profile.error)) return <Loading />;
  if (profile.error || !form) return <ErrorBox error={profile.error} />;

  const dirty = form.about !== profile.data?.about || form.skills_yaml !== profile.data?.skills_yaml;
  const yamlError = save.isError && isYamlError(save.error) ? save.error.message : null;
  const otherError = save.isError && !yamlError ? save.error : null;

  const edit = (key: keyof Profile, value: string) => {
    setForm({ ...form, [key]: value });
    if (save.isError || save.isSuccess) save.reset();
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate(form);
  };

  return (
    <>
      <div className="mb-6 border-b border-line pb-3">
        <h1 className="text-2xl font-semibold">My profile</h1>
        <p className="text-sm text-muted">
          Read by agents that may read the profile.{" "}
          {settings.data?.profile_local_only === "false"
            ? "Each agent's own setting decides, also for cloud models."
            : "Right now only local models get it, because profile_local_only is on."}{" "}
          <Link to="/settings" className="text-accent hover:underline">
            Change in Settings
          </Link>
        </p>
      </div>

      <form onSubmit={submit} className="space-y-6">
        <div className="card p-4 sm:p-5">
          <label htmlFor="about" className="font-display text-lg font-semibold">
            About me
          </label>
          <p className="mb-2 text-sm text-muted">Free text in Markdown, for example background, what I look for and how I write.</p>
          <textarea
            id="about"
            rows={12}
            className="input leading-relaxed"
            value={form.about}
            onChange={(e) => edit("about", e.target.value)}
          />
        </div>

        <div className="card p-4 sm:p-5">
          <label htmlFor="skills" className="font-display text-lg font-semibold">
            Skills
          </label>
          <p id="skills-hint" className="mb-2 text-sm text-muted">
            YAML with a list called <code className="font-mono text-ink">skills</code>. It is checked when you save.
          </p>
          <textarea
            id="skills"
            rows={16}
            spellCheck={false}
            className={`input font-mono text-xs leading-relaxed ${yamlError ? "border-bad focus:border-bad focus:ring-bad" : ""}`}
            value={form.skills_yaml}
            onChange={(e) => edit("skills_yaml", e.target.value)}
            aria-invalid={!!yamlError}
            aria-describedby={yamlError ? "skills-hint skills-error" : "skills-hint"}
          />
          {yamlError && (
            <div id="skills-error" role="alert" className="mt-2 rounded-md border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">
              <p className="font-semibold">Nothing was saved. Fix the skills and try again.</p>
              <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-xs">{yamlError}</pre>
            </div>
          )}
        </div>

        {otherError && <ErrorBox error={otherError} />}

        <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-3 border-t border-line bg-page/95 px-4 py-3 backdrop-blur">
          <button type="submit" className="btn-primary" disabled={!dirty || save.isPending}>
            {save.isPending ? "Saving…" : "Save profile"}
          </button>
          <button
            type="button"
            className="btn-ghost"
            disabled={!dirty || save.isPending}
            onClick={() => {
              setForm(profile.data!);
              save.reset();
            }}
          >
            Undo changes
          </button>
          <span className="text-sm" aria-live="polite">
            {save.isSuccess && !dirty ? (
              <span className="text-ok">✓ Saved. Agents use it from the next task.</span>
            ) : dirty ? (
              <span className="text-warn">Unsaved changes</span>
            ) : (
              <span className="text-muted">No changes</span>
            )}
          </span>
        </div>
      </form>
    </>
  );
}
