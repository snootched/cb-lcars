export function createIssues() {
  return { errors: [], warnings: [] };
}
export function err(issues, code, message, ctx) {
  issues.errors.push({ code, message, ctx });
}
export function warn(issues, code, message, ctx) {
  issues.warnings.push({ code, message, ctx });
}
