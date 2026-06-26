const TARGET_URL = process.env.HEADERS_VERIFY_URL ?? "https://www.quantivis.io/";

const requiredHeaders = [
  {
    name: "content-security-policy",
    validate: (value) => Boolean(value),
    expected: "present",
  },
  {
    name: "x-frame-options",
    validate: (value) => value?.toLowerCase() === "deny",
    expected: "DENY",
  },
  {
    name: "x-content-type-options",
    validate: (value) => value?.toLowerCase() === "nosniff",
    expected: "nosniff",
  },
  {
    name: "referrer-policy",
    validate: (value) => Boolean(value),
    expected: "present",
  },
  {
    name: "strict-transport-security",
    validate: (value) => Boolean(value),
    expected: "present",
  },
];

async function fetchHeaders() {
  const response = await fetch(TARGET_URL, {
    method: "HEAD",
    redirect: "follow",
  });

  return {
    status: response.status,
    url: response.url,
    headers: response.headers,
  };
}

const result = await fetchHeaders();
const failures = [];

console.log(`Checked: ${result.url}`);
console.log(`HTTP status: ${result.status}`);

for (const requiredHeader of requiredHeaders) {
  const value = result.headers.get(requiredHeader.name);
  const passed = requiredHeader.validate(value);
  const displayedValue = value ?? "<missing>";
  console.log(`${passed ? "PASS" : "FAIL"} ${requiredHeader.name}: ${displayedValue}`);

  if (!passed) {
    failures.push(`${requiredHeader.name} expected ${requiredHeader.expected}, got ${displayedValue}`);
  }
}

if (failures.length > 0) {
  console.error("\nSecurity header verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log("\nSecurity header verification passed.");
}
