/**
 * Forbids the service-role Drizzle client in apps that must stay behind RLS.
 *
 * `createDrizzleSupabaseClient()` returns `{ admin, rls }`. Forgetting the `rls`
 * wrapper does not throw — the query runs with RLS bypassed and quietly returns
 * every applicant's row. Nothing catches that at runtime, so it is caught here.
 *
 * Deliberately fail-closed: any `.admin` member access, `{ admin }` destructure
 * or `admin` named import is reported, without type information to narrow it.
 * @type {import("eslint").Rule.RuleModule}
 */
const noAdminDbClient = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow the service-role database client, which bypasses row level security.",
    },
    schema: [],
    messages: {
      forbidden:
        "The service-role `admin` database client bypasses RLS and is not allowed here. Use `rls(tx => ...)`.",
    },
  },
  create(context) {
    return {
      MemberExpression(node) {
        if (!node.computed && node.property.type === "Identifier" && node.property.name === "admin") {
          context.report({ node: node.property, messageId: "forbidden" });
        }
      },
      "ObjectPattern > Property"(node) {
        if (!node.computed && node.key.type === "Identifier" && node.key.name === "admin") {
          context.report({ node: node.key, messageId: "forbidden" });
        }
      },
      ImportSpecifier(node) {
        if (node.imported.type === "Identifier" && node.imported.name === "admin") {
          context.report({ node, messageId: "forbidden" });
        }
      },
    };
  },
};

/** @type {import("eslint").ESLint.Plugin} */
export default {
  rules: { "no-admin-db-client": noAdminDbClient },
};
