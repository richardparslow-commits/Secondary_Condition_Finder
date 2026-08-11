// Reusable Secondary Service Connection Card component
// Supports both blue and gray theme variants

import Link from "next/link";

interface SecondaryServiceConnectionCardProps {
  theme: "blue" | "gray";
}

export function SecondaryServiceConnectionCard({ theme }: SecondaryServiceConnectionCardProps) {
  // Determine content based on theme
  const title = theme === "blue" 
    ? "Secondary Service Connection (Caused By)"
    : "Secondary Service Connection (Via Aggravation)";

  const description = theme === "blue"
    ? "Secondary service connection applies to a condition that may be caused by a service-connected condition—i.e., the condition is directly associated or related to your service-connected disability."
    : "Secondary service connection via aggravation applies to a condition that was permanently worsened by your service-connected condition—i.e., the severity of your condition increased beyond its natural progression due to your service.";

  const cardTheme = theme === "blue" ? "bg-blue-50" : "bg-gray-50";
  const borderTheme = theme === "blue" ? "border-blue-200" : "border-gray-200";

  return (
    <div className="max-w-4xl px-6 mb-8">
      <article className={`rounded-lg border ${borderTheme} ${cardTheme} p-6 shadow-sm`}>
        <h2 className="text-xl font-semibold text-blue-900">{title}</h2>
        <p className="text-sm text-gray-700 mt-2 leading-relaxed">{description}</p>

        <div className="mt-6 flex flex-col items-start gap-4">
          <Link
            href="/secondary/service-connection/wizard/step/1"
            className={`inline-block px-6 py-3 rounded-full ${theme === "blue" ? "bg-red-600" : "bg-green-600"} text-white text-sm font-medium hover:${theme === "blue" ? "bg-red-700" : "bg-green-700"} transition-colors`}
          >
            Click Here to Proceed to Wizard Step 1
          </Link>
        </div>
      </article>
    </div>
  );
}