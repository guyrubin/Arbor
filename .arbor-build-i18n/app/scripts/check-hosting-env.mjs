const required = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_APP_ID",
];

const missing = required.filter((key) => !process.env[key]);

if (missing.length) {
  console.error(
    `Missing Firebase client build env for production hosting: ${missing.join(", ")}`
  );
  process.exit(1);
}

console.log("Firebase client build env present.");
