import typescript from "rollup-plugin-typescript";

export default {
  // input: "src/main.js",
  input: "src/facetrackr.ts",
  output: {
    file: "dist/bundle.js",
    format: "iife",
  },
  plugins: [typescript()],
};
