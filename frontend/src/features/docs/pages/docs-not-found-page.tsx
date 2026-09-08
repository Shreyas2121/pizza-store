import { Link } from "react-router";
import { DocsPage } from "../components/docs-page";

export default function DocsNotFoundPage() {
  return <DocsPage title="Page not found" description="This documentation page does not exist. Return to the PizzaStore project overview.">
    <p className="docs-eyebrow mb-5">Documentation / 404</p>
    <h1 className="font-display text-4xl">A page that isn’t here.</h1>
    <p className="my-6 max-w-lg leading-7 text-ink-muted">This link may be out of date. The project overview is a good place to pick up the story.</p>
    <Link to="/docs" className="docs-button">Back to overview</Link>
  </DocsPage>;
}
