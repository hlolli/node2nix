import fs from "fs";
import path from "path";
import nijs from "nijs";
import * as nix2json from "./nix-to-json.js";
import * as R from "rambda";

import { NixExpression } from "./nix-expression.js";
import { Registry } from "./Registry.js";

export async function jsnix(opts) {
  const { dependencies = [], baseDir } = opts;

  if (!opts.registries || R.isEmpty(opts.registries)) {
    opts.registries = [new Registry("https://registry.npmjs.org")];
  }

  const expr = new NixExpression(opts, baseDir, dependencies);
  await expr.resolveDependencies();

  const nixExpr = nijs.jsToNix(expr, true);
  fs.writeFileSync(path.join(opts.outputDir, "package-lock.nix"), nixExpr);
  console.log(opts, nixExpr);
}
