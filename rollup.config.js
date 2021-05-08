import typescript from "rollup-plugin-typescript";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import json from "@rollup/plugin-json";

export default {
  input: "src/main.ts",
  output: {
    file: "dist/bundle.js",
    sourcemap: true,
    format: "iife",
  },
  plugins: [typescript(), nodeResolve(), json()],
};
