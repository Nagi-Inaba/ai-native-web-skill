const cell = (value) => String(value ?? "").replace(/\|/gu, "\\|").replace(/\r?\n/gu, " ");

function staticSection(report) {
  const lines = [`## Static findings (${report.findings.length})`, "", `Root: ${report.root} / files scanned: ${report.files}`, ""];
  if (!report.findings.length) return [...lines, "No findings."];
  lines.push("| Location | Rule | Recipe | Certainty | Message |", "| --- | --- | --- | --- | --- |");
  for (const f of report.findings) lines.push(`| ${cell(`${f.file}:${f.line}:${f.column}`)} | ${cell(f.ruleId)} | ${cell(f.recipe ?? "-")} | ${cell(f.certainty)} | ${cell(f.message)} |`);
  return lines;
}

function issueTable(issues) {
  if (!issues.length) return ["No issues."];
  return ["| Check | State | Recipe | Target | Message |", "| --- | --- | --- | --- | --- |", ...issues.map((i) =>
    `| ${cell(i.check)} | ${cell(i.state ?? "base")} | ${cell(i.recipe ?? "-")} | ${cell(i.target)} | ${cell(i.message)} |`)];
}

function tabTable(entries) {
  return ["| Step | Role | Name | Element | Focus indicator |", "| --- | --- | --- | --- | --- |", ...entries.map((e) =>
    `| ${e.step} | ${cell(e.role)} | ${cell(e.name)} | ${cell(e.element)} | ${e.focusIndicator ? "yes" : "no"} |`)];
}

function outlineSection(outline, heading) {
  // A page's accessible text can itself contain Markdown fence characters.
  const longest = Math.max(2, ...[...outline.matchAll(/`+/gu)].map(([run]) => run.length));
  const fence = "`".repeat(longest + 1);
  return [heading, "", `${fence}yaml`, outline, fence];
}

function pageSection(report) {
  const lines = [`## Page: ${cell(report.url)}`, "", `### Browser issues (${report.issues.length})`, "", ...issueTable(report.issues)];
  lines.push("", "### Tab order", "", ...tabTable(report.tab));
  if (report.blockedRequests.length) lines.push("", `Blocked external requests: ${report.blockedRequests.length}`);
  lines.push("", ...outlineSection(report.outline, "### Accessibility tree outline"));
  for (const toggle of report.toggles) {
    for (const note of toggle.notes) lines.push("", `Note (${cell(toggle.selector)}): ${note}`);
    if (!toggle.open) continue;
    lines.push("", `### Toggle state: ${cell(toggle.open.state)}`, "");
    if (toggle.stateLegibility) {
      const { changes } = toggle.stateLegibility;
      const yesNo = (value) => value ? "yes" : "no";
      lines.push(`Visual changed: ${yesNo(changes.visual)} / DOM signals changed: ${yesNo(changes.dom)} / Accessibility tree changed: ${yesNo(changes.accessibility)}`, "");
    }
    lines.push(...issueTable([...toggle.open.issues, ...(toggle.stateLegibility?.issues ?? [])]));
    lines.push("", "#### Tab order", "", ...tabTable(toggle.open.tab));
    lines.push("", ...outlineSection(toggle.open.outline, "#### Accessibility tree outline"));
  }
  return lines;
}

function browserSection(report) {
  return (report.pages ?? [report]).flatMap((page) => [...pageSection(page), ""]);
}

function doctorSection(report) {
  const lines = ["## Environment", "", `Node: ${report.node.version} (requires >=${report.node.minimum}) — ${report.node.ok ? "OK" : "upgrade Node"}`, "", "| Dependency | Result |", "| --- | --- |"];
  for (const dependency of report.dependencies) lines.push(`| ${cell(dependency.name)} | ${dependency.ok ? "OK" : cell(dependency.message)} |`);
  lines.push("", `Chrome (${cell(report.browser.channel)}): ${report.browser.ok ? "OK" : report.browser.message}`);
  return lines;
}

export function toMarkdown(report) {
  const body = report.kind === "static" ? staticSection(report) : report.kind === "doctor" ? doctorSection(report) : browserSection(report);
  return ["# ai-native-web report", "", ...body, ""].join("\n");
}

export function issueCount(report) {
  return report.kind === "static" ? report.findings.length : (report.pages ?? [report]).reduce((count, page) => count + page.issues.length, 0);
}
