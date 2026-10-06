export async function axNodeFor(cdp, expression) {
  const { result } = await cdp.send("Runtime.evaluate", { expression });
  if (!result.objectId) return null;
  const { nodes } = await cdp.send("Accessibility.getPartialAXTree", { objectId: result.objectId, fetchRelatives: false });
  const node = nodes[0];
  if (!node) return null;
  const properties = Object.fromEntries((node.properties ?? []).map((p) => [p.name, p.value?.value]));
  return { role: node.role?.value ?? null, name: node.name?.value ?? "", ignored: Boolean(node.ignored), properties };
}

export function focusedAxNode(cdp) {
  return axNodeFor(cdp, "document.activeElement");
}
