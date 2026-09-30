const { resolveRoute, validatedLocalities } = require("../lib/localities_router");

const testCases = [
  {
    path: "/sp/guarulhos",
    expected: { isRoot: true, stateSlug: "sp", municipalitySlug: "guarulhos" },
  },
  {
    path: "/sp/guarulhos/logistica",
    expected: { isCategory: true, category: "logistica" },
  },
  {
    path: "/sp/guarulhos/logistica/caas-express",
    expected: { isEntity: true, entityId: "caas-express" },
  },
  {
    path: "/rj/capital",
    expected: null,
  },
  {
    path: "/invalid",
    expected: null,
  },
];

let passed = 0;
testCases.forEach(({ path, expected }, i) => {
  const result = resolveRoute(path);
  const success =
    !result && expected === null ||
    (result && (
      expected.isRoot && result.isRoot ||
      expected.isCategory && result.isCategory ||
      expected.isEntity && result.isEntity ||
      (expected.category && result.category === expected.category) ||
      (expected.entityId && result.entityId === expected.entityId)
    ));

  if (success) {
    passed++;
    console.log(`Test ${i + 1} PASSED: ${path}`);
  } else {
    console.error(`Test ${i + 1} FAILED: ${path}. Got:`, result);
  }
});

if (passed !== testCases.length) {
  process.exit(1);
}
console.log("All routing tests passed!");
