import { Empty } from "../components/ui";

// Placeholder while the pages are built one at a time
export function ComingSoon({ title }: { title: string }) {
  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold">{title}</h1>
      <Empty>This page is still on the anvil.</Empty>
    </>
  );
}
