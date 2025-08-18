// functions/.eslintrc.cjs
module.exports = {
    root: true,
    env: {node: true, es2022: true},
    extends: ["eslint:recommended"],
    parserOptions: {ecmaVersion: "latest", sourceType: "module"},
    ignorePatterns: [
        "node_modules/",
        "lib/",
        "coverage/",
        ".eslintcache",
        "*.local",
    ],
    rules: {
    // keep or tweak to your taste
        indent: ["error", 4],
        "object-curly-spacing": ["error", "never"],
        "comma-dangle": ["error", "always-multiline"],
    },
};
