// Registers ts-loader.mjs's resolve/load hooks via Node's module.register()
// API. This file (not ts-loader.mjs itself) is what --import must point at.
import { register } from "node:module";

register("./ts-loader.mjs", import.meta.url);
